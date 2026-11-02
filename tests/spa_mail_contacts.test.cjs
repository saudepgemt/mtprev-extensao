'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function createContacts(rootNode) {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/shared/spa_mail_contacts.js'), 'utf8'), sandbox);
  return JSON.parse(JSON.stringify(sandbox.MTPrevSpaMailContacts.list(rootNode)));
}

function option(name, value, email = '', disabled = false) {
  return {textContent:name, value, disabled, dataset:{email}, getAttribute(key) {return key === 'data-email' ? email : null;}};
}
function select(name, options, extension = false) {
  return {name,id:'',labels:[],closest:()=>extension ? {} : null,
    getAttribute:()=>null,querySelectorAll:()=>options};
}

test('contatos do SPA só usam campos de usuário e e-mails explicitamente fornecidos', () => {
  const document = {querySelectorAll(selector) {
    if (selector === 'select') return [
      select('user_id', [option('Ana Clara (ana@org.gov.br)', 'a'), option('Gabrielle', 'b'), option('Escolha um usuário','')]),
      select('topic_id', [option('Não é usuário: fake@org.gov.br', 'x')]),
      select('assessor_id', [option('Yuri', 'c', 'yuri@org.gov.br')]),
      select('users', [option('Não incluir', 'n','outro@org.gov.br')], true)
    ];
    return [];
  }};
  assert.deepEqual(createContacts(document), [
    {name:'Ana Clara',email:'ana@org.gov.br'},
    {name:'Gabrielle',email:''},
    {name:'Yuri',email:'yuri@org.gov.br'}
  ]);
});

test('nenhum destinatário é inferido do nome sem e-mail cadastrado no SPA', () => {
  const document = {querySelectorAll(selector) {
    return selector === 'select' ? [select('usuario', [option('Servidor X', '9')])] : [];
  }};
  assert.deepEqual(createContacts(document), [{name:'Servidor X',email:''}]);
});

test('página de opções preserva destinatários globais gerenciados no SPA', async () => {
  const events = {};
  const nodes = new Map();
  for (const id of ['watch-mail-form','watch-mail-sender','watch-mail-consent','watch-mail-enabled',
    'watch-mail-status','watch-mail-test','watch-mail-connect','watch-mail-disconnect',
    'watch-mail-check','watch-mail-client-id-state','watch-mail-defaults-count','watch-mail-extension-id']) {
    nodes.set(id, {value:'',checked:false,textContent:'',dataset:{},addEventListener(name,handler) {events[`${id}:${name}`]=handler;}});
  }
  nodes.get('watch-mail-sender').value = 'remetente@org.gov.br';
  let persisted = {sender:'antigo@org.gov.br',defaults:['padrao@org.gov.br'],consent:false,enabled:false,custom:'preservar'};
  const chrome = {runtime:{id:'abcdefghijklmnopqrstuvwxyzabcdef',sendMessage:async()=>({ok:true,message:'Pronto',clientReady:true})},storage:{local:{
    get:async()=>({MTPREV_WATCH_GMAIL_CONFIG_V1:{...persisted}}),
    set:async data=>{persisted={...data.MTPREV_WATCH_GMAIL_CONFIG_V1};}
  }}};
  const sandbox={chrome,document:{getElementById:id=>nodes.get(id)},window:{confirm:()=>true}};
  sandbox.globalThis=sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root,'js/watch_mail_options.js'),'utf8'),sandbox);
  await new Promise(resolve=>setImmediate(resolve));
  nodes.get('watch-mail-sender').value='novo@org.gov.br';
  const callback=events['watch-mail-form:submit'];
  await callback({preventDefault(){}});
  assert.equal(persisted.sender,'novo@org.gov.br');
  assert.deepEqual(persisted.defaults,['padrao@org.gov.br']);
  assert.equal(persisted.custom,'preservar');
});
