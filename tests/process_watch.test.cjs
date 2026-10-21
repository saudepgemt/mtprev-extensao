const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('acompanhamento preserva referencia, detecta alteracoes e conserva dados em falhas', async () => {
  let listener;
  let data = {};
  let notifications = 0;
  let response = { ok: true, movements: [{ date: '20261015', description: 'Inicial', code: '1', linkedDocumentIds: [] }], expedientes: [] };
  const chrome = {
    storage: { local: {
      get: async () => structuredClone(data),
      set: async (value) => { data = structuredClone({ ...data, ...value }); }
    } },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {} },
    notifications: { create: async () => { notifications++; } },
    runtime: {
      onMessage: { addListener: (fn) => { listener = fn; } },
      onStartup: { addListener() {} }, onInstalled: { addListener() {} }
    },
    alarms: { onAlarm: { addListener() {} }, get: async () => true, create: async () => {} }
  };
  const background = fs.readFileSync(path.join(__dirname, '../js/background.js'), 'utf8');
  const validation = background.match(/^const ALLOWED_HOSTS = .*;$/m)[0] + '\n' + background.match(/^function normalizeAllowedUrl\(.*?^}/ms)[0];
  vm.runInNewContext(validation + '\n' + fs.readFileSync(path.join(__dirname, '../js/process_watch_background.js'), 'utf8'), {
    URL,
    chrome, fetchMniProcedureMovements: async () => response,
    inferMniPjeEndpoint: () => ({ id: 'pje1' })
  });
  const number = '00000000020268110001';
  const send = (action, url = 'https://spa.pge.mt.gov.br/procedures/123') => new Promise((resolve) => {
    listener({ type: 'CDSP_PROCESS_WATCH', action, processNumber: number }, { tab: { url } }, resolve);
  });
  let result = await send('add');
  assert.equal(result.records[number].initialized, true);
  assert.equal(notifications, 0);
  await send('check');
  assert.equal(notifications, 0);
  response.movements.push({ date: '20261016', description: 'Novo', code: '2', linkedDocumentIds: [] });
  result = await send('check');
  assert.equal(result.records[number].unread, true);
  assert.equal(notifications, 1);
  await send('read');
  result = await send('check');
  assert.equal(result.records[number].unread, false);
  assert.equal(notifications, 1);
  response = { ok: false, error: 'offline' };
  result = await send('check');
  assert.equal(result.records[number].error, 'offline');
  assert.equal(result.records[number].history.length, 1);
  response = { ok: true, movements: [], expedientes: [{ id: 'e1', deadlineAt: '20261020', closed: false }] };
  await send('check');
  assert.equal(notifications, 2);
  response.expedientes[0].closed = true;
  await send('check');
  assert.equal(notifications, 3);
  assert.equal((await send('remove', 'https://example.org/')).ok, false);
  result = await send('remove');
  assert.equal(Object.keys(result.records).length, 0);
});
