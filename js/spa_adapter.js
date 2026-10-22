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
  function workspaceRecords(root = document) {
    return locate('workspace','cards',root).nodes.filter(visible).map(node => {
      const fields = new Map(Array.from(node.querySelectorAll('.workspace-process-card__field')).map(field => [norm(field.querySelector('small')?.getAttribute('data-full-label') || field.querySelector('small')?.textContent), (field.querySelector('[data-copy-value]')?.getAttribute('data-copy-value') || field.querySelector('strong')?.getAttribute('data-full-value') || field.querySelector('strong')?.textContent || '').trim()]));
      const get = label => fields.get(norm(label)) || '';
      const rowKey = node.getAttribute('data-procedure-id');
      const safeUrl = value => { try { const url=new URL(value,location.href); return value && url.origin===location.origin && url.protocol==='https:' ? url.href : ''; } catch (_) { return ''; } };
      const pendencyUrl = safeUrl(node.querySelector('a.workspace-process-card__main')?.getAttribute('href'));
      const expedienteUrls = [...new Set(Array.from(node.querySelectorAll('[data-workspace-document-url]')).map(link => safeUrl(link.getAttribute('data-workspace-document-url'))).filter(Boolean))];
      const labels = Array.from(node.querySelectorAll('[data-workspace-card-markers] [data-original-title],[data-workspace-card-markers] [title]')).map(label => label.getAttribute('data-original-title') || label.getAttribute('title')).filter(Boolean);
      return {id:`workspace-card-${rowKey}`,rowKey,processNumber:get('Número do processo'),expedienteId:get('ID do expediente'),
        assunto:get('Assunto Principal') || get('Assunto(s) do Tribunal'),actionClass:get('Classe'),origin:get('Origem do expediente'),
        manifestationSuggested:get('Manifestação sugerida'),distributionDate:get('Data da distribuição'),
        jurisdiction:get('Jurisdição'),assessor:get('Assessor(a)'),party:get('Parte(s) ativa(s)'),
        lastProgress:node.querySelector('.workspace-process-card__last-progress strong')?.textContent.trim() || '',
        status:node.querySelector('.workspace-process-card__status')?.textContent.trim() || '',
        pjeDeadline:Array.from(node.querySelectorAll('.workspace-deadline__item strong')).map(item=>item.textContent.trim()).join(' / '),
        labels,pendencyUrl,expedienteUrls,expedienteCount:expedienteUrls.length,
        tasks:[...(pendencyUrl?[{kind:'pendency',url:pendencyUrl,label:'Pendência'}]:[]),...expedienteUrls.map(url=>({kind:'expediente',url,label:'Expediente'}))],
        metadataSource:'Cards da lista do workspace',readingScope:'workspace-list'};
    });
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
  async function collectWorkspaceRecords({ signal, onProgress = () => {}, timeout = 120000, pause = 300, idleTimeout = 4500 } = {}) {
    const list = locate('workspace', 'list').nodes[0];
    if (!list) throw new Error('Lista do workspace não identificada.');
    const scroller = scrollContainer(list);
    if (!scroller) throw new Error('Área de rolagem do workspace não identificada.');
    const href = location.href, form = document.querySelector('form.workspace-search');
    const signature = () => form ? Array.from(form.querySelectorAll('input,select,textarea'))
      .map(input => `${input.name}=${input.value}:${input.checked ?? ''}`).join('&') : '';
    const initial = signature(), gathered = new Map(), started = Date.now();
    const initialTop = scroller.scrollTop, initialLeft = scroller.scrollLeft;
    let lastProgress = started, lastClick = -Infinity, dataVersion = 0, clickedVersion = -1;
    let reason = 'timeout', rounds = 0;
    const check = () => {
      if (signal?.aborted) throw new DOMException('Carregamento cancelado', 'AbortError');
      if (location.href !== href || !list.isConnected || signature() !== initial) {
        throw new Error('Os filtros ou a lista mudaram. Inicie outra leitura na tela atual.');
      }
    };
    const capture = () => {
      const oldSize = gathered.size;
      for (const record of workspaceRecords()) {
        const key = record.rowKey || (record.expedienteId && record.expedienteId !== 'Sem ID'
          ? `${record.processNumber || ''}|${record.expedienteId}` : record.id);
        if (key) gathered.set(key, record);
      }
      if (gathered.size > oldSize) { lastProgress = Date.now(); dataVersion++; }
      onProgress({ count: gathered.size, rounds, ...workspaceCounts() });
    };
    const scroll = top => {
      scroller.scrollTop = top;
      scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
      if (scroller === document.scrollingElement && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new Event('scroll'));
      }
    };
    const bottom = () => scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
    try {
      check(); capture(); scroll(0);
      // Capturar de cima para baixo também cobre listas virtualizadas que reciclam cards.
      await new Promise(resolve => setTimeout(resolve, pause));
      while (Date.now() - started < timeout) {
        check(); capture();
        const counts = workspaceCounts();
        if (counts.total !== null && counts.total > 0 && counts.loaded !== null &&
            counts.loaded >= counts.total && gathered.size >= counts.total) {
          reason = 'complete'; break;
        }
        const button = locate('workspace', 'more').nodes.find(visible);
        const now = Date.now();
        if (button && !button.disabled && (lastClick === -Infinity ||
            (dataVersion !== clickedVersion && now - lastClick >= 300) || now - lastClick >= 10000)) {
          button.click();
          lastClick = now;
          clickedVersion = dataVersion;
        }
        // A rolagem também é necessária quando não existe botão "Carregar mais".
        if (!bottom()) {
          scroll(Math.min(scroller.scrollHeight, scroller.scrollTop + Math.max(100, scroller.clientHeight * .75)));
        } else {
          // Algumas implementações só carregam ao receber um evento de scroll no final.
          scroll(scroller.scrollTop);
        }
        await new Promise(resolve => setTimeout(resolve, pause));
        check(); rounds++; capture();
        const updated = workspaceCounts();
        if (updated.loaded !== counts.loaded || updated.total !== counts.total) {
          lastProgress = Date.now();
          dataVersion++;
        }
        const idle = Date.now() - lastProgress;
        const pending = locate('workspace', 'more').nodes.some(node => node.disabled && visible(node));
        if (bottom() && !pending && idle >= idleTimeout) {
          if (!button) {
            reason = updated.total !== null && gathered.size < updated.total ? 'partial' : 'stable';
            break;
          }
          // Se o botão ainda está lá mas não produziu dados, evitar clicar indefinidamente.
          if (Date.now() - lastClick >= idleTimeout * 2 && lastProgress <= lastClick) {
            reason = 'stalled'; break;
          }
        }
      }
      return { records: [...gathered.values()], reason, rounds, ...workspaceCounts() };
    } finally {
      if (location.href === href && list.isConnected) {
        scroller.scrollTop = initialTop;
        scroller.scrollLeft = initialLeft;
      }
    }
  }
  function records(root = document) {
    if (locate('workspace','list',root).nodes.length) return workspaceRecords(root);
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
      if (signal?.aborted) throw new DOMException('Carregamento cancelado', 'AbortError');
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
  globalThis.SpaAdapter = Object.freeze({ route, locate, readRows, field, records, workspacePreviewRecords, workspaceRecords, workspaceCounts, collectWorkspaceRecords, inspect, observe, waitFor, dispose, filterRecords, collectLazyRecords,
    actions: Object.freeze({ confirm: confirmAction }), registry });
  if (typeof window !== 'undefined') window.addEventListener('mtprev-extension-context-invalidated', () => {
    invalidated = true;
    document.querySelectorAll('.mtprev-action-confirm').forEach(dialog => dialog.close('no')); dispose();
  });
})();
