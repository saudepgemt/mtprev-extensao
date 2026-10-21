# Mapa de integração SPA · MTPrev

Data: 21/10/2026. Escopo: código do projeto, fixtures anônimas e inspetor de leitura. **Não houve observação do SPA autenticado nesta sessão.** Seletores encontrados no código legado não são classificados como confirmados no Coreplan.

## Registro e evidência

O registro executável está em `js/shared/spa_selectors.js`, agrupado por módulo. Cada entrada informa descrição, alternativas em ordem, origem e estado da validação Coreplan. `SpaAdapter.locate()` retorna o seletor efetivamente encontrado, sem XPath. `SpaAdapter.inspect()` distingue `matched-in-current-dom` e `not-observed`; uma correspondência em fixture não transforma um seletor em integração autenticada confirmada.

| Módulo/tela | Elemento e origem no legado | Estado testado / uso |
| --- | --- | --- |
| Caixa | `#procedures-box` | Tabela renderizada na fixture; não implica suporte a toda lista virtualizada |
| Triagem | `#procedures-box tbody tr.group-item` | Linhas carregadas, visíveis e conectadas; grupos ainda fechados ficam fora da leitura |
| Campos | `thead th[data-name]`, fallback `thead th` | Nomes normalizados e relação pelo cabeçalho da mesma tabela; não depende de índice fixo |
| Ciência | `form.take-consciousness-btn button`, `button.take-consciousness-btn`, `a.take-consciousness-btn` | Seletores retirados do legado; ação real não executada |
| Paginação | `#procedures-box_paginate` | Montagem assíncrona testada; navegação real continua com DataTables legado |
| Carregamento | `#procedures-box_processing`, `[aria-busy=true]` dentro da tabela | Leitura de estado visível; espera cancela por timeout/AbortSignal |
| Processo | `#main-procedure` | Contrato legado; conferir em sessão autenticada |
| Documento | `a[href*='/coresigner/info/']` | Leitor/PDF existente; URL validada pelos hosts autorizados |
| Protocolo | `a[href*='/procedures/massive/']` | Links reais são preferidos. IDs não são inventados para o Coreplan |
| Redação | `#spa-cdsp-deadline-panel` | Elemento da extensão, não do SPA |
| Coordenação | `#spa-cdsp-management-panel` | Elemento da extensão, não do SPA |
| Ofícios | `#spa-extrator-btn` | Elemento da extensão; automação SIGADOC não foi alterada |

Rotas reconhecidas em ambos os domínios HTTPS autorizados: workspace do procurador `/workspace`, caixa `/procedures`, processo `/procedures/:id`, pasta `/procedures/:id/folder`, passo em massa `/procedures/massive/:id`. Outras rotas permanecem `other`; não são inventados novos endpoints. Hosts semelhantes ou não autorizados são recusados.

O caminho `/workspace` foi informado pelo usuário no Coreplan. Parâmetros de consulta (incluindo o identificador do usuário) não são exportados. O relatório fornecido não encontrou seletores de caixa, linhas ou ações nessa tela; reconhecer a rota não valida seus controles nem autoriza reutilizar seletores de outra página.

HTML posterior fornecido pelo usuário confirmou o painel `.workspace-preview__document[data-procedure-id]`, seus campos `.workspace-preview__field` (rótulo `small`, valor `data-copy-value` ou `strong`) e o botão de relacionamento `[data-workspace-relationship-tab="pending_notice"][data-url]`. Esses elementos estão no inspetor sob `workspace`, com origem `user-provided-workspace-preview`; a flag conservadora de validação autenticada permanece. A leitura identifica somente o processo/expediente dos detalhes. A quantidade no botão de relacionamento não representa itens efetivamente lidos e não gera registros artificiais. Não foi copiado conteúdo pessoal para fixtures.

O anexo de script contém utilitários gerais e bibliotecas da interface, sem o carregador específico da lista do workspace. Os cards e o contêiner da lista principal, além do HTML do relacionamento após carregamento, ainda são necessários. Sem caixa reconhecida, o relatório nessa rota informa essa limitação antes de executar rotinas legadas de paginação, em vez de apresentar uma conclusão vazia sobre duplicidade.

### Leitura por rolagem

Em Triagem, `Carregar expedientes por rolagem` percorre a área rolável ancestral da caixa reconhecida (`#procedures-box`), coleta registros a cada avanço e restaura a posição original. Acumula por processo e ID do expediente, inclusive quando linhas são recicladas. A coleta termina após cinco verificações no final sem crescimento e sem indicador de carregamento, ou após 60 segundos. Estabilidade não comprova que o servidor entregou o total: o usuário deve conferir a quantidade informada pelo SPA. Não percorre paginação nem expande grupos automaticamente. Se a caixa não for reconhecida, informa isso sem rolar outra área arbitrariamente.

Há cancelamento; mudança de rota/caixa interrompe a coleta. Mudanças de filtros e paginação limpam a acumulação de leitura. A acumulação atende ao diagnóstico e não altera os executores de ações, os filtros da caixa ou os processos. Em Duplicados, o formulário inicial de apoio fica oculto; data, quantidade, filtros ativos e botões operacionais permanecem.

Validação local: testes de linhas recicladas, identidade de expedientes, cancelamento, mudança de rota e caixa ausente; fixtures de navegador para seleção, temas e ocultação do formulário. Lazy loading do SPA autenticado ainda exige conferência no ambiente real.

## Relações e campos

O fluxo operacional continua usando `rowInfo`, `rowColumnText`, `findColumnIndex`, `pieceReportRecord` e `mtprevPopRecords` do legado. As colunas disponíveis fornecem processo, expediente, assunto, classe, destinatário, partes, prazo e data. Distribuição não é tratada como data de intimação. Campos ausentes não são completados por hipótese.

`SpaAdapter.field()` é uma leitura contextual alternativa de cabeçalhos da mesma tabela. O fallback de diagnóstico, quando jQuery não estiver disponível, usa `SpaAdapter.records()`. **Esse fallback não habilita protocolo, ciência ou preenchimento em uma interface desconhecida.** Destinatário desconhecido continua desconhecido; partes do processo e procuradoria não substituem a parte intimada.

Ainda precisam de evidência autenticada: nomes e atributos dos filtros nativos Coreplan, subprocuradoria, unidade responsável, assessor/procurador, último andamento, botões de designação/encaminhamento, menus e formulários específicos. Não foram criados IDs fictícios para esses elementos. Opções de designação e etapas fixas do legado precisam ser conferidas antes de uso real.

## Atualização e espera

O adapter mantém um MutationObserver compartilhado por contexto, ativo apenas enquanto há assinantes. As notificações são agrupadas em 100ms. Ignora mudanças internas da extensão e observa montagem, classes, visibilidade, estilo e carregamento. O último assinante libera observador e listeners. `waitFor()` usa a mesma infraestrutura, com timeout e cancelamento.

Mudanças de rota usam `popstate`, `hashchange` e o evento local `mtprev-spa-routechange` emitido pelo watcher já existente no bridge. Não foi criado outro intervalo de polling. Isolated world e MAIN world têm instâncias separadas do adapter; não compartilham objetos JavaScript. A comunicação operacional continua passando pelo bridge.

Lazy loading, rolagem virtualizada, iframes autenticados e Shadow DOM fechado **não foram observados**. O inspetor informa essa limitação; conta iframes, hosts com shadow root aberto e diálogos sem tentar atravessar origens, abrir listas ocultas ou exportar conteúdo. XPath não foi necessário nem acrescentado.

## Coleta autenticada, sem escrita

1. Recarregue a extensão e a aba do SPA. Abra um módulo pelo radial e uma opção para entrar no drawer.
2. Use **Inspecionar → Atualizar evidência** em cada tela relevante. Navegue pela interface nativa e repita a captura após terminar o carregamento.
3. O relatório inclui rota com IDs numéricos omitidos, contagens, seletor testado, descrição, tipo, estado, ID técnico sanitizado, contexto de linha e estratégia de espera. Nomes acessíveis são exportados somente para uma lista restrita de comandos genéricos; o restante fica `not-exported`.
4. Não são exportados textos dos processos, valores de campos, nomes de partes, cookies, tokens ou documentos. A evidência é um snapshot, não uma prova de execução de ação.
5. Para rede, examine manualmente apenas as requisições que o próprio SPA já executa na aba Network, sem exportar HAR com credenciais ou conteúdo sigiloso. Esta implementação não intercepta `fetch`/XHR e não passa a chamar uma API apenas por ela ter sido vista.
6. Registre diferenças no seletor/atributo e anonimize uma fixture antes de adaptar o registro. Valide leitura antes de testar ações em homologação autorizada ou teste supervisionado.

## Leitura e ação

`SpaAdapter` oferece rota, localização, leitura, filtros puros, inspeção, observação e espera. O namespace `actions` oferece confirmação modal, não um clicador genérico. As ações confirmadas continuam nos executores legados.

Ciência manual mostra cada expediente que será acionado na página/lote efetivamente alcançado. O cancelamento interrompe a sequência; o vínculo com a linha é revalidado antes da ação. Classificação/designação e sugestão de encerramento mostram a pendência e os parâmetros escolhidos. Se o contexto da extensão for invalidado, diálogos pendentes são cancelados e o adapter é liberado. Diagnóstico não chama esses executores.

As rotinas programadas já existentes e previamente configuradas continuam separadas do diagnóstico; esta mudança não as converte em confirmação por expediente. Não houve execução ou validação autenticada dessas rotinas nesta sessão.
