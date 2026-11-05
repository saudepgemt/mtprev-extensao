'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../js/triagem/spa_extension_panel.js'), 'utf8');
const start = source.indexOf('  function findExternalDocumentsHost()');
const end = source.indexOf('  // Transfere a roda do mouse', start);
assert.ok(start >= 0 && end > start);

function functions(document) {
  const context = vm.createContext({ document });
  vm.runInContext(source.slice(start, end) + '\nthis.findHost=findExternalDocumentsHost;this.place=placeExternalDocumentsPanel;', context);
  return context;
}

test('Painel de autos fica dentro da Visão geral, não acima do conteúdo da aba', () => {
  const grid = { tag: 'grid' };
  const overview = { tag: 'overview', querySelector: (selector) => selector.includes('overview-grid') ? grid : null };
  const preview = { querySelector: (selector) => selector === '#workspace-preview-overview' ? overview : null };
  const doc = { querySelector: (selector) => selector.includes('data-procedure-id') ? preview : null };
  assert.equal(functions(doc).findHost(), overview);
});

test('Barra MTPrev é inserida ANTES dos cards e não cria um overlay', () => {
  const panel = { dataset: {}, parentElement: null };
  const overview = {
    firstElementChild: { tag: 'original' },
    firstChild: { tag: 'original' },
    matches: (s) => s === '#workspace-preview-overview',
    insertBefore(element, ref) {
      assert.equal(element, panel);
      assert.equal(ref, this.firstChild);
      panel.parentElement = this;
      this.firstElementChild = element;
      this.firstChild = element;
    }
  };
  const { place } = functions({});
  place(panel, overview);
  assert.equal(panel.parentElement, overview);
  assert.equal(overview.firstElementChild, panel);
  // Sem mutacao repetida, importante para o MutationObserver do SPA.
  overview.insertBefore = () => { throw Error('não deveria mover novamente'); };
  place(panel, overview);
});

test('Barra de autos abre recolhida por padrao e conserva o tema azul petroleo', () => {
  assert.match(source, /OPEN_MINIMIZED_V2/);
  assert.match(source, /storageGet\(EXTERNAL_DOCS_OPEN_MINIMIZED_KEY, "1"\) !== "0"/);
  assert.match(source, /setExternalDocumentsCollapsed\(minimizedMemoryInput.checked\)/);
  assert.match(source, /background: linear-gradient\(100deg, #193a4b, #276077\) !important/);
});

test('O card usa rolagem natural do iframe, sem lista com rolagem própria', () => {
  assert.match(source, /html\.mtprev-autos-in-iframe #spa-cdsp-external-docs-panel \.spa-cdsp-external-docs-list,[\s\S]*?max-height: none !important;[\s\S]*?overflow: visible !important;/);
  assert.match(source, /html\.mtprev-autos-in-iframe #spa-cdsp-external-docs-panel\.spa-cdsp-external-docs-modern\s*\{[^}]*background: #fff !important;/);
  assert.match(source, /html\.mtprev-autos-in-iframe #spa-cdsp-external-docs-panel \.spa-cdsp-external-docs-header\s*\{[^}]*background: #f7f9fc !important;/);
  assert.match(source, /if \(window\.parent !== window\) \{\s*viewer\.addEventListener\("wheel"/);
});
