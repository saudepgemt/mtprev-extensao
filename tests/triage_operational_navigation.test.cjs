'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('triagem destaca assunto SPA e navega para designação no processo correto',()=>{
 const panel=read('js/triagem/mtprev_pop_panel.js');
 assert.match(panel,/Assunto informado pelo SPA/);
 assert.match(panel,/Abrir no SPA para designar/);
 assert.match(panel,/Abrir próximo selecionado no SPA/);
 assert.match(panel,/openedForReview/);
 assert.match(panel,/window\.open\(href,'_blank'\)/);
 assert.match(panel,/O relatório é consultivo|O relatório é consultivo/i);
});
test('decisão só abre quando há link PDF identificado, validado e contagem conhecida',()=>{
 const panel=read('js/triagem/mtprev_pop_panel.js');
 const background=read('js/background.js');
 assert.match(panel,/function decisionPdfCandidate/);
 assert.match(panel,/decisao\|sentenca\|acordao/);
 assert.match(panel,/MTPREV_TRIAGE_PDF_PAGE_COUNT/);
 assert.match(panel,/target\.hash = 'page=' \+ pages/);
 assert.match(background,/async function mtprevTriagePdfPageCount/);
 assert.match(background,/new URL\(url\)\.origin!==new URL\(senderUrl\)\.origin/);
 assert.match(background,/const max=32\*1024\*1024/);
});
test('ações operacionais ficam recolhidas sem retirar a classificação efetiva',()=>{
 const source=read('js/triagem/spa_extension_panel.js');
 assert.match(source,/triagemAdvanced\.appendChild\(createTriageClassificationFlow\(\)\)/);
 assert.ok(!source.includes('triagemPage.appendChild(createTriageClassificationFlow())'));
 assert.match(source,/beginTriageClassification/);
 assert.match(source,/chooseSpaSelectWithRetries\(assessor, action\.assessor, true, 3\)/);
});
