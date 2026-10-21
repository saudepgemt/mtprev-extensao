(() => {
  if (globalThis.MTPrevTriageWorkspace) return;
  function create(api) {
    const root = document.createElement('section'); root.className = 'mtprev-triage-workspace'; root.dataset.mtprevUi = 'triage-list';
    root.setAttribute('aria-label', 'Lista de apoio à triagem');
    const title = document.createElement('h3'); title.textContent = 'Expedientes da caixa'; root.append(title);
    const scope = document.createElement('p'); scope.textContent = 'Página carregada. Esta seleção controla o diagnóstico; as ações operacionais continuam usando os filtros e lotes do SPA abaixo.'; root.append(scope);
    const filters = document.createElement('div'); filters.className = 'mtprev-workspace-filters'; root.append(filters);
    const controls = {};
    for (const [key, caption] of [['query', 'Processo ou expediente'], ['origin', 'Origem'], ['status', 'Situação'], ['date', 'Data informada no SPA'], ['deadline', 'Prazo informado no SPA']]) {
      const label = document.createElement('label'); label.textContent = caption;
      const input = document.createElement('input'); input.type = key === 'query' ? 'search' : 'text';
      input.placeholder = key === 'query' ? 'Buscar identificador' : 'Todos';
      label.append(input); filters.append(label); controls[key] = input;
    }
    const chips = document.createElement('div'); chips.className = 'mtprev-filter-chips'; root.append(chips);
    const count = document.createElement('p'); count.setAttribute('role', 'status'); root.append(count);
    const loadTools = document.createElement('div'); loadTools.className = 'mtprev-workspace-load'; root.append(loadTools);
    const load = document.createElement('button'); load.type = 'button'; load.textContent = 'Carregar expedientes por rolagem'; loadTools.append(load);
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancelar carregamento'; cancel.hidden = true; loadTools.append(cancel);
    const progress = document.createElement('p'); progress.setAttribute('role', 'status'); root.append(progress);
    const all = document.createElement('button'); all.type = 'button'; all.textContent = 'Selecionar resultados para diagnóstico'; root.append(all);
    const list = document.createElement('div'); list.className = 'mtprev-workspace-list'; root.append(list);
    const selected = new Set(); let items = [], results = [], explicit = false;
    let accumulated = new Map(), controller, currentRoute = location.href, disposed = false;
    const keyOf = record => record.expedienteId && record.expedienteId !== 'Sem ID' ? `${record.processNumber || ''}|${record.expedienteId}` : record.pendencyUrl || record.rowKey || record.id;
    function reset() { controller?.abort(); accumulated.clear(); selected.clear(); explicit = false; progress.textContent = ''; }
    function nativeChange(event) {
      if (event.target.closest?.('[data-mtprev-ui]')) return;
      if (event.type === 'change' || SpaAdapter.locate('triagem','pagination').nodes.some(node => node.contains(event.target))) { reset(); render(); }
    }
    document.addEventListener('change', nativeChange, true); document.addEventListener('click', nativeChange, true);
    cancel.onclick = () => controller?.abort();
    load.onclick = async () => {
      if (controller) return;
      controller = new AbortController(); accumulated.clear();
      load.disabled = true; cancel.hidden = false; root.setAttribute('aria-busy','true');
      try {
        const result = await SpaAdapter.collectLazyRecords({ read: api.getRecords, signal: controller.signal,
          onProgress: ({ count }) => { progress.textContent = `Carregando por rolagem: ${count} expediente(s) identificado(s)…`; } });
        accumulated = new Map(result.records.map(record => [keyOf(record), record]));
        progress.textContent = result.reason === 'complete' ? 'Lista carregada conforme o contador do SPA.' : result.reason === 'stable' ? 'Rolagem sem novos registros. Confira o total do SPA; outras páginas não foram percorridas.' : 'Leitura parcial: o carregamento parou ou atingiu o limite de tempo. Você pode tentar novamente.';
      } catch (error) { progress.textContent = error.name === 'AbortError' ? 'Carregamento cancelado. A lista mostra os registros atualmente montados.' : error.message; }
      finally { controller = null; load.disabled = false; cancel.hidden = true; root.setAttribute('aria-busy','false'); if (!disposed) render(); }
    };
    function preferences() { return Object.fromEntries(Object.entries(controls).map(([key, input]) => [key, input.value])); }
    try { const stored = JSON.parse(localStorage.getItem('MTPREV_TRIAGE_READING_FILTERS') || '{}'); for (const key of Object.keys(controls)) controls[key].value = stored[key] || ''; } catch (_) {}
    function render() {
      if (!root.isConnected) return;
      load.textContent = SpaAdapter.locate('workspace','list').nodes.length ? 'Carregar todos os cards da caixa' : 'Carregar expedientes por rolagem';
      if (location.href !== currentRoute) { reset(); currentRoute = location.href; }
      try { items = api.getRecords(); } catch (_) { items = SpaAdapter.records(); }
      if (accumulated.size) items = [...new Map([...accumulated, ...items.map(record => [keyOf(record),record])]).values()];
      scope.textContent = items.some(record => record.readingScope === 'workspace-preview')
        ? 'Somente o expediente exibido nos detalhes foi lido. A lista da caixa e os expedientes relacionados ainda não estão mapeados; o total abaixo não representa a caixa inteira.'
        : 'Esta seleção controla o diagnóstico dos registros carregados; as ações operacionais usam os filtros e lotes do SPA abaixo.';
      const filters = preferences(); results = SpaAdapter.filterRecords(items, filters).filter(record => !filters.deadline || String(record.pjeDeadline || '').toLowerCase().includes(filters.deadline.toLowerCase()));
      count.textContent = `${results.length} de ${items.length} expediente(s) carregado(s) · ${explicit ? results.filter(record => selected.has(keyOf(record))).length : results.length} para diagnóstico. Outras páginas e linhas não montadas não foram lidas.`;
      chips.replaceChildren();
      for (const [key, value] of Object.entries(filters)) {
        if (!value) continue;
        const chip = document.createElement('button'); chip.type = 'button'; chip.textContent = `${controls[key].parentElement.firstChild.textContent}: ${value} ×`;
        chip.setAttribute('aria-label', `Remover filtro ${controls[key].parentElement.firstChild.textContent}`);
        chip.onclick = () => { controls[key].value = ''; changed(); }; chips.append(chip);
      }
      list.replaceChildren();
      for (const record of results) {
        const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.checked = !explicit || selected.has(keyOf(record));
        input.onchange = () => {
          if (!explicit) { results.forEach(item => selected.add(keyOf(item))); explicit = true; }
          input.checked ? selected.add(keyOf(record)) : selected.delete(keyOf(record)); render();
        };
        const text = document.createElement('span'); text.textContent = `${record.processNumber || 'Processo não identificado'} · expediente ${record.expedienteId || 'não identificado'}`;
        label.append(input, text); list.append(label);
      }
    }
    function changed() { try { localStorage.setItem('MTPREV_TRIAGE_READING_FILTERS', JSON.stringify(preferences())); } catch (_) {} render(); }
    let debounce; Object.values(controls).forEach(input => input.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(changed, 150); }));
    all.onclick = () => { explicit = true; results.forEach(item => selected.add(keyOf(item))); render(); };
    let unsubscribe;
    queueMicrotask(() => {
      render(); unsubscribe = SpaAdapter.observe(() => { if (!root.isConnected) { clearTimeout(debounce); unsubscribe(); return; } render(); });
    });
    return { root, selectedRecords: () => { render(); return results.filter(record => !explicit || selected.has(keyOf(record))); },
      dispose: () => { disposed = true; controller?.abort(); document.removeEventListener('change', nativeChange, true); document.removeEventListener('click', nativeChange, true); clearTimeout(debounce); unsubscribe?.(); } };
  }
  globalThis.MTPrevTriageWorkspace = Object.freeze({ create });
})();
