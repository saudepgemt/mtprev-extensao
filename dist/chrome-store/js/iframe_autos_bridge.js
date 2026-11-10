/* MTPrev: painel de autos em iframes de processo (sem menu radial). */
(() => {
  'use strict';
  if (window.MTPREV_IFRAME_AUTOS_BRIDGE) return;
  window.MTPREV_IFRAME_AUTOS_BRIDGE = true;

  const allowed = new Set([
    'SPA_CDSP_SEARCH_AUTOS_DOCUMENT', 'SPA_CDSP_INSPECT_INITIAL_PETITION_DOCUMENT',
    'SPA_CDSP_ENSURE_PDF_LIB', 'SPA_CDSP_FETCH_PROCEDURE_MOVEMENTS',
    'SPA_CDSP_OPEN_BACKGROUND_TABS'
  ]);
  let pending = false;
  let installed = false;
  let retryId = null;

  // Mesma ponte do frame principal, limitada a operacoes de leitura/visualizacao.
  if (window !== window.top) window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.source !== 'SPA_CDSP_PAGE' || !allowed.has(data.type)) return;
    try {
      chrome.runtime.sendMessage({
        type: data.type,
        urls: Array.isArray(data.urls) ? data.urls : [data.url],
        processNumber: data.processNumber || '', tribunal: data.tribunal || '',
        query: data.query || '', exact: data.exact === true,
        records: Array.isArray(data.records) ? data.records : [],
        record: data.record || null, payload: data.payload || null,
        phrases: Array.isArray(data.phrases) ? data.phrases : []
      }, (response) => {
        const error = chrome.runtime.lastError;
        window.postMessage({
          source: 'SPA_CDSP_EXTENSION_BRIDGE',
          type: 'SPA_CDSP_OPEN_BACKGROUND_RESULT',
          requestId: data.requestId || '',
          response: response || null,
          error: error?.message || ''
        }, location.origin);
      });
    } catch (_) { /* Contexto da extensao pode ter sido recarregado. */ }
  });

  // Atalho do menu principal para um expediente aberto em iframe do mesmo SPA.
  // A injecao continua sendo solicitada PELO iframe, de modo que o background
  // injete apenas no frame correto (e nunca em todas as sub-janelas).
  if (window !== window.top) window.addEventListener('message', (event) => {
    if (event.source !== window.parent || !['https://spa.pge.mt.gov.br','https://pge.mt.spa.coreplan.com.br'].includes(event.origin)) return;
    const parentOrigin = event.origin;
    const data = event.data;
    if (data?.source !== 'MTPREV_AUTOS_MENU' || data.type !== 'MTPREV_OPEN_AUTOS_REQUEST' ||
        typeof data.requestId !== 'string' || !/^autos-\d+$/.test(data.requestId)) return;
    const reply = (ok, error = '') => {
      try {
        window.parent.postMessage({
          source:'MTPREV_IFRAME_AUTOS',type:'MTPREV_OPEN_AUTOS_RESULT',
          requestId:data.requestId,ok,error
        },parentOrigin);
      } catch (_) { /* A pagina mudou durante a solicitacao. */ }
    };
    if (!hasProcess()) {
      reply(false, 'O iframe ainda nao carregou um expediente.');
      return;
    }
    try {
      chrome.runtime.sendMessage({type:'MTPREV_INJECT_AUTOS_IFRAME'}, result => {
        const failure = chrome.runtime.lastError;
        if (failure || !result?.ok) {
          reply(false, failure?.message || result?.error || 'Falha ao inicializar o leitor no iframe.');
          return;
        }
        const panel = document.getElementById('spa-cdsp-external-docs-panel');
        if (panel) {
          if (panel.classList.contains('spa-cdsp-external-docs-collapsed')) {
            [...panel.querySelectorAll('button')].find(btn => /expandir/i.test(btn.textContent || ''))?.click();
          }
          panel.scrollIntoView({block:'start',behavior:'smooth'});
          panel.setAttribute('tabindex','-1'); panel.focus({preventScroll:true});
        }
        reply(Boolean(panel), panel ? '' : 'O SPA ainda nao disponibilizou os documentos do processo.');
      });
    } catch (error) { reply(false,error?.message || String(error)); }
  });

  // Reforça o visual da mesa sem substituir o JS radial ou os estilos do SPA.
  function applyWorkspaceAppearance() {
    if (window !== window.top || !/^\/workspace\/?$/.test(location.pathname)) return;
    if (document.getElementById('mtprev-workspace-unified-look')) return;
    const style = document.createElement('style');
    style.id = 'mtprev-workspace-unified-look';
    style.textContent = `
      body.mtprev-workspace-readable .workspace-panel.workspace-processes > .workspace-processes__toolbar,
      body.mtprev-workspace-readable .workspace-processes__toolbar {
        border-radius:16px 16px 0 0 !important;
        border-bottom:2px solid #13748a !important;
      }
      /* A identidade visual dos cards da mesa agora é única em radial_menu.js.
         Não sobrescrever a alternância nem a borda fina aqui. */
      body.mtprev-workspace-readable #workspace-process-results .workspace-process-list > article.workspace-process-card
        :is(.workspace-process-card__main,.workspace-process-card__footer,
            .workspace-process-card__summary,.workspace-process-card__fields,.workspace-process-card__received) {
        background:transparent !important;
        border-radius:0 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
    // O destaque de hover só reaparece quando o mouse sai e entra novamente.
    document.addEventListener('click', (event) => {
      const card = event.target.closest?.('#workspace-process-results article.workspace-process-card');
      if (card) card.classList.add('mtprev-workspace-hover-dismissed');
    }, true);
    document.addEventListener('pointerout', (event) => {
      const card = event.target.closest?.('#workspace-process-results article.workspace-process-card');
      if (card && !card.contains(event.relatedTarget)) card.classList.remove('mtprev-workspace-hover-dismissed');
    }, true);
  }
  applyWorkspaceAppearance();

  function hasProcess() {
    return Boolean(
      document.querySelector('.workspace-preview__document[data-procedure-id]') ||
      (/^\/procedures\/\d+(?:\/|$)/.test(location.pathname) &&
        document.querySelector('.procedure-header, .workspace-preview__document, .content__inner'))
    );
  }

  function tryInstall() {
    if (installed || pending || !hasProcess()) return;
    pending = true;
    try {
      chrome.runtime.sendMessage({ type: 'MTPREV_INJECT_AUTOS_IFRAME' }, (reply) => {
        pending = false;
        if (chrome.runtime.lastError || !reply?.ok) return;
        installed = true;
        if (retryId) clearInterval(retryId);
      });
    } catch (_) { pending = false; }
  }

  if (document.body) {
    new MutationObserver(tryInstall).observe(document.body, { childList: true, subtree: true });
  }
  retryId = setInterval(tryInstall, 1500);
  tryInstall();
  // O preview lateral de /workspace vive no DOCUMENTO PRINCIPAL (nao em iframe).
  // Em paginas de processo independentes, o mesmo layout pode existir no iframe.
  // Limitar-se estritamente ao preview, jamais aos cards da mesa de trabalho.
  // Preserva os nos nativos do SPA, seus listeners e a rolagem existente.
  const mtprevExpedientesActivated = new WeakMap();
  const mtprevPreviewRootsListening = new WeakSet();

  function mtprevCleanLabel(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
  }

  // O Coreplan usa <span> no cabecalho, nao <h3>/<strong>.
  // Ler primeiro as SECOES NATIVAS do preview impede selecionar cards
  // internos ou elementos da mesa de trabalho que ficam atras do drawer.
  function mtprevFindSection(scope, names) {
    if (!scope) return null;
    for (const section of scope.querySelectorAll('.workspace-preview__section')) {
      const heading = section.querySelector(':scope > .workspace-preview__section-heading');
      if (!heading) continue;
      const title = heading.querySelector(':scope > div > span, :scope > span, .workspace-preview__section-title, h2, h3, h4');
      const label = mtprevCleanLabel(title?.textContent);
      if (names.some(name => name.test(label))) return section;
    }
    // Compatibilidade com folhas antigas que usam h2/h3/card-title.
    const headings = scope.querySelectorAll('h2,h3,h4,h5,h6,.card-title,.workspace-preview__card-title,.workspace-preview__section-title');
    for (const heading of headings) {
      if (heading.closest('.mtprev-card-header')) continue;
      if (!names.some(name => name.test(mtprevCleanLabel(heading.textContent)))) continue;
      const section = heading.closest('.workspace-preview__section,section.workspace-preview__card,article.workspace-preview__card');
      if (section && scope.contains(section)) return section;
    }
    return null;
  }

  function mtprevFindProcessData(scope) {
    const explicit = mtprevFindSection(scope, [/^dados do processo$/, /^informa[cç][oõ]es do processo$/, /^detalhes do processo$/]);
    if (explicit) return explicit;
    const grid = scope?.querySelector('.workspace-preview__overview-grid');
    if (!grid) return null;
    for (const field of grid.querySelectorAll('.workspace-preview__field')) {
      let node = field.parentElement;
      while (node && node !== grid) {
        const count = node.querySelectorAll('.workspace-preview__field').length;
        const cls = typeof node.className === 'string' ? node.className : '';
        if (count >= 4 && (/card|section|detail|overview|column|info/.test(cls) || /^(SECTION|ARTICLE)$/.test(node.tagName))) {
          return node;
        }
        node = node.parentElement;
      }
    }
    return null;
  }

  function mtprevPreviewStyle() {
    if (document.getElementById('mtprev-preview-layout-style')) return;
    const style = document.createElement('style');
    style.id = 'mtprev-preview-layout-style';
    style.textContent = `
      /* O SPA ja usa uma grid em Visao geral. Criar outra dentro dela fazia
         a nova grade ocupar apenas a metade esquerda da folha lateral. */
      /* A aba nativa usa .is-active: NAO forcar display:block quando
         Andamentos, Anotacoes, Usuarios ou outra aba estiver aberta. */
      #workspace-process-preview .workspace-preview__panel:not(.is-active),
      #workspace-process-preview #workspace-preview-overview.mtprev-overview-hidden,
      .workspace-preview__document .workspace-preview__panel:not(.is-active),
      .workspace-preview__document #workspace-preview-overview.mtprev-overview-hidden {
        display:none !important;
      }
      #workspace-preview-overview.mtprev-overview-ready.is-active {
        width:100% !important;
        max-width:none !important;
        min-width:0 !important;
      }
      #workspace-preview-overview[hidden],
      #workspace-preview-overview[aria-hidden="true"],
      #workspace-preview-overview.d-none,
      #workspace-preview-overview[style*="display: none"],
      #workspace-preview-overview[style*="display:none"] {
        display:none !important;
      }
      #workspace-preview-overview.mtprev-overview-ready > #spa-cdsp-external-docs-panel {
        width:100% !important;
        max-width:none !important;
        box-sizing:border-box !important;
        margin:0 0 12px !important;
      }
      #workspace-preview-overview > .mtprev-overview-layout {
        display:grid !important;
        grid-template-columns:minmax(0,1fr) minmax(0,1fr) !important;
        grid-template-areas:
          "prazos ultimos"
          "relacionados situacao"
          "dados eventos" !important;
        gap:16px !important;
        width:100% !important;
        max-width:none !important;
        min-width:0 !important;
        align-items:start !important;
        margin:0 0 14px !important;
        box-sizing:border-box !important;
      }
      #workspace-preview-overview .mtprev-overview-cell { min-width:0 !important; width:100% !important; align-self:start !important; }
      #workspace-preview-overview .mtprev-cell-prazos { grid-area:prazos !important; }
      #workspace-preview-overview .mtprev-cell-ultimos { grid-area:ultimos !important; }
      #workspace-preview-overview .mtprev-cell-relacionados { grid-area:relacionados !important; }
      #workspace-preview-overview .mtprev-cell-situacao { grid-area:situacao !important; }
      #workspace-preview-overview .mtprev-cell-dados { grid-area:dados !important; }
      #workspace-preview-overview .mtprev-cell-eventos { grid-area:eventos !important; }
      #workspace-preview-overview .workspace-preview__overview-grid.mtprev-overview-source-empty {display:none !important;}
      #workspace-preview-overview .mtprev-overview-cell > .mtprev-managed-card,
      .mtprev-users-pane > .mtprev-managed-card { width:100% !important; max-width:none !important; min-width:0 !important; margin:0 !important; box-sizing:border-box !important; }
      #workspace-preview-overview .mtprev-managed-card,
      .mtprev-users-pane .mtprev-managed-card {
        overflow:hidden !important;
        border-radius:11px !important;
        border:1px solid #dbe3ec !important;
        background:#fff !important;
        box-shadow:0 2px 7px rgba(20,47,71,.06) !important;
      }
      /* Header encostado nas bordas do card, com conteudo nativo preservado. */
      #workspace-preview-overview .workspace-preview__section.mtprev-managed-card,
      .mtprev-users-pane .workspace-preview__section.mtprev-managed-card {padding:0 !important;}
      #workspace-preview-overview .workspace-preview__section.mtprev-managed-card > :not(.mtprev-card-header):not(.workspace-preview__section-heading),
      .mtprev-users-pane .workspace-preview__section.mtprev-managed-card > :not(.mtprev-card-header):not(.workspace-preview__section-heading) {
        margin-left:12px !important;margin-right:12px !important;
      }
      #workspace-preview-overview .workspace-preview__section.mtprev-managed-card > .workspace-preview__section-heading,
      .mtprev-users-pane .workspace-preview__section.mtprev-managed-card > .workspace-preview__section-heading {
        padding:8px 12px 0 !important;margin:0 !important;
      }
      #workspace-preview-overview .mtprev-card-header,
      .mtprev-users-pane .mtprev-card-header {
        display:flex !important;
        align-items:center !important;
        justify-content:space-between !important;
        gap:8px !important;
        min-height:43px !important;
        padding:8px 12px !important;
        background:linear-gradient(100deg,#1c4055,#27586c) !important;
        color:#f6fbff !important;
        border-bottom:1px solid #385e71 !important;
        border-radius:10px 10px 0 0 !important;
        box-sizing:border-box !important;
      }
      #workspace-preview-overview .mtprev-card-header strong,
      .mtprev-users-pane .mtprev-card-header strong {color:#f6fbff !important;font-size:12px !important;font-weight:750 !important;line-height:1.4 !important;}
      #workspace-preview-overview .mtprev-card-actions,
      .mtprev-users-pane .mtprev-card-actions {display:flex !important;align-items:center !important;gap:5px !important;flex-shrink:0 !important;}
      #workspace-preview-overview .mtprev-card-control,
      .mtprev-users-pane .mtprev-card-control {
        width:27px !important;height:26px !important;padding:0 !important;
        border:1px solid rgba(255,255,255,.26) !important;
        background:rgba(255,255,255,.12) !important;
        color:#fff !important;border-radius:6px !important;
        cursor:pointer !important;font-size:16px !important;line-height:1 !important;
        display:inline-flex !important;align-items:center !important;justify-content:center !important;
      }
      #workspace-preview-overview .mtprev-card-control:hover,
      .mtprev-users-pane .mtprev-card-control:hover {background:rgba(255,255,255,.3) !important;}
      #workspace-preview-overview .mtprev-managed-card.mtprev-card-collapsed > :not(.mtprev-card-header),
      .mtprev-users-pane .mtprev-managed-card.mtprev-card-collapsed > :not(.mtprev-card-header) {display:none !important;}
      #workspace-preview-overview .mtprev-managed-card.mtprev-card-closed,
      .mtprev-users-pane .mtprev-managed-card.mtprev-card-closed {display:none !important;}
      #workspace-preview-overview .mtprev-native-card-title,
      .mtprev-users-pane .mtprev-native-card-title {display:none !important;}
      #workspace-preview-overview .mtprev-native-heading-empty,
      .mtprev-users-pane .mtprev-native-heading-empty {display:none !important;}
      #workspace-preview-overview .mtprev-native-heading-tools,
      .mtprev-users-pane .mtprev-native-heading-tools {justify-content:flex-end !important;}
      #workspace-preview-overview .mtprev-restore-cards {
        display:block;margin:4px 0 10px auto;padding:6px 10px;
        border:1px solid #b5d6e4;border-radius:7px;
        background:#eaf5fa;color:#24566c;font-size:12px;cursor:pointer;
      }
      #workspace-preview-overview .mtprev-restore-cards[hidden] {display:none !important;}
      #workspace-preview-overview .mtprev-recent-body {padding:10px 12px 12px !important;display:grid;gap:8px;}
      #workspace-preview-overview .mtprev-recent-item {display:grid;grid-template-columns:6px minmax(0,1fr);gap:10px;align-items:start;padding:7px 8px;border:1px solid #e1eaf1;border-radius:8px;background:#f8fbfd;color:#253e53;min-width:0;}
      #workspace-preview-overview .mtprev-recent-item::before {content:"";display:block;width:6px;height:100%;min-height:24px;border-radius:5px;background:#4b8fb7;}
      #workspace-preview-overview .mtprev-recent-item strong {display:block;font-size:12px;line-height:1.4;overflow-wrap:anywhere;color:#263f52;}
      #workspace-preview-overview .mtprev-recent-item small {display:block;font-size:10px;line-height:1.5;color:#70849a;margin-top:3px;}
      #workspace-preview-overview .mtprev-recent-placeholder {font-size:12px;line-height:1.5;color:#6c7e91;margin:0;}
      #workspace-preview-overview .mtprev-recent-footer {display:flex;justify-content:flex-end;margin-top:2px;}
      #workspace-preview-overview .mtprev-recent-view-all {border:1px solid #b7cee2;border-radius:7px;background:#edf5fb;color:#165c8c;cursor:pointer;padding:5px 9px;font-size:11px;font-weight:650;}
      /* Ritmo uniforme, sem alterar a paleta ou os controles nativos. */
      #workspace-preview-overview .mtprev-card-header {
        min-height:48px !important;
        padding:10px 14px !important;
        gap:12px !important;
      }
      #workspace-preview-overview .mtprev-card-header strong {
        font-size:13px !important;
        min-width:0;
        overflow-wrap:anywhere;
      }
      #workspace-preview-overview .mtprev-card-control {
        width:30px !important;height:30px !important;
        flex:0 0 30px;
      }
      #workspace-preview-overview .mtprev-card-control:focus-visible {
        outline:2px solid currentColor;
        outline-offset:2px;
      }
      #workspace-preview-overview .mtprev-overview-cell:is(.mtprev-cell-prazos,.mtprev-cell-ultimos) {
        align-self:stretch !important;
        display:flex;
      }
      #workspace-preview-overview .mtprev-overview-cell:is(.mtprev-cell-prazos,.mtprev-cell-ultimos) > .mtprev-managed-card {
        flex:1 1 auto;
      }
      #workspace-preview-overview .mtprev-managed-card.mtprev-card-collapsed {
        align-self:flex-start !important;
      }
      #workspace-preview-overview .mtprev-managed-card.mtprev-card-collapsed .mtprev-card-header {
        border-bottom:0 !important;
        border-radius:10px !important;
      }
      #workspace-preview-overview .workspace-preview__section.mtprev-managed-card > :not(.mtprev-card-header):not(.workspace-preview__section-heading) {
        margin-left:14px !important;margin-right:14px !important;
      }
      #workspace-preview-overview .workspace-preview__section.mtprev-managed-card > .workspace-preview__section-heading {
        padding:10px 14px !important;
      }
      #workspace-preview-overview .mtprev-managed-card > :last-child:not(.mtprev-card-header) {
        margin-bottom:14px !important;
      }
      #workspace-preview-overview .workspace-preview__section-tools {
        display:flex;align-items:center;gap:8px;flex-wrap:wrap;
      }
      #workspace-preview-overview .workspace-preview__relationship-tabs {
        display:flex;align-items:center;flex-wrap:wrap;gap:8px;
        padding-top:12px;
        margin-bottom:12px !important;
      }
      #workspace-preview-overview .workspace-preview__relationship-tabs button {
        min-height:36px;
        padding:8px 12px;
      }
      #workspace-preview-overview .workspace-preview__facts {
        gap:12px !important;
        padding-top:12px;
      }
      #workspace-preview-overview .workspace-preview__field {
        min-width:0;
        line-height:1.5;
        padding-block:6px;
      }
      #workspace-preview-overview .workspace-preview__field :is(strong,a) {
        white-space:normal !important;
        overflow-wrap:anywhere;
      }
      #workspace-preview-overview .mtprev-recent-body {
        padding:14px !important;
        box-sizing:border-box !important;
        gap:10px;
      }
      #workspace-preview-overview #mtprev-recent-movements > .mtprev-recent-body {
        margin:0 !important;
        width:100% !important;
        min-width:0 !important;
      }
      #workspace-preview-overview .mtprev-cell-prazos :is(
        .workspace-preview__deadline,
        .workspace-preview__deadline-item,
        .workspace-preview__deadline-card,
        .workspace-preview__deadlines > article,
        .workspace-preview__deadlines > li,
        .workspace-preview__deadlines > div
      ) {
        background:#f0f6fa !important;
        border-color:#c4d8e4 !important;
      }
      #workspace-preview-overview .mtprev-recent-item {
        padding:10px;
        gap:10px;
      }
      #workspace-preview-overview .mtprev-recent-item small {font-size:11px;}
      #workspace-preview-overview #mtprev-recent-movements {
        border-color:#91b5c5 !important;
        box-shadow:0 3px 12px rgba(28,64,85,.12) !important;
      }
      #workspace-preview-overview #mtprev-recent-movements > .mtprev-card-header {
        border-bottom:3px solid #4b8fa6 !important;
      }
      #workspace-preview-overview .mtprev-recent-item {
        background:#f0f6fa;
        border-color:#c4d8e4;
        padding:12px;
        border-radius:9px;
      }
      #workspace-preview-overview .mtprev-recent-item strong {
        font-size:13px;
        line-height:1.5;
        color:#1c4055;
      }
      #workspace-preview-overview .mtprev-recent-item small {
        color:#506b80;
        margin-top:5px;
      }
      #workspace-preview-overview .mtprev-recent-item:first-child {
        background:#e2eff5;
        border-color:#7faabd;
      }
      #workspace-preview-overview .mtprev-recent-item:first-child::before {
        background:#27586c;
      }
      #workspace-preview-overview .mtprev-recent-latest {
        display:inline-block;
        margin-bottom:6px;
        padding:3px 8px;
        border-radius:5px;
        background:#27586c;
        color:#fff;
        font:650 10px/1.4 system-ui,'Segoe UI',sans-serif;
        letter-spacing:.02em;
      }
      #workspace-preview-overview .mtprev-recent-view-all {
        min-height:34px;
        padding:7px 12px;
      }
      #workspace-preview-overview .mtprev-recent-person {
        margin-top:7px;
        color:#234f65;
        font:650 12px/1.5 'Segoe UI',Arial,sans-serif;
        overflow-wrap:anywhere;
      }
      .workspace-preview__document .mtprev-timeline-recent {
        background:#f0f6fa !important;
        border-color:#a6c5d5 !important;
        box-shadow:inset 4px 0 #4b8fb7 !important;
      }
      .workspace-preview__document .mtprev-timeline-latest {
        background:#e2eff5 !important;
        border-color:#7faabd !important;
        box-shadow:inset 5px 0 #27586c !important;
      }
      .workspace-preview__document .mtprev-movement-person,
      .workspace-preview__document .mtprev-movement-person :is(span,a) {
        font-family:'Segoe UI',Arial,sans-serif !important;
        font-size:14px !important;
        font-weight:700 !important;
        line-height:1.5 !important;
        color:#193e55 !important;
        opacity:1 !important;
        white-space:normal !important;
        overflow-wrap:anywhere !important;
        text-overflow:clip !important;
      }
      /* Identificação de quem realizou o andamento, restrita à timeline do processo. */
      .workspace-preview__document :is(.workspace-preview__timeline-item,.workspace-preview__timeline-entry,.workspace-preview__movement,.workspace-preview__activity,.timeline-item,.timeline__item,.timeline-entry)
      :is([class*="timeline-user"],[class*="timeline-author"],[class*="timeline-actor"],[class*="timeline__user"],[class*="timeline__author"],[class*="movement-user"],[class*="activity-author"]) {
        font-size:13px !important;
        font-weight:650 !important;
        line-height:1.55 !important;
        color:#234f65 !important;
        white-space:normal !important;
        overflow-wrap:anywhere;
        text-overflow:clip !important;
        max-width:100%;
      }
      .workspace-preview__document :is(.workspace-preview__timeline-item,.workspace-preview__timeline-entry,.workspace-preview__movement,.workspace-preview__activity,.timeline-item,.timeline__item,.timeline-entry)
      :is([class*="timeline-user"],[class*="timeline-author"],[class*="timeline-actor"],[class*="timeline__user"],[class*="timeline__author"],[class*="movement-user"],[class*="activity-author"])
      :is(a,span):not([class*="avatar"]):not([class*="icon"]):not([aria-hidden="true"]) {
        font-size:inherit !important;
        font-weight:inherit !important;
        color:inherit !important;
        white-space:normal !important;
        overflow-wrap:anywhere;
      }
      .workspace-preview__document .mtprev-users-tab.mtprev-users-selected {color:#1767bf !important;font-weight:700 !important;border-bottom:2px solid #1767bf !important;}
      .workspace-preview__document .mtprev-users-pane {display:block;padding:12px 0 16px;min-width:0;}
      .workspace-preview__document .mtprev-users-pane[hidden] {display:none !important;}
      @media(max-width:700px) {
        #workspace-preview-overview > .mtprev-overview-layout {
          grid-template-columns:minmax(0,1fr) !important;
          grid-template-areas:"prazos" "ultimos" "relacionados" "situacao" "dados" "eventos" !important;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function mtprevEnhanceCard(card, label, overview) {
    if (!card || card.id === 'spa-cdsp-external-docs-panel' || !overview?.contains(card)) return;
    if (card.classList.contains('mtprev-managed-card')) return;
    card.classList.add('mtprev-managed-card');
    const header = document.createElement('div');
    header.className = 'mtprev-card-header';
    const title = document.createElement('strong');
    title.textContent = label;
    const actions = document.createElement('div');
    actions.className = 'mtprev-card-actions';
    const collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.className = 'mtprev-card-control';
    collapse.textContent = '⌃';
    collapse.title = 'Recolher ' + label;
    collapse.setAttribute('aria-label', collapse.title);
    collapse.setAttribute('aria-expanded', 'true');
    collapse.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      const closed = card.classList.toggle('mtprev-card-collapsed');
      collapse.textContent = closed ? '⌄' : '⌃';
      collapse.title = (closed ? 'Expandir ' : 'Recolher ') + label;
      collapse.setAttribute('aria-label', collapse.title);
      collapse.setAttribute('aria-expanded', String(!closed));
    });
    actions.append(collapse);
    header.append(title, actions);
    card.prepend(header);
    const nativeHeading = card.querySelector(':scope > .workspace-preview__section-heading');
    if (nativeHeading) {
      const nativeTitle = nativeHeading.querySelector(':scope > div > span, :scope > span');
      if (nativeTitle && mtprevCleanLabel(nativeTitle.textContent) === mtprevCleanLabel(label)) {
        const nativeCopy = nativeTitle.parentElement;
        nativeTitle.classList.add('mtprev-native-card-title');
        const hint = nativeCopy?.querySelector('small');
        if (hint) hint.classList.add('mtprev-native-card-title');
        const hasTools = Boolean(nativeHeading.querySelector('button,a,input,select,.workspace-preview__section-tools'));
        nativeHeading.classList.add(hasTools ? 'mtprev-native-heading-tools' : 'mtprev-native-heading-empty');
      }
    }
    const headings = card.querySelectorAll('h2,h3,h4,h5,h6,.card-title,.workspace-preview__card-title,.workspace-preview__section-title,strong');
    for (const heading of headings) {
      if (heading.closest('.mtprev-card-header')) continue;
      const currentHeading = mtprevCleanLabel(heading.textContent);
      const isSectionHeading = currentHeading === mtprevCleanLabel(label) ||
        (label === 'Processos relacionados' && currentHeading === 'processos relacionados') ||
        (label === 'Prazos em aberto' && /^prazos(?: em aberto| do processo| processuais)?$/.test(currentHeading)) ||
        (label === 'Últimos 3 andamentos' && currentHeading === 'últimos 3 andamentos');
      if (isSectionHeading && !heading.querySelector('button,a,input,select')) {
        heading.classList.add('mtprev-native-card-title');
        break;
      }
    }
  }

  function mtprevActivateExpedientes(card) {
    if (!card || mtprevExpedientesActivated.has(card)) return;
    const tab = Array.from(card.querySelectorAll('button,a,[role="tab"]')).find(item =>
      /^expedientes(?:\s*\d+)?$/.test(mtprevCleanLabel(item.textContent))
    );
    if (!tab) return;
    const info = { manual:false, tries:0 };
    mtprevExpedientesActivated.set(card,info);
    // Interrompe as tentativas quando o usuario escolher qualquer categoria.
    card.addEventListener('click', event => {
      if (!event.isTrusted || !event.target?.closest?.('button,a,[role="tab"]')) return;
      info.manual = true;
    }, true);
    const active = () => tab.getAttribute('aria-expanded') === 'true' || tab.getAttribute('aria-selected') === 'true' || tab.getAttribute('aria-pressed') === 'true' ||
      /(?:^|\s)(?:active|is-active|selected)(?:\s|$)/.test(tab.className || '');
    const hasLoaded = () => {
      const content = card.querySelector('[data-workspace-relationship-content],.workspace-preview__relationship-content,.workspace-preview__related-items,.workspace-preview__related-content,[class*="related-list"],[class*="related-content"]');
      const text = mtprevCleanLabel(content?.textContent || '');
      return Boolean(content && text && !/selecione uma categoria|carregando|nenhum item selecionado/.test(text));
    };
    const choose = () => {
      if (info.manual || !tab.isConnected || !card.isConnected || hasLoaded()) return;
      // Repetir o clique numa aba ja selecionada pode FECHAR Expedientes.
      if (active()) return;
      info.tries += 1;
      tab.click(); // Handler nativo do SPA, sem acesso a endpoints de escrita.
      // O SPA pode criar os controladores depois do primeiro render.
      if (info.tries < 3) setTimeout(choose, 700 * info.tries);
    };
    // Primeiro clique com o card ainda no container original do SPA.
    choose();
  }

  function mtprevCreateUsersTab(root, overview, usersCard) {
    if (!usersCard || !root || root.querySelector('.mtprev-users-tab')) return;
    const nav = Array.from(root.querySelectorAll('button,a,[role="tab"]')).find(item =>
      /^anota[cç][oõ]es(?:\s*\d+)?$/.test(mtprevCleanLabel(item.textContent))
    );
    if (!nav) return; // Sem a estrutura das abas, nao retirar usuarios da tela.
    const originalLi = nav.closest('li');
    const cloned = (originalLi && originalLi.contains(nav) ? originalLi : nav).cloneNode(true);
    const button = cloned.matches('button,a,[role="tab"]') ? cloned : cloned.querySelector('button,a,[role="tab"]');
    if (!button) return;
    for (const element of [cloned, ...cloned.querySelectorAll('*')]) {
      element.removeAttribute('id');
      for (const attr of Array.from(element.attributes)) {
        if (attr.name.startsWith('data-')) element.removeAttribute(attr.name);
      }
    }
    button.classList.add('mtprev-users-tab');
    button.setAttribute('aria-controls','mtprev-workspace-users');
    button.setAttribute('aria-label','Usuários');
    button.setAttribute('aria-selected','false');
    if (button.tagName === 'A') button.setAttribute('href','#mtprev-workspace-users');
    if (button.tagName === 'BUTTON') button.type = 'button';
    button.replaceChildren();
    const icon = document.createElement('i');
    icon.className = 'zmdi zmdi-accounts';
    icon.setAttribute('aria-hidden','true');
    button.append(icon, document.createTextNode(' Usuários'));

    const pane = document.createElement('section');
    pane.id = 'mtprev-workspace-users';
    pane.className = 'mtprev-users-pane';
    pane.hidden = true;
    pane.appendChild(usersCard);
    overview.insertAdjacentElement('afterend',pane);
    (originalLi && originalLi.contains(nav) ? originalLi : nav).insertAdjacentElement('afterend',cloned);

    const overviewNav = Array.from(root.querySelectorAll('button,a,[role="tab"]')).find(item =>
      /^vis[aã]o geral(?:\s*\d+)?$/.test(mtprevCleanLabel(item.textContent))
    );
    const showUsers = active => {
      pane.hidden = !active;
      overview.classList.toggle('mtprev-overview-hidden',active);
      if (active) overview.style.display = 'none';
      else overview.style.removeProperty('display');
      button.classList.toggle('mtprev-users-selected',active);
      button.classList.toggle('active',active);
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-selected',String(active));
    };
    button.addEventListener('click', event => {
      event.preventDefault(); event.stopImmediatePropagation();
      // Ativa primeiro a aba nativa Visao geral para ocultar os paineis do SPA.
      // Em seguida exibimos Usuarios na mesma area rolavel.
      if (overviewNav && overviewNav !== button) overviewNav.click();
      showUsers(true);
      for (const sibling of root.querySelectorAll('button[aria-selected="true"],a[aria-selected="true"]')) {
        if (sibling === button) continue;
        if (sibling.closest('li')?.parentElement === button.closest('li')?.parentElement || sibling.parentElement === button.parentElement) {
          sibling.classList.remove('active','is-active');
          sibling.setAttribute('aria-selected','false');
        }
      }
    });
    if (!mtprevPreviewRootsListening.has(root)) {
      mtprevPreviewRootsListening.add(root);
      // Cliques nos outros botoes mantem a navegacao original do SPA.
      root.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target.closest('button,a,[role="tab"]') : null;
        if (!target || target === button || !root.contains(target)) return;
        if (!/^(?:vis[aã]o geral|andamentos|movimenta[cç][oõ]es externas|movimenta[cç][oõ]es internas|anota[cç][oõ]es)(?:\s*\d+)?$/.test(mtprevCleanLabel(target.textContent))) return;
        showUsers(false);
      }, true);
    }
  }

  function mtprevGetPreviewRoot() {
    // #workspace-process-preview é a folha lateral real, irmã da mesa SPA,
    // como documentado no HTML /workspace entregue pelo usuário.
    const sheet = document.querySelector('#workspace-process-preview');
    const inSheet = sheet?.querySelector('.workspace-preview__document[data-procedure-id]');
    if (inSheet) return inSheet;
    // Compatibilidade com a pagina de processo completo e com iframes.
    // Nao procurar qualquer outro documento no /workspace principal:
    // isso poderia afetar os cards da mesa e abrir outra area rolavel.
    if (window.top !== window || /^\/procedures\/\d+(?:\/|$)/.test(location.pathname)) {
      return document.querySelector('.workspace-preview__document[data-procedure-id]');
    }
    return null;
  }

  // O SPA nao inclui o HTML do preview lateral na resposta inicial de /workspace.
  // A aba Andamentos e carregada sob demanda. A leitura abaixo usa somente a
  // linha do tempo do proprio processo e nao altera a aba visivel.
  const mtprevRecentByRoot = new WeakMap();
  const MTPREV_TIMELINE_ITEMS = '.workspace-preview__timeline-item,.workspace-preview__timeline-entry,.workspace-preview__movement,.workspace-preview__activity,.timeline-item,.timeline__item,.timeline-entry';

  function mtprevReadTimeline(documentOrNode, includeNodes = false) {
    const items = Array.from(documentOrNode?.querySelectorAll(MTPREV_TIMELINE_ITEMS) || []);
    return items.filter(node => !items.some(other => other !== node && other.contains(node)))
      .map(node => {
        const fullText = String(node.textContent || '').replace(/\s+/g,' ').trim();
        if (fullText.length < 6 || fullText.length > 1400) return null;
        const explicitDate = node.querySelector('time[datetime]')?.getAttribute('datetime') || node.getAttribute('datetime') || '';
        const match = fullText.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s*(?:[àa]s\s*)?(\d{1,2}):(\d{2}))?/i);
        const dateMs = explicitDate ? Date.parse(explicitDate) : match
          ? Date.UTC(+match[3],+match[2]-1,+match[1],+(match[4]||0),+(match[5]||0)) : NaN;
        const titleNode = node.querySelector('[class*="timeline-title"],[class*="timeline__title"],[class*="movement-title"],[class*="activity-title"],h3,h4,h5,strong');
        let title = String(titleNode?.textContent || '').replace(/\s+/g,' ').trim();
        if (!title || title.length > 190) title = fullText.slice(0, 145);
        const dateLabel = match ? match[0] : String(node.querySelector('time')?.textContent || '').replace(/\s+/g,' ').trim().slice(0,80);
        let actorNode = node.querySelector('.mtprev-movement-person,[class*="timeline-user"],[class*="timeline-author"],[class*="movement-user"],[class*="activity-author"]');
        if (!actorNode) {
          const avatar = node.querySelector('[class*="avatar"]');
          actorNode = Array.from(avatar?.parentElement?.children || []).find(sibling =>
            sibling !== avatar && !sibling.contains(avatar) &&
            !sibling.matches('img,svg,button,time,[class*="avatar"]') &&
            !sibling.querySelector('img,svg,button,time') && sibling.textContent.trim()
          );
        }
        const actor = String(actorNode?.textContent || '').replace(/\s+/g,' ').trim().slice(0,160);
        return {title:title.slice(0,190),dateLabel,actor,dateMs:Number.isFinite(dateMs)?dateMs:0,...(includeNodes ? {node} : {})};
      }).filter(Boolean).filter((item,index,list)=>list.findIndex(other=>other.title===item.title && other.dateLabel===item.dateLabel)===index)
      .sort((a,b)=> a.dateMs && b.dateMs ? b.dateMs-a.dateMs : 0).slice(0,3);
  }

  function mtprevFindAndamentosNav(root) {
    return Array.from(root.querySelectorAll('button,a,[role="tab"]')).find(item =>
      /^andamentos(?:\s*\d+)?$/.test(mtprevCleanLabel(item.textContent)) && !item.closest('.mtprev-overview-layout')
    ) || null;
  }

  function mtprevRenderRecent(root) {
    const card = root.querySelector('#mtprev-recent-movements');
    const body = card?.querySelector('.mtprev-recent-body');
    if (!body) return;
    const state = mtprevRecentByRoot.get(root);
    const entries = state?.entries || [];
    body.replaceChildren();
    if (entries.length) {
      for (const entry of entries) {
        const item = document.createElement('div');
        item.className = 'mtprev-recent-item';
        const main = document.createElement('div');
        if (entry === entries[0]) {
          const badge = document.createElement('span');
          badge.className = 'mtprev-recent-latest';
          badge.textContent = 'Mais recente';
          main.appendChild(badge);
        }
        const title = document.createElement('strong');
        title.textContent = entry.title;
        const meta = document.createElement('small');
        meta.textContent = entry.dateLabel || 'Andamento registrado no SPA';
        main.append(title,meta);
        const person = document.createElement('div');
        person.className = 'mtprev-recent-person';
        person.textContent = entry.actor || 'Autor não informado pelo SPA';
        main.appendChild(person);
        item.append(main);
        body.appendChild(item);
      }
    } else {
      const message = document.createElement('p');
      message.className = 'mtprev-recent-placeholder';
      message.textContent = state?.loading ? 'Consultando os últimos andamentos do SPA…' :
        'Os andamentos ainda não estão disponíveis para consulta nesta sessão. Abra a aba Andamentos para carregá-los.';
      body.appendChild(message);
    }
    const footer = document.createElement('div');
    footer.className = 'mtprev-recent-footer';
    const all = document.createElement('button');
    all.type = 'button';
    all.className = 'mtprev-recent-view-all';
    all.textContent = 'Ver todos os andamentos';
    all.addEventListener('click', () => mtprevFindAndamentosNav(root)?.click());
    footer.appendChild(all);
    body.appendChild(footer);
  }

  function mtprevRefreshRecent(root) {
    const processId = String(root.getAttribute('data-procedure-id') || '').trim();
    if (!/^\d{1,16}$/.test(processId)) return;
    let state = mtprevRecentByRoot.get(root);
    if (state && state.processId !== processId) state = null;
    if (!state) {
      state = {processId,entries:[],loading:false,loaded:false,attemptedAt:0};
      mtprevRecentByRoot.set(root,state);
    }
    // Se a aba Andamentos ja foi carregada pelo SPA, ela e a fonte preferida.
    const live = mtprevReadTimeline(root);
    if (live.length) {
      const changed = JSON.stringify(state.entries) !== JSON.stringify(live);
      state.entries=live;state.loaded=true;state.loading=false;
      if (changed) mtprevRenderRecent(root);
      return;
    }
    if (state.loading || state.loaded || Date.now()-state.attemptedAt < 30000) return;
    state.loading=true;state.attemptedAt=Date.now();
    mtprevRenderRecent(root);
    // Mesmo caminho de leitura usado no acompanhamento de processos: nunca
    // inferir dados de outra pessoa/processo nem executar acao de escrita.
    const url = new URL('/workspace/processes/'+processId+'/timeline',location.origin);
    if (url.origin !== location.origin || !/^\/(workspace\/processes\/\d+\/timeline)$/.test(url.pathname)) return;
    fetch(url.href,{credentials:'same-origin',headers:{Accept:'text/html, application/json'},redirect:'error'})
      .then(async response => {
        if (!response.ok) throw new Error('HTTP '+response.status);
        const raw=(await response.text()).slice(0,1500000);
        if (/\<form[^>]+(?:sign.in|login)/i.test(raw)) throw new Error('Sessão de autenticação expirada');
        let html=raw;
        if (/^\s*\{/.test(raw)) {
          const json=JSON.parse(raw);
          html=typeof json.html==='string'?json.html:typeof json.content==='string'?json.content:'';
        }
        if (!html) return [];
        const doc=new DOMParser().parseFromString(html,'text/html');
        return mtprevReadTimeline(doc);
      })
      .then(entries => {
        if (!root.isConnected || mtprevRecentByRoot.get(root)!==state) return;
        if (entries.length) {state.entries=entries;state.loaded=true;}
        state.loading=false;
        mtprevRenderRecent(root);
      })
      .catch(() => {
        if (!root.isConnected || mtprevRecentByRoot.get(root)!==state) return;
        state.loading=false;mtprevRenderRecent(root);
      });
  }

  function mtprevGetOverviewCell(layout,key) {
    let cell = layout.querySelector('.mtprev-cell-'+key);
    if (!cell) {
      cell = document.createElement('div');
      cell.className = 'mtprev-overview-cell mtprev-cell-'+key;
      cell.dataset.mtprevSlot=key;
      layout.appendChild(cell);
    }
    return cell;
  }

  function mtprevEnhanceMovementPeople(root) {
    if (!root) return;
    for (const item of root.querySelectorAll(MTPREV_TIMELINE_ITEMS)) {
      // O nome pode ser um irmão do avatar, sem classe de autor no SPA.
      for (const avatar of item.querySelectorAll('[class*="avatar"]')) {
        const row = avatar.parentElement;
        if (!row || row === item) continue;
        for (const sibling of row.children) {
          if (sibling === avatar || sibling.contains(avatar) ||
              sibling.matches('img,svg,button,time,[class*="avatar"]') ||
              sibling.querySelector('img,svg,button,time')) continue;
          if (sibling.textContent.trim() && sibling.textContent.trim().length <= 160) {
            sibling.classList.add('mtprev-movement-person');
          }
        }
      }
    }
  }

  function mtprevShowReceivedDate(root) {
    const facts = root?.querySelector('#workspace-preview-overview .workspace-preview__facts');
    if (!facts) return;
    const attributes = ['datetime','data-datetime','data-date','data-bs-original-title','data-original-title','title','aria-label'];
    for (const label of facts.querySelectorAll('span,small,dt,label,div')) {
      if (mtprevCleanLabel(label.textContent) !== 'recebido' || label.children.length) continue;
      const field = label.closest('.workspace-preview__fact,.workspace-preview__field') || label.parentElement;
      if (!field) continue;
      const candidates = Array.from(field.querySelectorAll('time,abbr,strong,[datetime],[title],[data-bs-original-title],[data-original-title]'));
      for (const value of candidates) {
        if (value === label || value.contains(label)) continue;
        const sources = attributes.map(attr => value.getAttribute(attr)).filter(Boolean);
        let dateLabel = '';
        for (const source of sources) {
          const br = source.match(/\b\d{2}\/\d{2}\/\d{4}(?:\s*(?:às|as)?\s*\d{2}:\d{2})?/);
          if (br) { dateLabel = br[0]; break; }
          const dateOnly = source.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (dateOnly) { dateLabel = dateOnly[3]+'/'+dateOnly[2]+'/'+dateOnly[1]; break; }
          if (/^\d{4}-\d{2}-\d{2}(?:[T\s]|$)/.test(source)) {
            const date = new Date(source);
            if (!Number.isNaN(date.getTime())) {
              dateLabel = new Intl.DateTimeFormat('pt-BR', {
                timeZone:'America/Cuiaba',day:'2-digit',month:'2-digit',year:'numeric',
                ...(/[T\s]\d{2}:\d{2}/.test(source) ? {hour:'2-digit',minute:'2-digit'} : {})
              }).format(date);
              break;
            }
          }
        }
        if (dateLabel && value.textContent !== dateLabel) value.textContent = dateLabel;
        if (dateLabel) break;
      }
    }
  }

  function mtprevLayoutProcessPreview() {
    const root = mtprevGetPreviewRoot();
    if (root) {
      mtprevPreviewStyle();
      mtprevEnhanceMovementPeople(root);
      mtprevShowReceivedDate(root);
      const recentNodes = mtprevReadTimeline(root, true).map(entry => entry.node);
      const highlighted = new Map();
      for (const item of root.querySelectorAll(MTPREV_TIMELINE_ITEMS)) {
        const index = recentNodes.indexOf(item);
        if (index < 0) continue;
        // A linha inclui o ícone e o trilho; colorir somente a superfície do cartão.
        let surface = item.querySelector('[class*="timeline-content"],[class*="timeline__content"],[class*="timeline-card"],[class*="timeline-body"]');
        if (!surface) {
          const person = item.querySelector('.mtprev-movement-person,[class*="avatar"]');
          let candidate = person?.parentElement;
          while (candidate && candidate.parentElement !== item) candidate = candidate.parentElement;
          if (candidate && candidate !== item && candidate.textContent.trim().length > (person?.textContent.trim().length || 0)) surface = candidate;
        }
        highlighted.set(surface || item, index);
      }
      for (const old of root.querySelectorAll('.mtprev-timeline-recent,.mtprev-timeline-latest')) {
        if (!highlighted.has(old)) old.classList.remove('mtprev-timeline-recent','mtprev-timeline-latest');
      }
      for (const [surface,index] of highlighted) {
        surface.classList.add('mtprev-timeline-recent');
        surface.classList.toggle('mtprev-timeline-latest', index === 0);
      }
    }
    const overview = root?.querySelector('#workspace-preview-overview');
    const grid = overview?.querySelector('.workspace-preview__overview-grid');
    if (!root || !overview || !grid) return;
    // Montar as colunas somente na Visao geral ativa; nunca alterar a
    // timeline de Andamentos nem os paineis de outras abas do SPA.
    if (!overview.classList.contains('is-active')) return;
    mtprevPreviewStyle();
    const related = mtprevFindSection(overview,[/^processos relacionados$/]);
    let deadlines = mtprevFindSection(overview,[/^prazos(?: em aberto| do processo| processuais)?$/]);
    const users = mtprevFindSection(overview,[/^usu[aá]rios$/]);
    const situation = mtprevFindSection(overview,[/^situa[cç][aã]o atual$/]);
    const events = mtprevFindSection(overview,[/^eventos$/]);
    if (deadlines && related && related.contains(deadlines)) deadlines=null;
    let details = mtprevFindProcessData(overview);
    if (details && [related,deadlines,users,situation,events].some(other => other && (details.contains(other) || other.contains(details)))) details=null;
    if (users) {
      mtprevCreateUsersTab(root,overview,users);
      if (root.querySelector('.mtprev-users-tab')) mtprevEnhanceCard(users,'Usuários',root.querySelector('.mtprev-users-pane'));
    }
    if (!related && !deadlines && !details && !situation) return;

    let layout = overview.querySelector(':scope > .mtprev-overview-layout');
    if (!layout) {
      layout=document.createElement('div');
      layout.className='mtprev-overview-layout';
      const panel=overview.querySelector(':scope > #spa-cdsp-external-docs-panel');
      if (panel) panel.insertAdjacentElement('afterend',layout);
      else grid.insertAdjacentElement('beforebegin',layout);
    }
    // Mover os cards efetivos (nao clonar) preserva os event handlers nativos.
    const put = (key,card,label) => {
      if (!card) return;
      const cell=mtprevGetOverviewCell(layout,key);
      if (card.parentElement!==cell) cell.appendChild(card);
      mtprevEnhanceCard(card,label,overview);
    };
    // Um unico DOM grid, com linhas fixas, impede o vazio na coluna direita.
    if (related) mtprevActivateExpedientes(related);
    put('prazos',deadlines,'Prazos em aberto');
    let recent=overview.querySelector('#mtprev-recent-movements');
    if (!recent) {
      recent=document.createElement('section');
      recent.id='mtprev-recent-movements';
      recent.className='mtprev-recent-movements';
      const body=document.createElement('div');
      body.className='mtprev-recent-body';
      recent.appendChild(body);
    }
    put('ultimos',recent,'Últimos 3 andamentos');
    if (!recent.querySelector('.mtprev-recent-item,.mtprev-recent-placeholder')) mtprevRenderRecent(root);
    put('relacionados',related,'Processos relacionados');
    put('situacao',situation,'Situação atual');
    put('dados',details,'Dados do processo');
    put('eventos',events,'Eventos');
    overview.classList.add('mtprev-overview-ready');
    // Se os antigos containers do SPA ficaram vazios, nao reservar outra grade.
    const remaining=Array.from(grid.querySelectorAll('.workspace-preview__card,section,article'))
      .filter(node=>!node.closest('.mtprev-managed-card') && !node.closest('.mtprev-overview-layout'));
    grid.classList.toggle('mtprev-overview-source-empty',remaining.length===0);
    if (!overview.querySelector(':scope > .mtprev-restore-cards')) {
      const restore=document.createElement('button');
      restore.className='mtprev-restore-cards';
      restore.type='button';
      restore.textContent='Restaurar cards fechados';
      restore.hidden=true;
      restore.addEventListener('click',()=>{
        root.querySelectorAll('.mtprev-managed-card.mtprev-card-closed').forEach(card=>card.classList.remove('mtprev-card-closed'));
        restore.hidden=true;
      });
      layout.insertAdjacentElement('beforebegin',restore);
    }
    mtprevRefreshRecent(root);
  }

  let mtprevLayoutTimer = null;
  function mtprevScheduleProcessLayout() {
    if (mtprevLayoutTimer) return;
    mtprevLayoutTimer = setTimeout(() => {
      mtprevLayoutTimer = null;
      try { mtprevLayoutProcessPreview(); } catch (error) {
        // Uma atualizacao parcial do SPA pode retirar a aba no meio da montagem.
        console.warn('MTPrev: layout do processo aguardando atualizacao:', error);
      }
    }, 160);
  }
  // No frame principal observar somente o sheet; evita reprocessar a mesa
  // com centenas de processos e não depende do cache nem de reiniciar o Chrome.
  const mtprevPreviewObserveRoot = window.top === window
    ? (document.querySelector('#workspace-process-preview .workspace-preview__content') ||
       document.querySelector('#workspace-process-preview') ||
       (/^\/procedures\/\d+(?:\/|$)/.test(location.pathname)
         ? (document.querySelector('.workspace-preview__document[data-procedure-id]') || document.body)
         : null))
    : document.body;
  if (mtprevPreviewObserveRoot) {
    new MutationObserver(mtprevScheduleProcessLayout).observe(mtprevPreviewObserveRoot,{childList:true,subtree:true});
  }
  mtprevScheduleProcessLayout();

})();
