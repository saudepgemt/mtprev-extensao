'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname,'..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
function setup(config) {
  let tokenCalls = 0, requests = 0;
  const events=[];
  const chrome={runtime:{getManifest:()=>({oauth2:{client_id:'12345-test.apps.googleusercontent.com'}}),getURL:x=>'chrome-extension://fixture/'+x,onMessage:{addListener:fn=>events.push(fn)}},
    identity:{getAuthToken:async()=>{tokenCalls++;return {token:'should-not-be-used'};},removeCachedAuthToken:async()=>{},clearAllCachedAuthTokens:async()=>{}},
    storage:{local:{get:async()=>({'MTPREV_WATCH_GMAIL_CONFIG_V1':config})}}};
  const context={chrome,globalThis:null,TextEncoder,btoa,Date,console,fetch:async()=>{requests++;throw Error('não use a rede');}};
  context.globalThis=context;
  vm.runInNewContext(read('js/watch_mail_template.js'),context);
  vm.runInNewContext(read('js/watch_mail_oauth.js'),context);
  return {api:context.MTPrevWatchMail, tokenCalls:()=>tokenCalls, requests:()=>requests};
}
const initial={sender:'contato@exemplo.gov.br',deliveryMode:'manual',consent:true,enabled:true,defaults:['a@exemplo.gov.br','b@exemplo.gov.br']};
const record={number:'12345678901234567890',subject:'Aposentadoria',expedienteId:'41858970',latestMovement:{date:'20261105',description:'Intimação expedida'}};
test('modo manual nunca chama Gmail API ou OAuth, mesmo com enabled legado true', async()=>{
  const t=setup(initial);
  assert.equal((await t.api.notify(record,[{description:'Petição'}])).skipped,true);
  assert.equal((await t.api.status()).enabled,false);
  await assert.rejects(()=>t.api.test(record),/Modo manual/);
  assert.equal(t.tokenCalls(),0);assert.equal(t.requests(),0);
});
test('rascunho do acompanhamento preserva destinatários e conteúdo, sem envio',async()=>{
  const t=setup(initial);
  const draft=await t.api.draft(record);
  assert.equal(draft.ok,true);
  assert.equal(draft.deliveryMode,'manual');
  assert.equal(draft.recipients.join(','),'a@exemplo.gov.br,b@exemplo.gov.br');
  assert.match(draft.subject,/Acompanhamento|Intimação/i);
  assert.match(draft.body,/Intimação expedida/);
  assert.equal(t.tokenCalls(),0);assert.equal(t.requests(),0);
});
test('rascunho exige consentimento e movimentação confiável',async()=>{
  const t=setup({...initial,consent:false});
  await assert.rejects(()=>t.api.draft(record),/autorização/);
  const q=setup(initial);
  await assert.rejects(()=>q.api.draft({number:'12345678901234567890'}),/Sem movimentação/);
});
test('menu, MCP e configurações preservam controles essenciais para extensão',()=>{
  const menu=read('js/radial_menu.js'), html=read('options.html'), panel=read('js/process_watch_panel.js');
  assert.match(menu,/MTPREV_OPEN_OPTIONS/);assert.match(menu,/icon:'settings'/);
  for(const id of ['endpoint','consent','default-service','test-service','mcp-connection-state','watch-mail-mode-manual','watch-mail-mode-oauth','watch-mail-compose','watch-mail-enabled'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(panel,/action.*mailDraft|mailDraft/);
  assert.match(read('js/process_watch_background.js'),/MTPrevWatchMail\.draft/);
});
