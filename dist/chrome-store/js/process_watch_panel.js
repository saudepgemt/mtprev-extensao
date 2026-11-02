(() => {
  "use strict";
  const KEY = "CDSP_PROCESS_WATCH_V1";
  const POSITION_KEY = "CDSP_PROCESS_WATCH_POSITION_V2";
  let panel = null;
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
    if (!record.initialized) element("p", "Aguardando a primeira consulta bem-sucedida para criar a referência.", body, "cdsp-watch-message");
    const history = record.history || [];
    if (history.length) {
      element("h3", "Histórico de alterações detectadas", body, "cdsp-watch-subtitle");
      history.forEach((entry, index) => {
        const isNew = unreadHistory(entry, record, index);
        const event = element("details", "", body, `cdsp-watch-event${isNew ? " is-unread" : ""}`);
        const title = element("summary", "", event);
        element("span", formatDate(entry.at), title);
        if (isNew) element("span", "NOVA MOVIMENTAÇÃO", title, "cdsp-watch-pill cdsp-watch-pill--unread");
        addMovementList(entry.items || [], event, isNew);
      });
    } else if (record.initialized) element("p", "Nenhuma alteração detectada desde o início do acompanhamento.", body, "cdsp-watch-message");
    if ((record.latest || []).length) {
      const latest = element("details", "", body, "cdsp-watch-event");
      element("summary", "Dados da última consulta", latest);
      addMovementList(record.latest, latest, false);
    }
    const actions = element("div", "", body, "cdsp-watch-card-actions");
    // O acompanhamento MNI/PJe conhece o CNJ, mas não necessariamente o ID interno
    // de cada expediente no SPA. Não inventar /procedures/ID.
    const cnj = displayNumber(record.number);
    const currentField = Array.from(document.querySelectorAll('.workspace-preview__field')).find((field) =>
      /número do processo/i.test(field.querySelector('small')?.textContent || '')
    );
    const currentNumber = (currentField?.querySelector('[data-copy-value]')?.getAttribute('data-copy-value') || currentField?.querySelector('strong')?.textContent || '').replace(/\D/g,'');
    const onMatchingProcess = currentNumber.length === 20 && currentNumber === cleanNumber(record.number) && /^\/procedures\/\d+\/?$/.test(location.pathname);
    const spaLink = element('a', onMatchingProcess ? 'Abrir autos/PDFs deste processo' : 'Localizar processo no SPA / Autos', actions, 'cdsp-watch-button cdsp-watch-button--primary');
    spaLink.href = onMatchingProcess ? location.href : new URL('/procedures/search?gq=' + encodeURIComponent(cnj), location.origin).href;
    spaLink.target = '_blank';spaLink.rel='noopener noreferrer';
    spaLink.title = onMatchingProcess ? 'Abrir o processo no SPA2 com o painel de autos.' : 'Pesquisar o CNJ no SPA, selecionar o expediente correto e consultar Autos/Andamentos.';
    button("Verificar agora", actions, async () => { await request("check", record.number); await render(); });
    if (record.unread) button("Marcar como lido", actions, async () => { await request("read", record.number); await render(); }, "cdsp-watch-button cdsp-watch-button--primary");
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
    list.replaceChildren();
    if (!items.length) element("p", "Nenhum processo acompanhado. Use ‘Adicionar processo’ para começar.", list, "cdsp-watch-empty");
    items.forEach((record) => {
      const card = makeRecordCard(record, list, expanded.has(cleanNumber(record.number)));
      if (record.error) card.classList.add("has-error");
    });
    applyFilters();
    const status = panel.querySelector(".cdsp-watch-status");
    if (status && status.dataset.tone !== "error") status.textContent = `Lista atualizada · ${unread} processo(s) com alterações não lidas.`;
  }
  function close() {
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
    element("p", "Movimentações de processos · Atualização a cada 30 minutos", heading);
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
    const form = element("details", "", actions, "cdsp-watch-add");
    element("summary", "+ Adicionar processo", form);
    const fields = element("div", "", form, "cdsp-watch-add-fields");
    const label = element("label", "Número do processo (CNJ)", fields);
    const input = element("input", "", label); input.placeholder = "0000000-00.0000.8.11.0000";
    input.value = (document.body.innerText.match(/\b\d{7}-\d{2}\.\d{4}\.8\.11\.\d{4}\b/) || [""])[0];
    const instanceLabel = element("label", "Instância", fields);
    const instance = element("select", "", instanceLabel);
    for (const [value, text] of [["", "Automática pelo número"], ["1 grau", "1º grau"], ["2 grau", "2º grau"]]) {
      const option = element("option", text, instance); option.value = value;
    }
    button("Iniciar acompanhamento", fields, async () => {
      await request("add", input.value, instance.value);
      form.open = false;
      input.value = "";
      await render();
    }, "cdsp-watch-button cdsp-watch-button--primary");
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
    const status = element("p", "", main, "cdsp-watch-status");
    status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
    element("p", "0 processo(s) exibido(s)", main, "cdsp-watch-visible-count");
    element("div", "", main, "cdsp-watch-list");
    element("p", "A primeira consulta cria a referência. As seguintes verificam movimentações e alterações de expedientes do PJe/TJMT. Não verifica encerramentos internos do SPA. As informações ficam neste perfil do Chrome.", main, "cdsp-watch-note");
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
})();
