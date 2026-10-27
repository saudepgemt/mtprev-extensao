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
        border-bottom:4px solid #13748a !important;
      }
      body.mtprev-workspace-readable #workspace-process-results .workspace-process-list > article.workspace-process-card,
      body.mtprev-workspace-readable #workspace-process-results .workspace-process-list > article.workspace-process-card:nth-of-type(even),
      body.mtprev-workspace-readable #workspace-process-results .workspace-process-list > article.workspace-process-card:nth-of-type(odd) {
        background:#ffffff !important;
        border-radius:0 !important;
        border-left:5px solid #4f7293 !important;
        border-bottom:5px solid #7695ad !important;
        box-shadow:none !important;
      }
      body.mtprev-workspace-readable #workspace-process-results .workspace-process-list > article.workspace-process-card:hover:not(.mtprev-workspace-hover-dismissed) {
        background:#cfe3f5 !important;
        border-left-color:#0f5f87 !important;
        border-bottom-color:#0f5f87 !important;
        box-shadow:inset 0 0 0 2px #1c6287,0 4px 14px rgba(18,52,75,.16) !important;
      }
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
})();
