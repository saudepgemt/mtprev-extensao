const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('checagem automatica so depois de 24h; manual nao altera intervalo; apenas movimento gera email', async () => {
  let now = Date.parse('2026-10-29T10:00:00.000Z');
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  let onMessage, onAlarm, checks = 0, emails = 0, lastItems = null, alarmConfig;
  let db = {};
  const number = '00000000020268110001';
  let result = {ok:true, fetchedAt:'2026-10-29T10:00:00Z', movements:[{date:'20261029',description:'Distribuição',code:'1',linkedDocumentIds:[]}],expedientes:[]};
  const chrome = {
    storage:{local:{get:async()=>structuredClone(db),set:async value=>{db=structuredClone({...db,...value});}}},
    action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},
    notifications:{create:async()=>{}},
    runtime:{onMessage:{addListener:fn=>{onMessage=fn;}},onStartup:{addListener(){}},onInstalled:{addListener(){}}},
    alarms:{create:async(name, config)=>{alarmConfig={name,...config};},onAlarm:{addListener:fn=>{onAlarm=fn;}}}
  };
  const bg = fs.readFileSync(path.join(__dirname,'../js/background.js'),'utf8');
  const validation = bg.match(/^const ALLOWED_HOSTS = .*;$/m)[0] + '\n' + bg.match(/^function normalizeAllowedUrl\(.*?^}/ms)[0];
  vm.runInNewContext(validation + '\n' + fs.readFileSync(path.join(__dirname,'../js/process_watch_background.js'),'utf8'),{
    URL,Date:Clock,chrome,fetchMniProcedureMovements:async()=>{checks++;return result;},
    inferMniPjeEndpoint:()=>({id:'pje'}),
    MTPrevWatchMail:{notify:async(record,items)=>{emails++;lastItems=items;return {accepted:true,count:2};}}
  });
  const send = action => new Promise(resolve => onMessage({type:'CDSP_PROCESS_WATCH',action,processNumber:number},{tab:{url:'https://pge.mt.spa.coreplan.com.br/workspace'}},resolve));
  await send('add');assert.equal(checks,1);assert.equal(emails,0);
  await send('pageOpened');assert.equal(checks,2);
  await send('pageOpened');assert.equal(checks,2);
  now += 2*60*60*1000;await send('pageOpened');assert.equal(checks,2);
  assert.equal(alarmConfig.periodInMinutes,1440);
  // Uma mudanca em expediente nao equivale a nova movimentacao.
  result={...result,expedientes:[{id:'e1',deadlineAt:'20261102'}]};
  now += 23*60*60*1000;
  await send('pageOpened');assert.equal(checks,3);assert.equal(emails,0);
  // Nova movimentacao detectada na rodada seguinte: dispara uma unica vez.
  result={...result,movements:[{date:'20261031',description:'Petição juntada',code:'2',linkedDocumentIds:[]},...result.movements]};
  now += 25*60*60*1000;await send('pageOpened');assert.equal(checks,4);assert.equal(emails,1);
  assert.equal(lastItems[0].description,'Petição juntada');
  await send('pageOpened');assert.equal(checks,4);assert.equal(emails,1);
  // Acoes manuais independem do bloqueio diario.
  await send('check');assert.equal(checks,5);assert.equal(emails,1);
  assert.equal(typeof onAlarm,'function');
});
