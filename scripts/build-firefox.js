"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { RUNTIME_FILES } = require("./runtime-files.js");

function buildFirefox(sourceRoot = path.resolve(__dirname, ".."), outputRoot = path.join(sourceRoot, "dist", "firefox")) {
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, "manifest.json"), "utf8"));
  manifest.background = {
    scripts: [
      "js/shared/audit_core.js", "js/audit_sheets_background.js",
      "js/shared/mtprev_triage_rules.js",
      "js/vendor/pdf.min.js",
      "js/triagem/offscreen_pdf_reader.js",
      manifest.background.service_worker,
      "js/watch_mail_template.js",
      "js/watch_mail_oauth.js",
      "js/process_watch_background.js"
    ]
  };
  manifest.permissions = manifest.permissions.filter((permission) => permission !== "offscreen");
  manifest.browser_specific_settings = {
    gecko: {
      id: "mtprev-extensao@mtprev.local",
      // MAIN-world injection is used by the SPA and SIGADOC integrations.
      strict_min_version: "128.0"
    }
  };
  // Firefox does not support Chrome's version_name field.
  delete manifest.version_name;
  delete manifest.minimum_chrome_version;

  const requiredFiles = new Set([
    ...manifest.background.scripts,
    "js/vendor/pdf.worker.min.js",
    ...Object.values(manifest.icons || {}),
    ...Object.values(manifest.action.default_icon || {}),
    ...manifest.content_scripts.flatMap((script) => [...(script.js || []), ...(script.css || [])]),
    ...manifest.web_accessible_resources.flatMap((entry) => entry.resources.filter((file) => !file.includes("*")))
  ]);
  const missingFiles = [...requiredFiles].filter((file) => !fs.existsSync(path.join(sourceRoot, file)));
  if (missingFiles.length) {
    throw new Error(`Arquivos obrigatorios ausentes:\n- ${missingFiles.join("\n- ")}`);
  }

  // Panels are loaded on demand and are not listed in content_scripts.
  const backgroundSource = fs.readFileSync(path.join(sourceRoot, "js/background.js"), "utf8");
  const lazyScripts = [...backgroundSource.matchAll(/["'](js\/[^"'\n]+\.js)["']/g)].map((match) => match[1]);
  const missingPanels = [...new Set(lazyScripts)].filter((file) => !fs.existsSync(path.join(sourceRoot, file)));
  if (missingPanels.length) {
    throw new Error(`Scripts dos paineis ausentes:\n- ${missingPanels.join("\n- ")}`);
  }

  // Package only runtime assets; never copy workspace settings or local credentials.
  fs.rmSync(outputRoot, { recursive: true, force: true });
  fs.mkdirSync(outputRoot, { recursive: true });
  for (const entry of RUNTIME_FILES) {
    fs.mkdirSync(path.dirname(path.join(outputRoot, entry)), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, entry), path.join(outputRoot, entry));
  }
  // A configuração de outro computador é importada nas opções, sem depender de .local.
  fs.writeFileSync(path.join(outputRoot, "js/background.js"), backgroundSource
    .replace(/^const LOCAL_MNI_SETTINGS_PATH = .*;$/m, 'const LOCAL_MNI_SETTINGS_PATH = "";'));
  fs.writeFileSync(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return outputRoot;
}

if (require.main === module) {
  console.log(`Build Firefox criado em: ${buildFirefox()}`);
}

module.exports = { buildFirefox };
