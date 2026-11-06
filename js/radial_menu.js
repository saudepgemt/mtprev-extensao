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
    // Launcher compactado + janela de aplicativos. Os painéis de trabalho são os mesmos.
    shell.classList.add('mtprev-grid-nav');
    const gridHead = create('div', 'mtprev-grid-head', '', stage);
    const center = create('button', 'mtprev-orbit__center', '', gridHead);
    center.type = 'button'; center.setAttribute('aria-label', 'Abrir menu MTPrev');
    center.setAttribute('aria-expanded', 'false');
    const logo = create('img', '', '', center); logo.src = api.url('images/logo-mtprev.png'); logo.alt = 'MTPrev'; logo.draggable = false;
    const compactCopy = create('span','mtprev-grid-compact-copy','',center);
    create('strong','','MTPrev',compactCopy);
    create('small','','Abrir ferramentas',compactCopy);
    const compactChevron = create('span','mtprev-grid-compact-chevron','▾',center);
    compactChevron.setAttribute('aria-hidden','true');
    const gridHeading = create('div','mtprev-grid-heading','',gridHead);
    create('strong','','MTPrev',gridHeading);
    const gridCrumbs = create('nav','mtprev-grid-breadcrumbs','',gridHeading);
    gridCrumbs.setAttribute('aria-label','Caminho da navegação');
    const gridBack = create('button','mtprev-grid-back','',gridHead);
    gridBack.type = 'button'; gridBack.setAttribute('aria-label','Voltar ao nível anterior');
    gridBack.title='Voltar'; gridBack.hidden = true;
    create('span','mtprev-back-glyph','«',gridBack);
    const gridClose = create('button','mtprev-grid-close','×',gridHead);
    gridClose.type='button'; gridClose.setAttribute('aria-label','Fechar menu de aplicativos');
    const ring = create('div', 'mtprev-orbit__ring', '', stage);
    ring.setAttribute('role','group'); ring.setAttribute('aria-label','Aplicativos MTPrev');
    const gridFoot = create('div','mtprev-grid-foot','Arraste pelo cabeçalho para mover · Esc para fechar',stage);
    const watchBadge = create('span', 'mtprev-watch-radial-badge', '', center); watchBadge.hidden = true; watchBadge.setAttribute('aria-hidden', 'true');
    let watchUnread = 0;
    function updateWatchCount(records) {
      watchUnread = Object.values(records || {}).filter((record) => record?.unread).length;
      watchBadge.hidden = watchUnread === 0;
      watchBadge.textContent = watchUnread > 99 ? '99+' : String(watchUnread);
      center.setAttribute('aria-label', `Abrir menu MTPrev${watchUnread ? `; ${watchUnread} processo(s) com alertas não lidos` : ''}`);
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
    const back = create('button', 'mtprev-orbit__back', '', tools); back.type = 'button';
    back.title = 'Voltar'; back.setAttribute('aria-label','Voltar ao nível anterior');
    create('span','mtprev-back-glyph','«',back);
    create('span','mtprev-back-caption','Voltar',back);
    const header = shell.querySelector('.cdsp-general-shell__header');
    const title = shell.querySelector('.cdsp-general-shell__title');
    title.replaceChildren();
    const panelHome = create('button','mtprev-panel-home','',title);
    panelHome.type='button'; panelHome.title='Voltar ao menu inicial'; panelHome.setAttribute('aria-label','MTPrev — voltar ao menu inicial');
    const headerLogo = create('img', 'mtprev-panel-logo', '', panelHome);
    headerLogo.src = api.url('images/logo-mtprev.png'); headerLogo.alt = ''; headerLogo.draggable = false;
    const theme = create('span', 'mtprev-panel-theme', '', title);
    const panelCrumbs = create('nav','mtprev-panel-breadcrumbs','',title);
    panelCrumbs.setAttribute('aria-label','Caminho da navegação');
    const context = create('span', 'mtprev-orbit__context', 'MTPrev', tools);
    context.setAttribute('aria-live', 'polite');
    let expanded = false, module = null, generation = 0, page = 0;
    let directShortcut = '', minimizedOperational = false;
    // A opção ativa pertence à aba do SPA; permanece após recarregar,
    // mas não afeta outras abas, contas ou páginas diferentes.
    const LAST_VIEW_KEY='mtprev.radial.active-view.v1';
    const viewScope=()=>`${location.origin}${location.pathname}|${new URLSearchParams(location.search).get('user_id') || ''}`;
    // Declaracao de funcao (hoisted): navegacao, callbacks e listeners
    // compartilham sempre a mesma rotina, sem dependencia de variavel global.
    function persistActiveView(option = '') {
      try {
        if (!module) {
          sessionStorage.removeItem(LAST_VIEW_KEY);
          return;
        }
        sessionStorage.setItem(LAST_VIEW_KEY, JSON.stringify({
          scope: viewScope(), moduleKey: module.key, option, directRoot: Boolean(directShortcut)
        }));
      } catch (_error) {
        // Sessao bloqueada: apenas nao persiste a navegacao.
      }
    }
    const loadView=()=>{
      try {
        const data=JSON.parse(sessionStorage.getItem(LAST_VIEW_KEY)||'null');
        return data && data.scope===viewScope() && typeof data.moduleKey==='string' ? data : null;
      } catch (_error){return null;}
    };

    function goToMenuRoot() {
      module = null; directShortcut = ''; minimizedOperational = false;
      page = 0; persistActiveView(); open();
    }
    function goToModule() {
      if (module) open(); else goToMenuRoot();
    }
    function renderPath(currentLabel = '') {
      const segments = [{title:'Menu',onClick:goToMenuRoot}];
      if (module) {
        const name = module.key === 'triagem' ? 'Triagem' : module.key === 'gestao' ? 'Gerencial' : module.title;
        // Atalhos da tela inicial não ganham pais fictícios no breadcrumb.
        if (directShortcut) {
          segments.push({title:directShortcut});
        } else {
          segments.push({title:name,onClick:goToModule});
          if (currentLabel && currentLabel !== name) segments.push({title:currentLabel});
        }
      }
      for (const nav of [gridCrumbs, panelCrumbs]) {
        nav.replaceChildren();
        segments.forEach((segment,index) => {
          if (index) {const separator=create('span','mtprev-breadcrumb-separator','›',nav);separator.setAttribute('aria-hidden','true');}
          const last = index === segments.length-1;
          if (last) {
            const label=create('span','mtprev-breadcrumb-current',segment.title,nav);
            label.setAttribute('aria-current','page');
          } else {
            const button=create('button','mtprev-breadcrumb-link',segment.title,nav);
            button.type='button'; button.addEventListener('click',segment.onClick);
          }
        });
      }
    }
    renderPath();

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
      // A grade usa CSS grid; não calcula coordenadas orbitais.
      clamp();
    }
    function collapseItems() {
      ring.classList.remove('is-open'); ring.inert = true;
      center.setAttribute('aria-expanded', 'false');
    }
    function showPanel(target, label) {
      shell.classList.remove('mtprev-panel-leaving');
      expanded = false; generation++; clearTimeout(timer); collapseItems();
      shell.classList.remove('mtprev-grid-open');
      shell.classList.add('mtprev-radial-operational');
      api.expand();
      context.textContent = module?.title || 'MTPrev';
      theme.textContent = label || target?.textContent.trim() || module?.title || '';
      renderPath(theme.textContent);
      persistActiveView(theme.textContent);
      back.hidden = false; header.insertBefore(back, title);
      if (target) target.click();
      const activePane = shell.querySelector('[data-cdsp-module-pane]:not([hidden])');
      if (activePane) { activePane.tabIndex = -1; activePane.focus({ preventScroll: true }); }
      clamp();
    }
    function options(includeHomeShortcuts = false) {
      const pane = shell.querySelector(`[data-cdsp-module-pane="${module.key}"]`);
      if (!pane) return [];
      if (module.key === 'triagem') return [...pane.querySelectorAll('.mtprev-context-nav > button')]
        .filter(node => includeHomeShortcuts || !['Duplicados','Peças'].includes(node.textContent.trim()))
        .map(node => ({ title: node.textContent.trim(), run: () => showPanel(node) }));
      const sections = [...pane.querySelectorAll('[data-mtprev-radial-option]')];
      if (sections.length) return sections.map((node) => ({ title: node.dataset.mtprevRadialOption, run: () => { showPanel(null, node.dataset.mtprevRadialOption); node.scrollIntoView({ block: 'nearest' }); node.querySelector('input,select,button,summary')?.focus({ preventScroll: true }); } }));
      if (module.key === 'oficios') return [...pane.querySelectorAll('.cdsp-oficios-section')].map((node) => ({ title: node.querySelector('.cdsp-oficios-section__title')?.textContent || node.querySelector('h3')?.textContent || '', run: () => { showPanel(null, node.querySelector('.cdsp-oficios-section__title')?.textContent || node.querySelector('h3')?.textContent); node.scrollIntoView({ block: 'nearest' }); } })).filter((item) => item.title);
      return [];
    }
    const moduleFor = key => api.modules.find(item => item.key === key);
    const notice = message => {
      context.textContent=message; context.classList.add('is-notice');
      gridFoot.textContent=message; gridFoot.setAttribute('role','status');
    };
    const selectShortcut=(key, option='', directRoot=false)=>{
      const item=moduleFor(key);
      if(!item){notice('Esta ferramenta não está disponível nesta tela do SPA.');return;}
      void select(item,option,directRoot);
    };
    const openWatch=async()=>{
      if (!window.MTPrevProcessWatch) { notice('Recarregue a aba para acessar o acompanhamento.'); return; }
      try {
        await window.MTPrevProcessWatch.open();
        close(); shell.classList.add('mtprev-radial-external');
        const panel = document.getElementById('cdsp-process-watch');
        if (panel) { panel.tabIndex = -1; panel.focus({ preventScroll: true }); }
      } catch(error) {notice(error?.message || 'Não foi possível abrir o acompanhamento.');}
    };
    // A tela de Autos pertence ao documento do processo, que pode ser a
    // pagina principal, uma previa SPA2 ou um iframe da mesma origem.
    // O menu nao deve depender de o usuario ter aberto Triagem antes.
    let autosOpening = false;
    let autosRequestSequence = 0;
    const autosAllowedOrigins = new Set(['https://spa.pge.mt.gov.br','https://pge.mt.spa.coreplan.com.br']);
    function autosFrameOrigin(frame) {
      try {
        const src = frame.getAttribute('src') || frame.src || '';
        const url = new URL(src || location.href,location.href);
        return autosAllowedOrigins.has(url.origin) ? url.origin : '';
      } catch (_) { return ''; }
    }
    function autosFrameCandidates() {
      return [...document.querySelectorAll('iframe')].filter((frame) => {
        try {
          if (!frame.isConnected) return false;
          const origin = autosFrameOrigin(frame);
          if (!origin) return false;
          if (origin !== location.origin) {
            const url = new URL(frame.getAttribute('src') || frame.src,location.href);
            return /^\/procedures\/\d+(?:\/|$)/.test(url.pathname);
          }
          const doc = frame.contentDocument;
          if (!doc) return false;
          return Boolean(doc.querySelector('#spa-cdsp-external-docs-panel, .workspace-preview__document[data-procedure-id], .procedure-header')) ||
            /^\/procedures\/\d+(?:\/|$)/.test(doc.location.pathname);
        } catch (_) { return false; } // PDF e origens nao autorizadas sao ignorados.
      });
    }
    function locateAutosPanel() {
      const localPanel = document.getElementById('spa-cdsp-external-docs-panel');
      if (localPanel?.isConnected) return {panel:localPanel,frame:null};
      for (const frame of autosFrameCandidates()) {
        try {
          const panel = frame.contentDocument.getElementById('spa-cdsp-external-docs-panel');
          if (panel?.isConnected) return {panel,frame};
        } catch (_) { /* iframe indisponivel */ }
      }
      return null;
    }
    function revealAutosPanel(found) {
      if (!found?.panel) return false;
      const {panel,frame} = found;
      if (panel.dataset.mtprevWatchDocked === '1') {
        notice('Este leitor esta aberto no Acompanhamento Especial. Volte ao processo ou feche o acompanhamento.');
        return false;
      }
      if (panel.classList.contains('spa-cdsp-external-docs-collapsed')) {
        const expand=[...panel.querySelectorAll('button')].find(btn => /expandir/i.test(btn.textContent || ''));
        expand?.click();
      }
      close();
      const behavior = reduced() ? 'auto' : 'smooth';
      if (frame) frame.scrollIntoView({behavior,block:'nearest'});
      panel.scrollIntoView({behavior,block:'start'});
      panel.setAttribute('tabindex','-1');
      panel.focus({preventScroll:true});
      return true;
    }
    function requestAutosInMainFrame() {
      return new Promise(resolve => {
        try {
          chrome.runtime.sendMessage({type:'MTPREV_INJECT_AUTOS_IFRAME'}, response => {
            const error = chrome.runtime.lastError;
            resolve(error ? {ok:false,error:error.message} : (response || {ok:false}));
          });
        } catch (error) { resolve({ok:false,error:error?.message || String(error)}); }
      });
    }
    function requestAutosInIframe(frame) {
      return new Promise(resolve => {
        let completed = false;
        const requestId = 'autos-' + (++autosRequestSequence);
        const finish = result => {
          if (completed) return;
          completed = true;
          clearTimeout(timeout);
          window.removeEventListener('message',receive);
          resolve(result);
        };
        const receive = event => {
          if (event.source !== frame.contentWindow || event.origin !== autosFrameOrigin(frame)) return;
          const data = event.data;
          if (data?.source !== 'MTPREV_IFRAME_AUTOS' || data.type !== 'MTPREV_OPEN_AUTOS_RESULT' || data.requestId !== requestId) return;
          finish({ok:data.ok===true,error:data.error || '',frame});
        };
        const timeout = setTimeout(() => finish({ok:false,error:'A subjanela nao respondeu.'}), 6000);
        window.addEventListener('message',receive);
        try {
          frame.contentWindow.postMessage({source:'MTPREV_AUTOS_MENU',type:'MTPREV_OPEN_AUTOS_REQUEST',requestId},autosFrameOrigin(frame));
        } catch (error) { finish({ok:false,error:error?.message || String(error)}); }
      });
    }
    async function openAutos() {
      if (autosOpening) return;
      if (revealAutosPanel(locateAutosPanel())) return;
      const hasMainProcess = Boolean(document.querySelector('.workspace-preview__document[data-procedure-id]')) ||
        /^\/procedures\/\d+(?:\/|$)/.test(location.pathname);
      const frames = autosFrameCandidates();
      if (!hasMainProcess && !frames.length) {
        notice('Abra a previa ou o expediente de um processo no SPA para acessar Autos e PDFs.');
        return;
      }
      autosOpening = true;
      notice('Preparando Autos e PDFs do processo…');
      try {
        const replies = await Promise.all([
          ...(hasMainProcess ? [requestAutosInMainFrame()] : []),
          ...frames.map(requestAutosInIframe)
        ]);
        // A montagem pode ocorrer em uma proxima microtarefa ou apos a
        // disponibilizacao tardia dos dados do processo pelo SPA.
        if (!locateAutosPanel() && replies.some(reply=>reply?.ok)) {
          await new Promise(resolve=>setTimeout(resolve,300));
        }
        if (revealAutosPanel(locateAutosPanel())) return;
        // O painel de um SPA em outra origem nao pode ser lido pelo DOM
        // principal; o proprio iframe ja o expandiu e focou apos responder.
        const remote = replies.find(reply=>reply?.ok && reply.frame &&
          autosFrameOrigin(reply.frame) !== location.origin);
        if (remote) {
          close();
          remote.frame.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'nearest'});
          return;
        }
        const reason = replies.find(reply=>reply?.error)?.error;
        notice(reason ? 'Autos e PDFs: ' + reason :
          'O processo ainda nao disponibilizou o leitor de Autos. Confira se o expediente tem numero e documentos carregados.');
      } finally { autosOpening = false; }
    }
    async function openSettings() {
      // A interface do SPA não tem acesso a openOptionsPage no content script.
      // A solicitação é validada e executada pelo service worker da extensão.
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        notice('Extensão desconectada. Recarregue a página do SPA.');
        return;
      }
      try {
        const reply = await chrome.runtime.sendMessage({ type: 'MTPREV_OPEN_OPTIONS' });
        if (!reply?.ok) throw new Error(reply?.error || 'Não foi possível abrir as opções.');
        close();
      } catch (error) {
        notice(error?.message || 'Não foi possível abrir as configurações. Recarregue a extensão.');
      }
    }
    function entries() {
      if (module) return options();
      return [
        {title:'Triagem',icon:'fact_check',run:()=>selectShortcut('triagem')},
        {title:'Duplicados',icon:'content_copy',run:()=>selectShortcut('triagem','Duplicados',true)},
        {title:'Peças',icon:'description',run:()=>selectShortcut('triagem','Peças',true)},
        {title:'Gerencial',icon:'account_tree',run:()=>selectShortcut('gestao')},
        {title:'Prazos',icon:'event',run:()=>selectShortcut('prazos')},
        {title:'Acompanhar',icon:'radar',special:true,run:openWatch},
        {title:'Autos e PDFs',icon:'format_list_numbered',run:openAutos},
        {title:'Ofícios',icon:'outgoing_mail',run:()=>selectShortcut('oficios')},
        {title:'Configurações',icon:'settings',run:openSettings}
      ];
    }
    function paint(items) {
      // Toda a navegação cabe na grade rolável: sem páginas e sem órbita.
      previous.hidden = true; next.hidden = true;
      // A volta fica no cabeçalho, e não ocupa a primeira célula da grade.
      gridBack.hidden = !module;
      const visibleItems = items;
      ring.replaceChildren();
      visibleItems.forEach(item=>{
        const button=create('button','mtprev-orbit__item','',ring);
        button.classList.add('mtprev-menu-tile');
        button.type='button';button.setAttribute('aria-label',item.title);
        if(item.special) button.classList.add('mtprev-orbit__special');
        if(item.isBack) button.classList.add('mtprev-orbit__item--back');
        const disc=create('span','mtprev-orbit__disc','',button);
        const image=create('img','','',disc);
        image.src=api.url(`images/material-rounded/${item.icon || iconFor(item.title)}.svg`);
        image.alt='';image.draggable=false;
        create('span','mtprev-orbit__label',item.title,button);
        if(item.special){
          const badge=create('span','mtprev-watch-option-badge',watchUnread > 99 ? '99+' : String(watchUnread),button);
          badge.setAttribute('aria-hidden','true');badge.hidden=watchUnread===0;
        }
        button.addEventListener('click',item.run);
      });
      layout();
      requestAnimationFrame(()=>{
        if(expanded){ring.inert=false;ring.classList.add('is-open');center.setAttribute('aria-expanded','true');}
      });
    }
    function open() {
      shell.classList.remove('mtprev-panel-leaving');
      expanded = true; generation++; clearTimeout(timer);
      context.classList.remove('is-notice');
      center.setAttribute('aria-expanded', 'true');
      shell.classList.remove('mtprev-radial-operational', 'mtprev-radial-compact');
      shell.classList.add('mtprev-grid-open');
      api.expand();
      renderPath();
      gridFoot.textContent='Arraste pelo cabeçalho · Dois cliques para recolher';gridFoot.removeAttribute('role');
      context.textContent = module?.title || 'Módulos MTPrev';
      // O retorno dos submenus já está na órbita; o botão auxiliar fica
      // reservado ao carregamento/erro e ao cabeçalho de painéis operacionais.
      back.hidden = true; tools.prepend(back);
      paint(entries());
      center.focus({ preventScroll: true });
    }
    function close() {
      expanded = false; generation++; clearTimeout(timer); collapseItems();
      shell.classList.remove('mtprev-grid-open');
      renderPath();
      if (shell.classList.contains('mtprev-radial-operational')) {
        minimizedOperational = true;
        shell.classList.add('mtprev-panel-leaving');
      }
      timer = setTimeout(() => { if (!expanded) { shell.classList.remove('mtprev-radial-operational', 'mtprev-panel-leaving'); shell.classList.add('mtprev-radial-compact'); clamp(); } }, delay());
      center.focus({ preventScroll: true });
    }
    async function select(item, restoreOption = '', directRoot = false) {
      collapseItems(); module = item; directShortcut = directRoot ? restoreOption : '';
      minimizedOperational = false; page = 0; persistActiveView(); renderPath(); const token = ++generation;
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
      // Coordenação abre diretamente a janela de gerar o painel gerencial.
      // Não inicia coleta sem que o usuário clique em Gerar.
      if (item.key === 'gestao') {
        document.dispatchEvent(new Event('mtprev:management:open'));
        module = null;
        persistActiveView();
        close();
        return;
      }
      open();
      if(restoreOption){
        const choice=options(Boolean(directShortcut)).find(entry=>entry.title===restoreOption);
        if(choice) choice.run();
      }
    }
    gridClose.addEventListener('click',close);
    // Um clique no logotipo do menu aberto retorna à raiz.
    // Dois cliques no cabeçalho abrem/recolhem e restauram a tela anterior.
    let clickTimer=0;
    function toggleHeader() {
      clearTimeout(clickTimer); clickTimer=0;
      if (expanded || shell.classList.contains('mtprev-radial-operational')) {
        close(); return;
      }
      shell.classList.remove('mtprev-radial-compact');
      if (minimizedOperational && module) {
        minimizedOperational=false; clearTimeout(timer);
        expanded=false; collapseItems();
        shell.classList.remove('mtprev-grid-open','mtprev-panel-leaving');
        shell.classList.add('mtprev-radial-operational');
        api.expand(); renderPath(); clamp();
      } else open();
    }
    function queueHeaderClick(event) {
      if (event.defaultPrevented || event.detail >= 2) return;
      clearTimeout(clickTimer);
      clickTimer=setTimeout(() => {
        clickTimer=0;
        if (expanded) goToMenuRoot();
        else toggleHeader(); // lançamento compacto também acessível com um clique
      }, 230);
    }
    center.addEventListener('click',queueHeaderClick);
    panelHome.addEventListener('click',event => {event.stopPropagation();goToMenuRoot();});
    gridBack.addEventListener('click', () => back.click());
    gridHead.addEventListener('click',event=>{
      if(event.target.closest('button'))return;
      if(!expanded&&!shell.classList.contains('mtprev-radial-operational'))queueHeaderClick(event);
    });
    for (const host of [gridHead,header]) {
      host.addEventListener('dblclick',event=>{
        if(event.target.closest('.mtprev-grid-close,.mtprev-grid-back,.mtprev-breadcrumb-link,.mtprev-orbit__back,.mtprev-panel-home,.mtprev-drawer-close,a,input,select,textarea'))return;
        event.preventDefault();event.stopPropagation();toggleHeader();
      });
    }
    shell.addEventListener('mtprev-close-drawer', close);
    back.addEventListener('click', () => {
      if (shell.classList.contains('mtprev-radial-operational')) {
        if (directShortcut) goToMenuRoot(); else {persistActiveView();open();}
        return;
      }
      collapseItems(); const token = ++generation;
      clearTimeout(timer); timer = setTimeout(() => {
        if (token === generation) goToMenuRoot();
      }, delay());
    });
    previous.addEventListener('click', () => { page--; paint(entries()); });
    next.addEventListener('click', () => { page++; paint(entries()); });
    shell.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation(); event.preventDefault();
      if (expanded && module) back.click(); else if (expanded) close(); else { shell.classList.remove('mtprev-radial-compact'); open(); }
    });

    // Arraste por Pointer Events tanto no cabeçalho aberto quanto no compacto
    // e nos painéis operacionais. Não arrasta a partir de links/botões de ação.
    function startDrag(event) {
      if (event.button !== 0 || event.isPrimary === false || drag) return;
      if (event.target.closest('.mtprev-grid-close,.mtprev-grid-back,.mtprev-panel-home,.mtprev-breadcrumb-link,.mtprev-orbit__back,.cdsp-general-shell__toggle,.mtprev-drawer-close')) return;
      // Em painéis, botões de ação próprios do header continuam clicáveis.
      if (event.currentTarget === header && event.target.closest('button,a,input,select,textarea')) return;
      const rect = shell.getBoundingClientRect();
      drag = {id:event.pointerId, x:event.clientX,y:event.clientY, left:rect.left,top:rect.top, dx:0,dy:0,moved:false,host:event.currentTarget};
      suppressClick = false;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    function moveDrag(event) {
      if (!drag || drag.id !== event.pointerId || drag.host !== event.currentTarget) return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if (!drag.moved && Math.hypot(dx,dy)<6) return;
      drag.moved=true;
      const position=api.clamp(shell,drag.left+dx,drag.top+dy);
      drag.dx=position.left-drag.left;drag.dy=position.top-drag.top;
      if (!frame) frame=requestAnimationFrame(()=>{frame=0;if(drag) shell.style.transform=`translate3d(${drag.dx}px,${drag.dy}px,0)`;});
    }
    function endDrag(event) {
      if (!drag || drag.id!==event.pointerId || drag.host!==event.currentTarget) return;
      cancelAnimationFrame(frame);frame=0;
      suppressClick=drag.moved || event.type==='pointercancel';
      shell.style.transform='';
      if (drag.moved) {
        clearTimeout(clickTimer);clickTimer=0;
        const pos=api.clamp(shell,drag.left+drag.dx,drag.top+drag.dy);
        shell.style.left=pos.left+'px'; shell.style.top=pos.top+'px';
        shell.style.right='auto';shell.style.bottom='auto';
        api.save(shell);
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      drag=null;
    }
    function preventPostDragClick(event) {
      if (!suppressClick) return;
      suppressClick=false;
      event.preventDefault();event.stopImmediatePropagation();
    }
    for (const host of [gridHead,header]) {
      host.addEventListener('pointerdown',startDrag);
      host.addEventListener('pointermove',moveDrag);
      host.addEventListener('pointerup',endDrag);
      host.addEventListener('pointercancel',endDrag);
      host.addEventListener('lostpointercapture',endDrag);
      host.addEventListener('click',preventPostDragClick,true);
    }
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
      if(item) requestAnimationFrame(()=>{void select(item,lastView.option || '',Boolean(lastView.directRoot));});
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
    ['recebido', 5],
    ['observacao', 6]
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
    /* Cards da mesa: fundo alternado suave, contornos finos e hover inequívoco. */
    body.mtprev-workspace-readable #workspace-process-results .workspace-process-list > article.workspace-process-card {
      background:#ffffff !important;
      border-radius:7px !important;
      border:2px solid #8caec4 !important;
      border-left:4px solid #4f829f !important;
      border-bottom:2px solid #8caec4 !important;
      box-shadow:none !important;
      box-sizing:border-box !important;
      min-width:0 !important;
      transition:background-color 140ms ease,border-color 140ms ease,box-shadow 140ms ease;
    }
    body.mtprev-workspace-readable #workspace-process-results .workspace-process-list > article.workspace-process-card:nth-of-type(even) {
      background:#eaf3f8 !important;
      border-left-color:#527b9c !important;
    }
    body.mtprev-workspace-readable #workspace-process-results .workspace-process-list > article.workspace-process-card:is(:hover,:focus-within):not(.mtprev-workspace-hover-dismissed) {
      background:#d8eaf6 !important;
      border-color:#35789e !important;
      border-left-color:#145b87 !important;
      box-shadow:0 3px 12px rgba(18,52,75,.14) !important;
      position:relative;
      z-index:1;
    }
    body.mtprev-workspace-readable #workspace-process-results .workspace-process-list > article.workspace-process-card:focus-within {
      outline:2px solid #175e87;
      outline-offset:-2px;
    }
    /* Após atualizações por AJAX o SPA volta a inserir estilos inline na grade. */
    body.mtprev-workspace-readable.mtprev-workspace-compact #workspace-process-results .workspace-process-card:not(.mtprev-workspace-expanded) .workspace-process-card__identity,
    body.mtprev-workspace-readable.mtprev-workspace-compact #workspace-process-results .workspace-process-card:not(.mtprev-workspace-expanded) .workspace-process-card__main {
      min-width:0 !important;
      max-width:100% !important;
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
      gap:12px 16px !important;
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
    /* No modo detalhado o SPA já exibe o recebimento nativo na área de resumo. */
    body.mtprev-workspace-readable:not(.mtprev-workspace-compact) #workspace-process-results .mtprev-workspace-received-field,
    body.mtprev-workspace-readable.mtprev-workspace-compact #workspace-process-results article.mtprev-workspace-expanded .mtprev-workspace-received-field {
      display:none !important;
    }
    body.mtprev-workspace-readable #workspace-process-results .workspace-process-card__field[data-mtprev-field="6"] {
      min-width:0 !important;
      max-width:100% !important;
    }
    body.mtprev-workspace-readable #workspace-process-results .workspace-process-card__field[data-mtprev-field="6"] strong {
      display:-webkit-box;
      -webkit-line-clamp:2;
      -webkit-box-orient:vertical;
      overflow:hidden;
      overflow-wrap:anywhere;
      line-height:1.45;
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
  // Não inferir "recebimento" pela primeira movimentação: são eventos distintos.
  // A data exata só aparece se o próprio SPA a fornecer no card.
  const ensureReceiptField = card => {
    const fields = card.querySelector('.workspace-process-card__fields');
    if (!fields) return;
    const source = card.querySelector('.workspace-process-card__received strong');
    const raw = String(source?.textContent || '').replace(/\s+/g,' ').trim();
    const existing = fields.querySelector('[data-mtprev-received-field]');
    if (!raw) { existing?.remove(); return; }
    const title = source?.getAttribute('title') || source?.querySelector('[title]')?.getAttribute('title') || '';
    let field = existing;
    if (!field) {
      field = document.createElement('span');
      field.className = 'workspace-process-card__field mtprev-workspace-received-field';
      field.dataset.mtprevReceivedField = '1';
      const label = document.createElement('small');
      label.textContent = 'Recebido';
      const value = document.createElement('span');
      value.className = 'workspace-process-card__field-value';
      const strong = document.createElement('strong');
      value.appendChild(strong);
      field.append(label,value);
      fields.appendChild(field);
    }
    field.querySelector('strong').textContent = raw;
    if (title) field.querySelector('strong').title = title;
  };
  const enhanceCard = card => {
    if (!(card instanceof HTMLElement) || card.dataset.mtprevWorkspaceReady) return;
    const footerActions = card.querySelector('.workspace-process-card__actions');
    if (!footerActions) return;
    ensureReceiptField(card);
    const fields = card.querySelectorAll('.workspace-process-card__field');
    if (!fields.length) return;
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
    const results = document.getElementById('workspace-process-results');
    if (!results || !document.body) return;
    applyMode();
    // O filtro de fluxo pode substituir tanto a lista quanto o próprio cabeçalho.
    const heading = document.querySelector('.workspace-processes__heading');
    if (heading && !heading.querySelector('.mtprev-workspace-mode-toggle')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mtprev-workspace-mode-toggle';
      heading.appendChild(button);
      applyMode();
    }
    results.querySelectorAll('article.workspace-process-card').forEach(card => {
      if (!card.dataset.mtprevWorkspaceReady) enhanceCard(card);
      else ensureReceiptField(card);
    });
  };
  const queueScan = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(scanCards);
  };
  scanCards();
  // Observador no documento: o SPA substitui #workspace-process-results nas buscas.
  const mutationRelevant = node => node.nodeType === 1 && (
    node.matches?.('#workspace-process-results,.workspace-process-list,article.workspace-process-card,.workspace-processes__toolbar,.workspace-processes__heading') ||
    node.querySelector?.('#workspace-process-results,article.workspace-process-card,.workspace-processes__toolbar,.workspace-processes__heading')
  );
  new MutationObserver(records => {
    if (records.some(record => Array.from(record.addedNodes).some(mutationRelevant))) queueScan();
  }).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click', event => {
    const mode = event.target.closest?.('.mtprev-workspace-mode-toggle');
    if (mode) {
      compact = !compact;
      try { localStorage.setItem(KEY,compact ? 'compact':'detailed'); } catch (_) {}
      applyMode();
      return;
    }
    const button = event.target.closest?.('.mtprev-workspace-details-toggle');
    if (!button) return;
    const card = button.closest('article.workspace-process-card');
    if (!card) return;
    card.classList.toggle('mtprev-workspace-expanded');
    updateCardLabel(card);
  });

})();

/* MTPrev — filtros nativos do SPA2 em paineis independentes na lateral.
   O proprio controle original muda de lugar, sem duplicar a logica do SPA.
   Cada secao pode ser recolhida sem ocultar Visões rápidas ou Fluxos. */
(() => {
  'use strict';
  if (!/^\/workspace\/?$/.test(location.pathname) || window.__mtprevWorkspaceFilterSidebar) return;
  window.__mtprevWorkspaceFilterSidebar = true;

  const STORAGE = 'mtprev.workspace.filter.sections.v3';
  const DEFINITIONS = [
    {key:'process',title:'Tipos de processo',pattern:/\btipos? de processos?\b/},
    {key:'deadline',title:'Tipos de prazo',pattern:/\btipos? de prazos?\b/},
    {key:'markers',title:'Marcadores',pattern:/\bmarcadores?\b/},
    {key:'organize',title:'Organizar',pattern:/\borganizar\b/},
    {key:'markerTypes',title:'Tipos de marcadores',pattern:/\btipos? de marcadores?\b/}
  ];
  const norm = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  const safeStorage = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE) || '{}') || {}; }
    catch (_) { return {}; }
  };
  const folded = safeStorage();
  const NATIVE_IDS = {process:'workspace-process-type-filter',deadline:'workspace-deadline-type-filter',markers:'workspace-marker-filter',organize:'workspace-process-organizer'};
  const entries = new Map();
  let observer = null, scheduled = false, scanTimer = null, sidebar = null;
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  };
  const isWorkspace = () => /^\/workspace\/?$/.test(location.pathname);
  const filterRoot = element => element?.closest?.(
    '.workspace-navigation,.mtprev-workspace-filter-panel,#cdsp-general-shell,#cdsp-process-watch,'+
    '.workspace-process-card,.workspace-process-list,dialog,[role="dialog"],.modal,.popover'
  );
  const isInteractive = element => element?.matches?.(
    'button,[role="button"],[role="combobox"],select,summary,[aria-haspopup],'+
    '[data-bs-toggle],[data-toggle],a[href],input[type="button"]'
  );
  const caption = node => norm([
    node.getAttribute('aria-label'),node.getAttribute('title'),
    node.getAttribute('data-original-title'),node.getAttribute('data-testid'),
    node.textContent
  ].filter(Boolean).join(' ').slice(0,240));
  const matches = (def,node) => {
    const c = caption(node);
    if (!c || c.length > 180 || !def.pattern.test(c)) return false;
    // "Tipos de marcadores" nao e o mesmo filtro que "Marcadores".
    if (def.key === 'markers' && /\btipos? de marcadores?\b/.test(c)) return false;
    if (def.key === 'process' && /\btipos? de prazos?\b/.test(c)) return false;
    return true;
  };
  const regionPriority = node => node.closest('.workspace-processes__toolbar') ? 0
    : node.closest('.workspace-hero,.workspace-header,.workspace-summary,.workspace-overview') ? 1
    : node.closest('.workspace-inbox,.workspace-main,.workspace-layout') ? 2 : 3;

  function findNativeControl(def) {
    // IDs documentados no HTML do SPA: mover o shell completo, nunca só o summary.
    const id = NATIVE_IDS[def.key];
    if (id) {
      const candidates = document.querySelectorAll('[id="'+id+'"]');
      const outsideSidebar = Array.from(candidates).find(node => !sidebar?.contains(node));
      if (outsideSidebar) return outsideSidebar;
    }
    // Os filtros do topo nem sempre sao <button>: alguns layouts usam div[role=button]
    // ou [aria-haspopup]. Busca em todo o DOM, excluindo cards e o proprio MTPrev.
    const nodes = document.querySelectorAll(
      'button,[role="button"],[role="combobox"],select,summary,[aria-haspopup],'+
      '[data-bs-toggle],[data-toggle]'
    );
    const found = [];
    for (const node of nodes) {
      if (!node.isConnected || filterRoot(node) || !matches(def,node)) continue;
      if (node.matches('[disabled],[aria-disabled="true"]')) continue;
      if (node.closest('[hidden],[aria-hidden="true"]')) continue;
      found.push(node);
    }
    if (found.length) {
      found.sort((a,b) => regionPriority(a)-regionPriority(b));
      return found[0];
    }
    // Fallback: label dentro de uma superficie clicavel com classes diferentes.
    // So identifica textos curtos para nao confundir a lista inteira de processos.
    const labels = document.querySelectorAll('span,strong,small,label');
    for (const label of labels) {
      if (filterRoot(label) || !matches(def,label)) continue;
      let root = label.parentElement;
      for (let i=0;root && i<4;i++,root=root.parentElement) {
        if (filterRoot(root)) break;
        if (isInteractive(root) || root.onclick || root.hasAttribute('tabindex') ||
            /(?:filter|dropdown|select|trigger)/i.test(String(root.className || ''))) {
          if (caption(root).length <= 180) return root;
        }
      }
    }
    return null;
  }

  function movableRoot(control) {
    // Preserva o menu descendente quando estiver dentro de um wrapper pequeno.
    // Nunca leva o grupo inteiro de filtros, a barra de busca ou outro botao.
    let node = control;
    for (let depth=0;depth<2;depth++) {
      const parent = node.parentElement;
      if (!parent || filterRoot(parent) || parent.matches(
        '.workspace-hero,.workspace-header,.workspace-processes__toolbar,'+
        '.workspace-processes__heading,.workspace-main,.workspace-layout,.workspace-inbox'
      )) break;
      const other = [...parent.querySelectorAll('button,[role="button"],[role="combobox"],select')]
        .filter(child => child !== control && !control.contains(child) &&
          !child.closest('[role="menu"],.dropdown-menu,[role="listbox"],.select-options'));
      if (other.length || parent.querySelector('input[type="search"],.workspace-processes__heading') ||
          parent.querySelector('.workspace-process-card')) break;
      // Evita capturar colunas do header ou wrappers de dezenas de elementos.
      if (parent.querySelectorAll('*').length > 30) break;
      node=parent;
    }
    return node;
  }

  function setFolded(def, panel, collapsed) {
    folded[def.key] = Boolean(collapsed);
    try { localStorage.setItem(STORAGE,JSON.stringify(folded)); } catch (_) {}
    panel.classList.toggle('mtprev-workspace-filter-collapsed',Boolean(collapsed));
    const button=panel.querySelector('.mtprev-workspace-filter-chevron');
    const body=panel.querySelector('.mtprev-workspace-filter-body');
    if (body) body.hidden=Boolean(collapsed);
    if (button) {
      button.setAttribute('aria-expanded',String(!collapsed));
      button.setAttribute('aria-label',(collapsed?'Expandir ':'Recolher ')+def.title);
      button.textContent=collapsed?'▸':'▾';
    }
  }

  // Os quatro filtros do SPA usam <details> e painéis posicionados como popovers.
  // Mantemos os elementos (links e handlers nativos) e abrimos os detalhes dentro
  // da sidebar; o CSS da extensão transforma os popovers em listas locais.
  function revealNativeOptions(node,def) {
    if (!node || !['process','deadline','markers','organize'].includes(def.key)) return;
    node.classList.add('mtprev-filter-inline');
    const details = node.matches('details') ? node : node.querySelector('details');
    if (details) {
      details.open = true;
      details.setAttribute('open','');
    }
    const nativePanel = node.querySelector(
      '.workspace-deadline-type-filter__panel,.workspace-marker-filter__panel,.workspace-organizer__panel'
    );
    if (nativePanel) {
      nativePanel.removeAttribute('hidden');
      nativePanel.setAttribute('aria-hidden','false');
    }
  }

  function restore(entry) {
    // O comentario na origem permite restaurar o SPA ao trocar de rota.
    if (entry.anchor?.isConnected) entry.anchor.replaceWith(entry.node);
    else if (entry.originalParent?.isConnected) entry.originalParent.appendChild(entry.node);
    entry.node?.classList.remove('mtprev-workspace-native-filter');
    entry.panel?.remove();
  }
  function restoreAll() {
    for (const entry of entries.values()) restore(entry);
    entries.clear();
    document.body?.classList.remove('mtprev-workspace-filter-dock');
  }
  function attach(def,control) {
    if (!sidebar?.isConnected) return;
    const node=control.id && Object.values(NATIVE_IDS).includes(control.id) ? control : movableRoot(control);
    if (!node.parentNode || sidebar.contains(node)) return;
    const panel=make('section','workspace-panel mtprev-workspace-filter-panel');
    panel.dataset.mtprevFilter=def.key;
    const head=make('div','workspace-panel__heading mtprev-workspace-filter-heading');
    const button=make('button','mtprev-workspace-filter-chevron');
    button.type='button';
    const title=make('span','',def.title);
    head.append(title,button);
    const body=make('div','mtprev-workspace-filter-body');
    body.id='mtprev-workspace-filter-'+def.key;
    button.setAttribute('aria-controls',body.id);
    button.addEventListener('click',() => setFolded(def,panel,!panel.classList.contains('mtprev-workspace-filter-collapsed')));
    panel.append(head,body);
    const anchor=document.createComment('MTPrev: local original do filtro '+def.key);
    const originalParent=node.parentNode;
    originalParent.insertBefore(anchor,node);
    body.appendChild(node);
    node.classList.add('mtprev-workspace-native-filter');
    revealNativeOptions(node,def);
    // Manter a ordem processo / prazo / marcadores / tipo de marcadores.
    const index=DEFINITIONS.findIndex(item=>item.key===def.key);
    const later=DEFINITIONS.slice(index+1).map(item=>entries.get(item.key)?.panel).find(el=>el?.isConnected);
    if (later) sidebar.insertBefore(panel,later);
    else {
      const prev=DEFINITIONS.slice(0,index).reverse().map(item=>entries.get(item.key)?.panel).find(el=>el?.isConnected);
      if (prev) prev.after(panel);
      else sidebar.prepend(panel);
    }
    entries.set(def.key,{control,node,anchor,originalParent,panel});
    // As opções ficam abertas no primeiro uso, como Visões rápidas.
    setFolded(def,panel,folded[def.key] === true);
  }

  function update() {
    scheduled=false;
    if (!isWorkspace()) {restoreAll();return;}
    const nextSidebar=document.querySelector('.workspace-navigation');
    const toolbar=document.querySelector('.workspace-processes__toolbar');
    if (!nextSidebar || !toolbar || !document.body) return;
    if (sidebar && sidebar !== nextSidebar) restoreAll();
    sidebar=nextSidebar;
    document.body.classList.add('mtprev-workspace-filter-dock');
    for (const def of DEFINITIONS) {
      const entry=entries.get(def.key);
      const control=findNativeControl(def);
      // AJAX pode recriar o shell do filtro no cabeçalho com novos links/valores.
      // Nesse caso substituímos a instância antiga, em vez de manter links obsoletos.
      const fresh=control && NATIVE_IDS[def.key] && control.id === NATIVE_IDS[def.key] &&
        control !== entry?.node;
      if (entry && entry.panel.isConnected && entry.node.isConnected &&
          entry.node.closest('.mtprev-workspace-filter-body') && !fresh) {
        revealNativeOptions(entry.node,def);
        continue;
      }
      if (entry) {entry.anchor?.remove();entry.panel.remove();entries.delete(def.key);}
      if (control) attach(def,control);
    }
  }
  const queueUpdate=() => {
    if (scheduled) return;
    scheduled=true;
    setTimeout(update,200);
  };
  // Os filtros nativos podem chegar depois do carregamento inicial do SPA.
  update();
  observer=new MutationObserver(records => {
    if (records.some(record => {
      const target=record.target instanceof Element ? record.target : record.target?.parentElement;
      if (!target) return false;
      return !target.closest('.mtprev-workspace-filter-panel,.workspace-process-list,#workspace-process-results,'+
        '.workspace-process-card,#cdsp-general-shell,#cdsp-process-watch');
    })) queueUpdate();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
  // Suporte aos filtros que carregam sem uma mutacao de DOM observavel.
  scanTimer=setInterval(() => {
    for (const def of DEFINITIONS) {
      const entry=entries.get(def.key);
      if (entry?.node?.isConnected) revealNativeOptions(entry.node,def);
    }
    if (isWorkspace() && (entries.size < 4 || DEFINITIONS.some(def => {
      const id=NATIVE_IDS[def.key];
      return id && Array.from(document.querySelectorAll('[id="'+id+'"]')).some(node => !sidebar?.contains(node));
    }))) queueUpdate();
    if (!isWorkspace() && entries.size) restoreAll();
  },3000);
  window.addEventListener('popstate',queueUpdate);
})();
