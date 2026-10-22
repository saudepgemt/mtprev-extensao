const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup({mode = 'scroll', total = 3, startingTop = 200} = {}) {
  let top = startingTop, cards = [], clicks = 0;
  const pager = {dataset:{loadedCount:'1',totalCount:String(total)}};
  const formInputs = [{name:'q',value:'',checked:false}];
  const form = {querySelectorAll:()=>formInputs};
  const scroller = {clientHeight:100,scrollHeight:500,scrollLeft:9,parentElement:null,dispatchEvent(){}};
  const makeCard = id => ({
    isConnected:true,
    getClientRects:()=>[{}],closest:()=>null,
    getAttribute: name => name === 'data-procedure-id' ? String(id) : null,
    querySelectorAll:()=>[],querySelector:()=>null
  });
  const append = id => {
    cards.push(makeCard(id));
    pager.dataset.loadedCount = String(cards.length);
  };
  append(1);
  const button = mode === 'button' ? {
    disabled:false,getClientRects:()=>[{}],isConnected:true,closest:()=>null,
    click(){
      clicks++;
      this.disabled=true;
      setTimeout(()=>{
        append(cards.length+1);
        this.disabled=false;
      }, 8);
    }
  } : null;
  const list = {parentElement:scroller,isConnected:true};
  Object.defineProperty(scroller,'scrollTop',{
    get:()=>top,
    set:value=>{
      top=Math.max(0,Math.min(value,scroller.scrollHeight-scroller.clientHeight));
      if(mode==='scroll' && top>=200 && cards.length===1) setTimeout(()=>append(2),8);
      if(mode==='scroll' && top>=400 && cards.length===2) setTimeout(()=>append(3),8);
      if(mode==='virtual') {
        cards=[makeCard(1 + Math.floor(top/100))];
        pager.dataset.loadedCount=String(total);
      }
    }
  });
  if (mode === 'virtual') {
    scroller.scrollHeight=600;
    pager.dataset.loadedCount=String(total);
    cards=[makeCard(1+Math.floor(top/100))];
  }
  const document = {
    scrollingElement:scroller,
    querySelector:query=>query==='form.workspace-search'?form:null,
    querySelectorAll:query=>({
      '.workspace-process-list':[list],
      '.workspace-process-list .workspace-process-card[data-procedure-id]':cards,
      '.workspace-infinite-scroll[data-loaded-count][data-total-count]':[pager],
      '.workspace-infinite-scroll__button':button && cards.length < total ? [button]:[]
    }[query] || [])
  };
  const location={href:'https://pge.mt.spa.coreplan.com.br/workspace'};
  const context=vm.createContext({URL,Set,Map,Date,Promise,Event,DOMException,setTimeout,clearTimeout,
    document,location,getComputedStyle:()=>({overflowY:'auto',visibility:'visible',display:'block'}),
    window:{addEventListener(){},dispatchEvent(){}}});
  for (const filename of ['spa_selectors.js','spa_adapter.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/shared',filename),'utf8'),context);
  }
  return {api:context.SpaAdapter,scroller,list,formInputs,location,
    getClicks:()=>clicks};
}

test('workspace with automatic lazy scroll collects all cards and restores the scroll',async()=>{
  const {api,scroller}=setup();
  const result=await api.collectWorkspaceRecords({pause:5,idleTimeout:100,timeout:1800});
  assert.equal(result.reason,'complete');
  assert.equal(result.records.length,3);
  assert.equal(scroller.scrollTop,200);
  assert.equal(scroller.scrollLeft,9);
});

test('workspace loads via native More button without losing page state',async()=>{
  const {api,scroller,getClicks}=setup({mode:'button'});
  const result=await api.collectWorkspaceRecords({pause:5,idleTimeout:100,timeout:1500});
  assert.equal(result.reason,'complete');
  assert.equal(result.records.length,3);
  assert.equal(getClicks(),2);
  assert.equal(scroller.scrollTop,200);
});

test('workspace virtual list retains cards removed from the DOM',async()=>{
  const {api,scroller}=setup({mode:'virtual',total:6});
  const result=await api.collectWorkspaceRecords({pause:5,idleTimeout:100,timeout:1500});
  assert.equal(result.reason,'complete');
  assert.deepEqual([...result.records].map(r=>r.rowKey).sort(),['1','2','3','4','5','6']);
  assert.equal(scroller.scrollTop,200);
});

test('workspace cancels collection and restores original position',async()=>{
  const {api,scroller}=setup();
  const abort=new AbortController();
  await assert.rejects(api.collectWorkspaceRecords({pause:5,signal:abort.signal,onProgress:()=>abort.abort()}),{name:'AbortError'});
  assert.equal(scroller.scrollTop,200);
});

test('workspace aborts when filter changes during lazy loading',async()=>{
  const {api,scroller,formInputs}=setup();
  await assert.rejects(api.collectWorkspaceRecords({pause:5,onProgress:()=>{formInputs[0].value='different';}}),/filtros ou a lista mudaram/);
  assert.equal(scroller.scrollTop,200);
});

test('workspace reports partial if SPA total is larger but no more records load',async()=>{
  const {api}=setup({mode:'none',total:3});
  const result=await api.collectWorkspaceRecords({pause:5,idleTimeout:65,timeout:1200});
  assert.equal(result.reason,'partial');
  assert.equal(result.records.length,1);
});
