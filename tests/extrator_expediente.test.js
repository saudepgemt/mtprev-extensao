const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'extrator', 'content.js'), 'utf8');

function getFunction(start, end) {
  const first = source.indexOf(`  function ${start}(`);
  const last = source.indexOf(`  function ${end}(`, first);
  assert.ok(first >= 0 && last > first);
  return source.slice(first, last);
}

const context = vm.createContext({
  URL,
  window: { location: { href: 'https://spa.pge.mt.gov.br/' } },
});
vm.runInContext(
  getFunction('normalizarTexto', 'normalizarRotulo') +
  getFunction('encontrarUrlProcessoPrincipalEmRaiz', 'encontrarUrlProcessoPrincipal') +
  getFunction('extrairLinkExpedienteDeDocumentoSpa', 'extrairAssuntoDeDocumentoSpa'),
  context
);

function link(href, title, text = '') {
  const attributes = { href, title };
  return { getAttribute: (name) => attributes[name] || '', textContent: text };
}

test('seleciona o expediente pelo ID mesmo quando outro PDF aparece primeiro', () => {
  const doc = {
    querySelectorAll: () => [
      link('/coresigner/info/oficio.pdf', 'Oficio assinado'),
      link('/coresigner/info/expediente.pdf?procedure_id=123', 'Ler Expediente 52707282'),
      link('/coresigner/info/outra-peca.pdf', 'Expediente 99999999'),
    ],
  };
  assert.equal(
    context.extrairLinkExpedienteDeDocumentoSpa(doc, 'https://spa.pge.mt.gov.br/procedures/123', '52707282'),
    'https://spa.pge.mt.gov.br/coresigner/info/expediente.pdf?procedure_id=123'
  );
});

test('nao escolhe PDF de outro expediente ou sem ID', () => {
  const doc = { querySelectorAll: () => [link('/coresigner/info/outro.pdf', 'Ler Expediente 99999999')] };
  assert.equal(context.extrairLinkExpedienteDeDocumentoSpa(doc, 'https://spa.pge.mt.gov.br/procedures/123', '52707282'), '');
  assert.equal(context.extrairLinkExpedienteDeDocumentoSpa(doc, 'https://spa.pge.mt.gov.br/procedures/123', ''), '');
});

test('rejeita link com rotulo correto fora do SPA', () => {
  const doc = { querySelectorAll: () => [link('https://example.org/coresigner/info/arquivo.pdf', 'Ler Expediente 52707282')] };
  assert.equal(context.extrairLinkExpedienteDeDocumentoSpa(doc, 'https://spa.pge.mt.gov.br/procedures/123', '52707282'), '');
});

test('em new_progress reconhece Voltar para o processo como Processo Principal', () => {
  const root = {
    querySelector: () => null,
    querySelectorAll: () => [link('/procedures/3169590', 'Voltar para o processo')],
  };
  assert.equal(
    context.encontrarUrlProcessoPrincipalEmRaiz(
      root,
      'https://spa.pge.mt.gov.br/procedures/3169590/new_progress/618',
      { processo: '1000000-00.2026.8.11.0000' }
    ),
    'https://spa.pge.mt.gov.br/procedures/3169590'
  );
});

const background = fs.readFileSync(path.join(__dirname, '..', 'js', 'background.js'), 'utf8');
const start = background.indexOf('async function cdspOficiosSalvarExpedienteSpa(');
const end = background.indexOf('function cdspOficiosBaixarArquivo(', start);
assert.ok(start >= 0 && end > start);

function createDownloadContext(body) {
  let stored;
  const sandbox = vm.createContext({
    URL,
    Uint8Array,
    btoa,
    fetch: async (url) => ({
      ok: true,
      url,
      arrayBuffer: async () => Uint8Array.from(Buffer.from(body)).buffer,
    }),
    cdspOficiosSalvarPdfInterno: async (data) => { stored = data; },
  });
  vm.runInContext(background.slice(start, end), sandbox);
  return { sandbox, getStored: () => stored };
}

const download = {
  id: 'arquivo-123',
  url: 'https://spa.pge.mt.gov.br/coresigner/info/expediente.pdf',
  idExpediente: '52707282',
  nomeArquivo: 'Expediente.pdf',
  processo: '123',
};

test('download guarda PDF e origem do expediente', async () => {
  const { sandbox, getStored } = createDownloadContext('%PDF-1.7\nconteudo');
  const result = await sandbox.cdspOficiosSalvarExpedienteSpa(download);
  assert.equal(result.ok, true);
  assert.equal(getStored().metadados.origemUrl, download.url);
  assert.equal(getStored().metadados.idExpedienteSpa, download.idExpediente);
  assert.equal(getStored().metadados.tipo, 'expediente-para-anexo-sigadoc');
});

test('download nao guarda resposta que nao e PDF', async () => {
  const { sandbox, getStored } = createDownloadContext('<html>login</html>');
  await assert.rejects(sandbox.cdspOficiosSalvarExpedienteSpa(download), /PDF valido/);
  assert.equal(getStored(), undefined);
});

test('documento assinado oferece a rota oficial de inclusao', () => {
  const html = fs.readFileSync('D:/Users/PGE-MT/Downloads/SIGA - PGE-OFI-2026_40789.html', 'utf8');
  const match = html.match(/<a\s+id="incluir-documento"[\s\S]*?href="([^"]*criandoAnexo=true[^"]*)"/i);
  assert.ok(match);
  assert.match(match[1], /^\/sigaex\/app\/expediente\/doc\/editar\?mobilPaiSel\.sigla=PGEOFI202640789A&criandoAnexo=true&$/);
  assert.match(source, /document\.getElementById\('incluir-documento'\)/);
  assert.match(source, /await aguardarAberturaInclusaoSigadoc\(\)/);
});
