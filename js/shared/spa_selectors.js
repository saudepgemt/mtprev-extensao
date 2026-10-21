/* Registry contains observed legacy selectors, not claims about authenticated Coreplan. */
(() => {
  if (globalThis.MTPrevSpaSelectors) return;
  const entry = (description, selectors, source = 'legacy-source') => Object.freeze({ description, selectors: Object.freeze(selectors), source, coreplan: 'requires-authenticated-evidence' });
  globalThis.MTPrevSpaSelectors = Object.freeze({
    workspace: Object.freeze({
      list: entry('Lista principal do workspace', ['.workspace-process-list'], 'user-provided-workspace-list'),
      cards: entry('Cards de processos carregados', ['.workspace-process-list .workspace-process-card[data-procedure-id]'], 'user-provided-workspace-list'),
      pagination: entry('Contadores do carregamento incremental', ['.workspace-infinite-scroll[data-loaded-count][data-total-count]'], 'user-provided-workspace-list'),
      more: entry('Carregar mais processos', ['.workspace-infinite-scroll__button'], 'user-provided-workspace-list'),
      preview: entry('Detalhes de um processo; não é a lista da caixa', ['.workspace-preview__document[data-procedure-id]'], 'user-provided-workspace-preview'),
      fields: entry('Dados do processo no painel de detalhes', ['.workspace-preview__document .workspace-preview__field'], 'user-provided-workspace-preview'),
      pendingNotices: entry('Botão de expedientes relacionados; conteúdo carregado separadamente', ['.workspace-preview__document [data-workspace-relationship-tab="pending_notice"][data-url]'], 'user-provided-workspace-preview'),
      relationships: entry('Conteúdo dos itens relacionados; pode conter somente o placeholder', ['.workspace-preview__document [data-workspace-relationship-content]'], 'user-provided-workspace-preview'),
    }),
    triagem: Object.freeze({
      list: entry('Caixa de expedientes', ['#procedures-box']),
      rows: entry('Linhas de expedientes carregadas', ['#procedures-box tbody tr.group-item']),
      columns: entry('Cabeçalhos técnicos', ['#procedures-box thead th[data-name]', '#procedures-box thead th']),
      science: entry('Ciência: confirmar no contexto de uma linha', ['form.take-consciousness-btn button', 'button.take-consciousness-btn', 'a.take-consciousness-btn']),
      pagination: entry('Paginação DataTables', ['#procedures-box_paginate']),
      loading: entry('Carregamento da caixa', ['#procedures-box_processing', '#procedures-box [aria-busy="true"]']),
    }),
    processo: Object.freeze({ main: entry('Processo principal', ['#main-procedure']), documents: entry('Expedientes', ['a[href*="/coresigner/info/"]']) }),
    protocolo: Object.freeze({ massive: entry('Links de passos em massa; IDs variam por ambiente', ['a[href*="/procedures/massive/"]']) }),
    redacao: Object.freeze({ panel: entry('Painel da extensão', ['#spa-cdsp-deadline-panel'], 'extension') }),
    coordenacao: Object.freeze({ panel: entry('Painel da extensão', ['#spa-cdsp-management-panel'], 'extension') }),
    oficios: Object.freeze({ extract: entry('Botão de extração existente', ['#spa-extrator-btn'], 'extension') }),
  });
})();
