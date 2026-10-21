(() => {
  if (window.MTPrevSpaInspector) return;
  function open() {
    const previous = document.getElementById('mtprev-spa-inspector');
    if (previous) { previous.showModal(); return; }
    const dialog = document.createElement('dialog'); dialog.id = 'mtprev-spa-inspector'; dialog.dataset.mtprevUi = 'inspector';
    const title = document.createElement('h2'); title.textContent = 'Inspetor SPA · somente leitura';
    const explanation = document.createElement('p'); explanation.textContent = 'Não envia requisições e não coleta textos, nomes, valores de campos, cookies ou tokens. Inspeciona somente elementos atualmente montados. Valide cada tela após navegar.';
    const output = document.createElement('pre');
    const refresh = document.createElement('button'); refresh.textContent = 'Atualizar evidência'; refresh.type = 'button';
    const capture = () => { output.textContent = JSON.stringify(SpaAdapter.inspect(), null, 2); };
    refresh.onclick = capture;
    const close = document.createElement('button'); close.textContent = 'Fechar'; close.type = 'button'; close.onclick = () => dialog.close();
    dialog.append(title, explanation, refresh, close, output); document.body.append(dialog); capture(); dialog.showModal();
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
  }
  window.MTPrevSpaInspector = Object.freeze({ open });
})();
