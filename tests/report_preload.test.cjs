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
test('triagem prepara sem abrir modal e invalida leitura quando muda o escopo',()=>{
 const panel=read('triagem/mtprev_pop_panel.js');
 const start=panel.indexOf('    function preload(){'),end=panel.indexOf('    setTimeout(preload,300);',start);
 const context={scope:'mesa-a',hasCards:true,calls:0,last:{},currentController:null,attemptedScope:'',
 reportScope:()=>context.scope,document:{querySelector:()=>context.hasCards?{}:null},generateReport:background=>{assert.equal(background,true);context.calls++;}};
 vm.createContext(context);vm.runInContext(panel.slice(start,end),context);
 context.preload();context.preload();assert.equal(context.calls,1);
 let aborted=false;context.currentController={abort(){aborted=true;}};context.scope='mesa-b';context.preload();assert.equal(aborted,true);assert.equal(context.last,null);
 context.currentController=null;context.preload();assert.equal(context.calls,2);
});
