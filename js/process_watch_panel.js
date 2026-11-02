(() => {
  "use strict";
  const KEY = "CDSP_PROCESS_WATCH_V1";
  const POSITION_KEY = "CDSP_PROCESS_WATCH_POSITION_V2";
  const MAIL_CONFIG_KEY = "MTPREV_WATCH_GMAIL_CONFIG_V1";
  let panel = null;
  let dockedFullAutos = null;
  function restoreFullAutos() {
    if (!dockedFullAutos) return;
    const { viewer, marker } = dockedFullAutos;
    dockedFullAutos = null;
    if (!viewer) return;
    delete viewer.dataset.mtprevWatchDocked;
    if (marker?.parentNode) marker.replaceWith(viewer);
    else document.querySelector('.workspace-preview__document[data-procedure-id]')?.appendChild(viewer);
  }
  let busy = false;
  let renderVersion = 0;
  const element = (tag, text, parent, className) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  };
  const formatDate = (value) => {
    if (!value) return "Ainda não realizada";
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d.toLocaleString("pt-BR") : "Não informada";
  };
  const cleanNumber = (value) => String(value || "").replace(/\D/g, "");
  const displayNumber = (value) => {
    const digits = cleanNumber(value);
    return digits.length === 20 ? digits.replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/, "$1-$2.$3.$4.$5.$6") : String(value || "");
  };
  const unreadHistory = (entry, record, index) => entry?.unread === true || (record.unread && index === 0 && entry?.unread !== false);
  async function request(action, processNumber, tribunal) {
    const result = await chrome.runtime.sendMessage({ type: "CDSP_PROCESS_WATCH", action, processNumber, tribunal });
    if (!result?.ok) throw new Error(result?.error || "Não foi possível acessar a extensão. Recarregue a página.");
    return result.records || {};
  }
  const emailRegex = /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/;
  const parseEmails = value => {
    const entries = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/);
    const emails = [...new Set(entries.map(entry => String(entry).trim().toLowerCase()).filter(Boolean))];
    for (const address of emails) if (!emailRegex.test(address) || address.length > 254) throw new Error('E-mail inválido: ' + address.slice(0, 80));
    if (emails.length > 40) throw new Error('Máximo de 40 e-mails por grupo.');
    return emails;
  };
  async function mailRequest(action, processNumber, mail) {
    const result = await chrome.runtime.sendMessage({type:'CDSP_PROCESS_WATCH',action,processNumber,mail});
    if (!result?.ok) throw new Error(result?.error || 'Falha na configuração de e-mails.');
    return result;
  }
  // O SPA e a extensao partilham este DOM (isolated world), sem acessar tokens ou
  // criar rotas de API supostas. Uma leitura local e voluntaria nunca dispara email.
  function spaRecordFor(number = '') {
    const required = cleanNumber(number);
    const adapter = window.SpaAdapter;
    const previews = adapter?.workspacePreviewRecords?.() || [];
    const cards = adapter?.workspaceRecords?.() || [];
    const candidates = [...previews, ...cards];
    let match = candidates.find(row => cleanNumber(row.processNumber) === required && required.length === 20);
    if (!match && !required) match = candidates.find(row => cleanNumber(row.processNumber).length === 20);
    if (!match) {
      const ctx = required && findCurrentSpaContext(required);
      if (ctx?.matching) match = { processNumber:required, expedienteId:ctx.id };
    }
    if (!match) return null;
    const cnj = cleanNumber(match.processNumber);
    if (cnj.length !== 20 || (required && cnj !== required)) return null;
    const preview = findCurrentSpaContext(cnj);
    const root = preview.matching
      ? document.querySelector('.workspace-preview__document[data-procedure-id]') || document.querySelector('.procedure-header')
      : null;
    const fieldText = (labels) => {
      for (const field of root?.querySelectorAll('.workspace-preview__field') || []) {
        const key = (field.querySelector('small')?.textContent || '').toLowerCase();
        if (labels.some(label => key.includes(label))) return (field.querySelector('[data-copy-value]')?.getAttribute('data-copy-value') || field.querySelector('strong')?.textContent || '').trim();
      }
      return '';
    };
    const rawTimeline = preview.matching ? preview.timeline : '';
    let timeline = '';
    try {
      const url = new URL(rawTimeline, location.origin);
      if (rawTimeline && url.protocol === 'https:' && url.origin === location.origin && /^\/workspace\/processes\/\d+\/timeline\/?$/.test(url.pathname)) timeline = url.href;
    } catch (_) { /* Sem timeline oferecida pela interface atual. */ }
    return {number:cnj,subject: match.assunto || fieldText(['assunto']),
      parties: match.party || fieldText(['parte(s) ativa', 'partes ativas', 'polo ativo']),
      expedienteId: String(match.expedienteId || preview.id || '').replace(/\D/g,''),
      lastProgress: String(match.lastProgress || '').trim(), timeline};
  }
  async function readSpaMovement(info) {
    if (info.timeline) {
      try {
        const controller = new AbortController();
        const stop = setTimeout(() => controller.abort(), 12000);
        let response;
        try { response = await fetch(info.timeline, {credentials:'same-origin',headers:{Accept:'application/json, text/html'},signal:controller.signal}); }
        finally { clearTimeout(stop); }
        if (response.ok) {
          const raw = (await response.text()).slice(0, 1600000);
          let html = raw;
          if (/^\s*\{/.test(raw)) {const data=JSON.parse(raw);html=typeof data.html==='string'?data.html:'';}
          if (html) {
            const doc = new DOMParser().parseFromString(html,'text/html');
            doc.querySelectorAll('script,style,iframe,form,nav').forEach(n => n.remove());
            const items = [...doc.querySelectorAll('.workspace-preview__timeline-item,.timeline-item,.timeline__item,.timeline-entry')];
            const candidates=items.map(n => ({
              description:(n.textContent || '').replace(/\s+/g,' ').trim(),
              at:Date.parse(n.querySelector('time[datetime]')?.getAttribute('datetime') || n.getAttribute('datetime') || '') || 0
            })).filter(entry => entry.description.length>=8 && entry.description.length<=900);
            // Somente classificar por data quando o SPA fornece datas estruturadas.
            if (candidates.some(entry => entry.at)) candidates.sort((a,b) => b.at-a.at);
            const latest=candidates[0];
            if (latest) return {description:latest.description,source:'SPA - linha do tempo',
              date:latest.at ? new Date(latest.at).toISOString() : ''};
          }
        }
      } catch (_) { /* Continua para o ultimo andamento do card visivel. */ }
    }
    const text = info.lastProgress.replace(/\s+/g, ' ').trim();
    // O campo "Último andamento" e um resumo da lista e nao toda a timeline.
    return text.length >= 6 && text.length <= 900 ? {description:text,source:'SPA - último andamento do card'} : null;
  }
  async function syncSpaForMail(number, onStep = () => {}) {
    let chosen = number;
    if (!chosen) {
      // O teste geral so pode selecionar processos realmente acompanhados,
      // nunca um card aleatorio entre os centenas da mesa do SPA.
      const result = await mailRequest('list','');
      const tracked = Object.keys(result.records || {});
      const available = tracked.map(cnj => spaRecordFor(cnj)).filter(Boolean);
      const matching = available.find(entry => entry.timeline || entry.lastProgress) || available[0];
      if (!matching) return {found:false};
      chosen = matching.number;
    }
    const info = spaRecordFor(chosen);
    if (!info) return {found:false};
    onStep('Lendo dados do expediente no SPA…', 18);
    const movement = await readSpaMovement(info);
    const result = await mailRequest('spaSnapshot',info.number,{
      subject:String(info.subject || '').slice(0,160),parties:String(info.parties || '').slice(0,240),
      expedienteId:info.expedienteId, movement
    });
    return {found:true,hasMovement:!!movement,number:info.number,source:movement?.source || '',result};
  }
  // Alternativa ao PJe na mesa SPA: observa SOMENTE processos acompanhados
  // cujos cards estao carregados. O worker aplica o limite de 24 horas.
  async function observeVisibleSpaProcesses() {
    if (!/^\/workspace\/?$/.test(location.pathname) && !/^\/procedures\/\d+(?:\/|$)/.test(location.pathname)) return;
    const list=await mailRequest('list','');
    const tracked=Object.keys(list.records||{}).filter(cnj => /^\d{20}$/.test(cnj));
    for (const cnj of tracked.slice(0,80)) {
      const info=spaRecordFor(cnj);
      if (!info) continue;
      const movement=await readSpaMovement(info);
      if (!movement) continue;
      try {
        await mailRequest('spaObserve',cnj,{subject:String(info.subject||'').slice(0,160),
          parties:String(info.parties||'').slice(0,240),expedienteId:info.expedienteId,movement});
      } catch (_) { /* A consulta PJe e as demais observacoes prosseguem. */ }
    }
  }
  function makeMailProgress(container) {
    const wrapper=element('div','',container,'cdsp-watch-send-progress');
    wrapper.hidden=true;
    const status=element('div','',wrapper,'cdsp-watch-send-caption');
    status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const bar=element('progress','',wrapper,'cdsp-watch-send-bar');
    bar.max=100;bar.value=0;
    return (message, value, state='running') => {
      wrapper.hidden=false;
      wrapper.dataset.state=state;
      status.textContent=message;
      if (value === null) bar.removeAttribute('value');
      else bar.value=value;
    };
  }
  async function confirmTest(processNumber, progress = () => {}) {
    progress('Procurando a última movimentação no SPA…', 8);
    const spa = await syncSpaForMail(processNumber,progress);
    progress('Conferindo autorização e destinatários…', 45);
    const preview = await mailRequest('mailPreview', processNumber || spa.number || '');
    if (!preview.clientReady) throw new Error('Client ID OAuth não configurado em manifest.json. Abra as opções da extensão.');
    if (!preview.consent) throw new Error('Autorize a transmissão de dados pela Gmail API nas Opções da extensão.');
    if (!preview.recipients.length) throw new Error('Nenhum destinatário configurado para o processo. Cadastre e salve os e-mails antes de testar.');
    if (!preview.movementAvailable) throw new Error(spa.found
      ? 'O SPA mostrou o processo, mas não disponibilizou uma movimentação legível. Abra o expediente e sua linha do tempo no SPA, depois tente novamente.'
      : 'Não há movimentação salva. Abra o expediente ou um card do processo na mesa do SPA e tente novamente. O PJe não é obrigatório para este teste.');
    progress('Confira o processo e autorize o envio…', 65);
    if (!window.confirm(`Enviar TESTE da ÚLTIMA MOVIMENTAÇÃO do processo ${displayNumber(preview.processNumber)} pelo Gmail ${preview.sender || '(não configurado)'} para:\n\n${preview.recipients.join('\n')}\n\nAssunto: ${preview.subject}\n\nConfirma?`)) {
      progress('Envio cancelado. Nenhuma mensagem foi enviada.',0,'idle');return null;
    }
    progress('Enviando pela Gmail API…',null);
    const result = await mailRequest('mailTest',preview.processNumber);
    progress(result.message || 'Gmail API aceitou a mensagem de teste.',100,'success');
    return result;
  }
  function formLabel(text, parent, control) {
    const label = element('label', text, parent, 'cdsp-watch-mail-label');
    if (control) label.htmlFor = control.id;
    return label;
  }
  function button(text, parent, fn, className) {
    const node = element("button", text, parent, className || "cdsp-watch-button");
    node.type = "button";
    if (fn) node.addEventListener("click", async () => {
      if (fn === close) { close(); return; }
      if (busy) return;
      busy = true;
      node.disabled = true;
      const status = panel?.querySelector(".cdsp-watch-status");
      if (status) { status.textContent = "Consultando…"; status.dataset.tone = ""; }
      try { await fn(); }
      catch (error) {
        if (status) { status.textContent = error?.message || "Falha na consulta."; status.dataset.tone = "error"; }
      }
      finally { busy = false; node.disabled = false; }
    });
    return node;
  }
  function viewportClamp(left, top) {
    const width = panel?.offsetWidth || 0;
    const height = panel?.offsetHeight || 0;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    return {
      left: Math.max(8, Math.min(left, Math.max(8, vw - width - 8))),
      top: Math.max(8, Math.min(top, Math.max(8, vh - height - 8)))
    };
  }
  function positionPanel() {
    if (!panel || panel.hidden) return;
    let position;
    try { position = JSON.parse(localStorage.getItem(POSITION_KEY) || "null"); } catch (_) { /* no saved position */ }
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const defaultLeft = Math.max(8, (vw - panel.offsetWidth) / 2);
    const safe = viewportClamp(Number.isFinite(position?.left) ? position.left : defaultLeft,
      Number.isFinite(position?.top) ? position.top : 72);
    panel.style.left = `${safe.left}px`;
    panel.style.top = `${safe.top}px`;
    panel.style.right = "auto";
  }
  function makeDraggable(header) {
    let drag = null;
    header.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button, a, input, select") || drag) return;
      const rect = panel.getBoundingClientRect();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      header.setPointerCapture?.(event.pointerId);
      header.classList.add("is-dragging");
    });
    header.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const next = viewportClamp(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
      panel.style.left = `${next.left}px`;
      panel.style.top = `${next.top}px`;
    });
    const stop = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      drag = null;
      header.classList.remove("is-dragging");
      const rect = panel.getBoundingClientRect();
      try { localStorage.setItem(POSITION_KEY, JSON.stringify({ left: rect.left, top: rect.top })); } catch (_) { /* storage optional */ }
      if (header.hasPointerCapture?.(event.pointerId)) header.releasePointerCapture(event.pointerId);
    };
    header.addEventListener("pointerup", stop);
    header.addEventListener("pointercancel", stop);
    header.addEventListener("lostpointercapture", stop);
  }
  function line(tag, value, parent, cls) { return element(tag, value, parent, cls); }
  function addMovementList(entries, parent, highlight) {
    const list = element("ul", "", parent, "cdsp-watch-movements");
    if (highlight) list.classList.add("is-unread");
    for (const text of entries || []) {
      const item = element("li", String(text), list);
      if (highlight) item.classList.add("is-unread");
    }
    return list;
  }
  function findCurrentSpaContext(cnjDigits) {
    const preview = document.querySelector('.workspace-preview__document[data-procedure-id]');
    const field = preview && [...preview.querySelectorAll('.workspace-preview__field')].find((node) =>
      /n[uú]mero do processo/i.test(node.querySelector('small')?.textContent || ''));
    const displayed = field?.querySelector('[data-copy-value]')?.getAttribute('data-copy-value') || field?.querySelector('strong')?.textContent || '';
    const current = cleanNumber(displayed);
    if (preview && current === cnjDigits) {
      return {
        id: preview.getAttribute('data-procedure-id'),
        timeline: preview.querySelector('[data-workspace-preview-panel="timeline"][data-timeline-url]')?.getAttribute('data-timeline-url') || '',
        matching: true
      };
    }
    if (/^\/procedures\/\d+\/?$/.test(location.pathname) &&
        (document.querySelector('.workspace-preview__document') || document.querySelector('.procedure-header'))) {
      const match = location.pathname.match(/\/procedures\/(\d+)/);
      const header = [...document.querySelectorAll('.workspace-preview__field')].find((node) =>
        /n[uú]mero do processo/i.test(node.querySelector('small')?.textContent || ''));
      const value = header?.querySelector('strong')?.textContent || '';
      return { id: match?.[1] || '', timeline: document.querySelector('[data-timeline-url]')?.getAttribute('data-timeline-url') || '',
        matching: cleanNumber(value) === cnjDigits };
    }
    return { matching: false, timeline: '' };
  }
  // Cada card tem um leitor independente. Somente o expediente que estiver
  // efetivamente aberto no SPA pode receber a instancia real de Autos/PDFs.
  // Nao duplicar IDs nem reutilizar uma instancia em varios processos.
  function createProcessSourceViewer(record, parent) {
    const cnj = cleanNumber(record.number);
    const ctx = findCurrentSpaContext(cnj);
    const full = document.getElementById('spa-cdsp-external-docs-panel');
    const canUseFull = Boolean(ctx.matching && full && cleanNumber(full.dataset.processNumber) === cnj);
    const slot = element('div', '', parent, 'cdsp-watch-source-slot');
    if (canUseFull && (!dockedFullAutos || dockedFullAutos.viewer === full)) {
      const marker = document.createComment('MTPrev: retorno do leitor completo de Autos');
      full.parentNode.insertBefore(marker, full);
      full.dataset.mtprevWatchDocked = '1';
      full.classList.remove('spa-cdsp-external-docs-collapsed');
      slot.appendChild(full);
      dockedFullAutos = {viewer:full,marker};
      return slot;
    }
    // Sem ID interno conhecido, mostrar painel proprio baseado no historico
    // persistido do PJe. A ausencia do expediente nao esconde a interface.
    const reader = element('section', '', slot, 'cdsp-watch-autos cdsp-watch-autos--standalone');
    const header = element('div', '', reader, 'cdsp-watch-autos-nav');
    const heading = element('div', 'Autos e andamentos', header, 'cdsp-watch-autos-heading');
    heading.title = `Processo ${displayNumber(record.number)}`;
    const tabs = element('div', '', header, 'cdsp-watch-source-tabs');
    const content = element('div', '', reader, 'cdsp-watch-autos-body');
    const activeButtons = new Map();
    const searchUrl = new URL('/procedures/search?gq=' + encodeURIComponent(displayNumber(record.number)), location.origin).href;
    const link = (label, href) => {
      const node = element('a', label, content, 'cdsp-watch-autos-link');
      node.href = href; node.target = '_blank'; node.rel = 'noopener noreferrer';
      return node;
    };
    function show(tab) {
      for (const [key, button] of activeButtons) button.setAttribute('aria-pressed', String(key === tab));
      content.replaceChildren();
      if (tab === 'pje') {
        element('p', `Última consulta PJe: ${formatDate(record.checkedAt)}`, content, 'cdsp-watch-autos-muted');
        if (record.error) element('p', 'Consulta indisponível. Os últimos andamentos salvos continuam acessíveis.', content, 'cdsp-watch-autos-warning');
        const latest = record.latest || [];
        if (latest.length) addMovementList(latest, content, false);
        else element('p', 'Nenhum andamento salvo. Configure a conexão PJe e use Verificar agora.', content, 'cdsp-watch-autos-muted');
        if ((record.history || []).length) {
          const hist = element('details', '', content, 'cdsp-watch-autos-history');
          element('summary', `Movimentações detectadas (${record.history.length})`, hist);
          for (const entry of record.history) {
            element('strong', formatDate(entry.at), hist);
            addMovementList(entry.items || [], hist, Boolean(entry.unread));
          }
        }
      } else {
        element('p', tab === 'spa'
          ? 'Para carregar os andamentos administrativos, abra o expediente deste CNJ no SPA.'
          : 'Autos e PDFs dependem do ID do expediente aberto no SPA. Um mesmo CNJ pode ter vários expedientes.',
        content, 'cdsp-watch-autos-muted');
        link('Localizar expediente no SPA', searchUrl);
      }
    }
    for (const [key, label] of [['pje','Andamento PJe'],['spa','Andamentos SPA'],['autos','Autos e PDFs']]) {
      const btn = element('button', label, tabs, 'cdsp-watch-autos-tab');
      btn.type = 'button'; btn.addEventListener('click', () => show(key));
      activeButtons.set(key,btn);
    }
    show('pje');
    return slot;
  }

  function makeRecordCard(record, parent, wasOpen) {
    const card = element("details", "", parent, "cdsp-watch-card");
    card.dataset.processNumber = cleanNumber(record.number);
    if (record.unread) card.classList.add("has-unread");
    if (wasOpen) card.open = true;
    const summary = element("summary", "", card, "cdsp-watch-card-summary");
    const label = element("span", "", summary, "cdsp-watch-card-title");
    element("strong", displayNumber(record.number), label);
    element("small", `Última consulta: ${formatDate(record.checkedAt || record.spaCheckedAt)}`, label);
    if (record.unread) {
      const count = (record.history?.[0]?.items || []).length;
      element("span", count > 0 ? `${count} nova(s)` : "Novidade", summary, "cdsp-watch-pill cdsp-watch-pill--unread");
    } else if (record.error) element("span", "Erro de consulta", summary, "cdsp-watch-pill cdsp-watch-pill--error");
    else element("span", record.initialized ? "Em acompanhamento" : "Aguardando referência", summary, "cdsp-watch-pill");
    element("span", "▾", summary, "cdsp-watch-chevron").setAttribute("aria-hidden", "true");
    const body = element("div", "", card, "cdsp-watch-card-body");
    if (record.error) element("p", `Falha na última consulta: ${record.error}. Os dados anteriores foram preservados.`, body, "cdsp-watch-message is-error");
    if (record.emailError) element('p', `Alerta por e-mail: ${record.emailError}`, body, 'cdsp-watch-message is-error');
    else if (record.emailStatus) element('p', `E-mail: ${record.emailStatus}.`, body, 'cdsp-watch-message');
    if (!record.initialized) element("p", "Aguardando a primeira consulta bem-sucedida para criar a referência.", body, "cdsp-watch-message");
    // Leitor criado sob demanda, com novas tentativas locais de pareamento.
    // O iframe/pre-visualizador do SPA pode chegar depois que o card abre.
    // Os retries nao consultam PJe nem abrem documentos, apenas conferem o DOM.
    const mountReader = () => {
      const existing = body.querySelector('.cdsp-watch-source-slot');
      if (existing?.contains(dockedFullAutos?.viewer)) return;
      if (existing) {
        const ctx = findCurrentSpaContext(cleanNumber(record.number));
        const available = document.getElementById('spa-cdsp-external-docs-panel');
        if (!(ctx.matching && available && cleanNumber(available.dataset.processNumber) === cleanNumber(record.number))) return;
        existing.remove();
      }
      createProcessSourceViewer(record, body);
    };
    const queueReaderRetry = () => [650, 1600, 3200].forEach(delay => setTimeout(() => {
      if (card.open && card.isConnected) mountReader();
    }, delay));
    if (card.open) {mountReader(); queueReaderRetry();}
    card.addEventListener('toggle', () => {
      if (card.open) {mountReader();queueReaderRetry();}
      else {
        if (body.contains(dockedFullAutos?.viewer)) restoreFullAutos();
        body.querySelector('.cdsp-watch-source-slot')?.remove();
      }
    });
    const actions = element("div", "", body, "cdsp-watch-card-actions");
    button("Verificar agora", actions, async () => { await request("check", record.number); await render(); });
    if (record.unread) button("Marcar como lido", actions, async () => { await request("read", record.number); await render(); }, "cdsp-watch-button cdsp-watch-button--primary");
    if (record.unread && (record.history || []).length) {
      button("Preparar e-mail", actions, async () => {
        const preview = await mailRequest('mailPreview', record.number);
        const recipient = preview.recipients.join(',');
        const latest = record.history[0];
        const subject = `MTPrev | Nova movimentação no processo ${displayNumber(record.number)}`;
        const lines = [
          `Processo: ${displayNumber(record.number)}`,
          `Consulta: ${formatDate(latest.at)}`,
          "",
          ...((latest.items || []).slice(0, 15).map((value) => String(value).slice(0, 500))),
          "",
          "Mensagem preparada pelo MTPrev para revisão antes do envio."
        ];
        const mailto = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
        const anchor = document.createElement("a");
        anchor.href = mailto;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }, "cdsp-watch-button cdsp-watch-button--primary").title =
        "Abre um rascunho no aplicativo de e-mail. Não envia automaticamente.";
    }
    const mailDetails = element('details', '', body, 'cdsp-watch-mail-per-process');
    element('summary', 'Dados do processo e destinatários de notificações', mailDetails);
    const content = element('div', '', mailDetails, 'cdsp-watch-mail-per-process-body');
    element('p', 'O teste tenta preencher automaticamente assunto, partes, expediente e último andamento do SPA. Campos manuais são opcionais e têm prioridade.', content, 'cdsp-watch-mail-help');
    const fields = [
      ['Assunto do processo', 'subject', 'Ex.: Aposentadoria / concessão', 160],
      ['Partes (nomes para o aviso)', 'parties', 'Ex.: Parte autora × Instituto de Previdência', 240],
      ['ID do expediente SPA (para link direto)', 'expedienteId', 'Ex.: 41858970', 16]
    ];
    const metadata = {};
    for (const [labelText,key,placeholder,max] of fields) {
      formLabel(labelText,content);
      const field = element('input','',content);
      field.type='text';field.maxLength=max;field.placeholder=placeholder;
      field.value=String(record[key] || (key==='expedienteId' ? (findCurrentSpaContext(cleanNumber(record.number)).matching ? findCurrentSpaContext(cleanNumber(record.number)).id : '') : ''));
      metadata[key]=field;
    }
    const offLabel = element('label', '', content, 'cdsp-watch-mail-check');
    const off = element('input', '', offLabel);
    off.type = 'checkbox'; off.checked = record.mail?.enabled !== false;
    element('span', 'Enviar avisos deste processo', offLabel);
    formLabel('Adicionar destinatários específicos (um por linha)', content);
    const extra = element('textarea', '', content);
    extra.rows = 2;
    extra.placeholder = 'outro.servidor@instituicao.gov.br';
    extra.value = (record.mail?.extra || []).join('\n');
    const exclusions = element('fieldset', '', content, 'cdsp-watch-mail-exclusions');
    element('legend', 'Destinatários padrão — desmarque para excluir neste processo', exclusions);
    const excluded = new Set(record.mail?.excluded || []);
    const checks = [];
    const explain = element('p', 'As alterações de destinatários são salvas apenas após clicar em Salvar.', content, 'cdsp-watch-mail-help');
    const mailActions = element('div', '', content, 'cdsp-watch-card-actions');
    const saveMail = button('Salvar destinatários', mailActions, async () => {
      const settings = {enabled: off.checked, extra:parseEmails(extra.value), excluded:checks.filter(row => !row.input.checked).map(row => row.address), subject:metadata.subject.value,parties:metadata.parties.value,expedienteId:metadata.expedienteId.value};
      await mailRequest('saveMail', record.number, settings);
      explain.textContent = 'Destinatários deste processo atualizados.';
    }, 'cdsp-watch-button cdsp-watch-button--primary');
    saveMail.title = 'Salva inclusões e exclusões somente para este processo.';
    const updateTestProgress=makeMailProgress(content);
    button('Enviar última movimentação (TESTE)', mailActions, async () => {
      try {
        const result = await confirmTest(record.number, updateTestProgress);
        if (result) explain.textContent = result.message;
      } catch(error) {
        updateTestProgress(error?.message || 'Falha no envio.',0,'error');
        throw error;
      }
    });
    chrome.storage.local.get(MAIL_CONFIG_KEY).then(data => {
      if (!exclusions.isConnected) return;
      const defaults = parseEmails(data?.[MAIL_CONFIG_KEY]?.defaults || []);
      if (!defaults.length) {
        element('p', 'Nenhum destinatário padrão cadastrado. Abra Destinatários padrão dos avisos acima.', exclusions);
      }
      for (const address of defaults) {
        const row = element('label', '', exclusions, 'cdsp-watch-mail-check');
        const input = element('input', '', row);
        input.type = 'checkbox';input.checked = !excluded.has(address);
        element('span', address, row);
        checks.push({address,input});
      }
    }).catch(() => { explain.textContent = 'Não foi possível carregar os destinatários padrão.'; });
    button("Parar de acompanhar", actions, async () => {
      if (!window.confirm(`Parar de acompanhar o processo ${displayNumber(record.number)}?`)) return;
      await request("remove", record.number); await render();
    }, "cdsp-watch-button cdsp-watch-button--quiet");
    return card;
  }
  function applyFilters() {
    if (!panel) return;
    const term = cleanNumber(panel.querySelector(".cdsp-watch-search")?.value);
    const freeText = (panel.querySelector(".cdsp-watch-search")?.value || "").trim().toLowerCase();
    const filter = panel.querySelector(".cdsp-watch-filter")?.value || "all";
    let visible = 0;
    panel.querySelectorAll(".cdsp-watch-card").forEach((card) => {
      const matchTerm = !freeText || (term ? card.dataset.processNumber.includes(term) : card.textContent.toLowerCase().includes(freeText));
      const matchFilter = filter === "all" || (filter === "unread" ? card.classList.contains("has-unread") : card.classList.contains("has-error"));
      card.hidden = !(matchTerm && matchFilter);
      if (!card.hidden) visible++;
    });
    const hint = panel.querySelector(".cdsp-watch-visible-count");
    if (hint) hint.textContent = `${visible} processo(s) exibido(s)`;
  }
  async function render() {
    if (!panel || panel.hidden) return;
    const version = ++renderVersion;
    const records = await request("list");
    if (!panel || panel.hidden || version !== renderVersion) return;
    const list = panel.querySelector(".cdsp-watch-list");
    const expanded = new Set([...list.querySelectorAll(".cdsp-watch-card[open]")].map((node) => node.dataset.processNumber));
    const items = Object.values(records).filter(Boolean).sort((a, b) => Number(!!b.unread) - Number(!!a.unread) || (b.checkedAt || "").localeCompare(a.checkedAt || ""));
    const unread = items.filter((item) => item.unread).length;
    const errors = items.filter((item) => !!item.error).length;
    panel.querySelector(".cdsp-watch-total").textContent = String(items.length);
    panel.querySelector(".cdsp-watch-unread-total").textContent = String(unread);
    panel.querySelector(".cdsp-watch-error-total").textContent = String(errors);
    restoreFullAutos();
    list.replaceChildren();
    if (!items.length) element("p", "Nenhum processo acompanhado. Cole um CNJ e clique em Salvar acompanhamento.", list, "cdsp-watch-empty");
    items.forEach((record) => {
      const card = makeRecordCard(record, list, expanded.has(cleanNumber(record.number)));
      if (record.error) card.classList.add("has-error");
    });
    applyFilters();
    const status = panel.querySelector(".cdsp-watch-status");
    if (status && status.dataset.tone !== "error") status.textContent = `Lista atualizada · ${unread} processo(s) com alterações não lidas.`;
  }
  function close() {
    restoreFullAutos();
    if (panel) panel.hidden = true;
    window.dispatchEvent(new Event("mtprev-process-watch-closed"));
  }
  async function open() {
    if (panel) {
      panel.hidden = false;
      positionPanel();
      await render();
      panel.focus({ preventScroll: true });
      return;
    }
    panel = element("section", "", document.body, "cdsp-watch-panel");
    panel.id = "cdsp-process-watch";
    panel.tabIndex = -1;
    panel.setAttribute("aria-label", "Acompanhamento especial de processos");
    const header = element("header", "", panel, "cdsp-watch-header");
    const logo = element("img", "", header);
    logo.src = chrome.runtime.getURL("images/logo-mtprev.png"); logo.alt = "MTPrev"; logo.draggable = false;
    const heading = element("div", "", header, "cdsp-watch-heading");
    element("h2", "Acompanhamento Especial", heading);
    element("p", "Movimentações de processos · Verificação automática a cada 24h", heading);
    button("Voltar", header, close, "cdsp-watch-button cdsp-watch-close");
    makeDraggable(header);
    const main = element("div", "", panel, "cdsp-watch-main");
    const stats = element("div", "", main, "cdsp-watch-stats");
    for (const [label, className] of [["Acompanhados", "cdsp-watch-total"], ["Não lidos", "cdsp-watch-unread-total"], ["Falhas", "cdsp-watch-error-total"]]) {
      const stat = element("div", "", stats, "cdsp-watch-stat");
      element("small", label, stat);
      element("strong", "0", stat, className);
    }
    const toolbar = element("div", "", main, "cdsp-watch-toolbar");
    const search = element("input", "", toolbar, "cdsp-watch-search");
    search.type = "search"; search.placeholder = "Buscar processo acompanhado"; search.setAttribute("aria-label", "Buscar processo acompanhado");
    search.addEventListener("input", applyFilters);
    const filter = element("select", "", toolbar, "cdsp-watch-filter");
    filter.setAttribute("aria-label", "Filtrar acompanhamentos");
    [["all", "Todos"], ["unread", "Com novas movimentações"], ["errors", "Com falha de consulta"]].forEach(([value, label]) => {
      const option = element("option", label, filter); option.value = value;
    });
    filter.addEventListener("change", applyFilters);
    const actions = element("div", "", main, "cdsp-watch-toolbar-actions");
    // Cadastro direto: colar o CNJ e salvar, sem abrir outro formulário.
    const form = element("div", "", main, "cdsp-watch-quick-add");
    const label = element("label", "Adicionar processo ao acompanhamento", form, "cdsp-watch-quick-label");
    const fields = element("div", "", form, "cdsp-watch-quick-fields");
    const input = element("input", "", fields, "cdsp-watch-quick-cnj");
    input.type = "text"; input.inputMode = "numeric";
    input.placeholder = "Cole o número CNJ (20 dígitos)";
    input.setAttribute("aria-label", "Número CNJ para acompanhar");
    const currentCNJ = (document.body.innerText.match(/\b\d{7}-\d{2}\.\d{4}\.8\.11\.\d{4}\b/) || [""])[0];
    if (currentCNJ) input.value = currentCNJ;
    const instance = element("select", "", fields, "cdsp-watch-quick-instance");
    instance.setAttribute("aria-label", "Instância do PJe");
    for (const [value, text] of [["", "Instância automática"], ["1 grau", "1º grau"], ["2 grau", "2º grau"]]) {
      const option = element("option", text, instance); option.value = value;
    }
    const submit = button("Salvar acompanhamento", fields, async () => {
      if (!/^\d{20}$/.test(cleanNumber(input.value))) throw new Error("Cole um número CNJ válido com 20 dígitos.");
      await request("add", input.value, instance.value);
      input.value = "";
      await render();
    }, "cdsp-watch-button cdsp-watch-button--primary");
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); submit.click(); }
    });
    button("Verificar todos agora", actions, async () => { await request("checkAll"); await render(); });
    // Acompanhamento mantém somente preferências de destinatários.
    // OAuth, remetente e MCP/PJe ficam na página aberta pelo botão Configurações do menu inicial.
    const mailSettings = element('details', '', main, 'cdsp-watch-mail-settings');
    element('summary', 'Destinatários padrão dos avisos', mailSettings);
    const mailFields = element('div', '', mailSettings, 'cdsp-watch-mail-fields');
    element('p', 'Defina quem receberá avisos de todos os processos acompanhados. Para excluir alguém de um processo específico, abra o card e desmarque o destinatário.', mailFields);
    formLabel('Endereços padrão (um por linha; também aceita vírgulas)', mailFields);
    const defaultsInput = element('textarea', '', mailFields);
    defaultsInput.rows = 4;
    defaultsInput.placeholder = 'servidor@instituicao.gov.br\noutro@instituicao.gov.br';
    const spaContacts = element('div', '', mailFields, 'cdsp-watch-spa-contacts');
    formLabel('Selecionar uma conta do SPA', spaContacts);
    const contactsSearch = element('input', '', spaContacts, 'cdsp-watch-contact-search');
    contactsSearch.type = 'search';
    contactsSearch.placeholder = 'Pesquisar pelo nome ou e-mail no SPA';
    contactsSearch.setAttribute('aria-label', 'Pesquisar usuários visíveis no SPA');
    const contactsSelect = element('select', '', spaContacts, 'cdsp-watch-contact-select');
    contactsSelect.setAttribute('aria-label', 'Selecionar conta do SPA');
    const contactEmail = element('input', '', spaContacts, 'cdsp-watch-contact-email');
    contactEmail.type = 'email';
    contactEmail.placeholder = 'E-mail confirmado do usuário selecionado';
    contactEmail.setAttribute('aria-label', 'E-mail confirmado do usuário selecionado');
    contactEmail.autocomplete = 'off';
    const contactsHelp = element('p', '', spaContacts, 'cdsp-watch-mail-help');
    const contactsActions = element('div', '', spaContacts, 'cdsp-watch-card-actions');
    let availableContacts = [];
    const fillContacts = () => {
      const query = contactsSearch.value.trim().toLocaleLowerCase('pt-BR');
      const filtered = availableContacts.filter(item => !query || `${item.name} ${item.email}`.toLocaleLowerCase('pt-BR').includes(query));
      contactsSelect.replaceChildren();
      const placeholder = element('option', filtered.length ? 'Selecione uma conta do SPA' : 'Nenhuma conta encontrada', contactsSelect);
      placeholder.value = '';
      filtered.forEach(item => {
        const option = element('option', item.email ? `${item.name} — ${item.email}` : `${item.name} — e-mail a informar`, contactsSelect);
        option.value = String(availableContacts.indexOf(item));
      });
      contactEmail.value = '';
      contactsHelp.textContent = availableContacts.length
        ? `${availableContacts.length} conta(s) encontrada(s) nos campos visíveis do SPA. Se o SPA não informar um e-mail, digite o endereço confirmado antes de adicionar.`
        : 'O SPA não disponibilizou contas nos controles desta página. Abra uma lista de usuários no SPA e clique em Atualizar, ou informe os e-mails diretamente acima.';
    };
    const reloadContacts = () => {
      availableContacts = globalThis.MTPrevSpaMailContacts?.list(document) || [];
      fillContacts();
    };
    contactsSearch.addEventListener('input', fillContacts);
    contactsSelect.addEventListener('change', () => {
      const index = contactsSelect.value;
      const contact = index === '' ? null : availableContacts[Number(index)];
      contactEmail.value = contact?.email || '';
      contactsHelp.textContent = !contact ? 'Selecione uma conta do SPA.' : contact.email
        ? `Endereço fornecido pelo SPA para ${contact.name}. Confira antes de adicionar.`
        : `O SPA mostrou ${contact.name}, mas não informou e-mail. Digite um endereço confirmado para associar ao destinatário.`;
    });
    button('Atualizar contas do SPA', contactsActions, async () => { reloadContacts(); });
    button('Adicionar destinatário selecionado', contactsActions, async () => {
      const index = contactsSelect.value;
      if (index === '') throw new Error('Escolha uma conta na lista do SPA.');
      const chosen = availableContacts[Number(index)];
      if (!chosen) throw new Error('Conta do SPA não encontrada; atualize a lista.');
      const address = parseEmails(contactEmail.value);
      if (address.length !== 1) throw new Error('Informe um e-mail válido e confirmado para o usuário selecionado.');
      const updated = parseEmails([...parseEmails(defaultsInput.value), address[0]]);
      defaultsInput.value = updated.join('\n');
      contactsHelp.textContent = `${chosen.name} adicionado à lista. Clique em Salvar destinatários padrão para confirmar.`;
    }, 'cdsp-watch-button cdsp-watch-button--primary');
    reloadContacts();
    const mailInfo = element('p', '', mailFields, 'cdsp-watch-mail-help');
    const loadDefaults = async () => {
      const data = await chrome.storage.local.get(MAIL_CONFIG_KEY);
      const current = data?.[MAIL_CONFIG_KEY] || {};
      defaultsInput.value = parseEmails(current.defaults || []).join('\n');
      mailInfo.textContent = `${parseEmails(current.defaults || []).length} destinatário(s) padrão salvo(s). Limite de 40 endereços por envio.`;
    };
    loadDefaults().catch(() => { mailInfo.textContent = 'Não foi possível carregar os destinatários. Tente reabrir o painel.'; });
    const mailButtons = element('div', '', mailFields, 'cdsp-watch-card-actions');
    button('Salvar destinatários padrão', mailButtons, async () => {
      const defaults = parseEmails(defaultsInput.value);
      const stored = (await chrome.storage.local.get(MAIL_CONFIG_KEY))[MAIL_CONFIG_KEY] || {};
      await chrome.storage.local.set({[MAIL_CONFIG_KEY]:{...stored, defaults}});
      mailInfo.textContent = `${defaults.length} destinatário(s) padrão salvo(s). As exclusões individuais por processo foram preservadas.`;
      // Atualizar checkboxes de cada processo sem perder o conteúdo salvo.
      await render();
    }, 'cdsp-watch-button cdsp-watch-button--primary');
    const status = element("p", "", main, "cdsp-watch-status");
    status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    element("p", "0 processo(s) exibido(s)", main, "cdsp-watch-visible-count");
    element("div", "", main, "cdsp-watch-list");
    element("p", "Verificação automática do PJe a cada 24 horas e observação dos cards SPA visíveis quando a mesa estiver aberta. Para teste, a extensão também pode ler o último andamento do expediente exibido no SPA, sem PJe configurado; a observação SPA depende dos cards carregados na mesa e não alcança processos ausentes da tela. Com navegador fechado não há monitoramento.", main, "cdsp-watch-note");
    panel.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } });
    window.addEventListener("resize", () => { if (panel && !panel.hidden) { const rect = panel.getBoundingClientRect(); const pos = viewportClamp(rect.left, rect.top); panel.style.left = `${pos.left}px`; panel.style.top = `${pos.top}px`; } });
    positionPanel();
    await render();
    panel.focus({ preventScroll: true });
  }
  window.MTPrevProcessWatch = { open, close };
  function install() {
    const nav = document.querySelector(".cdsp-general-shell__modules");
    if (!nav || document.getElementById("cdsp-watch-open")) return;
    const node = element("button", "Acompanhar processos", nav);
    node.type = "button"; node.id = "cdsp-watch-open";
    node.addEventListener("click", () => open().catch((error) => {
      const status = panel?.querySelector(".cdsp-watch-status");
      if (status) { status.textContent = error.message; status.dataset.tone = "error"; }
    }));
    chrome.storage.local.get(KEY).then((data) => updateLegacyBadge(data?.[KEY] || {})).catch(() => {});
  }
  function updateLegacyBadge(records) {
    const unread = Object.values(records || {}).filter((record) => record?.unread).length;
    const node = document.getElementById("cdsp-watch-open");
    if (node) node.textContent = `Acompanhar processos${unread ? ` (${unread})` : ""}`;
  }
  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[KEY]) return;
    updateLegacyBadge(changes[KEY].newValue || {});
    if (panel && !panel.hidden && !busy) render().catch(() => {});
  });
  install();
  // Executa ao carregar o SPA, mesmo que o usuário não abra o painel.
  // O background controla o intervalo global para evitar consultas duplicadas entre abas.
  if (window === window.top && !window.MTPREV_WATCH_PAGE_CHECK_SENT) {
    window.MTPREV_WATCH_PAGE_CHECK_SENT = true;
    chrome.runtime.sendMessage({ type:"CDSP_PROCESS_WATCH", action:"pageOpened" })
      .catch(() => {});
    // Espera os cards SPA2 serem renderizados; uma segunda tentativa cobre
    // carregamentos lentos. O background bloqueia repeticoes em menos de 24h.
    for (const delay of [4500,13000]) setTimeout(() =>
      observeVisibleSpaProcesses().catch(() => {}),delay);
  }
})();
