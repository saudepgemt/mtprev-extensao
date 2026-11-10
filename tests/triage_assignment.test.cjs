'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../js/triagem/mtprev_pop_panel.js'),'utf8');
const code=source.slice(source.indexOf('  function recentSpaAssignment('),source.indexOf('  function decisionPdfCandidate('));
function doc(titles){return {querySelectorAll:()=>titles.map((item)=>({
  textContent:typeof item==='string'?item:item.title,
  contains:()=>false,getAttribute:()=>null,
  querySelector:selector=>selector==='time[datetime]'?(item.date?{getAttribute:()=>item.date}:null):{textContent:typeof item==='string'?item:item.title}
}))};}
function context(extra={}){const ctx={URL,AbortController,setTimeout,clearTimeout,location:{origin:'https://pge.mt.spa.coreplan.com.br'},procedureHref:r=>r.pendencyUrl||'',...extra};vm.createContext(ctx);vm.runInContext(code,ctx);return ctx;}
test('exclui designação nos três últimos e não confunde autor, setor ou sugestão',()=>{
 const ctx=context();
 assert.equal(ctx.recentSpaAssignment(doc(['Processo classificado (IA)','Processo distribuído para Assessor(a) - Medicamentos em geral','Processo distribuído para NSUS'])).assigned,true);
 for(const title of ['Processo distribuído para NSUS','Sugestão de assessor: Maria','Não designado para assessor','Designação revogada para assessor','Processo classificado (IA) por assessor'])assert.equal(ctx.recentSpaAssignment(doc([title])).assigned,false,title);
 assert.equal(ctx.recentSpaAssignment(doc(['A','B','C','Processo designado para assessor'])).assigned,false);
});
test('ordena pela data antes de limitar aos três últimos',()=>{
 const ctx=context();
 assert.equal(ctx.recentSpaAssignment(doc([
  {title:'Processo distribuído para Assessor(a)',date:'2026-11-01T10:00:00Z'},
  ...[2,3,4].map(day=>({title:'Processo classificado',date:`2026-11-0${day}T10:00:00Z`}))
 ])).assigned,false);
});
test('consulta única por processo, filtra duplicatas e preserva falhas',async()=>{
 const calls=[];
 const ctx=context({DOMParser:class{parseFromString(html){return doc([html]);}},fetch:async(url,options)=>{
  calls.push(url);assert.equal(options.credentials,'same-origin');
  if(url.includes('/2/'))throw new Error('offline');
  return {ok:true,text:async()=>'Processo distribuído para Assessor(a) - Saúde'};
 }});
 const kept={procedureId:'2'},missing={};
 const result=await ctx.excludeAssignedSpaRecords([{procedureId:'1'},{procedureId:'1'},kept,missing],{signal:new AbortController().signal});
 assert.equal(calls.length,2);assert.equal(result.excluded,2);assert.equal(result.failed,2);
 assert.equal(result.triagedRecords.length,2);
 assert.ok(result.triagedRecords.every(record=>record.procedureId==='1'));
 assert.equal(result.records[0],kept);assert.equal(result.records[1],missing);
});
test('cancelamento interrompe a verificação',async()=>{
 const ctx=context();const controller=new AbortController();controller.abort();
 await assert.rejects(ctx.excludeAssignedSpaRecords([{procedureId:'1'}],{signal:controller.signal}),{name:'AbortError'});
});
test('já triados reúne conferência manual e detecção automática sem duplicação',()=>{
 const start=source.indexOf('      function refreshTriageState(){');
 const end=source.indexOf('      refreshTriageState();',start);
 const ctx={data:{triagedRows:[{key:'automatico'},{key:'ambos'}]},sourceRows:[{key:'manual'},{key:'ambos'},{key:'rascunho'},{key:'pendente'}],
 localStorage:{getItem:()=>JSON.stringify({manual:{status:'Conferido — manter indicação'},ambos:{status:'Conferido — corrigir indicação'},rascunho:{assessor:'Maria'},pendente:{status:'Pendente'}})}};
 vm.createContext(ctx);
 vm.runInContext('let rows=[],triagedRows=[];'+source.slice(start,end)+'refreshTriageState();globalThis.result={rows,triagedRows};',ctx);
 assert.equal(ctx.result.triagedRows.length,3);
 assert.deepEqual(Array.from(ctx.result.rows,x=>x.key),['rascunho','pendente']);
 assert.equal(ctx.result.triagedRows.find(x=>x.key==='ambos').triagedManually,true);
 assert.equal(ctx.result.triagedRows.find(x=>x.key==='ambos').triagedAutomatically,true);
});
