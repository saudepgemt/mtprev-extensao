/* MTPrev: painel de autos em iframes de processo (sem menu radial). */
(() => {
  'use strict';
  if (window === window.top || window.MTPREV_IFRAME_AUTOS_BRIDGE) return;
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
  window.addEventListener('message', (event) => {
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
