'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/triagem/spa_extension_panel.js'),'utf8');
const code=source.slice(source.indexOf('  function readTriageCardHandoff()'),source.indexOf('  function openTriageCardHandoff()'));
const key='MTPREV_TRIAGE_CARD_HANDOFF';
function setup(draft,procedureId='123'){
  const data=new Map([[key,typeof draft==='string'?draft:JSON.stringify(draft)]]);
  const ctx={window:{sessionStorage:{getItem:k=>data.get(k)||null,removeItem:k=>data.delete(k)}},currentProcedureId:()=>procedureId};
  vm.createContext(ctx);vm.runInContext(code,ctx);
  return {read:()=>ctx.readTriageCardHandoff(),data};
}
test('triagem do card entrega dados somente ao expediente selecionado e apenas uma vez',()=>{
  const draft={procedureId:'123',createdAt:Date.now(),assessor:'Pessoa da Equipe',processObservation:'Conferir documentos'};
  const ctx=setup(draft);
  assert.equal(ctx.read().assessor,draft.assessor);
  assert.equal(ctx.read(),null);
  assert.equal(ctx.data.has(key),false);
});
test('outro processo ou rota sem expediente não recebe a triagem',()=>{
  for(const procedureId of ['456','']){
    const ctx=setup({procedureId:'123',createdAt:Date.now()},procedureId);
    assert.equal(ctx.read(),null);
    assert.equal(ctx.data.has(key),true);
  }
});
test('descarta triagens expiradas, futuras e inválidas',()=>{
  for(const draft of [null,'{invalid',{procedureId:'123'},{procedureId:'123',createdAt:Date.now()-300001},{procedureId:'123',createdAt:Date.now()+60000}]){
    const ctx=setup(draft);
    assert.equal(ctx.read(),null);
    assert.equal(ctx.data.has(key),false);
  }
});
