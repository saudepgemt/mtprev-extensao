(function () {
  "use strict";

  if (window.CDSP_GENERAL_BRIDGE_INITIALIZED) return;
  window.CDSP_GENERAL_BRIDGE_INITIALIZED = true;

  const SHELL_ID = "cdsp-general-shell";
  const STATE_KEY = "CDSP_GENERAL_SHELL_STATE";
  const POSITION_KEY = "CDSP_GENERAL_SHELL_POSITION";
  const COLLAPSED_KEY = "CDSP_GENERAL_SHELL_COLLAPSED";
  const OPEN_MINIMIZED_KEY = "CDSP_GENERAL_SHELL_OPEN_MINIMIZED";
  const ACTIVE_KEY = "CDSP_GENERAL_ACTIVE_MODULE";
  const PAGE_SOURCE = "SPA_CDSP_PAGE";
  const PAGE_BRIDGE_SOURCE = "SPA_CDSP_EXTENSION_BRIDGE";
  const MANAGEMENT_PAGE_SOURCE = "SPA_CDSP_MANAGEMENT_PANEL";
  const MANAGEMENT_BRIDGE_SOURCE = "SPA_CDSP_MANAGEMENT_BRIDGE";
  const TEAM_DATABASE_PAGE_SOURCE = "SPA_CDSP_TEAM_DATABASE_PANEL";
  const TEAM_DATABASE_BRIDGE_SOURCE = "SPA_CDSP_TEAM_DATABASE_BRIDGE";

  const MODULES = [
    { key: "triagem", title: "Triagem e Protocolo", messageType: "CDSP_GENERAL_INJECT_TRIAGEM" },
    { key: "prazos", title: "Redação e Correção", messageType: "CDSP_GENERAL_INJECT_PRAZOS" },
    { key: "gestao", title: "Coordenação", messageType: "CDSP_GENERAL_INJECT_GESTAO" },
    { key: "oficios", title: "Ofícios", local: true }
  ];

  const TRIAGEM_ALLOWED_TYPES = [
    "SPA_CDSP_OPEN_BACKGROUND_TABS",
    "SPA_CDSP_OPEN_FILTERED_EXPEDIENTE_TABS",
    "SPA_CDSP_CLASSIFY_PIECE_RECORDS",
    "SPA_CDSP_FINGERPRINT_EXPEDIENTES",
    "SPA_CDSP_VALIDATE_DUPLICATE_RECORDS",
    "SPA_CDSP_OPEN_PIECE_REPORT_RECORD",
    "SPA_CDSP_SEARCH_AUTOS_DOCUMENT",
    "SPA_CDSP_ENSURE_PDF_LIB",
    "SPA_CDSP_FETCH_PROCEDURE_MOVEMENTS",
    "SPA_CDSP_SCHEDULE_GET",
    "SPA_CDSP_SCHEDULE_SAVE",
    "SPA_CDSP_SCHEDULE_RUN_NOW",
    "SPA_CDSP_SCHEDULE_PASSWORD_SET",
    "SPA_CDSP_SIMPLE_CLOSURE_INSERT_DOCUMENT"
  ];

  const loadedModules = Object.create(null);
  const loadingModules = Object.create(null);
  let rootToolsLoading = false;
  let rootToolsLastRoute = "";

  function contextInvalidatedMessage(error) {
    const message = error && error.message ? error.message : String(error || "");
    if (message.indexOf("Extension context invalidated") >= 0) {
      return "Recarregue a aba do SPA.";
    }
    return message || "Falha de comunicacao.";
  }

  function safeLastError() {
    try {
      return chrome.runtime.lastError || null;
    } catch (error) {
      return { message: contextInvalidatedMessage(error) };
    }
  }

  function safeSendMessage(message, callback) {
    try {
      chrome.runtime.sendMessage(message, callback);
    } catch (error) {
      callback({ ok: false, error: contextInvalidatedMessage(error) });
    }
  }

  function moduleByKey(key) {
    return MODULES.find((module) => module.key === key) || MODULES[0];
  }

  function clampPosition(shell, left, top) {
    const margin = 8;
    const maxLeft = Math.max(margin, window.innerWidth - shell.offsetWidth - margin);
    const maxTop = Math.max(margin, window.innerHeight - shell.offsetHeight - margin);
    return {
      left: Math.min(Math.max(margin, left), maxLeft),
      top: Math.min(Math.max(margin, top), maxTop)
    };
  }

  function readShellState() {
    try {
      const state = JSON.parse(window.localStorage.getItem(STATE_KEY) || "{}");
      return state && typeof state === "object" ? state : {};
    } catch (_error) {
      window.localStorage.removeItem(STATE_KEY);
      return {};
    }
  }

  function writeShellState(state) {
    try {
      window.localStorage.setItem(STATE_KEY, JSON.stringify(state || {}));
    } catch (_error) {
      // Sem armazenamento local, o menu continua funcional na aba atual.
    }
  }

  function saveShellState(shell, overrides) {
    const state = Object.assign({}, readShellState(), overrides || {});

    if (shell) {
      const rect = shell.getBoundingClientRect();
      state.left = Math.round(rect.left);
      state.top = Math.round(rect.top);
      state.collapsed = shell.classList.contains("cdsp-general-shell--collapsed");
    }

    if (!state.active) {
      state.active = window.localStorage.getItem(ACTIVE_KEY) || MODULES[0].key;
    }

    writeShellState(state);

    try {
      if (Number.isFinite(Number(state.left)) && Number.isFinite(Number(state.top))) {
        window.localStorage.setItem(POSITION_KEY, JSON.stringify({ left: state.left, top: state.top }));
      }
      if (typeof state.collapsed === "boolean") {
        window.localStorage.setItem(COLLAPSED_KEY, state.collapsed ? "1" : "0");
      }
      if (state.active) {
        window.localStorage.setItem(ACTIVE_KEY, state.active);
      }
    } catch (_error) {
      // Estado antigo tambem e opcional.
    }
  }

  function savePosition(shell) {
    const rect = shell.getBoundingClientRect();
    saveShellState(shell, { left: Math.round(rect.left), top: Math.round(rect.top) });
  }

  function readBooleanSetting(key) {
    try {
      return window.localStorage.getItem(key) === "1";
    } catch (_error) {
      return false;
    }
  }

  function writeBooleanSetting(key, value) {
    try {
      window.localStorage.setItem(key, value ? "1" : "0");
    } catch (_error) {
      // Preferencia opcional; a extensao continua funcional na aba atual.
    }
  }

  function setShellCollapsed(shell, collapsed) {
    if (!shell) return;
    shell.classList.toggle("cdsp-general-shell--collapsed", Boolean(collapsed));
    const toggle = shell.querySelector(".cdsp-general-shell__toggle");
    if (toggle) toggle.textContent = collapsed ? "+" : "-";
  }

  function applySavedPosition(shell) {
    try {
      const shellState = readShellState();
      const raw = window.localStorage.getItem(POSITION_KEY);
      const parsed = Number.isFinite(Number(shellState.left)) && Number.isFinite(Number(shellState.top))
        ? shellState
        : raw
        ? JSON.parse(raw)
        : null;
      if (!parsed) return;
      const left = Number(parsed.left);
      const top = Number(parsed.top);
      if (!Number.isFinite(left) || !Number.isFinite(top)) return;
      const position = clampPosition(shell, left, top);
      shell.style.left = position.left + "px";
      shell.style.top = position.top + "px";
    } catch (_error) {
      window.localStorage.removeItem(POSITION_KEY);
    }
  }

  function makeDraggable(shell, handle) {
    let drag = null;

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (
        event.target &&
        event.target.closest &&
        event.target.closest("button,input,select,textarea,a,.cdsp-general-shell__memory")
      ) {
        return;
      }
      const rect = shell.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top
      };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const position = clampPosition(
        shell,
        drag.left + event.clientX - drag.startX,
        drag.top + event.clientY - drag.startY
      );
      shell.style.left = position.left + "px";
      shell.style.top = position.top + "px";
    });

    function finish(event) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      try {
        handle.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // Captura ja liberada.
      }
      drag = null;
      savePosition(shell);
    }

    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  }

  function installWheelScrollPassThrough(shell) {
    shell.addEventListener("wheel", (event) => {
      if (shell.classList.contains("cdsp-general-shell--collapsed")) return;

      let scroller = null;
      let node = event.target;
      while (node && node !== shell) {
        if (node instanceof HTMLElement) {
          const style = window.getComputedStyle(node);
          const canOverflow = /auto|scroll/i.test(style.overflowY);
          if (canOverflow && node.scrollHeight > node.clientHeight + 1) {
            scroller = node;
            break;
          }
        }
        node = node.parentElement;
      }

      if (!scroller) {
        scroller = shell.querySelector(".cdsp-general-shell__body");
      }

      const canScrollInside = scroller &&
        scroller.scrollHeight > scroller.clientHeight + 1 &&
        ((event.deltaY < 0 && scroller.scrollTop > 0) ||
          (event.deltaY > 0 && scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 1));

      if (canScrollInside) return;

      window.scrollBy({
        top: event.deltaY,
        left: event.deltaX,
        behavior: "auto"
      });
      event.preventDefault();
    }, { passive: false });
  }

  function setStatus(text, tone) {
    const status = document.querySelector("#" + SHELL_ID + " .cdsp-general-shell__status");
    if (!status) return;
    status.textContent = text || "";
    status.dataset.tone = tone || "";
  }

  function setActiveModule(key) {
    const module = moduleByKey(key);
    const shell = document.getElementById(SHELL_ID);
    if (!shell) return;

    window.localStorage.setItem(ACTIVE_KEY, module.key);
    saveShellState(shell, { active: module.key });
    shell.querySelectorAll("[data-cdsp-module-button]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.cdspModuleButton === module.key);
    });
    shell.querySelectorAll("[data-cdsp-module-pane]").forEach((pane) => {
      pane.hidden = pane.dataset.cdspModulePane !== module.key;
    });
    const empty = shell.querySelector(".cdsp-general-shell__empty");
    if (empty) empty.hidden = true;
  }

  function ensureModuleLoaded(key) {
    const module = moduleByKey(key);
    setActiveModule(module.key);

    if (module.key === "oficios") {
      renderOficiosModule();
      loadedModules[module.key] = true;
      setStatus("Pronto", "ok");
      return;
    }

    if (loadedModules[module.key]) {
      setStatus("Pronto", "ok");
      return;
    }
    if (loadingModules[module.key]) {
      setStatus("Carregando...", "busy");
      return;
    }

    setStatus("Carregando...", "busy");
    loadingModules[module.key] = true;
    safeSendMessage({ type: module.messageType }, (response) => {
      const lastError = safeLastError();
      delete loadingModules[module.key];
      if (lastError) {
        setStatus(contextInvalidatedMessage(lastError), "error");
        return;
      }
      if (!response || !response.ok) {
        setStatus((response && response.error) || "Erro", "error");
        return;
      }
      loadedModules[module.key] = true;
      setActiveModule(module.key);
      setStatus("Pronto", "ok");
    });
  }

  function isProcedureRoute() {
    return /^\/procedures\/\d+\/?$/.test(window.location.pathname);
  }

  function refreshRootAutosSearchPanel() {
    const api = window.SPA_CDSP_AUTOMACAO;
    if (!api || typeof api.refreshExternalDocumentsPanel !== "function") return false;

    try {
      api.refreshExternalDocumentsPanel();
      return true;
    } catch (_error) {
      return false;
    }
  }

  function ensureRootAutosSearchLoaded() {
    if (!isProcedureRoute()) {
      refreshRootAutosSearchPanel();
      return;
    }

    if (loadedModules.triagem || loadingModules.triagem) {
      refreshRootAutosSearchPanel();
      return;
    }

    if (rootToolsLoading) return;
    rootToolsLoading = true;
    loadingModules.triagem = true;
    safeSendMessage({ type: "CDSP_GENERAL_INJECT_TRIAGEM" }, (response) => {
      const lastError = safeLastError();
      rootToolsLoading = false;
      delete loadingModules.triagem;

      const triagemPane = document.querySelector("[data-cdsp-module-pane='triagem']");
      if (!lastError && response && response.ok) {
        loadedModules.triagem = true;
        refreshRootAutosSearchPanel();
        setTimeout(refreshRootAutosSearchPanel, 700);
        if (triagemPane && !triagemPane.hidden) setStatus("Pronto", "ok");
      } else if (triagemPane && !triagemPane.hidden) {
        setStatus(lastError ? contextInvalidatedMessage(lastError) : (response && response.error) || "Erro", "error");
      }
    });
  }

  function scheduleRootToolsRefresh() {
    ensureRootAutosSearchLoaded();
    if (!isProcedureRoute()) return;
    setTimeout(ensureRootAutosSearchLoaded, 700);
    setTimeout(refreshRootAutosSearchPanel, 1800);
  }

  function installRootToolsWatcher() {
    const evaluateRoute = () => {
      const route = window.location.pathname + window.location.search + window.location.hash;
      if (route === rootToolsLastRoute) return;
      rootToolsLastRoute = route;
      scheduleRootToolsRefresh();
    };

    evaluateRoute();
    window.addEventListener("popstate", evaluateRoute);
    window.addEventListener("hashchange", evaluateRoute);
    setInterval(evaluateRoute, 1500);
  }

  function createModuleButton(module) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cdsp-general-shell__module-button";
    button.dataset.cdspModuleButton = module.key;
    button.textContent = module.title;
    button.addEventListener("click", () => ensureModuleLoaded(module.key));
    return button;
  }

  function getOficiosPane() {
    return document.querySelector("#cdsp-general-module-oficios");
  }

  function getOficiosApi() {
    const api = window.CDSP_EXTRATOR_OFICIOS;
    return api && typeof api.obterContexto === "function" ? api : null;
  }

  function createOficiosBrand() {
    const brand = document.createElement("div");
    brand.className = "cdsp-module-brand cdsp-oficios-brand";

    const image = document.createElement("img");
    image.src = chrome.runtime.getURL("images/cabecalho_cdsp_triagem.png");
    image.alt = "Coordenadoria de Defesa da Saude Publica";

    brand.appendChild(image);
    return brand;
  }

  function createOficiosStatus(text) {
    const status = document.createElement("div");
    status.className = "cdsp-oficios-status";
    status.textContent = text;
    return status;
  }

  function runOficiosAction(button, action) {
    if (!button || button.dataset.cdspOficiosRunning === "1") return;

    button.dataset.cdspOficiosRunning = "1";
    try {
      const result = action(button);
      Promise.resolve(result)
        .catch((error) => {
          button.classList.remove("copiando", "sucesso", "alerta");
          button.classList.add("erro");
          button.disabled = false;
          button.textContent = "Erro";
          button.title = error && error.message ? error.message : String(error || "Falha na ação.");
        })
        .finally(() => {
          delete button.dataset.cdspOficiosRunning;
        });
    } catch (error) {
      delete button.dataset.cdspOficiosRunning;
      button.classList.remove("copiando", "sucesso", "alerta");
      button.classList.add("erro");
      button.disabled = false;
      button.textContent = "Erro";
      button.title = error && error.message ? error.message : String(error || "Falha na ação.");
    }
  }

  function createOficiosButton(label, title, action, options) {
    const config = options || {};
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cdsp-oficios-button" + (config.variant ? " cdsp-oficios-button--" + config.variant : "");
    if (config.icon) {
      const icon = document.createElement("span");
      icon.className = "spa-icon";
      icon.textContent = config.icon;
      button.appendChild(icon);
      button.appendChild(document.createTextNode(label ? " " + label : ""));
    } else {
      button.textContent = label;
    }
    button.title = title || label;
    button.addEventListener("click", () => runOficiosAction(button, action));
    return button;
  }

  function createOficiosSection(titleText) {
    const section = document.createElement("section");
    section.className = "cdsp-oficios-section";

    const title = document.createElement("div");
    title.className = "cdsp-oficios-section__title";
    title.textContent = titleText;

    const body = document.createElement("div");
    body.className = "cdsp-oficios-section__body";

    section.appendChild(title);
    section.appendChild(body);
    return { section, body };
  }

  function renderOficiosModule() {
    const pane = getOficiosPane();
    if (!pane) return;

    pane.textContent = "";

    const root = document.createElement("div");
    root.className = "cdsp-oficios-module";
    root.appendChild(createOficiosBrand());

    const api = getOficiosApi();
    if (!api) {
      root.appendChild(createOficiosStatus("Carregando Ofícios..."));
      const retry = createOficiosButton("Atualizar", "Atualizar módulo Ofícios", () => renderOficiosModule());
      root.appendChild(retry);
      pane.appendChild(root);
      return;
    }

    const context = api.obterContexto();
    const isProcessContext = Boolean(context && (context.paginaProcesso || context.pastaProcesso));
    const isBoxContext = Boolean(context && context.caixa);
    const rows = context && Array.isArray(context.linhas) ? context.linhas : [];

    const topActions = document.createElement("div");
    topActions.className = "cdsp-oficios-top-actions";
    topActions.appendChild(
      createOficiosButton("Atualizar", "Atualizar ações de Ofícios", () => {
        if (api.atualizar) api.atualizar();
        renderOficiosModule();
      })
    );
    root.appendChild(topActions);

    if (isProcessContext) {
      const processSection = createOficiosSection("Processo");
      processSection.body.appendChild(
        createOficiosButton(
          "Extrair p/ SIGADOC",
          "Extrair dados do SPA para o SIGADOC",
          (button) => api.extrairProcesso(button),
          { variant: "sig", icon: "SIG" }
        )
      );
      processSection.body.appendChild(
        createOficiosButton(
          "Preencher SPA",
          "Preencher no SPA com o PDF assinado salvo pela extensão",
          (button) => api.preencherSpa(button),
          { variant: "spa", icon: "SPA" }
        )
      );
      root.appendChild(processSection.section);
    }

    if (isBoxContext) {
      const boxSection = createOficiosSection("Caixa");
      if (rows.length) {
        const list = document.createElement("div");
        list.className = "cdsp-oficios-row-list";
        rows.forEach((row) => {
          const label = row && row.rotulo ? row.rotulo : "Linha " + (Number(row && row.indice) + 1 || "");
          list.appendChild(
            createOficiosButton(
              label,
              row && row.url ? "Abrir o processo da linha e extrair para o SIGADOC" : "Link do processo não encontrado nesta linha",
              (button) => api.extrairLinha(row.indice, button, row && row.url),
              { variant: "sig-row", icon: "SIG" }
            )
          );
        });
        boxSection.body.appendChild(list);
      } else {
        boxSection.body.appendChild(createOficiosStatus("Nenhuma linha disponível."));
      }
      root.appendChild(boxSection.section);
    }

    if (!isProcessContext && !isBoxContext) {
      root.appendChild(createOficiosStatus("Acesse um processo, pasta do processo ou caixa de ofícios no SPA."));
    }

    pane.appendChild(root);
  }

  function installShell() {
    if (!document.body || document.getElementById(SHELL_ID)) return;

    const shell = document.createElement("section");
    shell.id = SHELL_ID;
    shell.setAttribute("aria-label", "CDSP");

    const header = document.createElement("div");
    header.className = "cdsp-general-shell__header";

    const title = document.createElement("div");
    title.className = "cdsp-general-shell__title";
    title.textContent = "CDSP";

    const status = document.createElement("div");
    status.className = "cdsp-general-shell__status";
    status.textContent = "Pronto";

    const collapse = document.createElement("button");
    collapse.type = "button";
    collapse.className = "cdsp-general-shell__toggle";
    collapse.textContent = "-";
    collapse.title = "Recolher ou expandir";

    const memory = document.createElement("label");
    memory.className = "cdsp-general-shell__memory";
    memory.title = "Quando marcado, novas abas do SPA abrem o menu CDSP minimizado.";

    const memoryInput = document.createElement("input");
    memoryInput.type = "checkbox";
    memoryInput.checked = readBooleanSetting(OPEN_MINIMIZED_KEY);

    const memoryText = document.createElement("span");
    memoryText.textContent = "Abrir minimizado";

    memory.appendChild(memoryInput);
    memory.appendChild(memoryText);

    header.appendChild(title);
    header.appendChild(status);
    header.appendChild(memory);
    header.appendChild(collapse);
    shell.appendChild(header);

    const nav = document.createElement("div");
    nav.className = "cdsp-general-shell__modules";
    MODULES.forEach((module) => nav.appendChild(createModuleButton(module)));
    shell.appendChild(nav);

    const body = document.createElement("div");
    body.className = "cdsp-general-shell__body";

    const empty = document.createElement("div");
    empty.className = "cdsp-general-shell__empty";
    empty.textContent = "Selecione um modulo.";
    body.appendChild(empty);

    MODULES.forEach((module) => {
      const pane = document.createElement("div");
      pane.id = "cdsp-general-module-" + module.key;
      pane.className = "cdsp-general-shell__pane";
      pane.dataset.cdspModulePane = module.key;
      pane.hidden = true;
      body.appendChild(pane);
    });

    shell.appendChild(body);
    document.body.appendChild(shell);
    makeDraggable(shell, header);
    installWheelScrollPassThrough(shell);
    applySavedPosition(shell);

    const savedState = readShellState();
    setShellCollapsed(shell, readBooleanSetting(OPEN_MINIMIZED_KEY));

    memoryInput.addEventListener("change", () => {
      writeBooleanSetting(OPEN_MINIMIZED_KEY, memoryInput.checked);
    });

    collapse.addEventListener("click", (event) => {
      event.stopPropagation();
      const next = !shell.classList.contains("cdsp-general-shell--collapsed");
      setShellCollapsed(shell, next);
      window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      saveShellState(shell, { collapsed: next });
    });

    window.addEventListener("resize", () => {
      const rect = shell.getBoundingClientRect();
      const position = clampPosition(shell, rect.left, rect.top);
      shell.style.left = position.left + "px";
      shell.style.top = position.top + "px";
    });

    const lastActive = savedState.active || window.localStorage.getItem(ACTIVE_KEY);
    if (lastActive && moduleByKey(lastActive).key === lastActive) {
      ensureModuleLoaded(lastActive);
    }

    installRootToolsWatcher();
  }

  function forwardManagementMessage(data) {
    safeSendMessage({ type: "SPA_CDSP_MANAGEMENT_FETCH_TEAM_DB" }, (response) => {
      const lastError = safeLastError();
      window.postMessage(
        {
          source: MANAGEMENT_BRIDGE_SOURCE,
          type: "FETCH_TEAM_DB_RESPONSE",
          requestId: data.requestId,
          response: lastError
            ? { ok: false, error: contextInvalidatedMessage(lastError) }
            : response || { ok: false, error: "sem resposta" }
        },
        window.location.origin
      );
    });
  }

  function forwardTeamDatabaseMessage(data) {
    safeSendMessage({ type: "SPA_CDSP_MANAGEMENT_FETCH_TEAM_DB" }, (response) => {
      const lastError = safeLastError();
      window.postMessage(
        {
          source: TEAM_DATABASE_BRIDGE_SOURCE,
          type: "FETCH_TEAM_DB_RESPONSE",
          requestId: data.requestId,
          response: lastError
            ? { ok: false, error: contextInvalidatedMessage(lastError) }
            : response || { ok: false, error: "sem resposta" }
        },
        "*"
      );
    });
  }

  function forwardTriagemMessage(data) {
    safeSendMessage(
      {
        type: data.type,
        urls: Array.isArray(data.urls) ? data.urls : [data.url],
        group: data.group || null,
        phrases: Array.isArray(data.phrases) ? data.phrases : [],
        records: Array.isArray(data.records) ? data.records : [],
        record: data.record || null,
        config: data.config || null,
        password: typeof data.password === "string" ? data.password : "",
        processNumber: data.processNumber || "",
        tribunal: data.tribunal || "",
        query: data.query || "",
        exact: data.exact === true,
        delayMs: data.delayMs,
        payload: data.payload || null
      },
      (response) => {
        const lastError = safeLastError();
        window.postMessage(
          {
            source: PAGE_BRIDGE_SOURCE,
            type: "SPA_CDSP_OPEN_BACKGROUND_RESULT",
            requestId: data.requestId || "",
            response: response || null,
            error: lastError ? contextInvalidatedMessage(lastError) : ""
          },
          window.location.origin
        );
      }
    );
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;

    const data = event.data || {};
    if (data.source === MANAGEMENT_PAGE_SOURCE && data.type === "FETCH_TEAM_DB") {
      forwardManagementMessage(data);
      return;
    }

    if (data.source === TEAM_DATABASE_PAGE_SOURCE && data.type === "FETCH_TEAM_DB") {
      forwardTeamDatabaseMessage(data);
      return;
    }

    if (data.source === PAGE_SOURCE && TRIAGEM_ALLOWED_TYPES.indexOf(data.type) >= 0) {
      forwardTriagemMessage(data);
    }
  });

  window.addEventListener("cdsp-extrator-oficios-updated", () => {
    const pane = getOficiosPane();
    if (!pane || pane.hidden) return;
    if (pane.querySelector("[data-cdsp-oficios-running='1'], .copiando")) return;
    renderOficiosModule();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "CDSP_GENERAL_TOGGLE_MENU") return false;
    const shell = document.getElementById(SHELL_ID);
    if (shell) {
      setShellCollapsed(shell, !shell.classList.contains("cdsp-general-shell--collapsed"));
      window.localStorage.setItem(
        COLLAPSED_KEY,
        shell.classList.contains("cdsp-general-shell--collapsed") ? "1" : "0"
      );
      saveShellState(shell, {
        collapsed: shell.classList.contains("cdsp-general-shell--collapsed")
      });
    } else {
      installShell();
    }
    sendResponse({ ok: true });
    return false;
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installShell, { once: true });
  } else {
    installShell();
  }
})();
