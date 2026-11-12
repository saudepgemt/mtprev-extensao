'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/triagem/mtprev_pop_panel.js'),'utf8');
const restore=source.slice(source.indexOf('    function restoreReport()'),source.indexOf('    function updateMenuProgress('));
function read(cached,scope='mesa-a',version='v1'){
 const ctx={localStorage:{getItem:()=>JSON.stringify(cached)},reportScope:()=>scope,currentRules:()=>({version}),savedReportKey:'cache',reopen:{hidden:true},last:null,lastScope:''};
 vm.createContext(ctx);vm.runInContext(restore+';restoreReport();',ctx);return ctx;
}
const cached={scope:'mesa-a',rulesVersion:'v1',data:{rows:[],triagedRows:[],at:'2026-11-12T12:00:00.000Z'}};
test('reabre resultado persistido sem impor expiração automática',()=>{
 const ctx=read(cached);assert.equal(ctx.last.fromCache,true);assert.equal(ctx.lastScope,'mesa-a');assert.equal(ctx.reopen.hidden,false);
});
test('não reutiliza outra mesa, filtros ou versão das regras',()=>{
 assert.equal(read(cached,'mesa-b').last,null);assert.equal(read(cached,'mesa-a','v2').last,null);assert.equal(read(cached,'').last,null);
});
test('ignora resultado ausente ou incompleto',()=>{
 assert.equal(read(null).last,null);assert.equal(read({...cached,data:{rows:[]}}).last,null);
});
