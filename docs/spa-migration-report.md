# Modernização incremental da Triagem e Protocolo

Data: 21/10/2026. Fonte operacional: `POP_Triagem_MTPrev_SPA.md` (trecho de setembro/2025) e a implementação existente em `mtprev_triage_rules.js`. O documento parcial não foi tratado como POP integral ou parecer jurídico atualizado.

## Auditoria do fluxo legado e reutilização

| Etapa | Implementação existente e decisão |
| --- | --- |
| Tela atual | Bridge acompanha pathname/search/hash; o módulo reconhece caixa e detalhe. `SpaAdapter.route` complementa a leitura sem substituir os roteadores operacionais |
| Expedientes | `rows`, `groupRows`, `expandGroup`, `rowsByProcess` e DataTables; filtros de data/prazo/origem e seleção de páginas são preservados |
| Dados | `rowInfo`, `rowColumnText`, `pieceReportRecord`, `mtprevPopRecords` e leitores do cabeçalho fornecem os campos. O fallback do adapter é apenas de leitura |
| Ações | `activateScience`, `takeScienceCurrentPage`, `takeSciencePreparedBatch`, `takeScienceAllPages`, `beginTriageClassification`, `beginTriageTaskClosure` e suas continuações permanecem os executores. A UI manual agora pede confirmação antes de entrar nos fluxos sensíveis |
| DOM | Observadores e flags legados de instalação continuam existindo. O adapter tem um observador compartilhado entre assinantes e se libera ao terminar; drawer e workspace são idempotentes ou descartados antes de remontagem |
| Documentos | `classifyPieceRecordsThroughExtension`, payloads de peças, mensagens do bridge, serviço de PDFs/offscreen e diagnóstico POP são reutilizados; consulta documental exige a opção existente marcada pelo usuário |
| Navegação | `MTPrevRadialMenu` permanece o lançador. `showPanel` abre o módulo/opção existente; voltar preserva o conteúdo e o estado. Fechar chama `close` do mesmo radial |
| Acompanhamento | Mantidos alarme, armazenamento, consulta e painel existentes; corrigida somente a fixture para fornecer o validador real do background |
| Outros módulos | Redação, Correção, Coordenação e Ofícios não tiveram executores reescritos. Usam o novo contêiner visual quando abertos pelo radial |

Contratos preservados: `SPA_CDSP_PAGE`, `SPA_CDSP_EXTENSION_BRIDGE`, `TRIAGEM_ALLOWED_TYPES`, tipos de mensagens existentes e suas validações de origem. Mantidas chaves `CDSP_GENERAL_SHELL_*`, `SPA_CDSP_*`, `MTPREV_POP_REVIEWS`, `MTPREV_POP_SUPPORT_UNIT`, `CDSP_PROCESS_WATCH_V1` e pendências de Ofícios/SIGADOC. Não houve migração ou exclusão de dados.

O fluxo de mensagens continua MAIN world → `window.postMessage` com fonte/origem verificadas → bridge isolado → `chrome.runtime.sendMessage` → service worker → resposta ao mesmo contrato. O serviço de documentos/PJe permanece onde estava; nenhuma API, endpoint, credencial ou payload operacional foi acrescentado para o Coreplan.

## Alterações implementadas

- Registro `js/shared/spa_selectors.js` e camada `js/shared/spa_adapter.js`, carregados antes do bridge no isolated world e antes da Triagem no MAIN world. Os dois domínios SPA permanecem autorizados. O registro distingue evidência de fonte legada e validação autenticada pendente.
- `js/spa_inspector.js`: diálogo somente de leitura, acessível por **Inspecionar** no drawer. Relatório técnico sem textos, credenciais ou dados de processos. Não contorna autenticação nem captura rede.
- `js/drawer.js` e `css/drawer.css`: contêiner lateral com cabeçalho fixo, voltar, minimizar original, fechar, tema claro/escuro e redimensionamento por pointer/teclado. Largura (`MTPREV_DRAWER_WIDTH`) e tema (`MTPREV_UI_THEME`) persistem por origem. Só o conteúdo rola; o rodapé é informativo, não inventa ações. O radial continua móvel e não permanece como área operacional.
- `js/triagem/triage_workspace.js`: busca por processo/expediente, origem, situação, data e prazo informado, chips removíveis, contagem e seleção por identidade. A seleção do diagnóstico é preservada quando os dados carregados são atualizados. Não tenta coletar linhas virtualizadas ou outras páginas escondidas.
- **Escopo deliberadamente explícito:** a nova busca e seleção são para leitura/diagnóstico. Os filtros e lotes nativos/legados ainda controlam as operações. Eles não foram ligados silenciosamente à busca local, pois isso poderia dar falsa impressão de que expedientes de outras páginas foram excluídos de uma operação.
- Quantidade passa a ser apresentada como **Sem limite**, mantendo a interpretação interna anterior de vazio/zero. Limites existentes por processo e lote não foram alterados.
- O diagnóstico agora agrupa **Dados identificados**, **Conferências**, **Pendências** e **Orientações**. Os fatos vêm dos campos coletados; competência/natureza/procedimento e recomendações continuam explicitamente sujeitos à conferência humana. A origem e o acesso aos documentos existentes permanecem disponíveis.
- Ciência manual, classificação/designação e sugestão de encerramento recebem confirmação dos alvos e parâmetros. Cancelar não entra no executor. A confirmação de ciência é por expediente efetivamente alcançado, evitando apresentar uma lista incompleta como se fosse todo o lote. Reforços do executor legado continuam restritos ao registro já autorizado. Rotinas programadas previamente configuradas não são disparadas pelo diagnóstico e mantêm seu fluxo existente.
- A invalidação de contexto fecha confirmações pendentes e libera o adapter. Dados jurídicos não são acrescentados a logs de diagnóstico; relatórios técnicos omitem textos e valores.

## Arquivos e testes

Novos arquivos de produção: `js/shared/spa_selectors.js`, `js/shared/spa_adapter.js`, `js/spa_inspector.js`, `js/drawer.js`, `js/triagem/triage_workspace.js`, `css/drawer.css`. Integração pontual: manifest, background, bridge, radial, painel de Triagem e painel de apoio POP. O mapa está em `docs/spa-dom-map.md`.

Comandos locais:

```powershell
node --test tests/spa_hosts.test.cjs tests/spa_adapter.test.cjs tests/process_watch.test.cjs
./tests/run_radial_browser.ps1 -Cases @(350,390,450,900,901,902,903)
```

- **19 testes Node passaram:** rotas dos dois domínios, segurança de hosts, seleção de abas, extração de links, acompanhamento, filtros puros, contratos de mensagens, sintaxe e confirmação antes do executor legado de ciência.
- **Fixtures de navegador passaram:** radial em 350/390/450px, retorno entre módulos, arraste sintético, persistência e idempotência; POP e grupos prioritários; parser dos scripts integrais; adapter/espera/DOM/paginação montada/seleção/drawer/inspetor; integração dos scripts reais da Triagem com rede bloqueada, diagnóstico e ausência de overflow nas três larguras.
- O teste de adapter cobre cancelamento de confirmação e alvo alterado; não pratica atos reais. Os eventos de pointer e teclado são simulados. A fixture de integração usa tabela e identificadores anônimos; jQuery ausente exercita o fallback de leitura, sem afirmar que o protocolo funciona sem DataTables.
- Inspeção visual em captura local da Triagem: drawer claro, logo única, controles e filtros legíveis, conteúdo com rolagem e rodapé fixo. Contraste do título e da indicação de filtros foi ajustado após essa revisão.

## Confirmado, pendente e não verificado

**Confirmado localmente:** arquivos carregados, parser, rotas, proteção de domínio, registro de seletores, leitura por cabeçalhos, espera cancelável, montagem/remontagem anônima, seleção, preferências visuais, drawer, radial e integração do diagnóstico. Os testes e screenshots não são sessões instaladas no SPA autenticado.

**Pendente de evidência:** seletores e campos reais do Coreplan, jQuery/DataTables da aplicação, IDs de etapas/usuários, filtros nativos, listas virtualizadas, lazy loading, menus/modais reais e respostas de rede autorizadas. A infraestrutura informa essa lacuna; nenhum ID novo foi inventado. Não há integração genérica para API, iframe remoto ou shadow root fechado.

**Não executado:** ciência, protocolo, designação, encaminhamento, encerramento, relatórios com dados reais, assinatura e tramitação SIGADOC. Não houve escrita em expedientes reais nem sessão autenticada acessível. Os fluxos legados foram preservados por código e regressão simulada, não declarados homologados no Coreplan.

## Roteiro supervisionado

1. Recarregue a extensão e as abas dos dois SPAs. Confira que não há cópia antiga carregada. Preferências `localStorage` são separadas por domínio.
2. Pelo radial, abra Triagem e uma opção. Confira título, voltar, minimizar, fechar e persistência de tema/largura, inclusive pelas setas do separador.
3. Na caixa carregada, use **Inspecionar** e registre evidência técnica em cada rota; atualize após paginação e montagem de modal. Não exporte HAR, tokens ou dados sigilosos.
4. Expanda grupos pelo SPA; compare os identificadores com a lista de leitura e teste busca/chips/seleção. Confirme que a UI informa o escopo da página e que filtros operacionais não são confundidos com filtros do diagnóstico.
5. Gere diagnóstico sem consultar documentos; depois marque a opção documental se autorizado. Confira fontes, ausências, ambiguidades e orientações do POP. O simples diagnóstico não pode alterar o SPA.
6. Em homologação autorizada ou teste supervisionado, selecione um expediente conhecido e cancele a confirmação de ciência/classificação/encerramento. Verifique ausência de efeito. Só depois homologue uma operação individual confirmada, conferindo resultado no próprio SPA.
7. Percorra outras telas sem recarregar, volte ao radial e verifique registros atuais, ausência de botões duplicados e comportamento após invalidar/recarregar a extensão. Abas antigas precisam ser atualizadas; não há recuperação fictícia de contexto.
