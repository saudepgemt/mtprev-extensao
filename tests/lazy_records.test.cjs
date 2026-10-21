const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function fixture() {
  const scroller={scrollTop:200,scrollLeft:7,scrollHeight:600,clientHeight:100,parentElement:null,dispatchEvent(){}};
  let top=200;
  Object.defineProperty(scroller,'scrollTop',{get:()=>top,set:value=>{top=Math.max(0,Math.min(value,500));}});
  const list={parentElement:scroller,isConnected:true};
  const document={querySelectorAll:selector=>selector==='#procedures-box'?[list]:[],scrollingElement:scroller};
  const context=vm.createContext({URL,Set,Map,Date,Promise,Event,DOMException,setTimeout,clearTimeout,document,
    location:{href:'https://pge.mt.spa.coreplan.com.br/procedures'},getComputedStyle:()=>({overflowY:'auto'}),window:{addEventListener(){}}});
  for(const file of ['spa_selectors.js','spa_adapter.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/shared',file),'utf8'),context);
  return {context,scroller,list,api:context.SpaAdapter};
}
test('scroll reading accumulates recycled rows, preserves different expedientes and restores scroll',async()=>{
  const {api,scroller}=fixture();
  const result=await api.collectLazyRecords({pause:1,timeout:1000,read:()=>[{processNumber:'same-process',rowKey:'same-process',expedienteId:String(Math.floor(scroller.scrollTop/100))}]});
  assert.equal(result.reason,'stable');
  assert.equal(result.records.length,6);
  assert.equal(scroller.scrollTop,200);assert.equal(scroller.scrollLeft,7);
});
test('scroll reading cancels without leaving the page scrolled',async()=>{
  const {api,scroller}=fixture(),controller=new AbortController();
  await assert.rejects(api.collectLazyRecords({pause:1,signal:controller.signal,read:()=>[],onProgress:()=>controller.abort()}),{name:'AbortError'});
  assert.equal(scroller.scrollTop,200);
});
test('unmapped list is reported instead of scrolling arbitrary page',async()=>{
  const {api,context}=fixture();context.document.querySelectorAll=()=>[];
  await assert.rejects(api.collectLazyRecords(),/Caixa não identificada/);
});
test('route change interrupts collecting records from another context',async()=>{
  const {api,context}=fixture();
  await assert.rejects(api.collectLazyRecords({pause:1,read:()=>[],onProgress:()=>{context.location.href+='?changed';}}),/caixa mudou/);
});
