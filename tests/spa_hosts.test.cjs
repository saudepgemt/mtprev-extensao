const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const oldOrigin = 'https://spa.pge.mt.gov.br';
const newOrigin = 'https://pge.mt.spa.coreplan.com.br';
function extract(source, name, indent = '') {
  const match = source.match(new RegExp(`^${indent}(?:async )?function ${name}\\(.*?^${indent}}`, 'ms'));
  assert.ok(match, `Missing function ${name}`);
  return match[0];
}
function background(overrides = {}) {
  const source = read('js/background.js');
  const context = vm.createContext({ URL, Set, chrome: overrides.chrome || {}, executeMainWorld: overrides.executeMainWorld });
  vm.runInContext([
    source.match(/^const ALLOWED_HOSTS = .*;$/m)[0],
    source.match(/^const SCHEDULE_DEFAULT_INBOX_URL = .*;$/m)[0],
    ...['normalizeAllowedUrl', 'normalizeRoutineUrl', 'legacyMassiveFallbackUrl', 'findRoutineTab', 'resolveMassiveStepUrl'].map(name => extract(source, name)),
  ].join('\n'), context);
  return context;
}
function extractor(origin) {
  const source = read('js/extrator/content.js');
  const context = vm.createContext({ URL, Map, window: { location: { href: `${origin}/procedures` } } });
  vm.runInContext(['normalizarTexto', 'normalizarUrlProcessoSpa', 'extrairLinkExpedienteDeDocumentoSpa'].map(name => extract(source, name, '  ')).join('\n'), context);
  return context;
}
for (const origin of [oldOrigin, newOrigin]) {
  test(`URLs and inbox stay on ${origin}`, () => {
    const api = background();
    assert.equal(api.normalizeAllowedUrl(`${origin}/procedures/123`), `${origin}/procedures/123`);
    assert.equal(api.normalizeRoutineUrl(`${origin}/procedures?user_id=12`), `${origin}/procedures?user_id=12`);
    assert.equal(api.normalizeRoutineUrl(`${origin}/procedures/123`), `${origin}/procedures`);
  });
  test(`Process and PDF extraction on ${origin}`, () => {
    const api = extractor(origin);
    assert.equal(api.normalizarUrlProcessoSpa('/procedures/123/folder'), `${origin}/procedures/123/folder`);
    const document = { querySelectorAll: () => [] };
    const pdf = `${origin}/coresigner/info/12.pdf`;
    assert.equal(api.extrairLinkExpedienteDeDocumentoSpa(document, origin, `<a href="${pdf}">PDF</a>`, '12'), pdf);
  });
  test(`Routine tab selection does not cross origins from ${origin}`, async () => {
    const tabs = [{ id: 1, url: `${oldOrigin}/procedures?user_id=12` }, { id: 2, url: `${newOrigin}/procedures?user_id=12` }];
    const api = background({ chrome: { tabs: { get: async () => tabs.find(t => !t.url.startsWith(origin)), query: async () => tabs } } });
    const selected = await api.findRoutineTab({ targetUrl: `${origin}/procedures`, targetUserId: '12', targetTabId: 99 });
    assert.ok(selected.url.startsWith(origin));
  });
  test(`Discovery of massive action links on ${origin}`, async () => {
    const href = `${origin}/procedures/massive/9999`;
    const api = background({ executeMainWorld: async () => ({ href }) });
    assert.equal(await api.resolveMassiveStepUrl(1, 'protocol_petition'), href);
  });
}
test('Unknown hosts, misleading suffixes and HTTP are rejected', () => {
  const api = background();
  for (const url of ['http://pge.mt.spa.coreplan.com.br/procedures', 'https://pge.mt.spa.coreplan.com.br.example.org/procedures', 'https://example.org/procedures']) {
    assert.equal(api.normalizeAllowedUrl(url), '');
    assert.equal(extractor(newOrigin).normalizarUrlProcessoSpa(url), '');
  }
});
test('Legacy workflow IDs are never guessed on Coreplan', async () => {
  const api = background({ chrome: { tabs: { get: async () => ({ url: `${newOrigin}/procedures` }) } }, executeMainWorld: async () => null });
  assert.equal(api.legacyMassiveFallbackUrl(newOrigin, 'protocol_petition'), '');
  assert.equal(await api.resolveMassiveStepUrl(1, 'close_assessoria'), '');
  assert.equal(api.legacyMassiveFallbackUrl(oldOrigin, 'protocol_petition'), `${oldOrigin}/procedures/massive/2760`);
});
test('Default inbox uses Coreplan; saved legacy inbox is preserved', () => {
  const api = background();
  assert.equal(api.normalizeRoutineUrl(''), `${newOrigin}/procedures`);
  assert.equal(api.normalizeRoutineUrl(`${oldOrigin}/procedures?user_id=12`), `${oldOrigin}/procedures?user_id=12`);
});
test('Foreign PDF origins remain blocked', () => {
  const api = extractor(newOrigin);
  assert.equal(api.extrairLinkExpedienteDeDocumentoSpa({ querySelectorAll: () => [] }, newOrigin, 'https://example.org/coresigner/info/12.pdf', '12'), '');
});
test('All modified scripts and diagnostic snippet parse', () => {
  for (const file of ['js/background.js', 'js/extrator/content.js', 'js/process_watch_background.js', 'js/triagem/mtprev_pop_panel.js', 'js/triagem/spa_extension_panel.js', 'tools/mapear-spa.js']) {
    new vm.Script(read(file), { filename: file });
  }
});
