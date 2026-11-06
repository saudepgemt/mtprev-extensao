'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function getRules(){const context=vm.createContext({});vm.runInContext(read('js/shared/mtprev_triage_rules.js'),context);return context.MTPrevTriageRules;}

test('equipe da triagem vem do PDF MTPrev, não da CDSP',()=>{
  const R=getRules();
  assert.equal(R.team.length,10);
  assert.ok(R.team.some(p=>p.name==='Luma Grabriela Nascimento'&&p.procuradores==='Miyoshi'));
  assert.ok(R.team.some(p=>p.name==='Maria Fernanda Bezerra Capilé'&&p.procuradores==='Dorigatti'));
  assert.ok(R.team.filter(p=>p.procuradores==='Dorigatti e Miyoshi').length>=7);
  assert.ok(!R.team.some(p=>p.name.includes('Ana Julia')));
  assert.match(R.suggestDistribution({assunto:'Contribuição doente + IR'}).source,/TRIAGEM\.pdf/);
});

test('a lista da triagem não requisita a antiga equipe.xlsx', async()=>{
 const R=getRules();
 const window={MTPrevTriageRules:R};
 const select={querySelectorAll:()=>[
  {value:'',textContent:'Selecione'},
  {value:'user-77',textContent:'Assessor extra cadastrado no SPA',disabled:false}
 ]};
 const document={querySelector:query=>query==='#progress_form_data_ATR007588'?select:null};
 const context=vm.createContext({window,document});
 vm.runInContext(read('js/shared/active_team_database.js'),context);
 const names=await window.SPA_CDSP_TEAM_DATABASE.loadActiveNames();
 assert.ok(names.includes('Luma Grabriela Nascimento'));
 assert.ok(names.includes('Assessor extra cadastrado no SPA'));
 assert.ok(names.length===11);
 assert.ok(!read('js/shared/active_team_database.js').includes('FETCH_TEAM_DB'));
});

test('a classificação exige assessor e valida seu nome no formulário do SPA',()=>{
 const source=read('js/triagem/spa_extension_panel.js');
 assert.match(source,/flowState\.assessor\.trim\(\)/);
 assert.match(source,/chooseSpaSelectWithRetries\(assessor, action\.assessor, true, 3\)/);
 assert.match(source,/selectionWasApplied\(assessor, action\.assessor, true\)/);
 assert.match(read("js/triagem/mtprev_pop_panel.js"),/assuntoTriagem/);
 assert.match(read("js/triagem/mtprev_pop_panel.js"),/textoDesignacao/);
 assert.match(source,/createPanelSection\("Classificar Processo \/ Designar ao assessor", true\)/);
});

test('relatório permite designação manual sem alterar SPA, e Chrome não publica a planilha legada',()=>{
 const source=read('js/triagem/mtprev_pop_panel.js');
 assert.match(source,/Salvar rascunho de designação/);
 assert.match(source,/Outro assessor habilitado no SPA/);
 assert.match(source,/Texto da designação \/ justificativa/);
 assert.match(source,/Copiar texto para o SPA/);
 const files=require('../scripts/runtime-files.js').RUNTIME_FILES;
 assert.ok(!files.includes('data/equipe.xlsx'));
 const manifest=JSON.parse(read('manifest.json'));
 assert.ok(!JSON.stringify(manifest.web_accessible_resources).includes('equipe.xlsx'));
 const background=read('js/background.js');
 assert.match(background,/Setor não informado na tabela TRIAGEM/);
 assert.ok(!background.includes('chrome.runtime.getURL("data/equipe.xlsx")'));
});
