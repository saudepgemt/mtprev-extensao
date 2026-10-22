"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { RUNTIME_FILES } = require("./runtime-files.js");
const { validateRuntime } = require("./build-chrome-store.js");
const { buildFirefox } = require("./build-firefox.js");

function replaceOnce(source, target, replacement) {
  if (!source.includes(target) || source.indexOf(target) !== source.lastIndexOf(target)) {
    throw new Error("O código mudou. Revise os pontos de configuração do build local.");
  }
  return source.replace(target, () => replacement);
}

function buildLocalTest(sourceRoot = path.resolve(__dirname, ".."), distRoot = path.join(sourceRoot, "dist"), configFile = path.join(sourceRoot, ".local", "test-credentials.json")) {
  if (!fs.existsSync(configFile)) throw new Error("Configuração local ausente: .local/test-credentials.json. Ela não faz parte do pacote público.");
  let config;
  try { config = JSON.parse(fs.readFileSync(configFile, "utf8")); }
  catch (_) { throw new Error("Não foi possível ler a configuração local de testes."); }
  let endpoint;
  try { endpoint = new URL(config.mniEndpoint); }
  catch (_) { throw new Error("Endereço local do serviço inválido."); }
  if (endpoint.protocol !== "https:" || endpoint.hostname !== "pje-mcp-worker-tjmt.joaooliveira.workers.dev" || endpoint.port || endpoint.username || endpoint.password) {
    throw new Error("O serviço de testes deve usar o domínio HTTPS autorizado na extensão.");
  }
  if (!Array.isArray(config.sigadoc) || !config.sigadoc.length || config.sigadoc.some(item =>
    !item || typeof item.matricula !== "string" || !item.matricula.trim() || typeof item.senha !== "string" || !item.senha || !Array.isArray(item.nomes) || item.nomes.some(name => typeof name !== "string"))) {
    throw new Error("Configuração local de credenciais do SIGADOC incompleta.");
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, "manifest.json"), "utf8"));
  validateRuntime(sourceRoot, manifest);
  let background = fs.readFileSync(path.join(sourceRoot, "js/background.js"), "utf8");
  // A autorização é específica desta instalação local. Desativar nas opções
  // continua funcionando: o marcador impede recriar a configuração ao reiniciar.
  background = replaceOnce(background, 'const MNI_SERVICE_SETTINGS_KEY = "MTPREV_SERVICE_SETTINGS";', `const MNI_SERVICE_SETTINGS_KEY = "MTPREV_SERVICE_SETTINGS";
const LOCAL_TEST_SERVICE_READY = (async () => {
  const marker = "MTPREV_LOCAL_TEST_SERVICE_INITIALIZED";
  const data = await chrome.storage.local.get([MNI_SERVICE_SETTINGS_KEY, marker]);
  if (data[marker]) return;
  const update = { [marker]: true };
  if (!data[MNI_SERVICE_SETTINGS_KEY]) {
    update[MNI_SERVICE_SETTINGS_KEY] = {
      endpoint: ${JSON.stringify(endpoint.href)}, consent: true, consentVersion: 1,
      authorizedAt: new Date().toISOString(), source: "local-test"
    };
  }
  await chrome.storage.local.set(update);
})();
void LOCAL_TEST_SERVICE_READY.catch(() => {});`);
  background = replaceOnce(background, "async function getMniServiceEndpoint() {", "async function getMniServiceEndpoint() {\n  await LOCAL_TEST_SERVICE_READY;");
  let content = fs.readFileSync(path.join(sourceRoot, "js/extrator/content.js"), "utf8");
  const detector = content.match(/^  function detectarCredencialAssinaturaSigadoc\(.*?^  }/ms)?.[0];
  if (!detector) throw new Error("Detector de identidade do SIGADOC não localizado.");
  content = replaceOnce(content, detector, `  // Credenciais exclusivas desta cópia local, nunca incluídas no build da loja.
  const LOCAL_TEST_SIGADOC_CREDENTIALS = Object.freeze(${JSON.stringify(config.sigadoc)});
  function detectarCredencialAssinaturaSigadoc() {
    const fontes = obterFontesUsuarioAssinaturaSigadoc();
    const matriculas = fontes.matriculas.map(normalizarTexto).filter(Boolean);
    const nomes = fontes.nomes.map(normalizarTexto).filter(Boolean);
    const cadastrada = LOCAL_TEST_SIGADOC_CREDENTIALS.find(item =>
      matriculas.includes(normalizarTexto(item.matricula)) || item.nomes.some(nome => {
        const esperado = normalizarTexto(nome);
        return esperado && nomes.some(atual => atual.includes(esperado) || esperado.includes(atual));
      })
    );
    const senha = obterSenhaDaSessaoSigadoc();
    if (cadastrada) return { ...cadastrada, senha: senha || cadastrada.senha };
    const matricula = fontes.matriculas.find(valor => /^[A-Z]{2,8}\\d{3,}$/i.test(valor.trim()));
    return matricula ? { matricula: matricula.trim(), senha } : null;
  }`);
  content = replaceOnce(content, "const tentativas = [{ origem: 'Senha do SIGADOC', senha: senhaDaSessao }];", "const tentativas = [{ origem: senhaDaSessao ? 'Senha do SIGADOC' : 'Credencial local de teste', senha: credencial.senha }];");
  content = replaceOnce(content, "senhaInput.placeholder = 'Necessária para assinar';", "senhaInput.placeholder = 'Opcional nesta cópia de testes';");
  const output = path.join(distRoot, "local-test");
  fs.mkdirSync(distRoot, { recursive: true });
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { mode: 0o700 });
  for (const file of RUNTIME_FILES) {
    fs.mkdirSync(path.dirname(path.join(output, file)), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, file), path.join(output, file));
  }
  fs.writeFileSync(path.join(output, "js/background.js"), background, { mode: 0o600 });
  fs.writeFileSync(path.join(output, "js/extrator/content.js"), content, { mode: 0o600 });
  fs.chmodSync(path.join(output, "js/background.js"), 0o600);
  fs.chmodSync(path.join(output, "js/extrator/content.js"), 0o600);
  manifest.name += " (teste local)";
  manifest.action.default_title = manifest.name;
  fs.writeFileSync(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const optionsPath = path.join(output, "options.html");
  fs.writeFileSync(optionsPath, fs.readFileSync(optionsPath, "utf8")
    .replace("Este recurso é opcional e fica desativado até você configurá-lo.", "Nesta cópia local de testes, o serviço anterior é configurado na primeira inicialização. Você pode desativá-lo abaixo.")
    .replace("A extensão não fornece uma credencial de acesso.", "Esta cópia local contém a credencial anterior do serviço."));
  const privacyPath = path.join(output, "privacy.html");
  fs.writeFileSync(privacyPath, fs.readFileSync(privacyPath, "utf8").replace("<body>", "<body><p><strong>Cópia local de testes com credenciais restauradas. Não publicar. O texto abaixo descreve a versão pública, cujo pacote não contém essas credenciais.</strong></p>"));
  fs.writeFileSync(path.join(output, "TESTE_LOCAL.txt"), "Cópia de testes com credenciais locais. Não publicar nem compartilhar.\nA versão da loja continua separada em dist/chrome-store.\n");
  return output;
}

if (require.main === module) {
  const output = buildLocalTest();
  console.log(`Teste local Chrome: ${output}`);
  if (process.argv.includes("--firefox")) {
    const firefoxOutput = path.join(path.dirname(output), "firefox-local-test");
    buildFirefox(output, firefoxOutput);
    fs.chmodSync(firefoxOutput, 0o700);
    console.log(`Teste local Firefox: ${firefoxOutput}`);
  }
}

module.exports = { buildLocalTest };
