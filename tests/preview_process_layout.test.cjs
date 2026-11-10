'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const bridge=fs.readFileSync(path.join(__dirname,'../js/iframe_autos_bridge.js'),'utf8');
const autos=fs.readFileSync(path.join(__dirname,'../js/triagem/spa_extension_panel.js'),'utf8');

function part(begin,end){
  const a=bridge.indexOf(begin);const b=bridge.indexOf(end,a+begin.length);
  assert.ok(a>=0 && b>a,'trecho encontrado: '+begin);
  return bridge.slice(a,b);
}

test('A extensão encontra somente o preview lateral, sem reorganizar a mesa do SPA',()=>{
  assert.match(bridge,/querySelector\('#workspace-process-preview'\)/);
  assert.match(bridge,/sheet\?\.querySelector\('\.workspace-preview__document\[data-procedure-id\]'\)/);
  const previewRoot={id:'somente-preview'};
  const sheet={querySelector:()=>previewRoot};
  const win={};win.top=win;
  const document={querySelector:sel=>sel==='#workspace-process-preview'?sheet:{id:'nao-usar'}};
  const cx=vm.createContext({document,window:win,location:{pathname:"/workspace"}});
  vm.runInContext(part('  function mtprevGetPreviewRoot()','  // O SPA nao inclui o HTML')+'\nthis.getRoot=mtprevGetPreviewRoot;',cx);
  assert.equal(cx.getRoot(),previewRoot);
  document.querySelector=()=>null;
  assert.equal(cx.getRoot(),null);
});

test('A Visão geral usa uma única grade de 2 colunas com as três linhas pedidas',()=>{
  assert.match(bridge,/#workspace-process-preview \.workspace-preview__panel:not\(\.is-active\)/);
  assert.doesNotMatch(bridge,/#workspace-preview-overview\.mtprev-overview-ready\s*\{\s*display:block !important/);
  assert.match(bridge,/querySelector\(':scope > \.workspace-preview__section-heading'\)/);
  assert.match(bridge,/grid-template-areas:\s*"prazos ultimos"\s*"relacionados situacao"\s*"dados eventos"/);
  assert.match(bridge,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
  for(const [slot,label] of [['prazos','Prazos em aberto'],['ultimos','Últimos 3 andamentos'],['relacionados','Processos relacionados'],['situacao','Situação atual'],['dados','Dados do processo'],['eventos','Eventos']]){
    assert.ok(bridge.includes(`put('${slot}',`),slot);
    assert.ok(bridge.includes(`,'${label}');`),label);
  }
  assert.doesNotMatch(bridge,/mtprev-overview-left|mtprev-overview-right/);
});

test('Os cards têm cabeçalho consistente, recolher, fechar e restaurar',()=>{
  assert.match(bridge,/mtprev-card-header/);
  assert.match(bridge,/if \(heading\.closest\('\.mtprev-card-header'\)\) continue/);
  assert.match(bridge,/mtprev-card-collapsed/);
  assert.match(bridge,/mtprev-card-closed/);
  assert.match(bridge,/Restaurar cards fechados/);
});

test('A aba Usuários continua independente das outras abas',()=>{
  assert.match(bridge,/mtprevCreateUsersTab\(root,overview,users\)/);
  assert.match(bridge,/pane\.appendChild\(usersCard\)/);
  assert.match(bridge,/mtprev-overview-hidden/);
  assert.match(bridge,/anota\[cç\]\[oõ\]es/);
});

test('Expedientes é ativado via botão nativo, com tentativas limitadas e respeito ao usuário',()=>{
  assert.match(bridge,/mtprevExpedientesActivated = new WeakMap/);
  let clicks=0;
  const tab={isConnected:true,textContent:'Expedientes 7',className:'',getAttribute:()=>null,click:()=>clicks++};
  const card={isConnected:true,querySelectorAll:()=>[tab],querySelector:()=>null,addEventListener:()=>{},textContent:'Selecione uma categoria para visualizar os itens.'};
  const cx=vm.createContext({mtprevExpedientesActivated:new WeakMap(),mtprevCleanLabel:v=>String(v).toLowerCase().trim(),setTimeout:()=>{}});
  vm.runInContext(part('  function mtprevActivateExpedientes(','  function mtprevCreateUsersTab(')+'\nthis.activate=mtprevActivateExpedientes;',cx);
  cx.activate(card);cx.activate(card);
  assert.equal(clicks,1,'não clicar repetidamente a cada atualização');
  assert.match(bridge,/event\.isTrusted/);
  assert.match(bridge,/info\.tries < 3/);
});

test('Lê até três movimentações em ordem decrescente sem inventar histórico',()=>{
  const code=part('  function mtprevReadTimeline(','  function mtprevFindAndamentosNav(');
  const makeNode=(label,time,actor='Pessoa de teste')=>({
    textContent:label+' '+time.replace('T',' '),getAttribute:()=>null,contains:()=>false,
    querySelector:sel=>sel.includes('time[datetime]')?{getAttribute:()=>time}:sel.includes('timeline-title')?{textContent:label}:sel.includes('timeline-user')?{textContent:actor}:null
  });
  const nodes=[makeNode('Antigo','2025-07-01T12:00:00'),makeNode('Novo','2025-08-31T21:40:00'),makeNode('Segundo','2025-08-31T21:39:00'),makeNode('Terceiro','2025-08-28T17:17:00')];
  const cx=vm.createContext({MTPREV_TIMELINE_ITEMS:'.timeline-item'});
  vm.runInContext(code+'\nthis.read=mtprevReadTimeline;',cx);
  const result=cx.read({querySelectorAll:()=>nodes});
  assert.deepEqual(Array.from(result,x=>x.title),['Novo','Segundo','Terceiro']);
  assert.equal(result[0].actor,'Pessoa de teste');
  assert.equal(result[0].node,undefined,'dados do resumo não carregam referências DOM');
  const highlighted=cx.read({querySelectorAll:()=>nodes},true);
  assert.equal(highlighted[0].node,nodes[1],'destaque usa a mesma ordem cronológica do resumo');
});

test('A busca da timeline é limitada ao processo e à própria origem do SPA',()=>{
  assert.ok(bridge.includes("'/workspace/processes/'+processId+'/timeline'"));
  assert.match(bridge,/credentials:'same-origin'/);
  assert.match(bridge,/redirect:'error'/);
  assert.match(bridge,/new DOMParser\(\)\.parseFromString\(html,'text\/html'\)/);
  assert.match(bridge,/title\.textContent = entry\.title/);
  assert.match(bridge,/state\?\.loading \? 'Consultando os últimos andamentos/);
});

test('O painel MTPrev permanece no topo, recolhido por padrão e sem rolagem paralela',()=>{
  assert.match(autos,/host\.insertBefore\(panel, host\.firstChild\)/);
  assert.match(autos,/OPEN_MINIMIZED_V2/);
  assert.match(autos,/storageGet\(EXTERNAL_DOCS_OPEN_MINIMIZED_KEY, "1"\) !== "0"/);
  assert.match(autos,/html\.mtprev-autos-in-iframe #spa-cdsp-external-docs-panel \.spa-cdsp-external-docs-list,[\s\S]*?overflow: visible !important;/);
});

test('Visão geral não invade outras abas e títulos nativos em span são reconhecidos',()=>{
  assert.match(bridge, /if \(!overview\.classList\.contains\('is-active'\)\) return/);
  assert.match(bridge, /querySelector\(':scope > div > span, :scope > span/);
  assert.match(bridge, /mtprev-native-heading-empty/);
  assert.match(bridge, /data-workspace-relationship-content/);
  assert.match(bridge, /if \(active\(\)\) return/);
});

test('O processo completo usa a propria folha sem mexer na mesa principal',()=>{
  assert.ok(bridge.includes('location.pathname'));
  assert.match(bridge,/location.pathname/);
});
