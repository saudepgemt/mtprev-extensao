# Adequação ao POP MTPrev — 2.69

## Fontes e escopo

- `POP_Triagem_MTPrev_SPA.md`: trechos 2.1, 2.1.1, 2.2 e 2.2.1 de setembro/2025.
- `images/Manual de Demandas Judiciais.pdf`: somente Processo Judicial – SPA,
  páginas físicas 10–14 e instruções de trabalho SPA 34–54. O PDF tem 54 páginas.
  As páginas do sistema antigo não fundamentam os novos componentes.

O manual é uma referência operacional fornecida pelo usuário. Os números de prazos,
limites em UPF e destinatários nominais citados nele não viraram automatismos.
Redistribuição, confirmação de análise/prazo, CI, assinatura e protocolo continuam
dependendo das ações humanas nos fluxos existentes.

## Etapa A — Navegação

Cinco entradas radiais: Acompanhamento Especial de Processos no topo e os quatro
módulos existentes. O acompanhamento abre diretamente pelo mesmo painel e pelos
mesmos handlers, mensagens, alarme e chave `CDSP_PROCESS_WATCH_V1`. Nenhuma migração
de processos foi criada. `Voltar ao menu` retorna aos cinco círculos. O botão
auxiliar antigo continua sendo o mesmo controle; não há implementação paralela.

Arquivos: `js/radial_menu.js`, `css/radial_menu.css`, `js/process_watch_panel.js`,
`images/material-rounded/radar.svg`.

## Etapa B — Destinatários no Andamento PJe

As funções compartilhadas distinguem Estado e Fundação com base no destinatário
ou na parte do próprio expediente, nunca pela procuradoria representante ou pelas
partes gerais do processo. Os nomes aceitos inicialmente são os fornecidos no
pedido: Estado de Mato Grosso, Fundação Mato Grosso Previdência e MTPrev, incluindo
a denominação completa com a sigla. Identificadores estruturados disponíveis são
preservados; o classificador aceita mapas explícitos de IDs/aliases, sem inventar
CNPJs nem inferir nomes não documentados.

O resumo identifica a parte intimada em cada prazo e inclui destinatário na chave
de deduplicação. Encerramento manual informado pelo PJe não aparece como prazo em
aberto. Nomes desconhecidos permanecem sem classificação segura.

Arquivos: `js/shared/mtprev_triage_rules.js`, `js/background.js`,
`js/triagem/spa_extension_panel.js`.

## Etapa C — Diagnóstico da Triagem

Nova seção em Triagem com perfil de apoio MTPrev/Saúde, diagnóstico sob comando
expresso e leitura de PDFs opcional. Reaproveita `pieceReportRecord`, as funções
de leitura de colunas/cabeçalhos e o leitor de expedientes do background.

Exibe competência provável/a conferir/não identificada, natureza da ação,
procedimento e etapas do POP, destinatário, assunto, prazo oficial disponível,
indícios prioritários, referência ao relatório comum de duplicados e evidências com sua origem.
As seis categorias do POP são suportadas. Classe processual disponível tem
precedência sobre menções em andamento/documentos. Ambiguidades ficam explícitas.

As orientações SPA do manual aparecem como itens de conferência com página de
origem: redistribuições (p.36), coletivas (p.38/44), tarefas relacionadas a
liminar/contestação e cumprimento de sentença/CI (p.44/46–49), NCOPE (p.44–45).
Não preenche formulários operacionais nem escolhe assessor/procurador.

A revisão humana e a nota ficam em `MTPREV_POP_REVIEWS`, separadas dos dados do SPA.
O diagnóstico cobre **linhas expandidas e visíveis da página com os filtros atuais**
ou a pendência aberta, não todas as páginas da caixa. Não usa distribuição como
data da intimação. Campos ausentes são informados como não identificados.

Arquivos: `js/triagem/mtprev_pop_panel.js`, `js/shared/mtprev_triage_rules.js`,
`js/triagem/spa_extension_panel.js`, `js/background.js`.

## Etapa D — Relatórios de apoio

Desde a versão 2.69, Duplicados usa exclusivamente os comandos antigos
`Abrir Duplicados` e `Relatorio Duplicados`, com os mesmos critérios, filtros,
comparação de PDFs e ações para todas as unidades. Não há seleção Saúde/MTPrev
nessa aba. A conferência separada e seu comparador foram removidos. O diagnóstico
remete a esse relatório único, sem produzir uma classificação paralela de duplicidade.
As regras anteriores, inclusive filtros específicos já existentes, foram preservadas.

Em Peças, grupos para revisão de impugnação ao cumprimento, pauta e coletivas,
com filtro por grupo, inclusive não identificado. Menções históricas e existência
de processo coletivo são **indícios**, nunca prova da providência a elaborar.
As regras definitivas ainda dependem de expedientes de referência da equipe.

## Validação e limites

`tests/run_radial_browser.ps1` executa fixtures locais no Chrome headless:
menu em 350, 390, 450 e 760 px (450 com movimento reduzido) e testes de regras/UI
POP. Os cenários cobrem preservação da lista de acompanhamento, abertura direta,
cinco entradas, foco no painel de acompanhamento, arraste sintético, navegação e destinatários distintos;
exceções, ausência de dados, categorias POP, menções históricas,
revisão local e isolamento por unidade no diagnóstico e grupos prioritários.

Também foram verificadas a sintaxe dos arquivos JS e, com funções reais do código
e dependências simuladas, a marcação de leitura parcial/completa de PDF e a chave
de resumo de prazo para destinatários distintos com mesmo ID de expediente.
Os scripts integrais de background e triagem também são analisados pelo parser
do Chrome em `tests/syntax.browser.html`, sem inicializar o SPA.

Fixtures não comprovam funcionamento no SPA autenticado. Ainda falta validar
os nomes/IDs efetivamente retornados pelo MCP, as colunas/cabeçalhos nas caixas
MTPrev, as notificações do sistema operacional e expedientes positivos/negativos
de impugnação, pauta, coletivas e duplicidade. O manual não substitui esses exemplos.
