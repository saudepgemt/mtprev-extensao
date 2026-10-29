'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../js/triagem/spa_extension_panel.js'), 'utf8');
const start = source.indexOf('  function chainExternalAutosWheelAtBoundary(');
const end = source.indexOf('  function injectExternalDocumentsStyles()', start);
assert.ok(start >= 0 && end > start, 'A rotina de rolagem deve existir.');
const listenerSource = source.slice(start, end);

class MockElement {
  constructor({ top = 0, height = 100, full = 500, overflow = 'auto', parent = null, doc = null } = {}) {
    this.scrollTop = top;
    this.clientHeight = height;
    this.scrollHeight = full;
    this.overflow = overflow;
    this.parentElement = parent;
    this.ownerDocument = doc;
    this.scrolls = 0;
  }
  closest() { return this.scroller || this; }
  scrollBy({ top }) { this.scrolls += 1; this.scrollTop = Math.min(Math.max(this.scrollTop + top, 0), this.scrollHeight - this.clientHeight); }
}

function setup({ listTop = 400, iframeTop = 100, parentTop = 100, ctrlKey = false } = {}) {
  const localDoc = { defaultView: { getComputedStyle: (node) => ({ overflowY: node.overflow }) } };
  const outerDoc = { defaultView: { getComputedStyle: (node) => ({ overflowY: node.overflow }) } };
  const localRoot = new MockElement({ top: iframeTop, doc: localDoc });
  localDoc.scrollingElement = localRoot;
  const outerRoot = new MockElement({ top: 0, doc: outerDoc });
  outerDoc.scrollingElement = outerRoot;
  const parentScroll = new MockElement({ top: parentTop, doc: outerDoc, parent: outerRoot });
  const frame = new MockElement({ parent: parentScroll, doc: outerDoc });
  const list = new MockElement({ top: listTop, doc: localDoc });
  const viewer = { contains: (node) => node === list };
  const window = { parent: {}, frameElement: frame, innerHeight: 600 };
  const context = vm.createContext({ Element: MockElement, window, document: localDoc });
  vm.runInContext(listenerSource + '\nthis.scrollWheel = chainExternalAutosWheelAtBoundary;', context);
  const event = { target: list, deltaY: 60, deltaMode: 0, ctrlKey, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; } };
  return { list, localRoot, parentScroll, event, viewer, scrollWheel: context.scrollWheel };
}

test('Rolagem interna continua dentro da lista enquanto há documentos abaixo', () => {
  const t = setup({ listTop: 120 });
  t.scrollWheel(t.event, t.viewer);
  assert.equal(t.event.defaultPrevented, false);
  assert.equal(t.localRoot.scrolls, 0);
  assert.equal(t.parentScroll.scrolls, 0);
});

test('No fim da lista, rola primeiro o próprio iframe do processo', () => {
  const t = setup({ listTop: 400, iframeTop: 100 });
  t.scrollWheel(t.event, t.viewer);
  assert.equal(t.event.defaultPrevented, true);
  assert.equal(t.localRoot.scrollTop, 160);
  assert.equal(t.parentScroll.scrolls, 0);
});

test('Somente ao fim do iframe a rolagem passa à janela do SPA', () => {
  const t = setup({ listTop: 400, iframeTop: 400, parentTop: 100 });
  t.scrollWheel(t.event, t.viewer);
  assert.equal(t.event.defaultPrevented, true);
  assert.equal(t.localRoot.scrollTop, 400);
  assert.equal(t.parentScroll.scrollTop, 160);
});

test('Ctrl+roda preserva o zoom do navegador', () => {
  const t = setup({ ctrlKey: true });
  t.scrollWheel(t.event, t.viewer);
  assert.equal(t.event.defaultPrevented, false);
  assert.equal(t.localRoot.scrolls, 0);
  assert.equal(t.parentScroll.scrolls, 0);
});

test('CSS remove o corte apenas no iframe, sem mudar o layout principal', () => {
  assert.match(source, /html\.mtprev-autos-in-iframe #spa-cdsp-external-docs-panel \.spa-cdsp-external-docs-viewer\s*\{[^}]*max-height:\s*none !important;[^}]*overflow:\s*visible !important;/);
  assert.match(source, /window\.parent !== window[\s\S]*?viewer\.addEventListener\("wheel"/);
});

test('Roda para cima ao início da lista retorna ao conteúdo anterior do iframe', () => {
  const t = setup({ listTop: 0, iframeTop: 150 });
  t.event.deltaY = -45;
  t.scrollWheel(t.event, t.viewer);
  assert.equal(t.localRoot.scrollTop, 105);
  assert.equal(t.parentScroll.scrolls, 0);
});

test('Sem outro contêiner rolável, o evento permanece disponível ao navegador', () => {
  const t = setup({ listTop: 400, iframeTop: 400, parentTop: 400 });
  t.parentScroll.parentElement.scrollTop = 400; // Também no limite da janela externa.
  t.scrollWheel(t.event, t.viewer);
  assert.equal(t.event.defaultPrevented, false);
});
