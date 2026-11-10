const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function adapter(hasHome=false) {
  const context = vm.createContext({ URL, Set, Map, console, document:{querySelector:()=>hasHome?{}:null}, window: { addEventListener() {} }, location: { href: 'https://pge.mt.spa.coreplan.com.br/procedures' } });
  for (const file of ['spa_selectors.js', 'spa_adapter.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js/shared', file), 'utf8'), context);
  return context.SpaAdapter;
}
test('página inicial com mesa SPA usa o mesmo leitor; página sem mesa não é presumida workspace',()=>{
  assert.equal(adapter(true).route('https://pge.mt.spa.coreplan.com.br/').kind,'workspace');
  assert.equal(adapter(false).route('https://pge.mt.spa.coreplan.com.br/').kind,'other');
});
test('route recognition preserves both SPA domains and excludes untrusted hosts', () => {
  const api = adapter();
  for (const origin of ['https://spa.pge.mt.gov.br', 'https://pge.mt.spa.coreplan.com.br']) {
    for (const [route, kind] of [['/workspace','workspace'],['/procedures','inbox'],['/procedures/123','procedure'],['/procedures/123/folder','folder'],['/procedures/massive/123','massive']]) assert.equal(api.route(origin + route).kind, kind);
    assert.deepEqual(JSON.parse(JSON.stringify(api.route(origin + '/workspace?utf8=test&user_id=123'))), { supported: true, kind: 'workspace', origin, path: '/workspace' });
  }
  assert.equal(api.route('https://pge.mt.spa.coreplan.com.br.example.org/procedures').supported, false);
  assert.equal(api.route('http://spa.pge.mt.gov.br/procedures').supported, false);
});
test('filters are pure and keep record identity', () => {
  const api = adapter();
  const records = [{processNumber:'0001-22',expedienteId:'17',origin:'TJ',status:'Pendente'}, {processNumber:'0002-33',expedienteId:'18',origin:'TRF',status:'Conferido'}];
  assert.equal(api.filterRecords(records, {query:'000122'})[0], records[0]);
  assert.equal(api.filterRecords(records, {origin:'TRF',status:'Conferido'}).length, 1);
  assert.equal(api.filterRecords(records, {query:'inexistente'}).length, 0);
  assert.equal(records.length, 2);
});
test('selector registry never claims authenticated Coreplan evidence', () => {
  const api = adapter();
  for (const entries of Object.values(api.registry)) for (const item of Object.values(entries)) assert.equal(item.coreplan, 'requires-authenticated-evidence');
  assert.equal(typeof api.actions.confirm, 'function');
  assert.equal(api.actions.click, undefined);
});
test('new scripts parse and manifest loads the read layer before the bridge', () => {
  for (const file of ['js/shared/spa_selectors.js','js/shared/spa_adapter.js','js/spa_inspector.js','js/drawer.js','js/triagem/triage_workspace.js']) new vm.Script(fs.readFileSync(path.join(root,file),'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  const scripts = manifest.content_scripts[0].js;
  assert.ok(scripts.indexOf('js/shared/spa_adapter.js') < scripts.indexOf('js/content_bridge.js'));
  const bridge = fs.readFileSync(path.join(root,'js/content_bridge.js'),'utf8');
  for (const contract of ['SPA_CDSP_PAGE','SPA_CDSP_EXTENSION_BRIDGE','TRIAGEM_ALLOWED_TYPES']) assert.ok(bridge.includes(contract));
});

test('manual science uses the legacy executor only after confirmation', async () => {
  const source = fs.readFileSync(path.join(root,'js/triagem/spa_extension_panel.js'),'utf8');
  const fn = source.match(/^  async function takeScienceCurrentPage\(.*?^  }/ms)[0];
  for (const accepted of [false, true, 'stale']) {
    let writes = 0, confirmations = 0, currentId = 'anonymous-expediente';
    const row = {isConnected:true};
    const context = vm.createContext({ Set, manualScienceConfirmation:true, state:{stopped:false},
      rows:()=>[row], rowsByProcess:()=>[{key:'anonymous-process',rows:[row]}], log:()=>{}, processLogLabel:()=>'', rowInfo:()=>({}),
      scienceRecordFromRow:()=>({processKey:'anonymous-process',expedienteId:currentId}), rowHasScienceButton:()=>true,
      scienceRecordKey:record=>record.expedienteId,
      activateScience:()=>{writes++;return true},sleep:async()=>{},waitProcessingDone:async()=>{},retryPendingScienceRecords:async()=>{},CONFIG:{delayScienceMs:0},
      window:{SpaAdapter:{actions:{confirm:async(operation,targets,validate)=>{confirmations++;if(accepted==='stale')currentId='remounted-expediente';return Boolean(accepted)&&validate()}}}},
    });
    vm.runInContext(source.match(/^  async function confirmTriageAction\(.*?^  }/ms)[0]+'\n'+fn,context);
    await context.takeScienceCurrentPage(0);
    assert.equal(confirmations,1);assert.equal(writes,accepted===true?1:0);assert.equal(context.state.stopped,accepted!==true);
  }
});
