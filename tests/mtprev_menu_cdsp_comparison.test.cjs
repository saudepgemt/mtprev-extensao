'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');

test('menu Triagem, Duplicados e Peças usa o painel operacional, não uma cópia do relatório',()=>{
 const operational=read('js/triagem/spa_extension_panel.js');
 const report=read('js/triagem/mtprev_pop_panel.js');
 const radial=read('js/radial_menu.js');
 const background=read('js/background.js');
 assert.match(operational,/window\.SPA_CDSP_EXTENSION_PANEL_INITIALIZED = true/);
 assert.match(operational,/panel\.id = "spa-cdsp-panel"/);
 assert.match(operational,/nav\.classList\.add\("mtprev-context-nav"\)/);
 assert.match(operational,/buildDuplicateReport\(false\)/);
 assert.match(operational,/buildPieceReport\(\)/);
 assert.match(operational,/createMtprevPopSupport\("diagnostic"\)/);
 assert.match(operational,/refreshExternalDocumentsPanel/);
 assert.match(report,/window\.MTPrevPopPanel = Object\.freeze/);
 assert.match(report,/Abrir no SPA para designar/);
 assert.match(report,/function decisionPdfCandidate/);
 assert.match(radial,/\{title:'Duplicados',icon:'content_copy',run:\(\)=>selectShortcut\('triagem','Duplicados',true\)\}/);
 assert.match(background,/Boolean\(window\.SPA_CDSP_EXTENSION_PANEL_INITIALIZED && document\.querySelector\("#spa-cdsp-panel \.mtprev-context-nav > button"\)\)/);
 assert.notEqual(operational.slice(0,50),report.slice(0,50));
});

test('MTPrev mantém o leitor PDF, a pesquisa e a comparação de duplicatas existentes',()=>{
 const worker=read('js/background.js');
 assert.match(worker,/async function searchPdfUrlForQuery/);
 assert.match(worker,/async function extractPdfTextWithPdfJs/);
 assert.match(worker,/async function fingerprintDuplicateReportExpedientes/);
 assert.match(worker,/async function fetchMniProcedureMovements/);
 const offscreen=read('js/triagem/offscreen_pdf_reader.js');
 assert.match(offscreen,/pdfjsLib\.getDocument/);
});

test('integração individual PJe é opt-in e não reaproveita credenciais do outro setor',()=>{
 const worker=read('js/background.js');
 const oauth=read('js/shared/mtprev_pje_individual_oauth.js');
 assert.match(worker,/getMniAccessMode\(\)/);
 assert.match(worker,/return value\[MNI_INDIVIDUAL_MODE_KEY\] === "individual" \? "individual" : "endpoint"/);
 assert.match(worker,/fetchMniRpc\(/);
 assert.match(worker,/MTPREV_PJE_INDIVIDUAL_CONNECT/);
 assert.match(worker,/_sender\.url !== chrome\.runtime\.getURL\("options\.html"\)/);
 assert.match(oauth,/code_challenge_method:'S256'/);
 assert.match(oauth,/launchWebAuthFlow/);
 assert.match(oauth,/mtprev-pje-individual-oauth/);
 assert.doesNotMatch(oauth,/sigadoc-credentials|Yasmim Marques Nascimento|src\/private/);
 assert.match(read('options.html'),/Conexão individual ao PJe pelo MCP/);
 const {RUNTIME_FILES}=require('../scripts/runtime-files.js');
 assert.ok(RUNTIME_FILES.includes('js/shared/mtprev_pje_individual_oauth.js'));
 assert.ok(!RUNTIME_FILES.includes('data/equipe.xlsx'));
});

test('classificação exige assessor e não preenche responsáveis da CDSP',()=>{
 const source=read('js/triagem/spa_extension_panel.js');
 assert.match(source,/if \(!flowState\.assessor\.trim\(\)/);
 assert.match(source,/Se\.lecione um assessor|Selecione um assessor/);
 assert.match(source,/const TRIAGE_DEFAULT_OFFICE_ASSIGNEE = ""/);
 assert.match(source,/const TRIAGE_OFFICE_ASSIGNEES = \[\]/);
 assert.doesNotMatch(source,/Yasmim Marques Nascimento|Beatriz Vitoria Miranda Silva Cerqueira/);
 assert.match(source,/function pieceCategoryNeedsIntern\(_categoryKey\)/);
 const background=read('js/background.js');
 assert.match(background,/const PIECE_INTERNS = Object\.freeze\(\{\}\)/);
 assert.match(background,/needsManualAssignee = true/);
 assert.match(source,/chooseSpaSelectWithRetries\(assessor, action\.assessor, true, 3\)/);
});
