"use strict";

(() => {
  const key = "MTPREV_SERVICE_SETTINGS";
  const endpoint = document.getElementById("endpoint");
  const consent = document.getElementById("consent");
  const status = document.getElementById("status");
  const form = document.getElementById("service-form");
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
      const url = new URL(endpoint.value.trim());
      if (url.protocol !== "https:" || url.hostname !== "pje-mcp-worker-tjmt.joaooliveira.workers.dev" || url.port || url.username || url.password || !consent.checked) throw new Error();
      void save({ endpoint: url.href, consent: true, consentVersion: 1, authorizedAt: new Date().toISOString() });
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
  chrome.runtime.sendMessage({ type: "MTPREV_SERVICE_STATUS" }).catch(() => null).then(() => chrome.storage.local.get(key)).then(data => {
    const saved = data[key];
    endpoint.value = saved?.endpoint || "";
    consent.checked = saved?.consent === true;
    show(consent.checked ? "Serviço autorizado neste navegador." : "Serviço de andamentos desativado.");
  }).catch(() => show("Não foi possível carregar as configurações.", true));
})();
