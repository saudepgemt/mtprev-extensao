const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/watch_mail_oauth.js'), 'utf8');
const templateSource = fs.readFileSync(path.join(__dirname, '../js/watch_mail_template.js'), 'utf8');
const validClient = '123456789-testclient.apps.googleusercontent.com';
function setup(initial = {}, opts = {}) {
  let tokenCalls = 0;
  const store = {'MTPREV_WATCH_GMAIL_CONFIG_V1': initial};
  const sent = [];
  const browser = {
    runtime: {id: 'hlmpphdngoibhfhlgheobekbkhabcgpj',getManifest:() => ({oauth2:{client_id:opts.clientId || validClient}}),getURL: s => 'chrome-extension://hlmpphdngoibhfhlgheobekbkhabcgpj/'+s,onMessage:{addListener() {}}},
    storage:{local:{get:async key=>({[key]:store[key]}),set:async obj=>Object.assign(store,obj)}},
    identity:{getAuthToken:async()=>{tokenCalls++;return {token:'token-test'};},removeCachedAuthToken:async()=>{},clearAllCachedAuthTokens:async()=>{}}
  };
  const context = {chrome: browser, globalThis:null,TextEncoder, btoa, Date, console,
    fetch: async (url, args) => {
      if (url.includes('userinfo')) return {ok:true,json:async()=>({email: opts.actual || 'remetente@org.gov.br',email_verified:true})};
      if (url.includes('/messages/send')) {sent.push(JSON.parse(args.body));return {ok:true,json:async()=>({id:'gmail-message-abc'})};}
      throw new Error('URL não reconhecida');
    }};
  context.globalThis = context;
  vm.runInNewContext(templateSource, context);
  vm.runInNewContext(source, context);
  return {api:context.MTPrevWatchMail, sent, getTokenCalls:()=>tokenCalls,store};
}
const base = {sender:'remetente@org.gov.br',defaults:['a@org.gov.br','b@org.gov.br'],enabled:true,consent:true};
test('destinatários padrão: cada processo pode excluir e acrescentar sem alterar padrões', async()=>{
  const {api,store}=setup(base);
  const item={number:'12345678901234567890',mail:{enabled:true,extra:['c@gmail.com','a@org.gov.br'],excluded:['b@org.gov.br']}};
  const preview=await api.preview(item);
  assert.equal(preview.recipients.join(','),'a@org.gov.br,c@gmail.com');
  assert.equal(store.MTPREV_WATCH_GMAIL_CONFIG_V1.defaults.join(','),'a@org.gov.br,b@org.gov.br');
  assert.equal((await api.preview({mail:{enabled:false}})).recipients.length,0);
});
test('e-mail inválido ou excesso de destinatários são rejeitados',()=>{
  const {api}=setup();
  assert.throws(()=>api.parseEmails('alguem@gmail.com\r\nBcc: malicioso'), /inválido/);
  assert.throws(()=>api.parseEmails(Array.from({length:41},(_,i)=>`test${i}@org.gov.br`)),/Limite/);
});
test('primeira conexão do Gmail verifica que o remetente é o mesmo autorizado',async()=>{
  const {api,getTokenCalls}=setup(base,{actual:'outro@org.gov.br'});
  await assert.rejects(()=>api.test(null),/difere do remetente/);
  assert.equal(getTokenCalls(),1);
});
test('teste explícito de processo envia a ultima movimentação em HTML e Bcc',async()=>{
  const {api,sent}=setup(base);
  const result=await api.test({number:'12345678901234567890',subject:'Aposentadoria', parties:'Pessoa A e MTPrev',expedienteId:'41858970',latestMovement:{date:'20261029',description:'Juntada de petição',code:'202'},mail:{extra:['extra@gmail.com'],excluded:['b@org.gov.br']}});
  assert.equal(result.recipients.length,2);
  assert.equal(sent.length,1);
  const mime=Buffer.from(sent[0].raw.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');
  assert.match(mime,/To: remetente@org.gov.br/);
  assert.match(mime,/Bcc: a@org.gov.br, extra@gmail.com/);
  assert.match(mime,/multipart\/alternative/);
  assert.match(mime,/text\/html; charset=UTF-8/);
  const html64 = mime.match(/Content-Type: text\/html; charset=UTF-8\r?\nContent-Transfer-Encoding: base64\r?\n\r?\n([A-Za-z0-9+\/=\r\n]+)/)?.[1];
  assert.ok(html64);
  const html=Buffer.from(html64.replace(/\s/g,''),'base64').toString('utf8');
  assert.match(html,/Juntada de petição/);
  assert.match(html,/Aposentadoria/);
  assert.match(html,/\/procedures\/41858970/);
  assert.match(html,/Localizar processo no SPA/);
});
test('envio automático requer consentimento e ativação; sem OAuth não envia',async()=>{
  const {api,sent}=setup({...base,enabled:false});
  const result=await api.notify({number:'12345678901234567890'},['Movimentação']);
  assert.equal(result.skipped,true);
  assert.equal(sent.length,0);
});

test('HTML escapa dados do processo e impede links fornecidos sem ID autorizado',()=>{
  const {api}=setup(base);
  const ctx={globalThis:null};ctx.globalThis=ctx;vm.runInNewContext(templateSource,ctx);
  const item={number:'12345678901234567890',subject:'<script>alert(1)</script>',parties:'A & B',expedienteId:'https://site-falso.com',latestMovement:{date:'20261029',description:'Petição <img src=x>'}};
  const tpl=ctx.MTPrevMailTemplate.build(item,[],{test:true});
  assert.doesNotMatch(tpl.html,/<script>|<img src=x>/);
  assert.match(tpl.html,/&lt;script&gt;/);
  assert.match(tpl.html,/A &amp; B/);
  assert.doesNotMatch(tpl.html,/site-falso/);
  assert.match(tpl.html,/procedures\/search/);
});
