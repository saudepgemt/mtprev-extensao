"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createBackup } = require("../js/shared/mcp_settings.js");

function exportMcpSettings(root = path.resolve(__dirname, "..")) {
  let config;
  try { config = JSON.parse(fs.readFileSync(path.join(root, ".local/test-credentials.json"), "utf8")); }
  catch (_) { throw new Error("Configuração local ausente ou inválida. Você também pode exportar o MCP nas opções da extensão que já funciona."); }
  const backup = createBackup(config.mniEndpoint);
  const output = path.join(root, ".local/mtprev-mcp-settings.json");
  fs.writeFileSync(output, JSON.stringify(backup, null, 2) + "\n", { mode: 0o600 });
  fs.chmodSync(output, 0o600);
  return output;
}

if (require.main === module) {
  try { console.log(`Configuração MCP para importar no outro computador: ${exportMcpSettings()}`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { exportMcpSettings };
