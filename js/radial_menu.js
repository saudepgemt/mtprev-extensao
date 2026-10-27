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
    let expanded = false, module = null, generation = 0, page = 0;
    // A opção ativa pertence à aba do SPA; permanece após recarregar,
    // mas não afeta outras abas, contas ou páginas diferentes.
    const LAST_VIEW_KEY='mtprev.radial.active-view.v1';
    const viewScope=()=>`${location.origin}${location.pathname}|${new URLSearchParams(location.search).get('user_id') || ''}`;
    const saveView=(option='')=>{
      try {
        if(!module){sessionStorage.removeItem(LAST_VIEW_KEY);return;}
        sessionStorage.setItem(LAST_VIEW_KEY,JSON.stringify({scope:viewScope(),moduleKey:module.key,option}));
      } catch (_error) {}
    };
    const loadView=()=>{
      try {
        const data=JSON.parse(sessionStorage.getItem(LAST_VIEW_KEY)||'null');
        return data && data.scope===viewScope() && typeof data.moduleKey==='string' ? data : null;
      } catch (_error){return null;}
    };

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
      const radius = Math.max(68, Math.min(82, width / 2 - size / 2 - 48));
      stage.style.setProperty('--orbit-radius', radius + 'px');
      shell.style.setProperty('--orbit-radius', radius + 'px');
      // Espaço apenas para os círculos: a legenda não ocupa mais uma faixa fixa.
      const height = Math.max(88, 2 * (radius + size / 2 + 24)) + 'px';
      stage.style.height = height;
      stage.style.setProperty('--orbit-height', height);
      nodes.forEach((node, i) => {
        const angle = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, nodes.length);
        node.style.setProperty('--orbit-x', `${Math.cos(angle) * radius}px`);
        node.style.setProperty('--orbit-y', `${Math.sin(angle) * radius}px`);
        node.style.setProperty('--orbit-size', `${size}px`);
        node.style.setProperty('--orbit-delay', `${i * 20}ms`);
        // Posiciona o rótulo temporário sem encobrir o ícone vizinho.
        node.dataset.labelDefault = Math.sin(angle) < -0.55 ? 'above'
          : Math.sin(angle) > 0.45 ? 'below'
          : Math.cos(angle) > 0 ? 'right' : 'left';
        node.dataset.labelPosition = node.dataset.labelDefault;
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
      saveView(theme.textContent);
      back.hidden = false; back.textContent = 'Voltar'; header.appendChild(back);
      if (target) target.click();
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
      // Nos submenus, a seta é um botão orbital fixo. Não ocupa uma página de
      // opções nem desaparece quando o usuário avança para a página seguinte.
      const isSubmenu = Boolean(module);
      const optionCapacity = Math.max(1, capacity - (isSubmenu ? 1 : 0));
      page = Math.min(page, Math.max(0, Math.ceil(items.length / optionCapacity) - 1));
      previous.hidden = page === 0; next.hidden = (page + 1) * optionCapacity >= items.length;
      const visibleItems = items.slice(page * optionCapacity, (page + 1) * optionCapacity);
      items = isSubmenu
        ? [{ title: 'Voltar aos módulos', isBack: true, run: () => back.click() }, ...visibleItems]
        : visibleItems;
      ring.replaceChildren();
      items.forEach((item) => {
        const button = create('button', 'mtprev-orbit__item', '', ring); button.type = 'button';
        button.setAttribute('aria-label', item.title);
        const describe = () => {
          if (!expanded || context.classList.contains('is-notice')) return;
          // Tooltip acompanha o ícone, mas inverte o lado ao chegar perto
          // das bordas da tela (o radial pode ser arrastado livremente).
          const label = button.querySelector('.mtprev-orbit__label');
          const box = button.getBoundingClientRect();
          const w = label?.offsetWidth || 165, h = label?.offsetHeight || 40;
          const margin = 8, gap = 8;
          let side = button.dataset.labelDefault || 'below';
          if (side === 'left' && box.left - w - gap < margin) side = 'right';
          else if (side === 'right' && box.right + w + gap > innerWidth - margin) side = 'left';
          else if (side === 'above' && box.top - h - gap < margin) side = 'below';
          else if (side === 'below' && box.bottom + h + gap > innerHeight - margin) side = 'above';
          button.dataset.labelPosition = side;
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
        if (item.isBack) button.classList.add('mtprev-orbit__item--back');
        const disc = create('span', 'mtprev-orbit__disc', '', button);
        if (item.isBack) {
          const arrow = create('span', 'mtprev-orbit__return-icon', '←', disc);
          arrow.setAttribute('aria-hidden', 'true');
        } else {
          const image = create('img', '', '', disc); image.src = api.url(`images/material-rounded/${item.icon || iconFor(item.title)}.svg`); image.alt = ''; image.draggable = false;
        }
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
      context.classList.remove('is-notice');
      center.setAttribute('aria-expanded', 'true');
      shell.classList.remove('mtprev-radial-operational', 'mtprev-radial-compact'); api.expand();
      context.textContent = module?.title || 'Módulos MTPrev';
      // O retorno dos submenus já está na órbita; o botão auxiliar fica
      // reservado ao carregamento/erro e ao cabeçalho de painéis operacionais.
      back.hidden = true; back.textContent = 'Voltar';
      tools.prepend(back);
      paint(entries());
      center.focus({ preventScroll: true });
    }
    function close() {
      expanded = false; generation++; clearTimeout(timer); collapseItems();
      if (shell.classList.contains('mtprev-radial-operational')) shell.classList.add('mtprev-panel-leaving');
      timer = setTimeout(() => { if (!expanded) { shell.classList.remove('mtprev-radial-operational', 'mtprev-panel-leaving'); shell.classList.add('mtprev-radial-compact'); clamp(); } }, delay());
      center.focus({ preventScroll: true });
    }
    async function select(item, restoreOption = '') {
      collapseItems(); module = item; page = 0; saveView(); const token = ++generation;
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
      if(restoreOption){
        const choice=options().find(entry=>entry.title===restoreOption);
        if(choice) choice.run();
      }
    }
    center.addEventListener('click', (event) => {
      if (suppressClick && event.detail !== 0) { event.preventDefault(); suppressClick = false; return; }
      shell.classList.remove('mtprev-radial-compact');
      if (expanded) close(); else open();
    });
    shell.addEventListener('mtprev-close-drawer', close);
    back.addEventListener('click', () => {
      if (shell.classList.contains('mtprev-radial-operational')) { saveView(); open(); return; }
      collapseItems(); const token = ++generation;
      clearTimeout(timer); timer = setTimeout(() => { if (token === generation) { module = null; saveView(); page = 0; open(); } }, delay());
    });
    previous.addEventListener('click', () => { page--; paint(entries()); });
    next.addEventListener('click', () => { page++; paint(entries()); });
    shell.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation(); event.preventDefault();
      if (expanded && module) back.click(); else if (expanded) close(); else { shell.classList.remove('mtprev-radial-compact'); open(); }
    });
    center.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || drag) return;
      const rect = shell.getBoundingClientRect();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, dx: 0, dy: 0, moved: false };
      suppressClick = false; center.setPointerCapture(event.pointerId);
    });
    center.addEventListener('pointermove', (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      drag.moved = true;
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
      if (center.hasPointerCapture(event.pointerId)) center.releasePointerCapture(event.pointerId);
      api.save(shell);
    }
    center.addEventListener('pointerup', finish); center.addEventListener('pointercancel', finish); center.addEventListener('lostpointercapture', finish);
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
    const lastView=loadView();
    if(lastView){
      const item=api.modules.find(entry=>entry.key===lastView.moduleKey);
      if(item) requestAnimationFrame(()=>{void select(item,lastView.option || '');});
    }
  };
})();

/* MTPrev — visualização opcional, não destrutiva, dos cards da mesa SPA2.
   Os campos originais permanecem no DOM para leitura e operações do SPA. */
(() => {
  'use strict';
  if (!/^\/workspace\/?$/.test(location.pathname) || window.__mtprevWorkspaceReadable) return;
  window.__mtprevWorkspaceReadable = true;

  const KEY = 'mtprev.workspace.view.v1';
  const norm = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const visibleFields = new Map([
    ['numero do processo', 1],
    ['parte s ativa s', 2],
    ['assunto principal', 3],
    ['id do expediente', 4],
    ['tipo de expediente', 5],
    ['data da distribuicao', 6]
  ]);
  const style = document.createElement('style');
  style.id = 'mtprev-workspace-readable-css';
  style.textContent = `
    /* Leve tom grafite-azulado apenas na mesa de trabalho do SPA2. */
    body.mtprev-workspace-readable {
      background:#dce5ef !important;
    }
    body.mtprev-workspace-readable .workspace-inbox,
    body.mtprev-workspace-readable .workspace-layout,
    body.mtprev-workspace-readable .workspace-main {
      background-color:#e1e9f2 !important;
    }
    body.mtprev-workspace-readable .workspace-panel.workspace-processes {
      background:#e5edf5 !important;
      border-color:#c4d3e1 !important;
    }
    /* A barra principal fica claramente separada da lista, sem mudar o topo institucional. */
    body.mtprev-workspace-readable .workspace-processes__toolbar {
      background:#23485d !important;
      border-color:#1d485d !important;
      border-bottom:3px solid #1a7893 !important;
    }
    body.mtprev-workspace-readable .workspace-processes__heading .workspace-eyebrow {
      color:#aee3ec !important;
      font-weight:750;
    }
    body.mtprev-workspace-readable .workspace-processes__heading h2 {
      color:#ffffff !important;
    }
    body.mtprev-workspace-readable .workspace-processes__heading p,
    body.mtprev-workspace-readable .workspace-processes__heading #workspace-results-count {
      color:#d5e7f1 !important;
    }
    body.mtprev-workspace-readable .workspace-navigation .workspace-panel {
      background:#e6edf5 !important;
      border-color:#c4d3e1 !important;
    }
    body.mtprev-workspace-readable .workspace-navigation .workspace-panel__heading {
      color:#2b4158;
    }
    /* Somente os cards de /workspace; não interfere no preview do SPA. */
    /* O fundo alterna entre branco puro e azul perceptivelmente mais fechado.
       A barra espessa separa processos sem depender só da percepção de cor. */
    body.mtprev-workspace-readable .workspace-process-list > article.workspace-process-card {
      background:#ffffff !important;
      border-left:4px solid #849fb7 !important;
      border-bottom:4px solid #7695ad !important;
      box-shadow:none;
      transition:background-color 160ms ease,border-color 160ms ease,box-shadow 160ms ease;
    }
    body.mtprev-workspace-readable .workspace-process-list > article.workspace-process-card:nth-of-type(even) {
      background:#d9e6f3 !important;
      border-left-color:#486f90 !important;
    }
    /* Cor do hover preservada; contorno e relevo tornam o foco inconfundível.
       Também funciona no foco por teclado (focus-within). */
    body.mtprev-workspace-readable .workspace-process-list > article.workspace-process-card:is(:hover,:focus-within) {
      background:#c4d8eb !important;
      border-left-color:#0f5f87 !important;
      box-shadow:inset 0 0 0 3px #1c6287,0 4px 14px rgba(18,52,75,.16) !important;
      position:relative;
      z-index:1;
    }
    /* Contraste dos rótulos sem recolorir os avisos críticos de prazo. */
    body.mtprev-workspace-readable .workspace-process-list .workspace-process-card__field > small {
      color:#526b83 !important;
    }
    body.mtprev-workspace-readable .workspace-process-list .workspace-process-card__field-value strong {
      color:#263c54;
    }
    body.mtprev-workspace-readable .workspace-process-list .workspace-process-card__summary {
      border-top-color:#b3c6d8 !important;
    }
    body.mtprev-workspace-readable .workspace-process-list .workspace-process-card__footer {
      border-top-color:#afc3d4 !important;
    }
    /* Seleção e hover têm linguagem visual diferente: seleção usa traço pontilhado. */
    body.mtprev-workspace-readable .workspace-process-list > article.workspace-process-card:has(.workspace-process-card__checkbox:checked) {
      outline:3px dashed #164e6f !important;
      outline-offset:-3px;
    }
    body.mtprev-workspace-readable .workspace-process-list > article.workspace-process-card > :is(.workspace-process-card__main,.workspace-process-card__footer) {
      background:transparent !important;
    }
    body.mtprev-workspace-readable.mtprev-workspace-compact .workspace-process-list article.workspace-process-card:not(.mtprev-workspace-expanded) .workspace-process-card__field:not(.mtprev-workspace-primary) {
      display:none !important;
    }
    body.mtprev-workspace-readable.mtprev-workspace-compact .workspace-process-list article.workspace-process-card:not(.mtprev-workspace-expanded) .workspace-process-card__fields {
      display:grid !important;
      grid-template-columns:repeat(3,minmax(0,1fr)) !important;
      gap:12px 20px !important;
    }
    body.mtprev-workspace-readable.mtprev-workspace-compact .workspace-process-list article.workspace-process-card:not(.mtprev-workspace-expanded) .workspace-process-card__field.mtprev-workspace-primary {
      display:block !important;
      order:var(--mtprev-workspace-field-order,0);
      min-width:0;
    }
    body.mtprev-workspace-readable.mtprev-workspace-compact .workspace-process-list article.workspace-process-card:not(.mtprev-workspace-expanded) .workspace-process-card__summary {
      --workspace-summary-columns:repeat(2,minmax(0,1fr));
      grid-template-columns:repeat(2,minmax(0,1fr)) !important;
    }
    body.mtprev-workspace-readable.mtprev-workspace-compact .workspace-process-list article.workspace-process-card:not(.mtprev-workspace-expanded) .workspace-process-card__received {
      display:none !important;
    }
    body.mtprev-workspace-readable .workspace-process-list article.workspace-process-card .workspace-process-card__field .workspace-process-card__field-value {
      min-width:0;
    }
    body.mtprev-workspace-readable .workspace-process-list article.workspace-process-card .mtprev-workspace-primary:is([data-mtprev-field='1']) strong {
      color:#184b77;
      font-weight:750;
    }
    body.mtprev-workspace-readable .mtprev-workspace-details-toggle,
    body.mtprev-workspace-readable .mtprev-workspace-mode-toggle {
      appearance:none;
      border:1px solid #aac2d9;
      background:#f3f8fd;
      color:#204763;
      border-radius:8px;
      padding:7px 10px;
      font:600 12px/1.25 'Segoe UI',Arial,sans-serif;
      cursor:pointer;
      white-space:nowrap;
      transition:background-color 160ms,border-color 160ms;
    }
    body.mtprev-workspace-readable .mtprev-workspace-details-toggle:hover,
    body.mtprev-workspace-readable .mtprev-workspace-mode-toggle:hover {
      background:#dbeaf8;
      border-color:#397c9c;
    }
    body.mtprev-workspace-readable :is(.mtprev-workspace-details-toggle,.mtprev-workspace-mode-toggle):focus-visible {
      outline:3px solid #287caa !important;
      outline-offset:2px;
    }
    body.mtprev-workspace-readable:not(.mtprev-workspace-compact) .mtprev-workspace-details-toggle {
      display:none !important;
    }
    body.mtprev-workspace-readable .mtprev-workspace-mode-toggle {
      margin:8px 0 0;
      align-self:flex-start;
    }
    @media (max-width:1050px) {
      body.mtprev-workspace-readable.mtprev-workspace-compact .workspace-process-list article.workspace-process-card:not(.mtprev-workspace-expanded) .workspace-process-card__fields {
        grid-template-columns:repeat(2,minmax(0,1fr)) !important;
      }
    }
    @media (max-width:650px) {
      body.mtprev-workspace-readable.mtprev-workspace-compact .workspace-process-list article.workspace-process-card:not(.mtprev-workspace-expanded) .workspace-process-card__fields,
      body.mtprev-workspace-readable.mtprev-workspace-compact .workspace-process-list article.workspace-process-card:not(.mtprev-workspace-expanded) .workspace-process-card__summary {
        grid-template-columns:minmax(0,1fr) !important;
      }
    }
    @media (prefers-reduced-motion:reduce) {
      body.mtprev-workspace-readable .workspace-process-list > article.workspace-process-card,
      body.mtprev-workspace-readable :is(.mtprev-workspace-details-toggle,.mtprev-workspace-mode-toggle) {transition:none !important;}
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  let compact = true;
  try { compact = localStorage.getItem(KEY) !== 'detailed'; } catch (_) {}
  const applyMode = () => {
    document.body.classList.add('mtprev-workspace-readable');
    document.body.classList.toggle('mtprev-workspace-compact', compact);
    const mode = document.querySelector('.mtprev-workspace-mode-toggle');
    if (mode) {
      mode.textContent = compact ? 'Visão detalhada' : 'Visão compacta';
      mode.setAttribute('aria-pressed', String(compact));
      mode.title = compact ? 'Mostrar todos os campos dos processos' : 'Mostrar apenas os dados principais';
    }
  };
  const updateCardLabel = card => {
    const button = card.querySelector('.mtprev-workspace-details-toggle');
    if (!button) return;
    const opened = card.classList.contains('mtprev-workspace-expanded');
    button.textContent = opened ? 'Menos dados' : 'Mais dados';
    button.setAttribute('aria-expanded', String(opened));
  };
  const enhanceCard = card => {
    if (!(card instanceof HTMLElement) || card.dataset.mtprevWorkspaceReady) return;
    const fields = card.querySelectorAll('.workspace-process-card__field');
    const footerActions = card.querySelector('.workspace-process-card__actions');
    if (!fields.length || !footerActions) return;
    card.dataset.mtprevWorkspaceReady = '1';
    fields.forEach(field => {
      const label = norm(field.querySelector('small[data-full-label],small')?.getAttribute('data-full-label') || field.querySelector('small')?.textContent);
      const priority = visibleFields.get(label);
      if (!priority) return;
      field.classList.add('mtprev-workspace-primary');
      field.dataset.mtprevField = String(priority);
      field.style.setProperty('--mtprev-workspace-field-order',String(priority));
    });
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mtprev-workspace-details-toggle';
    toggle.setAttribute('aria-label', 'Alternar os campos adicionais deste processo');
    footerActions.prepend(toggle);
    updateCardLabel(card);
  };
  let scheduled = false;
  const scanCards = () => {
    scheduled = false;
    document.querySelectorAll('#workspace-process-results article.workspace-process-card:not([data-mtprev-workspace-ready])').forEach(enhanceCard);
  };
  const queueScan = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(scanCards);
  };
  const init = () => {
    const results = document.getElementById('workspace-process-results');
    if (!results || !document.body) return false;
    applyMode();
    const heading = document.querySelector('.workspace-processes__heading');
    if (heading && !heading.querySelector('.mtprev-workspace-mode-toggle')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mtprev-workspace-mode-toggle';
      heading.appendChild(button);
      applyMode();
    }
    scanCards();
    new MutationObserver(records => {
      if (records.some(record => Array.from(record.addedNodes).some(node =>
        node.nodeType === 1 && (node.matches?.('article.workspace-process-card') || node.querySelector?.('article.workspace-process-card'))))) {
        queueScan();
      }
    }).observe(results,{childList:true,subtree:true});
    document.addEventListener('click', event => {
      const mode = event.target.closest('.mtprev-workspace-mode-toggle');
      if (mode) {
        compact = !compact;
        try { localStorage.setItem(KEY,compact ? 'compact':'detailed'); } catch (_) {}
        applyMode();
        return;
      }
      const button = event.target.closest('.mtprev-workspace-details-toggle');
      if (!button) return;
      const card = button.closest('article.workspace-process-card');
      if (!card) return;
      card.classList.toggle('mtprev-workspace-expanded');
      updateCardLabel(card);
    });
    return true;
  };
  if (!init()) {
    const pending = new MutationObserver(() => { if (init()) pending.disconnect(); });
    pending.observe(document.documentElement,{childList:true,subtree:true});
  }
})();
