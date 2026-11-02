"use strict";

// Mesmo formato nas opções do navegador e no exportador local em Node.js.
(() => {
  function normalizeEndpoint(value) {
    let url;
    try { url = new URL(typeof value === "string" ? value.trim() : ""); }
    catch (_) { throw new Error("Endereço do serviço inválido."); }
    if (url.protocol !== "https:" || url.hostname !== "pje-mcp-worker-tjmt.joaooliveira.workers.dev" || url.port || url.username || url.password) {
      throw new Error("Use o endereço HTTPS no domínio autorizado do serviço PJe.");
    }
    return url.href;
  }

  function createBackup(endpoint) {
    // Exportar apenas o MCP: nunca senhas do SIGADOC, dados processuais ou consentimento.
    return { format: "mtprev-mcp-settings", version: 1, endpoint: normalizeEndpoint(endpoint) };
  }

  function parseBackup(text) {
    let data;
    try { data = JSON.parse(text); }
    catch (_) { throw new Error("O arquivo não contém uma configuração JSON válida."); }
    if (data?.format !== "mtprev-mcp-settings" || data.version !== 1) {
      throw new Error("Selecione o arquivo mtprev-mcp-settings.json exportado pelo MTPrev.");
    }
    return normalizeEndpoint(data.endpoint);
  }

  const api = Object.freeze({ normalizeEndpoint, createBackup, parseBackup });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalThis.MTPrevMcpSettings = api;
})();
