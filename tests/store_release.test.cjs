const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validateRuntime } = require('../scripts/build-chrome-store.js');
const { RUNTIME_FILES } = require('../scripts/runtime-files.js');
const root = path.resolve(__dirname, '..');
const background = fs.readFileSync(path.join(root,'js/background.js'),'utf8');
const extract = name => background.match(new RegExp('^async function '+name+'\\(.*?^}', 'ms'))[0];
function storage(initial = {}) {
  const values = { ...initial };
  return { values, get:async key=>({[key]:values[key]}), set:async data=>Object.assign(values,data), remove:async key=>{delete values[key];} };
}

test('Chrome package validates all runtime references and excludes workspace-only files', () => {
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
  validateRuntime(root,manifest);
  assert.equal(manifest.manifest_version,3);
  assert.equal(manifest.options_ui.page,'options.html');
  assert.equal(manifest.content_security_policy.extension_pages,"script-src 'self'; object-src 'self'");
  assert.ok(!manifest.host_permissions.includes('<all_urls>'));
  assert.equal(new Set(RUNTIME_FILES).size,RUNTIME_FILES.length);
  assert.ok(RUNTIME_FILES.every(file=>!/(?: copy\.|backup|\.zip$|\.pdf$|^tests\/|^docs\/|^\.)/i.test(file)));
  for(const size of [16,48,128]) {
    const png=fs.readFileSync(path.join(root,manifest.icons[size]));
    assert.equal(png.readUInt32BE(16),size);
    assert.equal(png.readUInt32BE(20),size);
  }
});

test('PJe service requires consent and only accepts its HTTPS origin',async()=>{
  const local=storage();
  const context=vm.createContext({URL,chrome:{storage:{local}},MNI_SERVICE_SETTINGS_KEY:'settings'});
  vm.runInContext(extract('getMniServiceEndpoint'),context);
  await assert.rejects(context.getMniServiceEndpoint(),/Configure e autorize/);
  const host='pje-mcp-worker-tjmt.joaooliveira.workers.dev';
  for(const endpoint of [`http://${host}/`, `https://${host}.example.org/`, `https://${host}:444/`, `https://user:pass@${host}/`,'javascript:alert(1)']) {
    local.values.settings={endpoint,consent:true};
    await assert.rejects(context.getMniServiceEndpoint(),/não autorizado/);
  }
  local.values.settings={endpoint:`https://${host}/configured-by-user`,consent:false};
  await assert.rejects(context.getMniServiceEndpoint(),/Configure e autorize/);
  local.values.settings.consent=true;
  assert.equal(await context.getMniServiceEndpoint(),local.values.settings.endpoint);
});

test('protocol password migrates away from persistent storage and clears its session copy',async()=>{
  for(const sessionAvailable of [true,false]) {
    const local=storage({password:'old-test-value'}), session=storage();
    const context=vm.createContext({chrome:{storage:{local,...(sessionAvailable?{session}:{})}},SCHEDULE_PROTOCOL_PASSWORD_KEY:'password',fallbackProtocolPassword:''});
    vm.runInContext(extract('setProtocolPassword')+'\n'+extract('getProtocolPassword'),context);
    assert.equal(await context.getProtocolPassword(),'');
    assert.equal(local.values.password,undefined);
    await context.setProtocolPassword('user-entered-test-value');
    assert.equal(await context.getProtocolPassword(),'user-entered-test-value');
    assert.equal(local.values.password,undefined);
    assert.equal(session.values.password,sessionAvailable?'user-entered-test-value':undefined);
    await context.setProtocolPassword('');
    assert.equal(await context.getProtocolPassword(),'');
    assert.equal(session.values.password,undefined);
  }
});

test('SIGADOC signature requires an identity from the page and the user session password',()=>{
  const source=fs.readFileSync(path.join(root,'js/extrator/content.js'),'utf8');
  let ids=['MTTEST12345'],password='';
  const context=vm.createContext({obterFontesUsuarioAssinaturaSigadoc:()=>({matriculas:ids}),obterSenhaDaSessaoSigadoc:()=>password});
  vm.runInContext(source.match(/^  function detectarCredencialAssinaturaSigadoc\(.*?^  }/ms)[0],context);
  assert.equal(context.detectarCredencialAssinaturaSigadoc().senha,'');
  password='user-input';
  assert.equal(context.detectarCredencialAssinaturaSigadoc().senha,password);
  ids=[];
  assert.equal(context.detectarCredencialAssinaturaSigadoc(),null);
  assert.ok(!source.includes('CREDENCIAIS_ASSINATURA_SIGADOC'));
});

test('SPA marker request preserves its response format without requesting script execution',async()=>{
  const checkbox={checked:false,disabled:false,getAttribute:name=>({'data-marker-id':'2','data-procedure-id':'31','data-url':'/marker_procedures'}[name])};
  const context=vm.createContext({window:{jQuery:{ajax:request=>{
    assert.equal(request.dataType,'text');
    assert.match(request.headers.Accept,/text\/javascript/);
    assert.equal(request.data.marker_procedures.procedure_id,'31');
    request.success('throw new Error("server text must not run")');
    request.complete();
  }}}});
  vm.runInContext(background.match(/^  async function applyMarkerBySpaAjax\(.*?^  }/ms)[0],context);
  const result=await context.applyMarkerBySpaAjax(checkbox);
  assert.equal(result.ok,true);
  assert.equal(checkbox.checked,true);
  assert.equal(checkbox.disabled,false);
});
