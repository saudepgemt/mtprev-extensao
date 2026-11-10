'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'../js',file),'utf8');
const source=read('triagem/spa_extension_panel.js');
const extract=name=>source.match(new RegExp('^  (?:async )?function '+name+'\\(.*?^  }','ms'))[0];
test('pré-leitura de duplicados compartilha coleta e salva sem abrir relatório',async()=>{
 let scope='mesa-a',collects=0;const saved=[];
 const context={AbortController,Map,Set,Date,Math,document:{querySelector:()=>({})},
 workspaceDuplicateCacheScope:()=>scope,normalizeDateOnly:x=>x,log(){},
 window:{MTPrevWorkspaceCache:{collect:async options=>{assert.equal(options.allowScroll,false);collects++;return {reason:'complete',total:2,records:[{processNumber:'1002000-44.2023.8.11.0041',rowKey:'1'},{processNumber:'1002000-44.2023.8.11.0041',rowKey:'2'}]};}}},
 saveWorkspaceDuplicateCache:async(key,report)=>{saved.push({key,report});}};
 vm.createContext(context);
 vm.runInContext('let duplicatePreload=null,duplicatePreloadScope="";'+extract('workspaceDuplicateReport')+extract('preloadWorkspaceDuplicates')+'\nglobalThis.job=()=>duplicatePreload?.promise;',context);
 context.preloadWorkspaceDuplicates();context.preloadWorkspaceDuplicates();await context.job();
 assert.equal(collects,1);assert.equal(saved.length,1);assert.equal(saved[0].report.groups.length,1);
 context.preloadWorkspaceDuplicates();assert.equal(collects,1);
 scope='mesa-b';context.preloadWorkspaceDuplicates();await context.job();
 assert.equal(collects,2);assert.equal(saved[1].key,'mesa-b');
});
test('triagem n?o inicia por temporizador e cancela ao mudar de mesa',()=>{
 const panel=read('triagem/mtprev_pop_panel.js');
 const start=panel.indexOf('    function watchTriageScope(){'),end=panel.indexOf('    const scopeTimer=',start);
 let aborted=false;
 const context={scope:'mesa-a',last:null,currentController:null,attemptedScope:'',lastScope:'',
 reportScope:()=>context.scope,document:{querySelector:()=>null},generateReport:()=>assert.fail('n?o deve iniciar automaticamente')};
 vm.createContext(context);vm.runInContext(panel.slice(start,end),context);
 context.watchTriageScope();
 context.currentController={abort(){aborted=true;}};context.attemptedScope='mesa-a';context.scope='mesa-b';
 context.watchTriageScope();assert.equal(aborted,true);
 assert.doesNotMatch(panel,/setTimeout\(preload/);
});

test('fechar a triagem mantém a leitura, enquanto Interromper cancela explicitamente',()=>{
 const panel=read('triagem/mtprev_pop_panel.js');
 const close=panel.match(/close\.addEventListener\('click',\(\)=>\{([^}]+)\}\);/);
 assert.ok(close);assert.doesNotMatch(close[1],/abort/);
 assert.match(panel,/cancel\.addEventListener\('click',\(\)=>currentController\?\.abort\(\)\)/);
});
test('abrir a triagem durante a leitura revela o menu sem criar modal',()=>{
 const panel=read('triagem/mtprev_pop_panel.js'),events=[];
 const start=panel.indexOf('    function openReport(){'),end=panel.indexOf("    document.addEventListener('mtprev:triage:open'",start);
 const context={last:null,currentController:{},pendingMain:{},document:{dispatchEvent:event=>events.push(event.type)},Event,
 makeModal:()=>assert.fail('não deve bloquear o SPA enquanto carrega'),generateReport:()=>assert.fail('não deve duplicar a leitura')};
 vm.createContext(context);vm.runInContext(panel.slice(start,end)+'openReport();',context);
 assert.deepEqual(events,['mtprev:triage:loading']);
});
test('apenas relatório pronto abre modal; a geração sempre usa contêiner fora da página',()=>{
 const panel=read('triagem/mtprev_pop_panel.js');
 const start=panel.indexOf('    async function generateReport('),end=panel.indexOf('    function renderReport(',start);
 const generation=panel.slice(start,end);
 assert.doesNotMatch(generation,/makeModal\(/);
 assert.match(generation,/const main=reportNode\('div','mtprev-triage-main'\)/);
 assert.match(generation,/updateMenuProgress\('ready'/);
});
test('primeira abertura do relatório pronto remove o aviso e restaura legenda do menu',()=>{
 const panel=read('triagem/mtprev_pop_panel.js');
 const start=panel.indexOf('    function openReport(){'),end=panel.indexOf("    document.addEventListener('mtprev:triage:open'",start);
 let removed=0,rendered=0;const compact={textContent:'Triagem pronta'};
 const ctx={last:{rows:[]},lastScope:'mesa',reportScope:()=> 'mesa',makeModal:()=>({}),renderReport:()=>rendered++,
 document:{querySelector:selector=>selector.includes('menu-progress')?{remove:()=>removed++}:compact}};
 vm.createContext(ctx);vm.runInContext(panel.slice(start,end)+'openReport();',ctx);
 assert.equal(removed,1);assert.equal(rendered,1);assert.equal(compact.textContent,'Abrir ferramentas');
});
