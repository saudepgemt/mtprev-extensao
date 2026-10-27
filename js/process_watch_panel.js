(() => {
  "use strict";
  const KEY = "CDSP_PROCESS_WATCH_V1";
  const POSITION_KEY = "CDSP_PROCESS_WATCH_POSITION_V2";
  const MAIL_RECIPIENT_KEY = "MTPREV_WATCH_MAIL_RECIPIENT";
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
    element("small", `Última consulta: ${formatDate(record.checkedAt)}`, label);
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
        const saved = (await chrome.storage.local.get(MAIL_RECIPIENT_KEY))[MAIL_RECIPIENT_KEY];
        const recipient = typeof saved === "string" ? saved.trim() : "";
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
    element("p", "Movimentações de processos · Consulta ao abrir o SPA", heading);
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
    const configure = button("Configurar consulta PJe", actions);
    configure.addEventListener("click", async () => {
      try {
        const result = await chrome.runtime.sendMessage({ type: "MTPREV_OPEN_OPTIONS" });
        if (!result?.ok) throw new Error(result?.error || "Não foi possível abrir a configuração.");
      } catch (error) {
        const status = panel.querySelector(".cdsp-watch-status");
        status.textContent = error.message; status.dataset.tone = "error";
      }
    });
    const mailSettings = element("details", "", main, "cdsp-watch-mail-settings");
    element("summary", "Alertas por e-mail (OAuth nas opções da extensão)", mailSettings);
    const mailFields = element("div", "", mailSettings, "cdsp-watch-mail-fields");
    const mailHelp = element("p", "Configure Microsoft 365 OAuth nas Opções do MTPrev para autorizar alertas automáticos. O botão Preparar e-mail continua disponível para revisão manual.", mailFields);
    const mailInput = element("input", "", mailFields);
    mailInput.type = "email";
    mailInput.placeholder = "destinatario@dominio.gov.br";
    mailInput.setAttribute("aria-label", "Destinatário de alertas por e-mail");
    chrome.storage.local.get(MAIL_RECIPIENT_KEY).then((data) => {
      if (data?.[MAIL_RECIPIENT_KEY] && !mailInput.value) mailInput.value = data[MAIL_RECIPIENT_KEY];
    }).catch(() => {});
    mailInput.addEventListener("change", () => {
      if (!mailInput.value || mailInput.validity.valid) {
        chrome.storage.local.set({ [MAIL_RECIPIENT_KEY]: mailInput.value.trim() }).catch(() => {});
      }
    });
    button('Configurar OAuth', mailFields, async () => {
      await chrome.runtime.sendMessage({type:'MTPREV_OPEN_OPTIONS'});
    }, 'cdsp-watch-button');
    const status = element("p", "", main, "cdsp-watch-status");
    status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    element("p", "0 processo(s) exibido(s)", main, "cdsp-watch-visible-count");
    element("div", "", main, "cdsp-watch-list");
    element("p", "A primeira consulta cria a referência. Depois, o PJe é verificado quando uma página do SPA carregar (uma única consulta por intervalo curto, mesmo com várias abas). Para consultar novamente nesta sessão, use “Verificar agora”. Não verifica encerramentos internos do SPA.", main, "cdsp-watch-note");
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
  }
})();
