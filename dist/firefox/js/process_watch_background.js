/* Loaded by background.js; reuses the institutional PJe consultation. */
(() => {
  "use strict";
  const KEY = "CDSP_PROCESS_WATCH_V1";
  const ALARM = "cdsp-process-watch";
  const LAST_CHECK_KEY = "MTPREV_WATCH_LAST_PAGE_CHECK";
  const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000; // Uma rodada automatica a cada 24h, no maximo.
  async function ensureDailyAlarm() {
    if (!chrome.alarms?.create) return;
    const saved = (await chrome.storage.local.get(LAST_CHECK_KEY))[LAST_CHECK_KEY];
    const previous = Number(saved) || 0;
    // Chrome pode suspender o worker ou ser fechado; reconstituir o alarme.
    const when = Math.max(Date.now() + 60000, previous + DAILY_INTERVAL_MS);
    await chrome.alarms.create(ALARM, {when, periodInMinutes: 1440});
  }

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
    ...(result.movements || []).map((m) => ({ key: JSON.stringify(["m", m.date, m.code, m.description, m.linkedDocumentIds]), text: `${m.date || ""} — ${m.description}`, kind:'movement', detail: {date:m.date,code:m.code,description:m.confidentialityLevel && !['0','publico','público','public'].includes(String(m.confidentialityLevel).toLowerCase()) ? 'Movimentação sob sigilo — consulte os autos no PJe.' : m.description} })),
    ...(result.expedientes || []).map((e) => ({ key: JSON.stringify(["e", e.id, e.documentId, e.createdAt, e.awareAt, e.deadlineAt, e.closed, e.manuallyClosedAt, e.responseId]), text: `Expediente ${e.id || ""}: prazo ${e.deadlineAt || "não informado"}; ${e.closed || e.manuallyClosedAt ? "encerrado" : "em aberto"}`, detail: {date:e.createdAt || e.awareAt, description:`Expediente ${e.id || ""}: prazo ${e.deadlineAt || "não informado"}; ${e.closed || e.manuallyClosedAt ? "encerrado" : "em aberto"}`} }))
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
    // Disponibiliza a movimentacao mais recente mesmo na primeira leitura,
    // para o envio manual de teste (sem gerar alerta na primeira consulta).
    if (result.movements?.length) {
      const m = result.movements[0];
      record.latestMovement = {date:String(m.date || ''), code:String(m.code || ''), description: m.confidentialityLevel && !['0','publico','público','public'].includes(String(m.confidentialityLevel).toLowerCase()) ? 'Movimentação sob sigilo — consulte os autos no PJe.' : String(m.description || '').slice(0, 700)};
    }
    if (changes.length) {
      record.unread = true;
      record.history = [{ at: record.checkedAt, items: changes.map((item) => item.text), unread: true }, ...(record.history || [])].slice(0, 30);
    }
    await save(records);
    // A primeira leitura é referência, não gera e-mail. Nas seguintes, apenas
    // mudanças ainda não vistas são elegíveis, com OAuth e consentimento explícitos.
    const newMovements = changes.filter(item => item.kind === 'movement');
    if (newMovements.length && globalThis.MTPrevWatchMail?.notify) {
      try {
        const mail = await globalThis.MTPrevWatchMail.notify(record, newMovements.map(item => item.detail || item.text));
        if (mail?.accepted) {record.emailStatus=`Aceito para envio pelo Gmail (${mail.count} destinatário(s))`;record.emailError='';}
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
      if (now - last < DAILY_INTERVAL_MS && now >= last) return { ok:true, records, skipped:true };
      if (!Object.keys(records).length) return {ok:true,records,skipped:true};
      // Marca antes da consulta: uma unica rodada diaria mesmo em varias abas.
      await chrome.storage.local.set({ [LAST_CHECK_KEY]: now });
      for (const key of Object.keys(records)) await check(records, key);
      await ensureDailyAlarm();
      return { ok:true, records, checked: Object.keys(records).length };
    }
    if (message.action === "checkAll") {
      for (const key of Object.keys(records)) await check(records, key);
      return { ok: true, records };
    }
    // O envio de teste precisa ser uma ação explícita do usuário no SPA.
    if (message.action === 'mailPreview' || message.action === 'mailTest' || message.action === 'mailDraft') {
      if (number && !/^\d{20}$/.test(number)) throw new Error('Número CNJ inválido.');
      let record = number ? records[number] : null;
      if (number && !record) throw new Error('Processo não está em acompanhamento.');
      // O teste geral utiliza a ultima movimentacao disponivel, nao um e-mail vazio.
      if (!number) record = Object.values(records)
        .filter(r => r?.latestMovement?.description || r?.latest?.length)
        .sort((a,b) => String(b.checkedAt || '').localeCompare(String(a.checkedAt || '')))[0] || null;
      if (!record) throw new Error('Nenhuma movimentação salva. Consulte um processo para preparar o teste.');
      if (!globalThis.MTPrevWatchMail) throw new Error('Módulo Gmail indisponível.');
      if (message.action === 'mailDraft') return globalThis.MTPrevWatchMail.draft(record);
      return message.action === 'mailPreview'
        ? globalThis.MTPrevWatchMail.preview(record)
        : globalThis.MTPrevWatchMail.test(record);
    }
    if (!/^\d{20}$/.test(number)) throw new Error("Informe o número CNJ com 20 dígitos.");
    if (message.action === 'spaSnapshot' || message.action === 'spaObserve') {
      const automatic = message.action === 'spaObserve';
      const record=records[number];
      if (!record) throw new Error('Processo não está em acompanhamento. Salve-o primeiro.');
      const mail=message.mail || {};
      const now=Date.now();
      if (automatic && record.spaObservedAt && now-Number(record.spaObservedAt)<DAILY_INTERVAL_MS && now>=Number(record.spaObservedAt))
        return {ok:true,skipped:true};
      const clip=(value,n)=>String(value||'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
      const expedienteId=clip(mail.expedienteId,16);
      // Dados capturados SOMENTE no SPA autorizado; nao sobrescrevem campos manuais.
      if (!record.subject) record.subject=clip(mail.subject,160);
      if (!record.parties) record.parties=clip(mail.parties,240);
      if (!record.expedienteId && /^\d{1,16}$/.test(expedienteId)) record.expedienteId=expedienteId;
      const description=clip(mail.movement?.description,700);
      if (description.length >= 6 && /^(SPA - linha do tempo|SPA - último andamento do card)$/.test(mail.movement?.source || '')) {
        const movement={date:clip(mail.movement.date,32),description,source:mail.movement.source};
        record.spaLatestMovement=movement;
        record.spaCheckedAt=new Date().toISOString();
        if (automatic) {
          const fingerprint=JSON.stringify([movement.source,movement.description,movement.date]);
          const previous=record.spaObservedFingerprint;
          // Mudanca de fonte (card x timeline) pode ser apenas outra apresentacao.
          // PJe ja funcional e prioritario para evitar dois alertas do mesmo movimento.
          const shouldNotify=Boolean(previous && previous!==fingerprint &&
            record.spaObservedSource===movement.source && !(record.initialized && !record.error));
          record.spaObservedAt=now;
          if (shouldNotify && globalThis.MTPrevWatchMail?.notify) {
            try {
              const mailResult=await globalThis.MTPrevWatchMail.notify(record,[movement]);
              if (mailResult?.accepted) {
                record.emailStatus=`SPA: aceito pelo Gmail (${mailResult.count} destinatário(s))`;
                record.emailError='';
              }
              record.spaObservedFingerprint=fingerprint;
            } catch(error) {
              // Nao confirma nova referencia de movimento: pode tentar novamente
              // somente na proxima rodada diaria, se nao houver nova atualizacao.
              record.emailError=String(error?.message||'Falha no alerta SPA').slice(0,220);
            }
          } else record.spaObservedFingerprint=fingerprint;
          record.spaObservedSource=movement.source;
        }
      }
      await save(records);
      return {ok:true,hasMovement:!!record.spaLatestMovement};
    }
    if (message.action === 'saveMail') {
      if (!records[number]) throw new Error('Processo não está em acompanhamento.');
      const parser = globalThis.MTPrevWatchMail?.parseEmails;
      if (!parser) throw new Error('Módulo Gmail indisponível.');
      const mail = message.mail || {};
      records[number].mail = {
        enabled: mail.enabled !== false,
        extra: parser(mail.extra || []),
        excluded: parser(mail.excluded || [])
      };
      // Dados complementares opcionais, informados pelo servidor que acompanha.
      // Nao inventamos partes, assunto ou ID interno a partir do numero CNJ.
      records[number].subject = String(mail.subject || '').replace(/[\x00-\x1f]/g,' ').trim().slice(0,160);
      records[number].parties = String(mail.parties || '').replace(/[\x00-\x1f]/g,' ').trim().slice(0,240);
      const expedienteId = String(mail.expedienteId || '').trim();
      records[number].expedienteId = /^\d{1,16}$/.test(expedienteId) ? expedienteId : '';
      await save(records);
      return {ok:true,records};
    }
    if (message.action === "add") {
      // Salvar um CNJ nao depende de credenciais PJe. A consulta PJe pode
      // falhar, mas o teste manual ainda pode obter dados do SPA autenticado.
      const instance = inferMniPjeEndpoint(number, message.tribunal);
      if (!records[number]) records[number] = { number, tribunal: message.tribunal || "", addedAt: new Date().toISOString(), history: [], seen: [], unread: false };
      await save(records);
      if (instance.error) {
        records[number].error='Consulta PJe indisponível; o teste por SPA continua disponível quando o processo estiver visível.';
        await save(records);
      } else await check(records, number);
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
  // Uma rodada por 24h: alarme enquanto Chrome estiver funcionando e
  // abertura do SPA/startup como recuperacao de eventual alarme perdido.
  chrome.alarms?.onAlarm?.addListener((alarm) => {
    if (alarm.name !== ALARM) return;
    serial(async () => {
      await handle({action:'pageOpened'});
      await ensureDailyAlarm();
    }).catch(() => {});
  });
  const restore = async () => {
    await save(await read());
    await ensureDailyAlarm();
  };
  chrome.runtime.onStartup.addListener(() => serial(async () => {
    await restore();
    await handle({action:'pageOpened'});
  }).catch(() => {}));
  chrome.runtime.onInstalled.addListener(() => serial(async () => {
    await restore();
    await handle({action:'pageOpened'});
  }).catch(() => {}));
  serial(restore).catch(() => {});
})();
