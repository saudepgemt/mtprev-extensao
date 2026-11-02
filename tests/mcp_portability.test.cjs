const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createBackup, parseBackup } = require('../js/shared/mcp_settings.js');
const { exportMcpSettings } = require('../scripts/export-mcp-settings.js');
const { buildGithub } = require('../scripts/build-github.js');
const { RUNTIME_FILES } = require('../scripts/runtime-files.js');

const root = path.resolve(__dirname, '..');
const endpoint = 'https://pje-mcp-worker-tjmt.joaooliveira.workers.dev/fixture-only';
const settingsKey = 'MTPREV_SERVICE_SETTINGS';

function tempRoot(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mtprev-mcp-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  return temp;
}

function loadBackground(packageRoot, fetch) {
  const values = {};
  const event = () => ({ addListener() {} });
  const context = vm.createContext({ URL, AbortController, setTimeout, clearTimeout, fetch, chrome: {
    runtime: { getURL: file => `chrome-extension://fixture/${file}`, onMessage: event(), onStartup: event(), onInstalled: event() },
    storage: { local: { get: async () => values, set: async data => Object.assign(values, data) } },
    action: { onClicked: event() },
    alarms: { onAlarm: event() }
  } });
  vm.runInContext(fs.readFileSync(path.join(packageRoot, 'js/background.js'), 'utf8'), context);
  return { context, values };
}

test('exportação local transporta somente o MCP e pode ser importada no navegador', t => {
  const temp = tempRoot(t);
  fs.mkdirSync(path.join(temp, '.local'));
  fs.writeFileSync(path.join(temp, '.local/test-credentials.json'), JSON.stringify({
    mniEndpoint: endpoint, sigadoc: [{ matricula: 'fixture', senha: 'fixture-secret', nomes: [] }]
  }));
  const file = exportMcpSettings(temp);
  const text = fs.readFileSync(file, 'utf8');
  assert.equal(parseBackup(text), endpoint);
  assert.deepEqual(JSON.parse(text), createBackup(endpoint));
  assert.ok(!text.includes('fixture-secret'));
  assert.ok(!text.includes('consent'));
  assert.ok(!text.includes('sigadoc'));
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test('importação rejeita arquivos errados e endereços fora da origem autorizada', () => {
  for (const value of ['invalid', 'null', '[]', '{}', JSON.stringify({ format: 'mtprev-mcp-settings', version: 2, endpoint })]) {
    assert.throws(() => parseBackup(value));
  }
  for (const value of [null, 123, endpoint.replace('https:', 'http:'), 'https://example.org/', endpoint.replace('.dev/', '.dev.example.org/'), endpoint.replace('.dev/', '.dev:444/'), endpoint.replace('https://', 'https://user:pass@')]) {
    assert.throws(() => parseBackup(JSON.stringify({ format: 'mtprev-mcp-settings', version: 1, endpoint: value })));
  }
});

test('pacotes de um checkout sem .local consultam o MCP após importar e autorizar', async t => {
  const temp = tempRoot(t);
  const source = path.join(temp, 'checkout');
  // Copiar somente os arquivos distribuídos, sem credenciais ou configurações deste PC.
  for (const file of ['manifest.json', ...RUNTIME_FILES]) {
    fs.mkdirSync(path.dirname(path.join(source, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(source, file));
  }
  const packages = buildGithub(source);
  for (const packageRoot of Object.values(packages)) {
    assert.equal(fs.existsSync(path.join(packageRoot, '.local')), false);
    for (const file of ['manifest.json', ...RUNTIME_FILES]) assert.ok(fs.existsSync(path.join(packageRoot, file)), file);
    const background = fs.readFileSync(path.join(packageRoot, 'js/background.js'), 'utf8');
    assert.match(background, /const LOCAL_MNI_SETTINGS_PATH = "";/);
    assert.ok(!background.includes('LOCAL_TEST_SERVICE_READY'));
    let requests = [];
    let useSse = false;
    let responseStatus = 200;
    const { context, values } = loadBackground(packageRoot, async (url, options) => {
      assert.equal(url, endpoint);
      assert.equal(options.method, 'POST');
      const request = JSON.parse(options.body);
      requests.push(request);
      let result;
      if (request.method === 'tools/list') {
        assert.deepEqual(request.params, {});
        result = { tools: [{ name: 'tjmt_mni_consultar_processo' }] };
      } else {
        assert.equal(request.params.name, 'tjmt_mni_consultar_processo');
        assert.equal(request.params.arguments.numeroProcesso, '00000000020268110001');
        assert.equal(request.params.arguments.instancia, 'pje1');
        result = { structuredContent: { ok: true, case: { number: '00000000020268110001', movements: [{ id: '1', description: 'Movimento de teste', date: '2026-10-23' }] }, expedientes: [] } };
      }
      const payload = JSON.stringify({ jsonrpc: '2.0', id: request.id, result });
      return { ok: responseStatus === 200, status: responseStatus, text: async () => useSse ? `: keepalive\r\n\r\nevent: message\r\ndata: ${payload}\r\n\r\n` : payload };
    });
    // Uma instalação nova não tem consentimento nem tenta buscar arquivo privado ausente.
    await assert.rejects(context.getMniServiceEndpoint(), /Configure e autorize/);
    assert.equal(requests.length, 0);
    const imported = parseBackup(JSON.stringify(createBackup(endpoint)));
    values[settingsKey] = { endpoint: imported, consent: false };
    assert.equal((await context.testMniServiceConnection()).ok, false);
    assert.equal(requests.length, 0);
    values[settingsKey].consent = true;
    for (const sse of [false, true]) {
      useSse = sse;
      assert.equal((await context.testMniServiceConnection()).ok, true);
      const result = await context.fetchMniProcedureMovements({ processNumber: '0000000-00.2026.8.11.0001' });
      assert.equal(result.ok, true);
      assert.equal(result.movements[0].description, 'Movimento de teste');
    }
    for (const status of [401, 403, 404, 429, 500]) {
      responseStatus = status;
      const result = await context.testMniServiceConnection();
      assert.equal(result.ok, false);
      assert.ok(!result.error.includes(endpoint));
    }
    requests = [];
    values[settingsKey] = { endpoint: '', consent: false };
    await assert.rejects(context.getMniServiceEndpoint(), /Configure e autorize/);
    assert.equal(requests.length, 0);
  }
});
