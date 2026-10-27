(() => {
  'use strict';
  if (globalThis.SpaAdapter) return;
  const hosts = new Set(['spa.pge.mt.gov.br', 'pge.mt.spa.coreplan.com.br']);
  const registry = globalThis.MTPrevSpaSelectors;
  const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function route(raw = location.href) {
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:' || !hosts.has(url.hostname)) return { supported: false, kind: 'unsupported' };
      const kind = /^\/workspace\/?$/.test(url.pathname) ? 'workspace' : /^\/procedures\/?$/.test(url.pathname) ? 'inbox' : /^\/procedures\/massive\/\d+/.test(url.pathname) ? 'massive' : /^\/procedures\/\d+\/folder\/?$/.test(url.pathname) ? 'folder' : /^\/procedures\/\d+(?:\/|$)/.test(url.pathname) ? 'procedure' : 'other';
      const path = kind === 'other' ? '/[unmapped]' : kind === 'procedure' ? '/procedures/:id' : url.pathname.replace(/\d+/g, ':id');
      return { supported: true, kind, origin: url.origin, path };
    } catch (_) { return { supported: false, kind: 'unsupported' }; }
  }
  const visible = node => Boolean(node?.isConnected && !node.closest('[hidden],[aria-hidden="true"]') && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none');
  function locate(module, key, root = document) {
    const definition = registry?.[module]?.[key];
    for (const selector of definition?.selectors || []) {
      const nodes = Array.from(root.querySelectorAll(selector));
      if (nodes.length) return { nodes, selector, source: definition.source, validated: true };
    }
    return { nodes: [], selector: null, source: definition?.source || 'unmapped', validated: false };
  }
  function readRows(root = document) { return locate('triagem', 'rows', root).nodes.filter(visible); }
  function field(row, aliases) {
    const table = row.closest('table');
    if (!table) return '';
    const heads = Array.from(table.querySelectorAll('thead th'));
    const index = heads.findIndex(th => aliases.map(norm).includes(norm(th.getAttribute('data-name') || th.textContent)));
    const cell = index >= 0 ? row.children[index] : null;
    return cell ? (cell.getAttribute('data-search') || cell.textContent || '').trim() : '';
  }
  function workspacePreviewRecords(root = document) {
    return locate('workspace','preview',root).nodes.filter(visible).map(node => {
      const fields = new Map(Array.from(node.querySelectorAll('.workspace-preview__field')).map(field => [norm(field.querySelector('small')?.textContent), (field.querySelector('[data-copy-value]')?.getAttribute('data-copy-value') || field.querySelector('strong')?.textContent || '').trim()]));
      const get = label => fields.get(norm(label)) || '';
      const procedureId = node.getAttribute('data-procedure-id');
      return { id:`workspace-preview-${procedureId}`, rowKey:procedureId, processNumber:get('Número do processo'), expedienteId:get('ID do expediente'),
        assunto:get('Assunto Principal') || get('Assunto(s) do Tribunal'), actionClass:get('Classe'), origin:get('Origem do expediente'),
        manifestationSuggested:get('Sugestão de ação (IA)'), metadataSource:'Painel de detalhes do workspace; somente o expediente exibido',
        readingScope:'workspace-preview', relatedExpedienteCount:Number(node.querySelector('[data-workspace-relationship-tab="pending_notice"] strong')?.textContent.trim()) || 0 };
    });
  }
  // Preferir classes e rótulos semânticos. O XPath absoluto com span[12] quebra
  // quando o SPA reordena campos ou altera o layout responsivo.
  function workspaceCardFields(node) {
    const fields = new Map();
    const add = (label, value) => {
      const key = norm(label);
      if (key && value && !fields.has(key)) fields.set(key, String(value).trim());
    };
    for (const field of node.querySelectorAll('.workspace-process-card__field')) {
      const label = field.querySelector('small,[data-full-label]');
      const value = field.querySelector('[data-copy-value],strong[data-full-value],strong');
      add(label?.getAttribute('data-full-label') || label?.textContent,
        value?.getAttribute('data-copy-value') || value?.getAttribute('data-full-value') || value?.textContent);
    }
    // Alternativa para os cards <article><a>...<strong data-full-value>
    // Cada campo é associado ao seu <small> mais próximo, não à posição visual.
    for (const strong of node.querySelectorAll('strong')) {
      for (let parent = strong.parentElement, depth = 0; parent && parent !== node && depth < 5; parent = parent.parentElement, depth++) {
        const label = parent.querySelector('small,[data-full-label]');
        if (label && parent.querySelectorAll('strong').length === 1) {
          add(label.getAttribute('data-full-label') || label.textContent,
            strong.getAttribute('data-full-value') || strong.getAttribute('data-copy-value') || strong.textContent);
          break;
        }
      }
    }
    return fields;
  }
  function workspaceRecordFromNode(node) {
      const fields = workspaceCardFields(node);
      const get = (...labels) => labels.map(label => fields.get(norm(label)) || '').find(Boolean) || '';
      const safeUrl = value => { try { const url = new URL(value, location.href); return value && url.origin === location.origin && url.protocol === 'https:' ? url.href : ''; } catch (_) { return ''; } };
      const pendencyUrl = safeUrl(node.querySelector('a.workspace-process-card__main,a[href*="/procedures/"]')?.getAttribute('href'));
      const processFromData = Array.from(node.querySelectorAll('strong[data-full-value]'))
        .map(el => el.getAttribute('data-full-value') || '').find(value => /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(value.trim())) || '';
      const processNumber = get('Número do processo', 'Processo') || processFromData;
      const rowKey = node.getAttribute('data-procedure-id') || node.querySelector('[data-procedure-id]')?.getAttribute('data-procedure-id') || pendencyUrl ||
        [processNumber,get('ID do expediente'),get('Parte(s) ativa(s)'),get('Data da distribuição')].join('|');
      const expedienteUrls = [...new Set(Array.from(node.querySelectorAll('[data-workspace-document-url]')).map(link => safeUrl(link.getAttribute('data-workspace-document-url'))).filter(Boolean))];
      const labels = Array.from(node.querySelectorAll('[data-workspace-card-markers] [data-original-title],[data-workspace-card-markers] [title]')).map(label => label.getAttribute('data-original-title') || label.getAttribute('title')).filter(Boolean);
      const procedureId = pendencyUrl.match(/\/procedures\/(\d+)(?:[/?#]|$)/)?.[1] || '';
      const deadlineNodes = Array.from(node.querySelectorAll('.workspace-deadline__item'));
      const deadlineDetails = deadlineNodes.map(item => [item.textContent, ...Array.from(item.querySelectorAll('[title],[data-content],[data-original-title]')).map(el => el.getAttribute('title') || el.getAttribute('data-content') || el.getAttribute('data-original-title'))].filter(Boolean).join(' ')).join(' ');
      return {id:`workspace-card-${rowKey}`,rowKey,processNumber,expedienteId:get('ID do expediente'),
        procedureId,
        assunto:get('Assunto Principal','Assunto(s) do Tribunal'),actionClass:get('Classe'),origin:get('Origem do expediente'),
        manifestationSuggested:get('Manifestação sugerida'),distributionDate:get('Data da distribuição'),
        jurisdiction:get('Jurisdição'),assessor:get('Assessor(a)'),party:get('Parte(s) ativa(s)','Partes ativas','Parte ativa'),
        judgingBody:get('Órgão julgador','Julgador'), tribunal:get('Tribunal'),
        receivedText:get('Recebido','Tempo na caixa'), knowledgeDateText:get('Data da ciência'), deadlineDetails,
        observation:get('Observação'),
        lastProgress:node.querySelector('.workspace-process-card__last-progress strong')?.textContent.trim() || get('Último andamento'),
        status:node.querySelector('.workspace-process-card__status')?.textContent.trim() || '',
        pjeDeadline:Array.from(node.querySelectorAll('.workspace-deadline__item strong')).map(item=>item.textContent.trim()).join(' / '),
        labels,pendencyUrl,expedienteUrls,expedienteCount:expedienteUrls.length,
        tasks:[...(pendencyUrl?[{kind:'pendency',url:pendencyUrl,label:'Pendência'}]:[]),...expedienteUrls.map(url=>({kind:'expediente',url,label:'Expediente'}))],
        metadataSource:'Cards da lista do workspace',readingScope:'workspace-list'};
  }
  function workspaceRecords(root = document) {
    return locate('workspace','cards',root).nodes.filter(visible).map(workspaceRecordFromNode);
  }
  function isWorkspace() {
    return /^\/workspace\/?$/.test(new URL(location.href).pathname);
  }
  async function collectWorkspaceReport({ onProgress = () => {}, isStopped = () => false } = {}) {
    const href = location.href;
    const check = () => {
      if (isStopped()) throw new DOMException('Carregamento interrompido', 'AbortError');
      if (location.href !== href) throw new Error('A página mudou durante a leitura. Tente novamente.');
    };
    check();
    const collection = await collectWorkspaceRecords({ onProgress: progress => { check(); onProgress(progress); } });
    check();
    return collection;
  }
  function collectionSummary(collection) {
    return `${collection.reason === 'complete' ? 'Leitura completa' : 'Leitura parcial'} do SPA2: ${collection.records.length}` +
      (Number.isFinite(collection.total) ? ` de ${collection.total}` : '') +
      ' expediente(s), na visão e nos filtros selecionados no SPA.';
  }
  function showCollectionSummary(container, collection) {
    if (!container || !collection) return;
    container.querySelector('.mtprev-workspace-coverage')?.remove();
    const notice = document.createElement('p');
    notice.className = 'mtprev-workspace-coverage';
    notice.setAttribute('role', 'status');
    notice.textContent = collectionSummary(collection);
    notice.style.cssText = 'padding:10px;margin:10px;background:var(--mtprev-surface,#fff);color:var(--mtprev-text,#24384b);border:1px solid var(--mtprev-border,#b5c5d5);border-radius:8px;';
    container.prepend(notice);
  }
  function workspaceCounts() {
    const node = locate('workspace', 'pagination').nodes[0];
    const number = key => {
      const value = node?.dataset?.[key];
      return value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
    };
    return { loaded: number('loadedCount'), total: number('totalCount') };
  }
  function scrollContainer(node) {
    for (let parent = node; parent && parent !== document.documentElement; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/auto|scroll|overlay/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 1) return parent;
    }
    return document.scrollingElement || document.documentElement;
  }
  // O preload solicita lotes de 100 e se adapta ao limite devolvido pelo servidor.
  // Sem tamanho explícito, uma única tentativa de
  // lote grande (até 1000) é feita primeiro; servidores que limitam per_page
  // recebem novas consultas com lotes menores, sem rolar a página.
  // Apenas GET no endpoint parcial do próprio SPA; não altera processos.
  async function collectWorkspaceViaApi({signal, onProgress, timeout, batchSize, adaptiveBatch}) {
    const form = document.querySelector('form.workspace-search[data-partial-url]');
    const original = workspaceCounts();
    if (!form || !Number.isSafeInteger(original.total) || original.total <= 0 ||
        typeof fetch !== 'function' || typeof DOMParser !== 'function') return null;
    const endpoint = new URL(form.getAttribute('data-partial-url'), location.href);
    if (endpoint.protocol !== 'https:' || endpoint.origin !== location.origin) return null;

    const PAGE_SIZE = 100;
    const MAX_CONCURRENT = 4; // Limite conservador por mesa; nunca aumentar por causa do total.
    const REQUEST_TIMEOUT_MS = 45000;
    const totalPages = Math.ceil(original.total / PAGE_SIZE);
    if (totalPages < 1 || totalPages > 2000) return null;
    const concurrency = Math.min(MAX_CONCURRENT, totalPages);
    const startHref = location.href;
    const params = new URLSearchParams(new FormData(form));
    const initialParams = params.toString();
    // Preservar os filtros e a visao selecionada no SPA2.
    const view = form.querySelector('input[name="view"]')?.value;
    const flowId = form.querySelector('input[name="flow_id"]')?.value;
    if (params.get('flow_id')) params.delete('view');
    else if (!params.has('view') && view) params.set('view', view);
    if (params.get('view') !== 'all' && !params.has('flow_id') && flowId) params.set('flow_id', flowId);
    params.set('overview', 'false');
    params.set('per_page', String(PAGE_SIZE));
    for (const name of [...params.keys()]) {
      if (/^(?:authenticity_token|csrf_token|_csrf|password|session)$/i.test(name)) params.delete(name);
    }

    const started = Date.now();
    const controller = new AbortController();
    const timeoutLimit = Math.max(1000, Number(timeout) || 360000);
    const globalTimer = setTimeout(() => controller.abort(), timeoutLimit);
    const forwardAbort = () => controller.abort();
    if (signal?.aborted) forwardAbort();
    else signal?.addEventListener('abort', forwardAbort, {once:true});
    const key = record => record.rowKey || record.id;
    const rendered = locate('workspace', 'cards').nodes.slice(0, 10)
      .map(workspaceRecordFromNode).map(key).filter(Boolean);
    const results = new Array(totalPages);
    const ids = new Set();
    let nextPage = 1, completed = 0, failure = null;
    const pageTimings = [];

    const check = () => {
      if (invalidated || signal?.aborted) throw new DOMException('Coleta cancelada', 'AbortError');
      if (location.href !== startHref || !form.isConnected ||
          new URLSearchParams(new FormData(form)).toString() !== initialParams ||
          workspaceCounts().total !== original.total)
        throw new Error('Os filtros da mesa mudaram durante a leitura.');
      if (Date.now() - started > timeoutLimit) throw new Error('Tempo limite da coleta por API.');
    };

    const request = async page => {
      check();
      const requestStarted = Date.now();
      const url = new URL(endpoint.href);
      for (const name of new Set(params.keys())) {
        url.searchParams.delete(name);
        for (const value of params.getAll(name)) url.searchParams.append(name, value);
      }
      url.searchParams.set('page', String(page));
      const response = await fetch(url.href, {
        method:'GET', credentials:'same-origin', signal:controller.signal,
        headers:{'Accept':'application/json','X-Requested-With':'XMLHttpRequest'}
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const json = await response.json();
      if (!json || typeof json.results_html !== 'string') throw new Error('Resposta parcial incompatível.');
      const html = new DOMParser().parseFromString(json.results_html, 'text/html');
      const cards = [...html.querySelectorAll('.workspace-process-card')];
      const pager = html.querySelector('.workspace-infinite-scroll');
      const responseTotal = Number(pager?.getAttribute('data-total-count'));
      if (Number.isFinite(responseTotal) && responseTotal > 0 && responseTotal !== original.total)
        throw new Error('O total da resposta difere da mesa atual.');
      const expected = Math.min(PAGE_SIZE, original.total - (page - 1) * PAGE_SIZE);
      if (cards.length !== expected)
        throw new Error(`Pagina ${page}: recebidos ${cards.length} de ${expected} processos.`);
      const records = cards.map(workspaceRecordFromNode);
      const pageKeys = records.map(key);
      if (pageKeys.some(id => !id) || new Set(pageKeys).size !== expected)
        throw new Error(`Pagina ${page}: registros sem ID ou repetidos.`);
      if (page === 1 && rendered.length) {
        const firstIds = new Set(pageKeys);
        if (rendered.filter(id => firstIds.has(id)).length < Math.ceil(rendered.length / 2))
          throw new Error('A resposta nao corresponde a visao da mesa.');
      }
      check();
      return {page, records:cards.map(workspaceRecordFromNode), requestMs:Date.now() - requestStarted};
    };
    const rendered = locate('workspace','cards').nodes.slice(0, 10)
      .map(workspaceRecordFromNode).map(key).filter(Boolean);
    // Limite preventivo evita um HTML excessivo em mesas muito grandes.
    const requested = batchSize || Math.min(original.total, 1000);
    const choices = [...new Set(adaptiveBatch
      ? [requested, ...[1000, 200, 100, 25].filter(size => size < requested)]
      : batchSize ? [requested] : [requested, Math.min(original.total, 100)])];
    const tried = new Set();
    for (let attempt = 0; choices.length && attempt < 6; attempt++) {
      const perPage = choices.shift();
      if (!perPage || tried.has(perPage)) continue;
      tried.add(perPage);
      const collected = new Map();
      let rounds = 0;
      try {
        const first = await request(1, perPage);
        if (!first.records.length) continue;
        const ids = new Set(first.records.map(key));
        if (rendered.length && rendered.filter(id => ids.has(id)).length < Math.ceil(rendered.length / 2))
          throw new Error('A resposta não corresponde à visão da mesa.');
        const actual = first.records.length;
        // Se um lote grande foi limitado pelo servidor, repetir usando a
        // quantidade realmente suportada. Evita pular páginas quando o
        // servidor calcula offset com base no tamanho solicitado.
        if (actual < perPage && actual < original.total) {
          if (actual > 0 && !tried.has(actual) && !choices.includes(actual)) choices.unshift(actual);
          continue;
        }
        const batch = actual < perPage ? actual : perPage;
        const pages = Math.ceil(original.total / batch);
        if (pages < 1 || pages > 2000) continue;
        const absorb = result => {
          if (!result.records.length) throw new Error('Página vazia antes do total.');
          for (const record of result.records) {
            const id = key(record);
            if (id) collected.set(id, record);
          }
          rounds++;
          onProgress({count:collected.size, loaded:collected.size, total:original.total,
            rounds, batchSize:result.records.length, requestedBatchSize:perPage,
            requestMs:result.requestMs, stage:'api'});
        };
        absorb(first);
        // Limitar a concorrência: lotes grandes (mais de 100) em até 2 GETs;
        // para lotes menores, manter os 3 GETs da versão já testada.
        const concurrency = batchSize ? 1 : perPage > 100 ? 2 : 3;
        for (let page = 2; page <= pages; page += concurrency) {
          check();
          for (const id of result.pageKeys) {
            if (ids.has(id)) throw new Error('ID repetido em paginas diferentes.');
            ids.add(id);
          }
          results[page - 1] = result.records;
          completed++;
          const requestMs=Date.now()-requestStarted;
          pageTimings.push({page,ms:requestMs,count:result.records.length});
          onProgress({count:ids.size,loaded:ids.size,total:original.total,
            rounds:completed,pages:totalPages,concurrency,stage:'api-parallel',
            lastCompletedPage:page,lastCompletedMs:requestMs,batchSize:PAGE_SIZE});
        } catch (error) {
          if (!failure) failure = error;
          controller.abort();
          return;
        } finally {
          clearTimeout(requestTimer);
        }
        check();
        if (collected.size === original.total) {
          return {records:[...collected.values()], reason:'complete', rounds,
            endJumps:0, loaded:collected.size, total:original.total, source:'workspace-api'};
        }
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError' || /filtros da mesa mudaram/i.test(error?.message || '')) throw error;
        // Uma tentativa maior pode ser recusada. Tentar o lote menor.
      }
    }
    // Caso a API falhe em todos os tamanhos, preservar o fallback nativo.
    return null;
  }

  let workspaceCollection = null;
  let workspaceSnapshot = null;
  function workspaceCollectionContext() {
    const list = locate('workspace', 'list').nodes[0];
    const form = document.querySelector('form.workspace-search');
    const signature = location.href + '|' + JSON.stringify(workspaceCounts()) + '|' + Array.from(form?.querySelectorAll('input,select,textarea') || [])
      .map(input => `${input.name}=${input.value}:${input.checked ?? ''}`).join('&');
    return {list, signature};
  }
  function getWorkspacePreload({onProgress} = {}) {
    const {list, signature} = workspaceCollectionContext();
    if (invalidated) return null;
    if (workspaceCollection?.list === list && workspaceCollection.signature === signature) {
      if (onProgress) workspaceCollection.listeners.add(onProgress);
      return workspaceCollection.promise;
    }
    if (!workspaceSnapshot || workspaceSnapshot.list !== list || workspaceSnapshot.signature !== signature) return null;
    const result = workspaceSnapshot.result;
    onProgress?.({count:result.records.length, loaded:result.records.length, total:result.total, stage:'cached'});
    return Promise.resolve(result);
  }
  function collectWorkspaceRecords(options = {}) {
    // Reports opened during preload share the current read instead of requesting pages twice.
    const {list, signature} = workspaceCollectionContext();
    if (!options.signal && workspaceSnapshot?.list === list && workspaceSnapshot.signature === signature &&
        Date.now() - workspaceSnapshot.time < 60000) {
      const result = workspaceSnapshot.result;
      options.onProgress?.({count:result.records.length, loaded:result.records.length, total:result.total, stage:'cached'});
      return Promise.resolve(result);
    }
    if (!options.signal && workspaceCollection?.list === list && workspaceCollection.signature === signature) {
      if (options.onProgress) workspaceCollection.listeners.add(options.onProgress);
      return workspaceCollection.promise;
    }
    const current = {list, signature, listeners:new Set(options.onProgress ? [options.onProgress] : [])};
    current.promise = readWorkspaceRecords({...options, onProgress:progress => {
      for (const listener of current.listeners) listener(progress);
    }}).then(result => {
      if (result.reason === 'complete' && result.source === 'workspace-api')
        workspaceSnapshot = {list, signature, time:Date.now(), result};
      return result;
    }).finally(() => { if (workspaceCollection === current) workspaceCollection = null; });
    if (!options.signal) workspaceCollection = current;
    return current.promise;
  }
  async function readWorkspaceRecords({
    signal, onProgress = () => {}, timeout = 360000, pause = 90,
    idleTimeout = 18000, maxRetries = 2, useApi = true, batchSize, allowScroll = true, adaptiveBatch = false
  } = {}) {
    // Ordem: botão nativo sem rolar; caso ele não acione a paginação,
    // salto instantâneo até o fim (equivalente à tecla End).
    // Não tentar inventar itens no DOM ou chamar endpoints desconhecidos.
    const listed = locate('workspace', 'list').nodes[0];
    const firstCard = locate('workspace', 'cards').nodes[0];
    const list = listed && listed !== firstCard ? listed : firstCard?.parentElement || listed;
    if (!list || !firstCard) throw new Error('Cards do workspace não encontrados. Abra a mesa de trabalho.');

    const viaApi = useApi ? await collectWorkspaceViaApi({signal,onProgress,timeout,batchSize,adaptiveBatch}) : null;
    if (viaApi) return viaApi;
    if (!allowScroll) throw new Error('O SPA não disponibilizou o carregamento em lotes sem rolagem.');

    const href = location.href;
    const form = document.querySelector('form.workspace-search');
    const signature = () => form ? Array.from(form.querySelectorAll('input,select,textarea'))
      .map(input => `${input.name}=${input.value}:${input.checked ?? ''}`).join('&') : '';
    const initial = signature();
    const scroller = scrollContainer(firstCard);
    const initialTop = scroller.scrollTop;
    const initialLeft = scroller.scrollLeft;
    const gathered = new Map();
    const started = Date.now();
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const interval = Math.max(50, Number(pause) || 90);
    let rounds = 0, endJumps = 0, failures = 0, reason = 'timeout';
    let expectedTotal = null, scrollAssisted = false, lastReported = '', hadMoreButton = false;
    let lastCapturedLoaded = -1, lastCardCount = -1;
    const processedNodes = new WeakMap();

    const check = () => {
      if (invalidated || signal?.aborted) throw new DOMException('Carregamento cancelado', 'AbortError');
      if (location.href !== href || !list.isConnected || signature() !== initial) {
        throw new Error('Os filtros ou a lista mudaram. Inicie outra leitura na tela atual.');
      }
    };
    const capture = (stage = 'reading', force = false) => {
      check();
      const counts = workspaceCounts();
      const nodes = locate('workspace', 'cards').nodes;
      // Evita analisar repetidamente centenas de cards durante cada espera.
      // Ainda revisita a lista após toda mudança de contador ou de quantidade de nós.
      if (force || counts.loaded !== lastCapturedLoaded || nodes.length !== lastCardCount) {
        for (const node of nodes) {
          if (!visible(node)) continue;
          // Já vistos não precisam ser extraídos novamente a cada lote de 25.
          // Verificar identidade para suportar listas virtualizadas com nós reciclados.
          const signature = node.getAttribute('data-procedure-id') ||
            node.querySelector('a[href]')?.getAttribute('href') || node.textContent || null;
          if (!force && processedNodes.has(node) && processedNodes.get(node) === signature) continue;
          const record = workspaceRecordFromNode(node);
          const key = record.rowKey || (record.expedienteId && record.expedienteId !== 'Sem ID'
            ? `${record.processNumber || ''}|${record.expedienteId}` : record.id);
          if (key) gathered.set(key, record);
          processedNodes.set(node, signature);
        }
        lastCapturedLoaded = counts.loaded;
        lastCardCount = nodes.length;
      }
      if (counts.total !== null) {
        if (expectedTotal === null) expectedTotal = counts.total;
        else if (expectedTotal !== counts.total) {
          throw new Error('O total da mesa de trabalho mudou durante a leitura. Reinicie o relatório na visão atual.');
        }
      }
      const fingerprint = [gathered.size, counts.loaded, counts.total, stage].join('|');
      if (fingerprint !== lastReported) {
        lastReported = fingerprint;
        onProgress({count:gathered.size, rounds, endJumps, ...counts, stage});
      }
      return counts;
    };
    const complete = counts => counts.total !== null && counts.loaded !== null &&
      counts.loaded >= counts.total && gathered.size >= counts.total;
    const changed = (beforeLoaded, beforeSize, counts) =>
      (counts.loaded !== null && (beforeLoaded === null || counts.loaded > beforeLoaded)) ||
      gathered.size > beforeSize;
    const waitForAdvance = async (beforeLoaded, beforeSize, duration, stage) => {
      const deadline = Math.min(started + timeout, Date.now() + duration);
      while (Date.now() < deadline) {
        await wait(interval);
        const counts = capture(stage);
        if (changed(beforeLoaded, beforeSize, counts)) {
          // Contador do SPA pode atualizar um instante antes de montar os cards.
          await wait(interval);
          capture('reading');
          return true;
        }
      }
      return false;
    };
    const jumpToEnd = () => {
      check();
      const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      // Salto imediato, sem smooth scrolling. Funciona para body ou div rolável.
      scroller.scrollTop = maxTop;
      endJumps++;
      // Disparar também scroll ajuda apps que escutam o evento em vez de
      // IntersectionObserver. O navegador normalmente o dispara por conta própria.
      if (typeof scroller.dispatchEvent === 'function') {
        scroller.dispatchEvent(new Event('scroll', {bubbles: true}));
      }
    };

    try {
      let counts = capture('reading', true);
      while (Date.now() - started < timeout) {
        check();
        counts = capture();
        if (complete(counts)) {reason = 'complete'; break;}
        if (counts.total !== null && counts.loaded !== null && counts.loaded >= counts.total) {
          // Algumas mesas usam DOM virtualizado: tudo já foi carregado pelo
          // SPA, mas só um subconjunto dos cards existe em cada posição.
          // Nesse caso não usar End; percorremos cada viewport para preservar
          // os registros que desaparecem quando saem da tela.
          const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          scroller.scrollTop = 0;
          capture('virtual', true);
          const step = Math.max(1, scroller.clientHeight);
          for (let top = step; top <= maxTop + step && gathered.size < counts.total; top += step) {
            check();
            scroller.scrollTop = Math.min(maxTop, top);
            await wait(interval);
            capture('virtual', true);
            if (top >= maxTop) break;
          }
          counts = capture();
          reason = complete(counts) ? 'complete' : 'partial';
          break;
        }
        const beforeLoaded = counts.loaded;
        const beforeSize = gathered.size;
        const button = locate('workspace', 'more').nodes[0];
        if (button?.isConnected) hadMoreButton = true;
        let advanced = false;

        // Depois que o botão falha uma vez, lembrar que esta versão do SPA
        // exige chegar ao rodapé para ativar a próxima leva.
        if (scrollAssisted) {
          jumpToEnd();
          // Um pequeno ciclo de layout permite ao IntersectionObserver agir.
          await wait(interval);
          counts = capture('end');
          advanced = changed(beforeLoaded, beforeSize, counts) ||
            await waitForAdvance(beforeLoaded, beforeSize, Math.max(200, interval * 2), 'end');
        }
        if (!advanced && button?.isConnected && !button.disabled) {
          // HTMLElement.click() pode funcionar mesmo que o botão ainda esteja
          // fora da área visível. Não condicioná-lo a getClientRects().
          button.click();
          rounds++;
          advanced = await waitForAdvance(beforeLoaded, beforeSize, Math.min(1800, idleTimeout), 'loading');
        }
        if (!advanced && !scrollAssisted) {
          jumpToEnd();
          scrollAssisted = true;
          advanced = await waitForAdvance(beforeLoaded, beforeSize, Math.min(3000, idleTimeout), 'end');
        }
        if (!advanced) {
          // Uma resposta lenta ainda pode estar em andamento. Não enviar um
          // novo clique antes de aguardar a resposta da tentativa anterior.
          advanced = await waitForAdvance(beforeLoaded, beforeSize, Math.min(8000, idleTimeout), 'waiting');
        }
        if (advanced) {
          failures = 0;
          continue;
        }
        failures++;
        if (failures > maxRetries) {reason = hadMoreButton ? 'stalled' : 'partial'; break;}
        // O rodapé pode ter se deslocado após uma atualização do layout.
        jumpToEnd();
        scrollAssisted = true;
        await wait(Math.max(interval, 200));
      }
      if (reason === 'timeout') reason = hadMoreButton ? 'stalled' : 'partial';
      capture(reason, true);
      return {records:[...gathered.values()], reason, rounds, endJumps, ...workspaceCounts()};
    } finally {
      // Restaurar a visualização sem alterar a mesa selecionada.
      if (location.href === href && list.isConnected) {
        if (scroller.scrollTop !== initialTop) scroller.scrollTop = initialTop;
        if (scroller.scrollLeft !== initialLeft) scroller.scrollLeft = initialLeft;
      }
    }
  }
  function records(root = document) {
    if (locate('workspace','cards',root).nodes.length) return workspaceRecords(root);
    if (!readRows(root).length) return workspacePreviewRecords(root);
    return readRows(root).map(row => {
      const processNumber = field(row, ['numero do processo judicial', 'numero do processo']);
      const expedienteId = field(row, ['id do expediente', 'numero do expediente']);
      return { id: row.getAttribute('data-id') || `${processNumber}|${expedienteId}`, processNumber, expedienteId,
        assunto: field(row, ['assunto', 'assunto(s)']), party: field(row, ['destinatario da intimacao', 'parte intimada', 'destinatario']),
        actionClass: field(row, ['classe processual', 'classe']), pjeDeadline: field(row, ['prazo pje', 'prazo']),
        relevantDate: field(row, ['data da intimacao', 'data de recebimento']), origin: field(row, ['origem', 'tribunal']),
        status: field(row, ['situacao', 'status']), metadataSource: 'Colunas visíveis do SPA — SpaAdapter' };
    });
  }
  function inspect(root = document) {
    return { version: 1, route: route(), modules: Object.fromEntries(Object.entries(registry || {}).map(([module, entries]) => [module,
      Object.fromEntries(Object.entries(entries).map(([key, definition]) => {
        const found = locate(module, key, root);
        return [key, { description: definition.description, count: found.nodes.length, selector: found.selector, source: found.source, coreplan: definition.coreplan,
          components: found.nodes.slice(0, 3).map(node => ({ type: node.tagName.toLowerCase(), id: node.id ? (definition.selectors.includes('#' + node.id) ? node.id : 'dynamic-id-not-exported') : null,
            role: node.getAttribute('role'), disabled: Boolean(node.disabled), expanded: node.getAttribute('aria-expanded'), busy: node.getAttribute('aria-busy'),
            accessibleName: /^(dar ci[eê]ncia|protocolar|encerrar|visualizar|documentos|anexos)$/i.test((node.getAttribute('aria-label') || node.textContent || '').trim()) ? (node.getAttribute('aria-label') || node.textContent).trim() : 'not-exported',
            rowContext: Boolean(node.closest('tr.group-item')), selectorValidated: root.querySelectorAll(found.selector).length > 0 })),
          evidence: found.nodes.length ? 'matched-in-current-dom' : 'not-observed', wait: 'SpaAdapter.waitFor + observe; reacquire after change' }];
      }))])),
      state: { visibleRows: readRows(root).length, visibleWorkspaceCards:locate('workspace','cards',root).nodes.filter(visible).length, workspaceCounts:workspaceCounts(), loading: locate('triagem', 'loading', root).nodes.some(visible),
        iframes: root.querySelectorAll('iframe').length, openShadowHosts: Array.from(root.querySelectorAll('*')).filter(node => node.shadowRoot).length,
        dialogs: root.querySelectorAll('[role="dialog"],dialog[open]').length,
        virtualization: 'not-verified', lazyLoading: 'not-verified', network: 'not-captured; inspect authorized application requests manually',
        coverage: 'Rendered DOM only. Hidden frames, closed shadows and unmounted virtual rows are not inspected.' } };
  }
  const subscribers = new Set(); let observer, timer, invalidated = false;
  function notify() { for (const callback of subscribers) { try { callback({ route: route(), reason: 'dom-or-route' }); } catch (error) { console.error('[MTPrev Adapter] Subscriber failed:', error.name); } } }
  function observe(callback) {
    subscribers.add(callback);
    if (!observer) {
      observer = new MutationObserver(changes => {
        if (changes.every(change => change.target.nodeType === 1 && change.target.closest('#cdsp-general-shell,[data-mtprev-ui]'))) return;
        clearTimeout(timer); timer = setTimeout(notify, 100);
      });
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-busy', 'class', 'style'] });
      for (const name of ['popstate', 'hashchange', 'mtprev-spa-routechange']) window.addEventListener(name, notify);
    }
    return () => { subscribers.delete(callback); if (!subscribers.size) dispose(); };
  }
  function dispose() {
    observer?.disconnect(); observer = null; clearTimeout(timer); subscribers.clear();
    if (typeof window !== 'undefined') for (const name of ['popstate', 'hashchange', 'mtprev-spa-routechange']) window.removeEventListener(name, notify);
  }
  function waitFor(module, key, { timeout = 5000, signal } = {}) {
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {}, deadline;
      const finish = (error, value) => { clearTimeout(deadline); unsubscribe(); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(value); };
      const abort = () => finish(new DOMException('Espera cancelada', 'AbortError'));
      const check = () => { const found = locate(module, key); if (found.nodes.some(visible)) finish(null, found); };
      if (signal?.aborted) { abort(); return; }
      unsubscribe = observe(check); signal?.addEventListener('abort', abort, { once: true });
      deadline = setTimeout(() => finish(new Error(`Elemento não observado: ${module}.${key}`)), timeout); check();
    });
  }
  function filterRecords(items, filters = {}) {
    const query = norm(filters.query).replace(/ /g, '');
    return items.filter(record => (!query || norm(`${record.processNumber} ${record.expedienteId}`).replace(/ /g, '').includes(query)) &&
      ['origin', 'status'].every(key => !filters[key] || norm(record[key]) === norm(filters[key])) &&
      (!filters.date || String(record.relevantDate || '').includes(filters.date)));
  }
  async function collectLazyRecords({ read = records, signal, onProgress = () => {}, timeout = 60000, pause = 600 } = {}) {
    if(locate('workspace','list').nodes.length)return collectWorkspaceRecords({signal,onProgress,timeout,pause});
    const list = locate('triagem', 'list').nodes[0];
    if (!list) throw new Error('Caixa não identificada nesta tela. Abra a lista de expedientes para carregar por rolagem.');
    let scroller = list.parentElement;
    while (scroller && !(scroller.scrollHeight > scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
    scroller ||= document.scrollingElement;
    if (!scroller) throw new Error('Área de rolagem não identificada.');
    const initialTop = scroller.scrollTop, initialLeft = scroller.scrollLeft, href = location.href;
    const collected = new Map(), started = Date.now();
    let stable = 0, rounds = 0, reason = 'timeout';
    const check = () => {
      if (invalidated || signal?.aborted) throw new DOMException('Carregamento cancelado', 'AbortError');
      if (location.href !== href || !list.isConnected) throw new Error('A caixa mudou durante a leitura. Inicie novamente na tela atual.');
    };
    const capture = () => {
      for (const item of read()) {
        const id = item.expedienteId && item.expedienteId !== 'Sem ID' ? `${item.processNumber || ''}|${item.expedienteId}` : item.pendencyUrl || item.rowKey || item.id;
        if (id) collected.set(id, item);
      }
      onProgress({ count: collected.size, rounds });
    };
    try {
      check(); capture(); scroller.scrollTop = 0;
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, pause));
      while (Date.now() - started < timeout) {
        check();
        const size = collected.size, height = scroller.scrollHeight, top = scroller.scrollTop;
        capture();
        scroller.scrollTop = Math.min(scroller.scrollHeight, scroller.scrollTop + Math.max(100, scroller.clientHeight * .75));
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, pause));
        check(); rounds++; capture();
        const busy = locate('triagem', 'loading').nodes.some(visible);
        const bottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
        stable = bottom && !busy && collected.size === size && scroller.scrollHeight === height && scroller.scrollTop === top ? stable + 1 : 0;
        if (stable >= 5) { reason = 'stable'; break; }
      }
      return { records: [...collected.values()], reason, rounds };
    } finally {
      if (location.href === href && list.isConnected) { scroller.scrollTop = initialTop; scroller.scrollLeft = initialLeft; }
    }
  }
  function confirmAction(operation, targets, validate = () => true, details = []) {
    return new Promise(resolve => {
      if (invalidated || !targets.length || !validate()) { resolve(false); return; }
      const dialog = document.createElement('dialog'); dialog.className = 'mtprev-action-confirm'; dialog.dataset.mtprevUi = 'confirmation';
      const title = document.createElement('h2'); title.textContent = operation; dialog.append(title);
      const notice = document.createElement('p'); notice.textContent = `${targets.length} expediente(s). Confira os identificadores antes de autorizar. A confirmação vale somente para este conjunto.`; dialog.append(notice);
      for (const [label, value] of details) { const line = document.createElement('p'); line.textContent = `${label}: ${value || 'não informado'}`; dialog.append(line); }
      const list = document.createElement('ul');
      for (const target of targets) { const item = document.createElement('li'); item.textContent = `Processo ${target.processNumber || target.processKey || 'não identificado'} · expediente ${target.expedienteId || target.rowKey || 'não identificado'}`; list.append(item); }
      dialog.append(list);
      for (const [label, result] of [['Cancelar', false], ['Confirmar operação', true]]) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
        button.onclick = () => { if (result && (invalidated || !validate())) { notice.textContent = 'A lista ou o contexto mudou. Cancele e revise novamente.'; return; } dialog.close(result ? 'yes' : 'no'); }; dialog.append(button);
      }
      dialog.addEventListener('close', () => { const accepted = dialog.returnValue === 'yes' && !invalidated && validate(); dialog.remove(); resolve(accepted); }, { once: true });
      document.body.append(dialog); dialog.showModal(); dialog.querySelector('button').focus();
    });
  }
  globalThis.SpaAdapter = Object.freeze({ route, locate, readRows, field, records, isWorkspace, workspaceRecordFromNode, workspacePreviewRecords, workspaceRecords, workspaceCounts, collectWorkspaceRecords, getWorkspacePreload, collectWorkspaceReport, collectionSummary, showCollectionSummary, inspect, observe, waitFor, dispose, filterRecords, collectLazyRecords,
    actions: Object.freeze({ confirm: confirmAction }), registry });
  if (typeof window !== 'undefined') window.addEventListener('mtprev-extension-context-invalidated', () => {
    invalidated = true;
    document.querySelectorAll('.mtprev-action-confirm').forEach(dialog => dialog.close('no')); dispose();
  });
})();
