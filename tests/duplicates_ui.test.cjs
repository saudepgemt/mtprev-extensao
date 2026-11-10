const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,'../js/triagem/spa_extension_panel.js'),'utf8');
const extract = name => source.match(new RegExp('^  (?:async )?function '+name+'\\(.*?^  }','ms'))[0];

test('duplicate loading ends after failures and the report preserves an actionable error', async()=>{
  for(const name of ['buildDuplicateReport','openDuplicateTabsAllPages']){
    const nodes=Array.from({length:2},()=>({hidden:true,dataset:{},setAttribute(key,value){this[key]=value}})), page={setAttribute(key,value){this[key]=value}};
    let during;
    const context=vm.createContext({
      window:{location:{pathname:'/procedures'}},
      document:{querySelectorAll:selector=>selector.includes('button')?[]:nodes,querySelector:()=>page},
      state:{running:false},guardStart(){context.state.running=true},setStatus(){},log(){},
      normalizeLimit:x=>x,logActionLimit(){},logCustomFilters(){},workspaceDuplicateCacheScope:()=>'',duplicatePreload:null,
      CONFIG:{groupLoadTimeoutMs:100},waitProcessingDone:async()=>{},
      async setPageLength(){during=nodes.every(n=>!n.hidden)&&page['aria-busy']==='true';throw Error('fixture failure')}
    });
    vm.runInContext(extract('setDuplicateLoading')+'\n'+extract(name),context);
    await context[name](false);
    assert.equal(during,true);
    if (name==='buildDuplicateReport') assert.ok(nodes.every(n=>!n.hidden && n.dataset.tone==='error' && n.role==='alert' && n.textContent.includes('fixture failure')));
    else assert.ok(nodes.every(n=>n.hidden));
    assert.equal(page['aria-busy'],'false');
    assert.equal(context.state.running,false);
  }
});

test('report theme follows explicit drawer choice over SPA theme',()=>{
  const shell={dataset:{theme:'light'}};
  const context=vm.createContext({getComputedStyle:()=>({getPropertyValue:()=>''}),document:{querySelector:()=>shell,documentElement:{classList:{contains:()=>true}}}});
  vm.runInContext(extract('isSpaCdspDarkMode')+'\n'+extract('reportTheme'),context);
  assert.equal(context.isSpaCdspDarkMode(),false);
  assert.equal(context.reportTheme().selectBg,'#ffffff');
  shell.dataset.theme='dark';
  assert.equal(context.isSpaCdspDarkMode(),true);
  assert.equal(context.reportTheme().selectBg,'#1f2d3a');
});
