'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname,'../js/shared/mtprev_triage_rules.js'),'utf8');
const context = vm.createContext({});
vm.runInContext(code, context);
const { suggestDistribution, diagnose } = context.MTPrevTriageRules;
const suggest = (assunto, manifestationSuggested = '') => suggestDistribution({assunto, manifestationSuggested});
const names = result => [...result.candidates].flatMap(item => [...item.assessores].map(person => person.name));
const contains = (result, token) => names(result).some(name => name.includes(token));

test('execução individual → Ney', () => {
  const result = suggest('Execução individual de sentença');
  assert.ok(contains(result,'Ney Geraldo'));
  assert.ok(!contains(result,'Victor Gabriel'));
});
test('execução coletiva sem recurso → Victor', () => {
  const result = suggest('Execuções coletivas');
  assert.ok(contains(result,'Victor Gabriel'));
  assert.ok(!contains(result,'Ney Geraldo'));
});
test('recurso de execução coletiva → Ney, não Victor', () => {
  const result = suggest('Recursos de execuções coletivas', 'Recurso');
  assert.ok(contains(result,'Ney Geraldo'));
  assert.ok(!contains(result,'Victor Gabriel'));
});
test('execução de honorários → Ana Clara', () => {
  const result = suggest('Execução de honorários');
  assert.ok(contains(result,'Ana Clara'));
  assert.ok(!contains(result,'Ney Geraldo'));
});
test('pensão por morte usual → Gabrielle', () => {
  const result = suggest('Pensão por morte');
  assert.ok(contains(result,'Gabrielle'));
  assert.ok(!contains(result,'Maria Fernanda'));
});
test('pensão por morte ligada à vida funcional → Maria e Ana Julia', () => {
  const result = suggest('Pensão por morte - vida funcional do instituidor');
  assert.ok(contains(result,'Maria Fernanda'));
  assert.ok(contains(result,'Ana Julia'));
  assert.ok(!contains(result,'Gabrielle'));
  const c = result.candidates.find(item=>item.id==='pensao_vida_funcional');
  assert.deepEqual([...c.assessores].map(p=>p.procuradores),['Diego','Lucas']);
});
test('contribuição não doente recurso → Gabrielle', () => {
  const result=suggest('Contribuição não doente - civil','Recurso ordinário');
  assert.ok(contains(result,'Gabrielle'));
  assert.ok(!contains(result,'Yuri'));
});
test('contribuição não doente sem recurso → Yuri', () => {
  const result=suggest('Contribuição não doente - militar');
  assert.ok(contains(result,'Yuri'));
  assert.ok(!contains(result,'Gabrielle'));
});
test('contribuição doente + IR → Maria e Ana Julia, não Clarissa automática', () => {
  const result=suggest('Contribuição doente + IR');
  assert.ok(contains(result,'Maria Fernanda'));
  assert.ok(contains(result,'Ana Julia'));
  assert.ok(!contains(result,'Clarissa'));
});
test('imposto de renda → Clarissa', () => {
  const result=suggest('Imposto de Renda');
  assert.ok(contains(result,'Clarissa'));
});
test('aposentadoria → responsáveis compartilhadas', () => {
  const result=suggest('Aposentadoria');
  assert.ok(contains(result,'Maria Fernanda'));
  assert.ok(contains(result,'Ana Julia'));
  assert.ok(result.notes.some(n=>n.includes('não define critério')));
});
test('mandado de segurança → Yuri', () => {
  const result=suggest('Mandado de segurança');
  assert.ok(contains(result,'Yuri'));
});
test('contrarrazões → Yuri', () => {
  const result=suggest('Contribuição não doente','Contrarrazões');
  assert.ok(contains(result,'Yuri'));
});
test('confirmar pauta de julgamento → Ana Clara', () => {
  const result=suggest('Pauta de julgamento','Confirmar pauta de julgamento');
  assert.ok(contains(result,'Ana Clara'));
});
test('comprovante de cumprimento de ordem judicial → Thais', () => {
  const result=suggest('Intimação', 'Juntada de comprovante de cumprimento de ordem judicial');
  assert.ok(contains(result,'Thais'));
});
test('assunto sem modalidade de execução não escolhe Ney ou Victor', () => {
  const result=suggest('Execução');
  assert.ok(!contains(result,'Ney Geraldo'));
  assert.ok(!contains(result,'Victor Gabriel'));
  assert.ok(result.notes.some(n=>n.includes('sem indicação confiável')));
});
test('texto documental sozinho não atribui assessor', () => {
  const result=suggestDistribution({},'Mandado de segurança e contribuição doente mencionados em PDF histórico');
  assert.equal(result.candidates.length,0);
  assert.ok(result.requiresHumanReview);
  assert.equal(result.writesToSpa,false);
});
test('triagem genérica mostra ressalva, sem escolher entre Diego, Ana Clara e Thais', () => {
  const result=suggest('', 'Triagem');
  assert.equal(result.candidates.length,0);
  assert.ok(result.notes.some(n=>n.includes('Diego Metello')));
});
test('diagnóstico integra sugestões de distribuição sem alterar campos existentes', () => {
  const d=diagnose({assunto:'Execuções coletivas'});
  assert.ok(d.distribution);
  assert.ok(contains(d.distribution,'Victor Gabriel'));
  assert.equal(typeof d.competence,'string');
  assert.equal(d.distribution.writesToSpa,false);
});
