'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'..');
const radial=fs.readFileSync(path.join(base,'js/radial_menu.js'),'utf8');
const css=fs.readFileSync(path.join(base,'css/radial_menu.css'),'utf8');
const bridge=fs.readFileSync(path.join(base,'js/iframe_autos_bridge.js'),'utf8');

function snippet(start,end) {
  const a=radial.indexOf(start),b=radial.indexOf(end,a+start.length);
  assert.ok(a>=0 && b>a,`${start} encontrado`);
  return radial.slice(a,b);
}

test('Resumo compacto mantém os campos principais e troca tipo/distribuição por recebido/observação',()=>{
  const fields=snippet('  const visibleFields = new Map([','  const style = document.createElement');
  assert.match(fields,/\['numero do processo', 1\]/);
  assert.match(fields,/\['parte s ativa s', 2\]/);
  assert.match(fields,/\['assunto principal', 3\]/);
  assert.match(fields,/\['id do expediente', 4\]/);
  assert.match(fields,/\['recebido', 5\]/);
  assert.match(fields,/\['observacao', 6\]/);
  assert.doesNotMatch(fields,/tipo de expediente|data da distribuicao/);
});

test('Campo recebido é extraído do SPA e não inventa data a partir de andamento',()=>{
  const code=snippet('  const ensureReceiptField = card => {','  const enhanceCard = card => {');
  assert.match(code,/workspace-process-card__received strong/);
  assert.match(code,/raw/);
  assert.match(code,/if \(!raw\) \{ existing\?\.remove\(\); return; \}/);
  assert.doesNotMatch(code,/Date\.now\(|timeline|31\/08\/2025/);
  assert.match(code,/node\.getAttribute\(attribute\)/);
  assert.match(code,/textContent = exactDate \|\| raw/);
  assert.match(radial,/dataset.mtprevReceivedField = '1'/);
});

test('Filtros usam containers estáveis documentados no HTML do SPA',()=>{
  for (const id of ['workspace-process-type-filter','workspace-deadline-type-filter','workspace-marker-filter','workspace-process-organizer']) {
    assert.ok(radial.includes(id),id);
    assert.ok(css.includes('#'+id),id);
  }
  assert.match(radial,/const NATIVE_IDS = \{/);
  assert.match(radial,/const outsideSidebar = Array\.from\(candidates\)\.find/);
  assert.match(radial,/const fresh=control && NATIVE_IDS\[def\.key\]/);
  assert.match(radial,/control !== entry\?\.node/);
});

test('Filtros são sticky com limite de altura e recuam ao fluxo normal no celular',()=>{
  assert.match(css,/\.workspace-navigation\s*\{\s*position:sticky !important/);
  assert.match(css,/max-height:calc\(100dvh - 82px\)/);
  assert.match(css,/overflow-y:auto !important/);
  assert.match(css,/@media\(max-width:850px\)/);
  assert.match(css,/position:relative !important;top:auto !important/);
});

test('Paleta alternada e contornos reforçados sem conflito com o hover',()=>{
  assert.match(radial,/nth-of-type\(even\)/);
  assert.match(radial,/--mtprev-card-bg:#eaf3f8/);
  assert.match(radial,/background:var\(--mtprev-card-bg\) !important/);
  assert.match(radial,/border-left:4px solid #668ba5 !important/);
  assert.match(radial,/:hover,:focus-within/);
  assert.doesNotMatch(bridge,/border-left:5px solid #4f7293/);
  assert.doesNotMatch(bridge,/background:#ffffff !important;\s*border-radius:0 !important/);
});

test('Reinicializa cards após atualização por fluxo/busca sem duplicar botões',()=>{
  assert.match(radial,/const results = document\.getElementById\('workspace-process-results'\)/);
  assert.match(radial,/new MutationObserver\(records => \{[\s\S]*?observe\(document\.documentElement,\{childList:true,subtree:true\}\)/);
  assert.match(radial,/if \(!card\.dataset\.mtprevWorkspaceReady\) enhanceCard\(card\)/);
  assert.match(radial,/else ensureReceiptField\(card\)/);
});

test('Filtros nativos abrem suas listas dentro da lateral sem popovers',()=>{
  assert.match(radial,/function revealNativeOptions\(node,def\)/);
  assert.match(radial,/details\.open = true/);
  assert.match(radial,/revealNativeOptions\(node,def\)/);
  assert.match(css,/\.mtprev-filter-inline/);
  assert.match(css,/\.workspace-organizer__options/);
  assert.match(css,/position:static !important/);
  assert.match(css,/height:calc\(100dvh - 78px\) !important/);
});
