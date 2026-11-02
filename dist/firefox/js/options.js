"use strict";

(() => {
  const key = "MTPREV_SERVICE_SETTINGS";
  const endpoint = document.getElementById("endpoint");
  const consent = document.getElementById("consent");
  const status = document.getElementById("status");
  const form = document.getElementById("service-form");
  const transfer = globalThis.MTPrevMcpSettings;
  const importFile = document.getElementById("import-service-file");
  function show(message, error = false) {
    status.dataset.error = String(error);
    status.textContent = message;
  }
  async function save(value) {
    const buttons = [...document.querySelectorAll("button")];
    buttons.forEach(button => { button.disabled = true; });
    try {
      if (value) await chrome.storage.local.set({ [key]: value });
      else await chrome.storage.local.set({ [key]: { consent: false, endpoint: "" } });
      if (!value) { endpoint.value = ""; consent.checked = false; }
      show(value ? "Configuração salva. Use Testar conexão para verificar o serviço." : "Serviço desativado e endereço apagado.");
    } catch (_) {
      show("Não foi possível salvar. Tente novamente nas opções da extensão.", true);
    } finally {
      buttons.forEach(button => { button.disabled = false; });
    }
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    try {
      const url = transfer.normalizeEndpoint(endpoint.value);
      if (!consent.checked) throw new Error();
      void save({ endpoint: url, consent: true, consentVersion: 1, authorizedAt: new Date().toISOString() });
    } catch (_) {
      show("Informe o endereço HTTPS fornecido pelo administrador, no domínio indicado, e marque a autorização.", true);
    }
  });
  document.getElementById("disable-service").addEventListener("click", () => { void save(null); });
  document.getElementById("test-service").addEventListener("click", async event => {
    event.currentTarget.disabled = true;
    const button = event.currentTarget;
    show("Testando a conexão, sem consultar dados de processos…");
    try {
      const result = await chrome.runtime.sendMessage({ type: "MTPREV_SERVICE_TEST" });
      show(result?.ok ? result.message : result?.error || "O serviço não respondeu.", !result?.ok);
    } catch (_) { show("Falha de comunicação. Reabra as opções da extensão.", true); }
    finally { button.disabled = false; }
  });
  document.getElementById("export-service").addEventListener("click", async () => {
    await ready;
    let downloadUrl;
    try {
      const saved = (await chrome.storage.local.get(key))[key];
      if (!saved?.endpoint || saved.consent !== true) {
        show("Salve e autorize uma configuração antes de exportar.", true);
        return;
      }
      const contents = JSON.stringify(transfer.createBackup(saved.endpoint), null, 2) + "\n";
      downloadUrl = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "mtprev-mcp-settings.json";
      document.body.append(link);
      link.click();
      link.remove();
      show("Configuração exportada. Leve o arquivo ao outro computador e importe nas opções da extensão.");
    } catch (_) { show("Não foi possível exportar a configuração salva.", true); }
    finally { if (downloadUrl) setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000); }
  });
  document.getElementById("import-service").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    try {
      await ready;
      if (file.size > 16384) throw new Error("Arquivo muito grande. Selecione a configuração MCP exportada pelo MTPrev.");
      const imported = transfer.parseBackup(await file.text());
      endpoint.value = imported;
      consent.checked = false;
      show("Configuração importada. Marque a autorização e clique em Salvar e autorizar; depois, Testar conexão salva.");
    } catch (error) { show(error.message || "Não foi possível importar a configuração.", true); }
    finally { importFile.value = ""; }
  });
  const ready = chrome.runtime.sendMessage({ type: "MTPREV_SERVICE_STATUS" }).catch(() => null).then(() => chrome.storage.local.get(key)).then(data => {
    const saved = data[key];
    endpoint.value = saved?.endpoint || "";
    consent.checked = saved?.consent === true;
    show(consent.checked ? "Serviço autorizado neste navegador." : "Serviço de andamentos desativado.");
  }).catch(() => show("Não foi possível carregar as configurações.", true));
})();
