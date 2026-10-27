const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PDFLib = require('../js/libs/pdf-lib.min.js');
const root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
const panel = source('js/triagem/spa_extension_panel.js');
const background = source('js/background.js');
function extract(text, name, indent = '  ') {
  const match = text.match(new RegExp(`^${indent}(?:async )?function ${name}\\(.*?^${indent}}`, 'ms'));
  assert.ok(match, name);
  return match[0];
}
function coverApi() {
  const context = vm.createContext({ PDFLib });
  vm.runInContext(source('js/shared/pdf_cover.js'), context);
  return context.MTPrevPdfCover;
}

test('capa MTPrev preserva páginas, ordem, acentos e campos longos', async () => {
  const pdf = await PDFLib.PDFDocument.create();
  pdf.addPage([300, 400]);
  pdf.addPage([310, 410]);
  const count = await coverApi().prepend(pdf, [
    { label: 'Número do processo', value: '0000000-00.2026.8.11.0000' },
    { label: 'Parte(s) ativa(s)', value: 'José da Silva · € — 😀' },
    { label: 'Assunto', value: 'Conferência de documentos e informações. '.repeat(180) }
  ]);
  assert.ok(count > 1, 'texto longo continua em novas páginas de capa');
  const loaded = await PDFLib.PDFDocument.load(await pdf.save());
  assert.equal(loaded.getPageCount(), count + 2);
  assert.deepEqual(loaded.getPage(count).getSize(), { width: 300, height: 400 });
  assert.deepEqual(loaded.getPage(count + 1).getSize(), { width: 310, height: 410 });
});

test('capa captura dados do processo e rejeita contexto trocado', () => {
  const context = vm.createContext({
    readCurrentProcedureProcessNumber: () => '0000000-00.2026.8.11.0000',
    readProcedureHeaderValue: label => ({ 'Polo ativo': 'Pessoa de teste', 'Tribunal': 'Não informado' }[label] || '')
  });
  vm.runInContext(extract(panel, 'readExternalCoverFields'), context);
  const fields = context.readExternalCoverFields('00000000020268110000');
  assert.equal(fields.length, 2);
  assert.equal(fields[1].value, 'Pessoa de teste');
  assert.throws(() => context.readExternalCoverFields('outro'), /processo mudou/);
});

test('PDF com capa exige todos os documentos, preservando a união legada sem capa', async () => {
  const sourcePdf = await PDFLib.PDFDocument.create();
  sourcePdf.addPage([300, 400]);
  const bytes = await sourcePdf.save();
  let opened = 0, saved;
  const context = vm.createContext({
    window: { PDFLib, MTPrevPdfCover: coverApi() },
    ensureExternalPdfMergeLibrary: async () => true,
    downloadExternalAutosPdfsForMerge: async () => [{ bytes }, { error: 'Documento indisponível' }],
    updateExternalAutosPdfLoadingPage() {}, sleep: async () => {},
    openExternalAutosMergedPdf(_tab, data) { opened++; saved = data; }
  });
  vm.runInContext(extract(panel, 'mergeExternalAutosPdfs'), context);
  const fields = [{ label: 'Processo', value: 'Teste' }];
  await assert.rejects(context.mergeExternalAutosPdfs({}, [{}, {}], 'Teste', null, fields), /cópia com capa não foi gerada/);
  assert.equal(opened, 0);
  const legacy = await context.mergeExternalAutosPdfs({}, [{}, {}], 'Teste', null);
  assert.equal(legacy.failed.length, 1);
  assert.equal((await PDFLib.PDFDocument.load(saved)).getPageCount(), 1);
  context.downloadExternalAutosPdfsForMerge = async () => [{ bytes }];
  const complete = await context.mergeExternalAutosPdfs({}, [{}], 'Teste', null, fields);
  assert.equal(complete.pages, 2);
  assert.equal((await PDFLib.PDFDocument.load(saved)).getPageCount(), 2);
  await assert.rejects(context.mergeExternalAutosPdfs({}, Array(81).fill({}), 'Teste', null, fields), /80 PDFs/);
});

test('bibliotecas de capa são injetadas no iframe que solicitou os autos', async () => {
  let ready = false;
  const context = vm.createContext({
    cdspGeneralTabId: () => 7,
    CDSP_GENERAL_PDF_LIB_FILE: 'js/libs/pdf-lib.min.js',
    CDSP_GENERAL_PDF_COVER_FILE: 'js/shared/pdf_cover.js',
    cdspGeneralExecuteScript: async ({ target }) => {
      assert.equal(target.frameIds[0], 4);
      return [{ result: { pdfLibReady: ready, coverReady: ready } }];
    },
    chrome: { scripting: { executeScript: async ({ target, files }) => {
      assert.equal(target.frameIds[0], 4);
      assert.ok(files.includes('js/shared/pdf_cover.js'));
      ready = true;
    } } }
  });
  vm.runInContext(extract(background, 'ensurePdfMergeLibrary', ''), context);
  assert.equal((await context.ensurePdfMergeLibrary({ frameId: 4 })).ok, true);
});

function reader(pages) {
  let destroyed = 0;
  const context = vm.createContext({
    Uint8Array, chrome: { runtime: { getURL: x => x, onMessage: { addListener() {} } } },
    pdfjsLib: {
      OPS: { save: 1, restore: 2, transform: 3, paintImageXObject: 4 },
      GlobalWorkerOptions: {},
      getDocument: () => ({ promise: Promise.resolve({
        numPages: pages.length,
        getPage: async n => ({
          view: [0, 0, 600, 800],
          getTextContent: async () => ({ items: [{ str: pages[n - 1].text, transform: [1, 0, 0, 1, 0, 10] }] }),
          getOperatorList: async () => pages[n - 1].image
            ? { fnArray: [1, 3, 4, 2], argsArray: [[], [600, 0, 0, 800, 0, 0], ['image'], []] }
            : { fnArray: [], argsArray: [] },
          cleanup() {}
        }),
        destroy: async () => { destroyed++; }
      }) })
    }
  });
  vm.runInContext(source('js/triagem/offscreen_pdf_reader.js'), context);
  return { search: query => context.MTPrevPdfReader.searchPdfText([37, 80, 68, 70], query, false), destroyed: () => destroyed };
}

test('busca indica página encontrada e libera o PDF após a leitura', async () => {
  const api = reader([{ text: 'Capa do processo' }, { text: 'Decisão sobre aposentadoria' }]);
  const result = await api.search('aposentadoria');
  assert.equal(result.found, true);
  assert.equal(result.page, 2);
  assert.equal(api.destroyed(), 1);
});

test('páginas vazias ou digitalizadas com cabeçalho impedem conclusão negativa', async () => {
  for (const second of [{ text: '' }, { text: 'Cabeçalho selecionável', image: true }]) {
    const result = await reader([{ text: 'Capa do processo' }, second]).search('aposentadoria');
    assert.equal(result.found, false);
    assert.equal(result.inconclusive, true);
    assert.equal(result.incompletePages, 1);
  }
  const result = await reader([{ text: 'Documento totalmente textual' }]).search('ausente');
  assert.equal(result.inconclusive, false);
});

test('limite de páginas deixa a pesquisa inconclusiva', async () => {
  const result = await reader(Array.from({ length: 601 }, () => ({ text: 'Documento' }))).search('ausente');
  assert.equal(result.pagesRead, 600);
  assert.equal(result.totalPages, 601);
  assert.equal(result.inconclusive, true);
});

test('background preserva página e leitura inconclusiva recebidas do leitor', async () => {
  const context = vm.createContext({
    AbortController, setTimeout, clearTimeout, PDF_SCAN_TIMEOUT_MS: 1000,
    getAutosSearchCache: () => null, setAutosSearchCache() {},
    normalizeSearchText: x => x,
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }),
    searchPdfWithOffscreen: async () => ({ found: false, textLength: 100, pagesRead: 2, totalPages: 2, incompletePages: 1, inconclusive: true })
  });
  vm.runInContext(extract(background, 'searchPdfUrlForQuery', ''), context);
  assert.equal((await context.searchPdfUrlForQuery('pdf', 'q', false)).inconclusive, true);
  context.searchPdfWithOffscreen = async () => ({ found: true, page: 2, textLength: 100, pagesRead: 2, totalPages: 3 });
  assert.equal((await context.searchPdfUrlForQuery('pdf', 'q', false)).page, 2);
});

test('autos e andamentos rejeitam redirecionamento e formulário de login', async () => {
  const origin = 'https://pge.mt.spa.coreplan.com.br';
  const url = origin + '/workspace/processes/123/timeline';
  let login = false, parsed = '';
  const context = vm.createContext({
    URL, AbortSignal, window: { location: { origin } },
    DOMParser: class { parseFromString(html) { parsed = html; return { querySelector: () => login }; } },
    parseExternalDocumentLinks: () => ['andamento'],
    fetch: async () => ({ ok: true, url: origin + '/users/sign_in' })
  });
  vm.runInContext(extract(panel, 'fetchExternalDocumentSummary'), context);
  await assert.rejects(context.fetchExternalDocumentSummary(url, 'spaTimeline'), /redirecionou/);
  context.fetch = async () => ({ ok: true, url, text: async () => JSON.stringify({ html: '<article>Andamento</article>' }) });
  assert.equal((await context.fetchExternalDocumentSummary(url, 'spaTimeline'))[0], 'andamento');
  assert.equal(parsed, '<article>Andamento</article>');
  login = true;
  await assert.rejects(context.fetchExternalDocumentSummary(url, 'spaTimeline'), /sessão.*expirou/);
  await assert.rejects(context.fetchExternalDocumentSummary('https://example.org/pdf', 'autos'), /SPA atual/);
});

test('abertura do resultado conserva a página no PDF temporário', async () => {
  const tab = { location: {}, document: { body: { style: {} } } };
  class TestURL extends URL { static createObjectURL() { return 'blob:teste'; } }
  const context = vm.createContext({
    URL: TestURL, Blob, setTimeout() {},
    window: { open: () => tab },
    fetchExternalAutosPdfBytes: async () => new Uint8Array([37, 80, 68, 70, 45])
  });
  vm.runInContext(extract(panel, 'openExternalDocumentPdfAsBlob'), context);
  assert.equal(await context.openExternalDocumentPdfAsBlob({ pdfUrl: 'https://spa.pge.mt.gov.br/a.pdf', searchPage: 3 }), true);
  assert.equal(tab.location.href, 'blob:teste#page=3');
});
