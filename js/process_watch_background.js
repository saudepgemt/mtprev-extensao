/* Loaded by background.js; reuses the institutional PJe consultation. */
(() => {
  "use strict";
  const KEY = "CDSP_PROCESS_WATCH_V1";
  const ALARM = "cdsp-process-watch";
  let queue = Promise.resolve();
  const serial = (fn) => { const result = queue.then(fn); queue = result.catch(() => {}); return result; };
  const read = async () => (await chrome.storage.local.get(KEY))[KEY] || {};
  const save = async (records) => {
    await chrome.storage.local.set({ [KEY]: records });
    const count = Object.values(records).filter((r) => r.unread).length;
    await chrome.action.setBadgeText({ text: count ? String(count) : "" });
    await chrome.action.setBadgeBackgroundColor({ color: "#b45309" });
  };
  // Movement IDs may be positional in the source: use content to avoid false alerts.
  const snapshot = (result) => [
    ...result.movements.map((m) => ({ key: JSON.stringify(["m", m.date, m.code, m.description, m.linkedDocumentIds]), text: `${m.date || ""} — ${m.description}` })),
    ...result.expedientes.map((e) => ({ key: JSON.stringify(["e", e.id, e.documentId, e.createdAt, e.awareAt, e.deadlineAt, e.closed, e.manuallyClosedAt, e.responseId]), text: `Expediente ${e.id || ""}: prazo ${e.deadlineAt || "não informado"}; ${e.closed || e.manuallyClosedAt ? "encerrado" : "em aberto"}` }))
  ];
  async function check(records, number) {
    const record = records[number];
    record.attemptedAt = new Date().toISOString();
    const result = await fetchMniProcedureMovements({ processNumber: number, tribunal: record.tribunal });
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
      record.history = [{ at: record.checkedAt, items: changes.map((item) => item.text) }, ...(record.history || [])].slice(0, 30);
    }
    await save(records);
    if (changes.length && chrome.notifications) {
      try { await chrome.notifications.create(`cdsp-watch-${number}`, { type: "basic", iconUrl: "images/icon-mtprev128.png", title: "Processo acompanhado: nova alteração", message: `${number}: ${changes.length} alteração(ões). Confira em Acompanhar processos.` }); } catch (_) { /* Panel and badge retain the alert. */ }
    }
  }
  async function handle(message) {
    const records = await read();
    const number = String(message.processNumber || "").replace(/\D/g, "");
    if (message.action === "list") return { ok: true, records };
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
    else if (message.action === "read" && records[number]) { records[number].unread = false; await save(records); }
    else if (message.action === "check" && records[number]) await check(records, number);
    else throw new Error("Acompanhamento não encontrado.");
    return { ok: true, records };
  }
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (message?.type !== "CDSP_PROCESS_WATCH") return false;
    if (!normalizeAllowedUrl(sender.tab?.url)) { reply({ ok: false, error: "Origem não permitida." }); return false; }
    serial(() => handle(message)).then(reply, (error) => reply({ ok: false, error: error.message }));
    return true;
  });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) serial(() => handle({ action: "checkAll" })).catch(() => {});
  });
  const restore = async () => {
    if (!(await chrome.alarms.get(ALARM))) await chrome.alarms.create(ALARM, { periodInMinutes: 30, delayInMinutes: 1 });
    await save(await read());
  };
  chrome.runtime.onStartup.addListener(() => serial(restore).catch(() => {}));
  chrome.runtime.onInstalled.addListener(() => serial(restore).catch(() => {}));
  serial(restore).catch(() => {});
})();
