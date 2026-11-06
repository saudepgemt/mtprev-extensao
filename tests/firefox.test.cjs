const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { buildFirefox } = require('../scripts/build-firefox.js');

const root = path.resolve(__dirname, '..');

function backgroundContext() {
  const listeners = [];
  const alarms = new Map();
  let storage = {};
  const event = () => ({ addListener() {} });
  const chrome = {
    runtime: {
      getManifest: () => ({ version: '2.0.71' }),
      getURL: (file) => `moz-extension://test/${file}`,
      onMessage: { addListener: (listener) => listeners.push(listener) },
      onStartup: event(), onInstalled: event()
    },
    action: { onClicked: event(), setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    storage: { local: {
      get: async () => structuredClone(storage),
      set: async (value) => { storage = { ...storage, ...structuredClone(value) }; }
    } },
    alarms: {
      onAlarm: event(),
      get: async (name) => alarms.get(name),
      create: async (name, value) => alarms.set(name, value),
      clear: async (name) => alarms.delete(name)
    }
  };
  const context = vm.createContext({ chrome, URL, setTimeout, clearTimeout, Uint8Array, structuredClone });
  const run = (file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return { context, run, listeners, alarms };
}

test('Firefox empacota dependencias completas e exclui arquivos do ambiente de trabalho', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mtprev-firefox-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const output = path.join(temp, 'firefox');
  const sourceManifest = fs.readFileSync(path.join(root, 'manifest.json'), 'utf8');
  buildFirefox(root, output);
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json')));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, undefined);
  assert.equal(manifest.permissions.includes('offscreen'), false);
  assert.ok(manifest.browser_specific_settings.gecko.id);
  assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, '128.0');
  for (const script of manifest.content_scripts) {
    for (const file of [...(script.js || []), ...(script.css || [])]) assert.ok(fs.existsSync(path.join(output, file)), file);
  }
  for (const entry of ['.git', '.agents', '.aws', '.codex', 'scripts', 'tests']) {
    assert.equal(fs.existsSync(path.join(output, entry)), false, entry);
  }
  assert.equal(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'), sourceManifest);
  fs.writeFileSync(path.join(output, 'stale.js'), 'old build');
  buildFirefox(root, output);
  assert.equal(fs.existsSync(path.join(output, 'stale.js')), false);

  const { run, context, listeners } = backgroundContext();
  for (const file of manifest.background.scripts) run(file);
  assert.ok(context.MTPrevTriageRules);
  assert.ok(context.pdfjsLib.getDocument);
  assert.ok(context.MTPrevPdfReader.searchPdfText);
  assert.equal(listeners.length, 4, 'leitor, rotinas, OAuth e acompanhamento iniciam uma vez');
});

test('build falha ao faltar um arquivo obrigatorio, sem omitir funcoes silenciosamente', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mtprev-firefox-missing-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.copyFileSync(path.join(root, 'manifest.json'), path.join(temp, 'manifest.json'));
  assert.throws(() => buildFirefox(temp), /Arquivos obrigatorios ausentes:[\s\S]*js\/background\.js/);
  assert.equal(fs.existsSync(path.join(temp, 'dist')), false);
});

test('build detecta arquivos ausentes que so seriam carregados ao abrir um painel', (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mtprev-panel-missing-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const source = path.join(temp, 'source');
  buildFirefox(root, source);
  fs.copyFileSync(path.join(root, 'manifest.json'), path.join(source, 'manifest.json'));
  fs.rmSync(path.join(source, 'js/triagem/spa_extension_panel.js'));
  assert.throws(() => buildFirefox(source, path.join(temp, 'output')), /Scripts dos paineis ausentes:[\s\S]*spa_extension_panel\.js/);
  assert.equal(fs.existsSync(path.join(temp, 'output')), false);
});

test('Triagem carrega dependencias existentes e propaga erros por frame do Firefox', async () => {
  const { run, context } = backgroundContext();
  let fail = true;
  let ready = false;
  const loadedFiles = [];
  context.chrome.scripting = {
    executeScript: async ({ files, func }) => {
      if (files) {
        for (const file of files) {
          assert.ok(fs.existsSync(path.join(root, file)), file);
          loadedFiles.push(file);
        }
        if (files.includes('js/triagem/spa_extension_panel.js')) {
          if (fail) return [{ frameId: 0, error: { message: 'Falha simulada no painel' } }];
          ready = true;
        }
        return [{ frameId: 0, result: undefined }];
      }
      return [{ frameId: 0, result: /excelReady/.test(func.toString()) ? { excelReady: false } : ready }];
    }
  };
  run('js/background.js');
  const sender = { tab: { id: 1 } };
  let result = await context.injectPanel(sender);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Falha simulada no painel');
  fail = false;
  result = await context.injectPanel(sender);
  assert.equal(result.ok, true);
  assert.ok(loadedFiles.indexOf('js/shared/mtprev_triage_rules.js') < loadedFiles.indexOf('js/triagem/spa_extension_panel.js'));
  assert.equal((await context.injectPanel(sender)).alreadyLoaded, true);
});

test('Triagem sem adaptador preserva confirmacao, cancelamento e verificacao do processo', async () => {
  const source = fs.readFileSync(path.join(root, 'js/triagem/spa_extension_panel.js'), 'utf8');
  const confirmFunction = source.match(/^  async function confirmTriageAction\(.*?^  }/ms)[0];
  let accepted = false;
  let message = '';
  const context = vm.createContext({
    window: { confirm: () => assert.fail('nao usar o dialogo sobrescrito pela automacao') },
    originalConfirm: (text) => { message = text; return accepted; }
  });
  vm.runInContext(confirmFunction, context);
  const records = [{ processKey: '0000000-00.2026.8.11.0001', expedienteId: '123', label: 'Outro rotulo' }];
  assert.equal(await context.confirmTriageAction('Dar Ciência', records, () => true), false);
  assert.match(message, /0000000-00\.2026\.8\.11\.0001/);
  assert.match(message, /Expediente: 123/);
  accepted = true;
  let checks = 0;
  assert.equal(await context.confirmTriageAction('Classificar', records, () => { checks++; return true; }, [['Assessor', 'Teste']]), true);
  assert.equal(checks, 2);
  assert.match(message, /Assessor: Teste/);
  checks = 0;
  await assert.rejects(context.confirmTriageAction('Classificar', records, () => ++checks === 1), /mudou durante/);
  await assert.rejects(context.confirmTriageAction('Classificar', records, () => false), /O processo mudou/);
});

test('Firefox inicia mensagens, armazenamento e alarme de consulta diaria', async () => {
  const { run, context, listeners, alarms } = backgroundContext();
  run('js/shared/mtprev_triage_rules.js');
  run('js/background.js');
  run('js/process_watch_background.js');
  await new Promise(setImmediate);
  assert.equal(alarms.has('cdsp-process-watch'), true);
  assert.equal(alarms.get('cdsp-process-watch').periodInMinutes, 1440);
  const config = await context.getRoutineConfig();
  assert.equal(config.active, false);
  const reply = await new Promise((resolve) => {
    for (const listener of listeners) {
      listener({ type: 'CDSP_PROCESS_WATCH', action: 'list' }, { tab: { url: 'https://spa.pge.mt.gov.br/procedures' } }, resolve);
    }
  });
  assert.equal(reply.ok, true);
  assert.equal(Object.keys(reply.records).length, 0);
});

test('Chrome continua importando as dependencias pelo service worker', () => {
  const { run, context, listeners } = backgroundContext();
  const imported = [];
  context.importScripts = (file) => { imported.push(file); run(`js/${file}`); };
  run('js/background.js');
  assert.deepEqual(imported, ['shared/mtprev_triage_rules.js', 'shared/mtprev_pje_individual_oauth.js', 'vendor/pdf.min.js', 'watch_mail_template.js', 'watch_mail_oauth.js', 'process_watch_background.js']);
  assert.equal(listeners.length, 3);
  assert.ok(context.pdfjsLib.getDocument);
});

test('Firefox extrai e pesquisa PDF com o leitor local, preservando bytes e liberando documentos', async () => {
  const { run, context } = backgroundContext();
  let destroyed = 0;
  let fail = false;
  context.pdfjsLib = {
    GlobalWorkerOptions: {},
    getDocument({ data }) {
      // Simulate the transfer performed by PDF.js to its worker.
      structuredClone(data, { transfer: [data.buffer] });
      if (fail) return { promise: Promise.reject(new Error('PDF invalido')) };
      return { promise: Promise.resolve({
        numPages: 2,
        getPage: async (page) => ({
          getTextContent: async () => ({ items: [{ str: page === 1 ? 'Decisão inicial' : 'Petição final', transform: [1, 0, 0, 1, 0, 10] }] }),
          cleanup() {}
        }),
        destroy: async () => { destroyed++; }
      }) };
    }
  };
  run('js/triagem/offscreen_pdf_reader.js');
  const readerSearch = context.MTPrevPdfReader.searchPdfText;
  run('js/background.js');
  assert.equal(context.MTPrevPdfReader.searchPdfText, readerSearch, 'helpers do background nao sobrescrevem o leitor');
  const bytes = new Uint8Array([37, 80, 68, 70]).buffer;
  assert.equal(await context.extractPdfTextWithOffscreen(bytes), 'Decisão inicial\nPetição final');
  const found = await context.searchPdfWithOffscreen(bytes, 'ausente;peticao', false);
  assert.equal(found.found, true);
  assert.equal(found.pagesRead, 2);
  const exact = await context.searchPdfWithOffscreen(bytes, 'decisao inicial', true);
  assert.equal(exact.found, true);
  assert.equal(exact.pagesRead, 1);
  assert.equal((await context.searchPdfWithOffscreen(bytes, 'ausente', true)).found, false);
  assert.equal(bytes.byteLength, 4);
  assert.equal(destroyed, 4);
  fail = true;
  await assert.rejects(context.extractPdfTextWithOffscreen(bytes), /PDF invalido/);
  assert.equal(bytes.byteLength, 4);
});

test('Chrome continua enviando PDFs ao documento offscreen', async () => {
  const { run, context } = backgroundContext();
  const sent = [];
  context.btoa = btoa;
  context.chrome.offscreen = { hasDocument: async () => true, createDocument: async () => assert.fail('documento ja existe') };
  context.MTPrevPdfReader = { extractPdfText: () => assert.fail('Chrome deve usar offscreen') };
  context.chrome.runtime.sendMessage = (message, callback) => {
    sent.push(message);
    callback({ ok: true, text: 'Texto PDF', found: true });
  };
  run('js/background.js');
  const bytes = new Uint8Array([37, 80, 68, 70]).buffer;
  assert.equal(await context.extractPdfTextWithOffscreen(bytes), 'Texto PDF');
  assert.equal((await context.searchPdfWithOffscreen(bytes, 'Texto', true)).found, true);
  assert.deepEqual(sent.map((message) => message.type), ['SPA_CDSP_OFFSCREEN_EXTRACT_PDF_TEXT', 'SPA_CDSP_OFFSCREEN_SEARCH_PDF_TEXT']);
  assert.equal(sent[0].base64, 'JVBERg==');
});
