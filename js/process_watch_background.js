/* Loaded by background.js; reuses the institutional PJe consultation. */
(() => {
  "use strict";
  const KEY = "CDSP_PROCESS_WATCH_V1";
  const ALARM = "cdsp-process-watch";
  const LAST_CHECK_KEY = "MTPREV_WATCH_LAST_PAGE_CHECK";
  const MIN_PAGE_INTERVAL_MS = 120000; // Uma unica checagem entre abas abertas num intervalo curto.

  let queue = Promise.resolve();
  const serial = (fn) => { const result = queue.then(fn); queue = result.catch(() => {}); return result; };
  const read = async () => (await chrome.storage.local.get(KEY))[KEY] || {};
  const save = async (records) => {
    await chrome.storage.local.set({ [KEY]: records });
    const count = Object.values(records).filter((r) => r.unread).length;
    await chrome.action.setBadgeText({ text: count ? String(count) : "" });
    await chrome.action.setBadgeBackgroundColor({ color: "#c92e48" });
  };
  // Movement IDs may be positional in the source: use content to avoid false alerts.
  const snapshot = (result) => [
    ...(result.movements || []).map((m) => ({ key: JSON.stringify(["m", m.date, m.code, m.description, m.linkedDocumentIds]), text: `${m.date || ""} — ${m.description}` })),
    ...(result.expedientes || []).map((e) => ({ key: JSON.stringify(["e", e.id, e.documentId, e.createdAt, e.awareAt, e.deadlineAt, e.closed, e.manuallyClosedAt, e.responseId]), text: `Expediente ${e.id || ""}: prazo ${e.deadlineAt || "não informado"}; ${e.closed || e.manuallyClosedAt ? "encerrado" : "em aberto"}` }))
  ];
  async function check(records, number) {
    const record = records[number];
    record.attemptedAt = new Date().toISOString();
    let result;
    try {
      result = await fetchMniProcedureMovements({ processNumber: number, tribunal: record.tribunal });
    } catch (_) {
      result = { ok: false, error: "Não foi possível conectar ao PJe. Confira a configuração da consulta e tente novamente." };
    }
    if (!result.ok) { record.error = result.error || "Consulta indisponível"; await save(records); return; }
    const current = snapshot(result);
    const seen = new Set(record.seen || []);
    const changes = record.initialized ? current.filter((item) => !seen.has(item.key)) : [];
    record.seen = [...new Set([...seen, ...current.map((item) => item.key)])];
    record.initialized = true;
    record.checkedAt = result.fetchedAt || new Date().toISOString();
    record.error = "";
    record.latest = current.slice(0, 8).map((item) => item.text);
    if (changes.length) {
      record.unread = true;
      record.history = [{ at: record.checkedAt, items: changes.map((item) => item.text), unread: true }, ...(record.history || [])].slice(0, 30);
    }
    await save(records);
    // A primeira leitura é referência, não gera e-mail. Nas seguintes, apenas
    // mudanças ainda não vistas são elegíveis, com OAuth e consentimento explícitos.
    if (changes.length && globalThis.MTPrevWatchMail?.notify) {
      try {
        const mail = await globalThis.MTPrevWatchMail.notify(record, changes.map(item => item.text));
        if (mail?.accepted) {record.emailStatus='Aceito para envio pelo Microsoft Graph';record.emailError='';}
        else if (mail?.skipped) {record.emailStatus='';}
      } catch (error) {
        record.emailError = String(error?.message||'Falha no alerta por e-mail').slice(0,220);
      }
      await save(records);
    }
    if (changes.length && chrome.notifications) {
      try { await chrome.notifications.create(`cdsp-watch-${number}`, { type: "basic", iconUrl: "images/icon-mtprev128.png", title: "Processo acompanhado: nova alteração", message: `${number}: ${changes.length} alteração(ões). Confira em Acompanhar processos.` }); } catch (_) { /* Panel and badge retain the alert. */ }
    }
  }
  async function handle(message) {
    const records = await read();
    const number = String(message.processNumber || "").replace(/\D/g, "");
    if (message.action === "list") return { ok: true, records };
    if (message.action === "pageOpened") {
      const previous = (await chrome.storage.local.get(LAST_CHECK_KEY))[LAST_CHECK_KEY];
      const last = Number(previous) || 0;
      const now = Date.now();
      if (now - last < MIN_PAGE_INTERVAL_MS && now >= last) return { ok:true, records, skipped:true };
      // Marca antes das consultas: diversas abas nao criam rajadas simultaneas.
      await chrome.storage.local.set({ [LAST_CHECK_KEY]: now });
      for (const key of Object.keys(records)) await check(records, key);
      return { ok:true, records, checked: Object.keys(records).length };
    }
    if (message.action === "checkAll") {
      for (const key of Object.keys(records)) await check(records, key);
      return { ok: true, records };
    }
    if (!/^\d{20}$/.test(number)) throw new Error("Informe o número CNJ com 20 dígitos.");
    if (message.action === "add") {
      const instance = inferMniPjeEndpoint(number, message.tribunal);
      if (instance.error) throw new Error(instance.error);
      if (!records[number]) records[number] = { number, tribunal: message.tribunal || "", addedAt: new Date().toISOString(), history: [], seen: [], unread: false };
      await save(records);
      await check(records, number);
    } else if (message.action === "remove") { delete records[number]; await save(records); }
    else if (message.action === "read" && records[number]) {
      records[number].unread = false;
      records[number].history = (records[number].history || []).map((entry) => ({ ...entry, unread: false }));
      await save(records);
    }
    else if (message.action === "check" && records[number]) await check(records, number);
    else throw new Error("Acompanhamento não encontrado.");
    return { ok: true, records };
  }
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.type !== "CDSP_PROCESS_WATCH") return false;
    if (!normalizeAllowedUrl(sender.tab?.url)) { reply({ ok: false, error: "Origem não permitida." }); return false; }
    // A lista usa o último estado salvo, sem esperar consultas de rede pendentes.
    const operation = message.action === "list" ? handle(message) : serial(() => handle(message));
    operation.then(reply, (error) => reply({ ok: false, error: error.message }));
    return true;
  });
  // A consulta agora e iniciada pelo content script ao abrir o SPA.
  // Retira o alarme legado para impedir consultas de meia em meia hora.
  const restore = async () => {
    if (chrome.alarms?.clear) await chrome.alarms.clear(ALARM);
    await save(await read());
  };
  chrome.runtime.onStartup.addListener(() => serial(restore).catch(() => {}));
  chrome.runtime.onInstalled.addListener(() => serial(restore).catch(() => {}));
  serial(restore).catch(() => {});
})();
