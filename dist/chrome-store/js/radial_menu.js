(() => {
  "use strict";
  window.MTPrevRadialMenu = function (shell, api) {
    if (shell.dataset.radialReady) return;
    shell.dataset.radialReady = "1";
    shell.classList.add("mtprev-radial-shell");
    const create = (tag, cls, text, parent) => {
      const node = document.createElement(tag); node.className = cls;
      if (text) node.textContent = text;
      if (parent) parent.appendChild(node);
      return node;
    };
    const nav = shell.querySelector('.cdsp-general-shell__modules');
    const stage = create('div', 'mtprev-orbit', '', shell);
    shell.insertBefore(stage, nav);
    const ring = create('div', 'mtprev-orbit__ring', '', stage);
    const center = create('button', 'mtprev-orbit__center', '', stage);
    center.type = 'button'; center.setAttribute('aria-label', 'Abrir ou fechar menu MTPrev; arraste para mover');
    center.setAttribute('aria-expanded', 'false');
    const logo = create('img', '', '', center); logo.src = api.url('images/logo-mtprev.png'); logo.alt = 'MTPrev'; logo.draggable = false;
    const watchBadge = create('span', 'mtprev-watch-radial-badge', '', center); watchBadge.hidden = true; watchBadge.setAttribute('aria-hidden', 'true');
    let watchUnread = 0;
    function updateWatchCount(records) {
      watchUnread = Object.values(records || {}).filter((record) => record?.unread).length;
      watchBadge.hidden = watchUnread === 0;
      watchBadge.textContent = watchUnread > 99 ? '99+' : String(watchUnread);
      center.setAttribute('aria-label', `Abrir ou fechar menu MTPrev; arraste para mover${watchUnread ? `; ${watchUnread} processo(s) com alertas não lidos` : ''}`);
      ring.querySelectorAll('.mtprev-orbit__special .mtprev-watch-option-badge').forEach((badge) => {
        badge.hidden = watchUnread === 0; badge.textContent = watchUnread > 99 ? '99+' : String(watchUnread);
      });
    }
    chrome.storage.local.get('CDSP_PROCESS_WATCH_V1').then((value) => updateWatchCount(value.CDSP_PROCESS_WATCH_V1 || {})).catch(() => {});
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.CDSP_PROCESS_WATCH_V1) updateWatchCount(changes.CDSP_PROCESS_WATCH_V1.newValue || {});
    });
    const tools = create('div', 'mtprev-orbit__tools', '', shell);
    shell.insertBefore(tools, shell.querySelector('.cdsp-general-shell__body'));
    const back = create('button', '', 'Voltar aos módulos', tools); back.type = 'button';
    back.classList.add('mtprev-orbit__back');
    const header = shell.querySelector('.cdsp-general-shell__header');
    const title = shell.querySelector('.cdsp-general-shell__title');
    title.replaceChildren();
    const headerLogo = create('img', 'mtprev-panel-logo', '', title);
    headerLogo.src = api.url('images/logo-mtprev.png'); headerLogo.alt = 'MTPrev'; headerLogo.draggable = false;
    const theme = create('span', 'mtprev-panel-theme', '', title);
    const context = create('span', 'mtprev-orbit__context', 'MTPrev', tools);
    context.setAttribute('aria-live', 'polite');
    const loading = create('div', 'mtprev-orbit__loading', '', shell);
    loading.hidden = true;
    const loadingText = create('div', '', '', loading);
    loadingText.setAttribute('role', 'status');
    const loadingBar = create('progress', '', '', loading);
    loadingBar.setAttribute('aria-label', 'Carregamento dos processos da mesa');
    let preloadList = null, preloadKey = '', preloadRunning = false, preloadStopped = false;
    function preloadWorkspace() {
      const adapter = window.SpaAdapter;
      if (preloadStopped || !adapter) return;
      if (!adapter.isWorkspace()) { loading.hidden = true; preloadList = null; preloadKey = ''; return; }
      if (preloadRunning) return;
      const list = adapter.locate('workspace', 'list').nodes[0];
      const counts = adapter.workspaceCounts();
      if (!list || counts.total === null || (counts.total > 0 && !adapter.locate('workspace', 'cards').nodes.length)) return;
      const form = document.querySelector('form.workspace-search');
      const key = location.href + '|' + counts.total + '|' + Array.from(form?.querySelectorAll('input,select,textarea') || [])
        .map(input => `${input.name}=${input.value}:${input.checked ?? ''}`).join('&');
      if (list === preloadList && key === preloadKey) return;
      preloadList = list; preloadKey = key;
      loading.hidden = false;
      let previousCount = counts.loaded || 0, batchSize = 0;
      const started = Date.now();
      let requestSeconds = null;
      const update = (count, total, complete = false) => {
        if (total !== null && total > 0) { loadingBar.max = total; loadingBar.value = Math.min(count, total); }
        else if (complete) { loadingBar.max = 1; loadingBar.value = 1; }
        else loadingBar.removeAttribute('value');
        loadingText.textContent = `${complete ? 'Carregamento concluído' : 'Carregando processos'}: ${count}${total === null ? '' : ' de ' + total} · Lote: ${batchSize || (complete ? 'nenhum' : 'aguardando')}${batchSize ? ' processos' : ''}`;
        loadingText.textContent += ` · Tempo total: ${((Date.now() - started) / 1000).toFixed(1)} s${requestSeconds === null ? '' : ' · Última requisição: ' + requestSeconds + ' s'}`;
        requestAnimationFrame(clamp);
      };
      update(previousCount, counts.total, counts.total === 0);
      if (counts.total === 0) return;
      preloadRunning = true;
      adapter.collectWorkspaceRecords({batchSize:100, allowScroll:false, onProgress:({count, loaded, total, batchSize:receivedBatch, requestMs}) => {
        const current = loaded ?? count;
        if (current > previousCount) batchSize = current - previousCount;
        if (receivedBatch) batchSize = receivedBatch;
        if (Number.isFinite(requestMs)) requestSeconds = (requestMs / 1000).toFixed(1);
        previousCount = current;
        update(count, total);
      }}).then(result => {
        update(result.records.length, result.total, result.reason === 'complete');
        if (result.reason !== 'complete') loadingText.textContent = `Carregamento parcial: ${result.records.length} de ${result.total ?? '?'} processos · Lote: ${batchSize}`;
      }).catch(() => {
        loadingText.textContent = 'Não foi possível carregar o lote solicitado sem rolagem. A página permanece na mesma posição.';
      }).finally(() => { preloadRunning = false; });
    }
    // The workspace may arrive after the menu or be replaced when its filters change.
    const preloadTimer = setInterval(preloadWorkspace, 1000);
    window.addEventListener('mtprev-extension-context-invalidated', () => {
      preloadStopped = true; clearInterval(preloadTimer); loading.hidden = true;
    });
    preloadWorkspace();
    let expanded = false, module = null, generation = 0, page = 0;
    const viewKey = 'MTPREV_RADIAL_VIEW_V1';
    let restoringView = false;
    function rememberView() {
      if (restoringView) return;
      const mode = shell.classList.contains('mtprev-radial-external') ? 'watch'
        : shell.classList.contains('mtprev-radial-operational') ? 'panel' : expanded ? 'menu' : 'compact';
      try { sessionStorage.setItem(viewKey, JSON.stringify({mode, module:module?.key || null, option:theme.textContent, page})); } catch (_) {}
    }
    window.addEventListener('pagehide', rememberView);
    const previous = create('button', '', 'Opções anteriores', tools); previous.type = 'button';
    const next = create('button', '', 'Mais opções', tools); next.type = 'button';
    previous.classList.add('mtprev-orbit__previous'); next.classList.add('mtprev-orbit__next');
    let timer, drag = null, frame = 0, suppressClick = false;
    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = () => reduced() ? 0 : 360;
    const icons = { triagem: 'inbox', prazos: 'edit_document', gestao: 'account_tree', oficios: 'outgoing_mail' };
    const iconFor = (text) => {
      const value = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      for (const [word, icon] of [['duplic','content_copy'],['peca','description'],['filtro','filter_alt'],['program','event'],['registro','history'],['triagem','fact_check'],['agravo','edit_document'],['relat','summarize'],['correc','edit_document'],['encerr','check_circle']]) if (value.includes(word)) return icon;
      return 'description';
    };
    function clamp() {
      if (shell.classList.contains('mtprev-radial-external')) return;
      const rect = shell.getBoundingClientRect();
      const pos = api.clamp(shell, rect.left, rect.top);
      shell.style.left = pos.left + 'px'; shell.style.top = pos.top + 'px';
    }
    function layout() {
      const nodes = [...ring.children];
      const width = stage.clientWidth;
      const size = Math.min(66, Math.max(48, width * .17));
      const radius = Math.max(60, Math.min(120, width / 2 - size / 2 - 32));
      stage.style.setProperty('--orbit-radius', radius + 'px');
      shell.style.setProperty('--orbit-radius', radius + 'px');
      const height = Math.max(88, 2 * (radius + size / 2 + 52)) + 'px';
      stage.style.height = height;
      stage.style.setProperty('--orbit-height', height);
      nodes.forEach((node, i) => {
        const angle = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, nodes.length);
        node.style.setProperty('--orbit-x', `${Math.cos(angle) * radius}px`);
        node.style.setProperty('--orbit-y', `${Math.sin(angle) * radius}px`);
        node.style.setProperty('--orbit-size', `${size}px`);
        node.style.setProperty('--orbit-delay', `${i * 20}ms`);
      });
      clamp();
    }
    function collapseItems() {
      ring.classList.remove('is-open'); ring.inert = true;
      center.setAttribute('aria-expanded', 'false');
    }
    function showPanel(target, label) {
      shell.classList.remove('mtprev-panel-leaving');
      expanded = false; generation++; clearTimeout(timer); collapseItems();
      shell.classList.add('mtprev-radial-operational');
      api.expand();
      context.textContent = module?.title || 'MTPrev';
      theme.textContent = label || target?.textContent.trim() || module?.title || '';
      back.hidden = false; back.textContent = 'Voltar'; header.appendChild(back);
      if (target) target.click();
      rememberView();
      const activePane = shell.querySelector('[data-cdsp-module-pane]:not([hidden])');
      if (activePane) { activePane.tabIndex = -1; activePane.focus({ preventScroll: true }); }
      clamp();
    }
    function options() {
      const pane = shell.querySelector(`[data-cdsp-module-pane="${module.key}"]`);
      if (!pane) return [];
      if (module.key === 'triagem') return [...pane.querySelectorAll('.mtprev-context-nav > button')].map((node) => ({ title: node.textContent.trim(), run: () => showPanel(node) }));
      const sections = [...pane.querySelectorAll('[data-mtprev-radial-option]')];
      if (sections.length) return sections.map((node) => ({ title: node.dataset.mtprevRadialOption, run: () => { showPanel(null, node.dataset.mtprevRadialOption); node.scrollIntoView({ block: 'nearest' }); node.querySelector('input,select,button,summary')?.focus({ preventScroll: true }); } }));
      if (module.key === 'oficios') return [...pane.querySelectorAll('.cdsp-oficios-section')].map((node) => ({ title: node.querySelector('.cdsp-oficios-section__title')?.textContent || node.querySelector('h3')?.textContent || '', run: () => { showPanel(null, node.querySelector('.cdsp-oficios-section__title')?.textContent || node.querySelector('h3')?.textContent); node.scrollIntoView({ block: 'nearest' }); } })).filter((item) => item.title);
      return [];
    }
    function entries() {
      return module ? options() : [{
        title: 'Acompanhamento Especial de Processos', icon: 'radar', special: true,
        run: async () => {
          if (!window.MTPrevProcessWatch) { context.textContent = 'Recarregue a aba para acessar o acompanhamento.'; context.classList.add('is-notice'); return; }
          try {
            await window.MTPrevProcessWatch.open();
            close(); shell.classList.add('mtprev-radial-external');
            const panel = document.getElementById('cdsp-process-watch');
            if (panel) { panel.tabIndex = -1; panel.focus({ preventScroll: true }); }
          } catch (error) { context.textContent = error.message; context.classList.add('is-notice'); }
        }
      }, ...api.modules.map((item) => ({ title: item.title, icon: icons[item.key], run: () => select(item) }))];
    }
    function paint(items) {
      const capacity = Math.min(6, Math.max(3, Math.floor((stage.clientWidth - 24) / 80) * 2));
      page = Math.min(page, Math.max(0, Math.ceil(items.length / capacity) - 1));
      previous.hidden = page === 0; next.hidden = (page + 1) * capacity >= items.length;
      items = items.slice(page * capacity, (page + 1) * capacity);
      ring.replaceChildren();
      items.forEach((item) => {
        const button = create('button', 'mtprev-orbit__item', '', ring); button.type = 'button';
        button.setAttribute('aria-label', item.title);
        const describe = () => {
          if (!expanded || context.classList.contains('is-notice')) return;
          context.textContent = item.title;
        };
        const restoreDescription = () => {
          if (!expanded || context.classList.contains('is-notice')) return;
          const active = ring.querySelector(':hover')?.closest('.mtprev-orbit__item') || ring.querySelector(':focus');
          context.textContent = active?.getAttribute('aria-label') || module?.title || 'Módulos MTPrev';
        };
        button.addEventListener('pointerenter', describe);
        button.addEventListener('focus', describe);
        button.addEventListener('pointerleave', restoreDescription);
        button.addEventListener('blur', restoreDescription);
        if (item.special) button.classList.add('mtprev-orbit__special');
        const disc = create('span', 'mtprev-orbit__disc', '', button);
        const image = create('img', '', '', disc); image.src = api.url(`images/material-rounded/${item.icon || iconFor(item.title)}.svg`); image.alt = ''; image.draggable = false;
        create('span', 'mtprev-orbit__label', item.title, button);
        if (item.special) {
          const badge = create('span', 'mtprev-watch-option-badge', watchUnread > 99 ? '99+' : String(watchUnread), button);
          badge.setAttribute('aria-hidden', 'true'); badge.hidden = watchUnread === 0;
        }
        button.addEventListener('click', item.run);
      });
      layout();
      requestAnimationFrame(() => { if (expanded) { ring.inert = false; ring.classList.add('is-open'); center.setAttribute('aria-expanded', 'true'); } });
    }
    function open() {
      shell.classList.remove('mtprev-panel-leaving');
      expanded = true; generation++; clearTimeout(timer);
      shell.classList.add('mtprev-radial-draggable');
      context.classList.remove('is-notice');
      center.setAttribute('aria-expanded', 'true');
      shell.classList.remove('mtprev-radial-operational', 'mtprev-radial-compact'); api.expand();
      context.textContent = module?.title || 'Módulos MTPrev';
      back.hidden = !module; back.textContent = 'Voltar';
      tools.prepend(back);
      paint(entries());
      center.focus({ preventScroll: true });
      rememberView();
    }
    function close() {
      expanded = false; generation++; clearTimeout(timer); collapseItems();
      shell.classList.remove('mtprev-radial-draggable');
      if (!restoringView) {
        try { sessionStorage.setItem(viewKey, JSON.stringify({mode:'compact', module:module?.key || null, page})); } catch (_) {}
      }
      if (shell.classList.contains('mtprev-radial-operational')) shell.classList.add('mtprev-panel-leaving');
      timer = setTimeout(() => { if (!expanded) { shell.classList.remove('mtprev-radial-operational', 'mtprev-panel-leaving'); shell.classList.add('mtprev-radial-compact'); clamp(); } }, delay());
      center.focus({ preventScroll: true });
    }
    async function select(item) {
      collapseItems(); module = item; page = 0; const token = ++generation;
      context.textContent = `Carregando ${item.title}…`; back.hidden = false;
      api.load(item.key);
      const started = performance.now();
      await new Promise((resolve) => setTimeout(resolve, delay()));
      const loadError = () => shell.querySelector('.cdsp-general-shell__status[data-tone="error"]')?.textContent;
      while (token === generation && !options().length && !loadError() && performance.now() - started < 10000) await new Promise((resolve) => setTimeout(resolve, 80));
      if (token !== generation) return;
      if (!options().length) {
        context.textContent = loadError() || 'Nenhuma opção disponível neste contexto. Volte ou abra um processo no SPA.';
        context.classList.add('is-notice');
        return;
      }
      open();
      return true;
    }
    center.addEventListener('click', (event) => {
      if (suppressClick && event.detail !== 0) { event.preventDefault(); suppressClick = false; return; }
      shell.classList.remove('mtprev-radial-compact');
      if (expanded) close(); else open();
    });
    // Cancel the release click before any option handler runs after a drag.
    shell.addEventListener('click', (event) => {
      if (!suppressClick || event.detail === 0) return;
      suppressClick = false;
      event.preventDefault(); event.stopImmediatePropagation();
    }, true);
    shell.addEventListener('mtprev-close-drawer', close);
    back.addEventListener('click', () => {
      if (shell.classList.contains('mtprev-radial-operational')) { open(); return; }
      collapseItems(); const token = ++generation;
      clearTimeout(timer); timer = setTimeout(() => { if (token === generation) { module = null; page = 0; open(); } }, delay());
    });
    previous.addEventListener('click', () => { page--; paint(entries()); });
    next.addEventListener('click', () => { page++; paint(entries()); });
    shell.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation(); event.preventDefault();
      if (expanded && module) back.click(); else if (expanded) close(); else { shell.classList.remove('mtprev-radial-compact'); open(); }
    });
    shell.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || drag || shell.classList.contains('mtprev-radial-operational')) return;
      const rect = shell.getBoundingClientRect();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, dx: 0, dy: 0, moved: false };
      suppressClick = false;
    });
    shell.addEventListener('pointermove', (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      if (!drag.moved) {
        shell.setPointerCapture(event.pointerId);
        shell.classList.add('mtprev-radial-dragging');
        drag.moved = true;
      }
      const position = api.clamp(shell, drag.left + dx, drag.top + dy);
      drag.dx = position.left - drag.left;
      drag.dy = position.top - drag.top;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (drag) shell.style.transform = `translate3d(${drag.dx}px,${drag.dy}px,0)`; });
    });
    function finish(event) {
      if (!drag || drag.id !== event.pointerId) return;
      cancelAnimationFrame(frame); frame = 0;
      suppressClick = drag.moved || event.type === 'pointercancel';
      shell.style.transform = '';
      shell.style.left = `${drag.left + drag.dx}px`; shell.style.top = `${drag.top + drag.dy}px`;
      drag = null;
      shell.classList.remove('mtprev-radial-dragging');
      if (shell.hasPointerCapture(event.pointerId)) shell.releasePointerCapture(event.pointerId);
      api.save(shell);
    }
    shell.addEventListener('pointerup', finish); shell.addEventListener('pointercancel', finish); shell.addEventListener('lostpointercapture', finish);
    window.addEventListener('resize', () => { if (expanded) layout(); else clamp(); });
    window.addEventListener('mtprev-process-watch-closed', () => {
      if (!shell.classList.contains('mtprev-radial-external')) return;
      shell.classList.remove('mtprev-radial-external'); module = null; page = 0; open();
    });
    // Expansion and asynchronously loaded panels can change height near an edge.
    // Reposition before paint without changing the observed dimensions.
    new ResizeObserver(() => { if (!drag) clamp(); }).observe(shell);
    new MutationObserver(() => {
      if (shell.classList.contains('cdsp-general-shell--collapsed') && (expanded || shell.classList.contains('mtprev-radial-operational'))) {
        expanded = false; generation++; clearTimeout(timer); collapseItems();
        shell.classList.remove('mtprev-radial-operational');
        shell.classList.add('mtprev-radial-compact');
        back.hidden = true;
        clamp();
      }
    }).observe(shell, { attributes: true, attributeFilter: ['class'] });
    // Preserve auxiliary controls such as process tracking outside the hidden legacy navigation.
    const extras = () => { [...nav.children].filter((node) => !node.dataset.cdspModuleButton).forEach((node) => tools.appendChild(node)); };
    new MutationObserver(extras).observe(nav, { childList: true }); extras();
    ring.inert = true; back.hidden = true;
    shell.classList.add('mtprev-radial-compact'); layout(); clamp();
    // Keep the same navigation view within this browser tab after a site navigation.
    async function restoreView() {
      let saved;
      try { saved = JSON.parse(sessionStorage.getItem(viewKey) || 'null'); } catch (_) {}
      if (!saved || saved.mode === 'compact') return;
      restoringView = true;
      try {
        if (saved.mode === 'watch') {
          await entries()[0].run();
          return;
        }
        const selected = api.modules.find(item => item.key === saved.module);
        if (selected) {
          if (!await select(selected)) return;
          page = Math.max(0, Number(saved.page) || 0);
          if (saved.mode === 'panel') {
            const option = options().find(item => item.title === saved.option);
            if (option) { option.run(); return; }
          }
          paint(entries());
        } else open();
      } finally { restoringView = false; rememberView(); }
    }
    setTimeout(restoreView, 0);
  };
})();
