(() => {
  'use strict';
  window.MTPrevDrawer = function (shell) {
    if (shell.dataset.drawerReady) return;
    shell.dataset.drawerReady = '1'; shell.classList.add('mtprev-modern-drawer');
    const header = shell.querySelector('.cdsp-general-shell__header');
    const read = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
    const save = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
    let width = Number(read('MTPREV_DRAWER_WIDTH')) || 420;
    const setWidth = value => {
      width = Math.max(Math.min(350, innerWidth - 16), Math.min(value, 760, innerWidth - 16));
      shell.style.setProperty('--drawer-width', width + 'px');
      handle.setAttribute('aria-valuenow', String(Math.round(width)));
    };
    function button(label, run) { const node = document.createElement('button'); node.type = 'button'; node.textContent = label; node.title = label; node.setAttribute('aria-label', label); node.onclick = run; header.append(node); return node; }
    const theme = button('Tema', () => setTheme(shell.dataset.theme === 'dark' ? 'light' : 'dark'));
    function setTheme(value) {
      shell.dataset.theme = value === 'dark' ? 'dark' : 'light'; save('MTPREV_UI_THEME', shell.dataset.theme);
      shell.dataset.mtTheme = shell.dataset.theme;
      theme.textContent = shell.dataset.theme === 'dark' ? 'Tema claro' : 'Tema escuro';
      theme.setAttribute('aria-label', theme.textContent);
    }
    setTheme(read('MTPREV_UI_THEME') || 'light');
    button('Inspecionar', () => window.MTPrevSpaInspector?.open());
    button('Fechar', () => shell.dispatchEvent(new Event('mtprev-close-drawer'))).classList.add('mtprev-drawer-close');
    const handle = document.createElement('div'); handle.className = 'mtprev-drawer-resize'; handle.tabIndex = 0;
    handle.setAttribute('role', 'separator'); handle.setAttribute('aria-orientation', 'vertical'); handle.setAttribute('aria-label', 'Redimensionar painel');
    handle.setAttribute('aria-valuemin', '350'); handle.setAttribute('aria-valuemax', '760'); shell.append(handle);
    let drag;
    handle.addEventListener('pointerdown', event => { if (event.button !== 0) return; drag = { x: event.clientX, width }; handle.setPointerCapture(event.pointerId); event.preventDefault(); });
    handle.addEventListener('pointermove', event => { if (drag) setWidth(drag.width + drag.x - event.clientX); });
    const finish = () => { if (drag) { drag = null; save('MTPREV_DRAWER_WIDTH', String(width)); } };
    handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', finish);
    handle.addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); setWidth(event.key === 'Home' ? 350 : event.key === 'End' ? 760 : width + (event.key === 'ArrowLeft' ? 20 : -20)); save('MTPREV_DRAWER_WIDTH', String(width)); });
    window.addEventListener('resize', () => setWidth(width)); setWidth(width);
    const footer = document.createElement('footer'); footer.className = 'mtprev-drawer-footer'; footer.textContent = 'MTPrev · dados do SPA e conferência humana · ajuste a largura pela borda esquerda'; shell.append(footer);
    window.addEventListener('mtprev-extension-context-invalidated', () => { finish(); });
  };
})();
