'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto').webcrypto;
const C=require('../js/shared/audit_core.js');
const origin='https://pge.mt.spa.coreplan.com.br/workspace';
function event(overrides={}){return {event_id:'evento_123456',processo:'1002000-44.2023.8.11.0041',assessor:'Ana Silva',evento:'Petição elaborada',data_minutada:'2026-11-11T14:00:00-04:00',dispensa:'nao',origem_spa:origin,...overrides};}
test('ranking conta evento único, ignora dispensa e respeita data minutada e período',()=>{
 const rows=[event(),event(),event({event_id:'dispensa_123',dispensa:'sim'}),event({event_id:'outro_12345',evento:'Minuta elaborada'}),event({event_id:'antigo_123',data_minutada:'2026-10-01T14:00:00Z'}),event({event_id:'semdata_123',data_minutada:''})];
 const rank=C.ranking(rows,{from:'2026-11-01',to:'2026-11-30',event:'Petição elaborada'});
 assert.equal(rank.length,1);assert.equal(rank[0].total,1);assert.equal(rank[0].semPrazo,1);
 assert.equal(C.ranking(rows,{event:''}).length,0);
});
test('regra de envio ao procurador aceita a grafia do SPA e mantém tipos desconhecidos fora do ranking',()=>{
 const rows=[event({event_id:'envio_111111',evento:'Minuta enviada ao(à) procurador(a)'}),event({event_id:'envio_222222',evento:'Minuta enviada ao procurador',dispensa:'nao_informado'}),event({event_id:'envio_333333',evento:'Minuta enviada ao procurador',dispensa:'sim'})];
 const rank=C.ranking(rows,{event:'Minuta enviada ao procurador'});
 assert.equal(rank[0].total,1);
});
test('prazo e tempo de elaboração usam somente datas exatas, com ausência explícita',()=>{
 const rows=[event({event_id:'evento_11111',prazo:'2026-11-11T20:00:00Z',data_recebimento:'2026-11-11T16:00:00Z'}),event({event_id:'evento_22222',prazo:'2026-11-11T17:00:00Z'}),event({event_id:'evento_33333'})];
 const row=C.ranking(rows,{event:'Petição elaborada'})[0];
 assert.equal(row.noPrazo,1);assert.equal(row.foraPrazo,1);assert.equal(row.semPrazo,1);assert.equal(row.mediaHoras,2);
});
test('assinatura ou envio não equivale a sucesso do protocolo',()=>{
 assert.equal(C.protocolOutcome({submitted:true,selectedCount:3},'Documentos assinados com sucesso').resultado,'enviado_sem_confirmacao');
 assert.equal(C.protocolOutcome({submitted:true,selectedCount:3},'3 processos protocolados com sucesso').confirmados,3);
 assert.equal(C.protocolOutcome({submitted:true,selectedCount:3},'2 processos protocolados com sucesso').confirmados,0);
 assert.equal(C.protocolOutcome({submitted:true,selectedCount:3},'3 processos protocolados com sucesso. Erro em outro item.').resultado,'falha');
});
test('histórico mantém o evento final de cada lote mesmo quando os horários coincidem',()=>{
 const rows=[{event_id:'batch_1_start',lote_id:'batch_1',atualizado_em:'2026-11-11T18:00:00Z',resultado:'iniciado'},{event_id:'batch_1_end',lote_id:'batch_1',atualizado_em:'2026-11-11T18:00:00Z',resultado:'enviado_sem_confirmacao'}];
 assert.equal(C.batches(rows).length,1);assert.equal(C.batches(rows)[0].resultado,'enviado_sem_confirmacao');
});
test('normalização restringe campos e não transporta senha, token ou origem externa',()=>{
 const row=C.normalizeEvent('Produtividade',event({password:'segredo',token:'segredo'}));
 assert.equal(row.password,undefined);assert.equal(row.token,undefined);
 assert.throws(()=>C.normalizeEvent('Produtividade',event({origem_spa:'https://outro.example/'})),/Origem/);
 assert.throws(()=>C.normalizeEvent('Produtividade',event({data_minutada:'aproximadamente 1 ano'})),/data exata/);
});
function service(){
 const storage={MTPREV_AUDIT_CONFIG_V1:{enabled:true,event:'Petição elaborada',account:'usuario@example.org'}};
 const remote={Produtividade:[],Protocolos:[]};let fail=false,appends=0;
 const chrome={storage:{local:{get:async key=>({[key]:storage[key]}),set:async values=>Object.assign(storage,structuredClone(values))}},
 identity:{getAuthToken:async()=>({token:'teste-nao-real'}),removeCachedAuthToken:async()=>{}},alarms:{create(){},onAlarm:{addListener(){}}},runtime:{getURL:p=>'chrome-extension://teste/'+p,onMessage:{addListener(){}}}};
 const ctx={MTPrevAuditCore:C,chrome,URL,AbortSignal,console,fetch:async(url,options)=>{
   if(fail)throw Error('offline');
   if(url.includes('?fields=sheets'))return {ok:true,json:async()=>({sheets:Object.keys(remote).map(title=>({properties:{title,gridProperties:{rowCount:1000}}}))})};
   const name=url.includes('Produtividade')?'Produtividade':'Protocolos';
   if(options.method==='POST'){
     assert.match(url,/valueInputOption=RAW/);appends++;
     remote[name].push(...JSON.parse(options.body).values);return {ok:true,json:async()=>({})};
   }
   const decoded=decodeURIComponent(url),first=decoded.includes('!A1:');
   return {ok:true,json:async()=>({values:first?[C.HEADERS[name],...remote[name]]:[]})};
 }};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/audit_sheets_background.js'),'utf8'),ctx);
 return {api:ctx.MTPrevAuditService,storage,remote,get appends(){return appends;},set fail(value){fail=value;}};
}
test('fila mantém dados offline e sincroniza sem duplicar reimportações',async()=>{
 const s=service();await s.api.capture('Produtividade',[event(),event()]);assert.equal((await s.api.status()).pending,1);
 s.fail=true;await assert.rejects(s.api.sync(),/offline/);assert.equal((await s.api.status()).pending,1);
 s.fail=false;await s.api.sync();assert.equal((await s.api.status()).pending,0);assert.equal(s.remote.Produtividade.length,1);
 await s.api.capture('Produtividade',[event()]);await s.api.sync();assert.equal(s.appends,1);
});
test('captura desabilitada não registra nem envia dados',async()=>{
 const s=service();s.storage.MTPREV_AUDIT_CONFIG_V1.enabled=false;
 assert.equal((await s.api.capture('Produtividade',[event()])).skipped,true);assert.equal(s.appends,0);
});
test('produção extrai autor do andamento, nunca do assessor sugerido',async()=>{
 const ctx={crypto,TextEncoder,URL,location:{origin:'https://pge.mt.spa.coreplan.com.br'}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/shared/audit_core.js'),'utf8'),ctx);
 const item={contains:()=>false,id:'',getAttribute:()=>'',querySelector:selector=>selector.includes('timeline-title')?{textContent:'Petição elaborada'}:selector.includes('timeline-user')?{textContent:'Autor real'}:selector.includes('time[datetime]')?{getAttribute:()=> '2026-11-11T14:00:00-04:00'}:null};
 const result=await ctx.MTPrevAuditCore.productivityFromTimeline({querySelectorAll:()=>[item]},{procedureId:'123',processNumber:'100',assessor:'Sugerido'},'Petição elaborada');
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].assessor,'Autor real');
 assert.equal(result.rows[0].dispensa,'nao_informado');
 const dispensa=await ctx.MTPrevAuditCore.productivityFromTimeline({querySelectorAll:()=>[item]},{procedureId:'123',manifestationSuggested:'Dispensa de atuação'},'Petição elaborada');
 assert.equal(dispensa.rows.length,0);
 item.querySelector=selector=>selector.includes('timeline-title')?{textContent:'Petição elaborada'}:null;
 const absent=await ctx.MTPrevAuditCore.productivityFromTimeline({querySelectorAll:()=>[item]},{procedureId:'123',assessor:'Sugerido'},'Petição elaborada');
 assert.equal(absent.rows.length,0);assert.equal(absent.skipped,1);
});
