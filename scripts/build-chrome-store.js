"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { RUNTIME_FILES } = require("./runtime-files.js");

function validateRuntime(root, manifest) {
  if (manifest.manifest_version !== 3 || !manifest.background?.service_worker) throw new Error("É necessário um service worker Manifest V3.");
  if (!manifest.description || manifest.description.length > 132) throw new Error("A descrição deve ter de 1 a 132 caracteres.");
  if (!/^\d+(\.\d+){0,3}$/.test(manifest.version)) throw new Error("Versão inválida.");
  const allowed = new Set(RUNTIME_FILES);
  const references = [manifest.background.service_worker, manifest.options_ui.page,
    ...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon),
    ...manifest.content_scripts.flatMap(item => [...(item.js || []), ...(item.css || [])]),
    ...manifest.web_accessible_resources.flatMap(item => item.resources).filter(file => !file.includes("*"))];
  for (const file of references) {
    if (!allowed.has(file)) throw new Error(`Referência fora da lista de publicação: ${file}`);
  }
  for (const file of RUNTIME_FILES) {
    if (!fs.statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile()) throw new Error(`Arquivo obrigatório ausente: ${file}`);
    if (!/\.(js|css|html)$/.test(file)) continue;
    const source = fs.readFileSync(path.join(root, file), "utf8");
    // Arquivos de terceiros têm seus próprios caminhos internos de módulos.
    if (/\/libs\/|\/vendor\//.test(file)) continue;
    for (const [, ref] of source.matchAll(/["'`](?:\.\.\/)?((?:js|css|images|data)\/[^"'`\n]+\.(?:js|css|png|svg|xlsx))["'`]/g)) {
      if (ref.includes("${")) continue;
      if (!allowed.has(ref)) throw new Error(`Dependência não empacotada em ${file}: ${ref}`);
    }
    if (/\b(?:senha|password|token|secret)\s*:\s*["'][^"'\s]+["']/i.test(source)) throw new Error(`Revise possível credencial fixa em ${file}`);
    if (/dataType\s*:\s*["']script["']|\beval\s*\(|\bnew Function\s*\(/.test(source)) throw new Error(`Execução dinâmica a revisar em ${file}`);
    if (/https:\/\/pje-mcp-worker-tjmt\.joaooliveira\.workers\.dev\/[^\s"'`*)]+/.test(source)) throw new Error(`Endereço privado do serviço não pode ser embutido em ${file}`);
  }
}

function buildChromeRuntime(sourceRoot, output) {
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, "manifest.json"), "utf8"));
  validateRuntime(sourceRoot, manifest);
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  const expectedContents = new Map();
  for (const file of RUNTIME_FILES) {
    fs.mkdirSync(path.dirname(path.join(output, file)), { recursive: true });
    const contents = fs.readFileSync(path.join(sourceRoot, file));
    expectedContents.set(file, contents);
    fs.writeFileSync(path.join(output, file), file === "js/background.js"
      ? contents.toString("utf8").replace(/^const LOCAL_MNI_SETTINGS_PATH = .*;$/m, 'const LOCAL_MNI_SETTINGS_PATH = "";')
      : contents);
  }
  fs.writeFileSync(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  // Validar a cópia que será publicada: o editor pode salvar arquivos durante o build.
  validateRuntime(output, manifest);
  for (const file of RUNTIME_FILES) {
    if (!fs.readFileSync(path.join(sourceRoot, file)).equals(expectedContents.get(file))) {
      throw new Error(`Arquivo alterado durante o build; gere novamente: ${file}`);
    }
  }
  return { manifest, output };
}

function buildChromeStore(sourceRoot = path.resolve(__dirname, ".."), distRoot = path.join(sourceRoot, "dist")) {
  const { manifest, output } = buildChromeRuntime(sourceRoot, path.join(distRoot, "chrome-store"));
  const archive = path.join(distRoot, `mtprev-${manifest.version}-chrome-web-store.zip`);
  fs.rmSync(archive, { force: true });
  execFileSync("zip", ["-q", "-X", archive, "manifest.json", ...RUNTIME_FILES.slice().sort()], { cwd: output });
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
  fs.writeFileSync(`${archive}.sha256`, `${sha256}  ${path.basename(archive)}\n`);
  return { archive, output, sha256, files: RUNTIME_FILES.length + 1 };
}

if (require.main === module) console.log(JSON.stringify(buildChromeStore(), null, 2));
module.exports = { buildChromeStore, buildChromeRuntime, validateRuntime };
