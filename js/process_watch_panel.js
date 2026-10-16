(() => {
  "use strict";
  const KEY = "CDSP_PROCESS_WATCH_V1";
  let panel;
  let busy = false;
  const element = (tag, text, parent) => { const node = document.createElement(tag); if (text) node.textContent = text; if (parent) parent.appendChild(node); return node; };
  const date = (value) => value ? new Date(value).toLocaleString("pt-BR") : "ainda não realizada";
  async function request(action, processNumber, tribunal) {
    const result = await chrome.runtime.sendMessage({ type: "CDSP_PROCESS_WATCH", action, processNumber, tribunal });
    if (!result?.ok) throw new Error(result?.error || "Não foi possível acessar a extensão. Recarregue a página.");
    return result.records;
  }
  function button(text, parent, fn) {
    const node = element("button", text, parent); node.type = "button";
    node.addEventListener("click", async () => {
      if (busy) return;
      busy = true; node.disabled = true;
      const status = panel?.querySelector("[role=status]");
      if (status) status.textContent = "Consultando…";
      try { await fn(); } catch (error) { if (status) status.textContent = error.message; }
      finally { busy = false; node.disabled = false; }
    }); return node;
  }
  async function render() {
    const records = await request("list");
    const list = panel.querySelector(".cdsp-watch-list"); list.replaceChildren();
    if (!Object.keys(records).length) element("p", "Nenhum processo acompanhado.", list);
    for (const record of Object.values(records)) {
      const item = element("article", "", list);
      element("strong", `${record.unread ? "● NOVAS ALTERAÇÕES — " : ""}${record.number}`, item);
      element("p", `Última consulta: ${date(record.checkedAt)}`, item);
      if (record.error) element("p", `Falha na consulta: ${record.error}. Os dados anteriores foram preservados.`, item);
      if (!record.initialized) element("p", "Aguardando a primeira consulta bem-sucedida para iniciar a comparação.", item);
      for (const entry of record.history || []) {
        const details = element("details", "", item);
        element("summary", `Alterações detectadas em ${date(entry.at)}`, details);
        for (const text of entry.items) element("p", text, details);
      }
      const latest = element("details", "", item); element("summary", "Últimos dados consultados", latest);
      for (const text of record.latest || []) element("p", text, latest);
      button("Verificar agora", item, async () => { await request("check", record.number); await render(); });
      button("Marcar como lido", item, async () => { await request("read", record.number); await render(); });
      button("Parar de acompanhar", item, async () => { await request("remove", record.number); await render(); });
    }
    panel.querySelector("[role=status]").textContent = "Lista atualizada.";
  }
  function close() {
    if (panel) panel.hidden = true;
    window.dispatchEvent(new Event('mtprev-process-watch-closed'));
  }
  async function open(forceOpen = false) {
    if (panel) { if (!forceOpen && !panel.hidden) { close(); return; } panel.hidden = false; await render(); return; }
    panel = element("section", "", document.body); panel.id = "cdsp-process-watch";
    const header = element('div', '', panel); header.className = 'cdsp-watch-header';
    const logo = element('img', '', header); logo.src = chrome.runtime.getURL('images/logo-mtprev.png'); logo.alt = 'MTPrev';
    element("h2", "Acompanhamento Especial de Processos", header);
    button("Voltar", header, close);
    element("p", "PJe/TJMT: consulta a cada 30 minutos enquanto o Chrome estiver aberto. A primeira consulta cria a referência; as seguintes detectam movimentações e alterações de expedientes. Não verifica encerramentos internos do SPA. Lista salva neste perfil do Chrome.", panel);
    const label = element("label", "Número do processo (CNJ)", panel);
    const input = element("input", "", label); input.placeholder = "0000000-00.0000.8.11.0000";
    input.value = (document.body.innerText.match(/\b\d{7}-\d{2}\.\d{4}\.8\.11\.\d{4}\b/) || [""])[0];
    const instanceLabel = element("label", "Instância", panel);
    const instance = element("select", "", instanceLabel);
    for (const [value, title] of [["", "Automática pelo número"], ["1 grau", "1º grau"], ["2 grau", "2º grau"]]) { const option = element("option", title, instance); option.value = value; }
    button("Acompanhar este processo", panel, async () => { await request("add", input.value, instance.value); await render(); });
    button("Verificar todos agora", panel, async () => { await request("checkAll"); await render(); });
    const status = element("p", "", panel); status.setAttribute("role", "status");
    element("div", "", panel).className = "cdsp-watch-list";
    await render();
  }
  window.MTPrevProcessWatch = { open: () => open(true), close };
  function install() {
    const nav = document.querySelector(".cdsp-general-shell__modules");
    if (!nav || document.getElementById("cdsp-watch-open")) return;
    const node = element("button", "Acompanhar processos", nav); node.type = "button"; node.id = "cdsp-watch-open";
    node.addEventListener("click", () => open().catch((error) => { if (panel) panel.querySelector("[role=status]").textContent = error.message; }));
  }
  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[KEY]) {
      const count = Object.values(changes[KEY].newValue || {}).filter((r) => r.unread).length;
      const node = document.getElementById("cdsp-watch-open");
      if (node) node.textContent = `Acompanhar processos${count ? ` (${count})` : ""}`;
      if (panel && !panel.hidden && !busy) render().catch(() => {});
    }
  });
  install();
})();
