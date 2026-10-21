/* Executar como Snippet no DevTools do SPA autenticado. Somente leitura.
   Não coleta valores de campos, conteúdo de documentos ou credenciais. */
(() => {
  'use strict';
  const hosts = ['spa.pge.mt.gov.br', 'pge.mt.spa.coreplan.com.br'];
  if (location.protocol !== 'https:' || !hosts.includes(location.hostname)) {
    throw new Error('Execute este diagnóstico em uma página do SPA autorizada.');
  }
  const route = (raw) => {
    try {
      const url = new URL(raw, location.href);
      if (url.origin !== location.origin) return '';
      // ID de configuração do fluxo, não ID de processo/documento.
      if (/^\/procedures\/massive\/\d+\/?$/.test(url.pathname)) return url.pathname;
      return url.pathname.replace(/\/coresigner\/info\/[^/]+/g, '/coresigner/info/:document.pdf')
        .replace(/\d+/g, ':id');
    } catch (_) { return ''; }
  };
  const selectors = [
    '#procedures-box', '#procedures-box thead th[data-name]',
    '#procedures-box tbody tr.group-item', '#main-procedure',
    'a[href*="/coresigner/info/"]', 'a[href*="/procedures/massive/"]',
    'a[href*="/judicial_processes/"]', 'input[type="checkbox"]',
  ];
  const routes = {};
  document.querySelectorAll('a[href], form[action]').forEach((element) => {
    const path = route(element.getAttribute('href') || element.getAttribute('action'));
    if (path) routes[path] = (routes[path] || 0) + 1;
  });
  const report = {
    origin: location.origin,
    page: route(location.href),
    selectors: Object.fromEntries(selectors.map((selector) => [selector, document.querySelectorAll(selector).length])),
    columns: Array.from(document.querySelectorAll('#procedures-box thead th')).map((th) => th.getAttribute('data-name') || ''),
    routes,
    jquery: typeof window.jQuery === 'function',
    dataTables: Boolean(window.jQuery?.fn?.DataTable),
    extensionPanel: Boolean(document.getElementById('cdsp-general-shell')),
  };
  console.table(report.selectors);
  console.info('Mapeamento SPA (somente leitura):', JSON.stringify(report, null, 2));
  return report;
})();
