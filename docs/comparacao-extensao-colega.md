# Comparação e adaptação da extensão CDSP SPA2

Análise em 27/10/2026 do arquivo `extensao-geral-main.zip` (manifesto CDSP 3.0), comparado com a MTPrev 0.0.1. Prioridade escolhida: **autos, PDFs e andamentos**.

## O que foi encontrado

| Recurso do pacote CDSP | Situação na MTPrev e decisão |
| --- | --- |
| Autos, Pasta e Andamento PJe | Já existem, além da fonte Andamentos SPA2. Preservados o painel, as fontes, filtros, seleção, ordenação, pesquisa e serviço configurável da MTPrev. |
| PDFs com capa de dados do processo | Acrescentada opção de capa MTPrev no fluxo de PDF unificado. Usa somente campos disponíveis da pendência atual. Não substitui os links nativos por um novo visualizador. |
| Página da ocorrência na pesquisa | O leitor passa a retornar a página; o botão do resultado abre o PDF nessa página. Busca com vários termos e parada no primeiro resultado permanecem. |
| Tratamento de páginas digitalizadas | A pesquisa sem ocorrência fica inconclusiva quando encontra página sem texto, imagem predominante, falha de inspeção ou limite de páginas. Não há OCR. |
| Validação da resposta de Autos/Pasta | Consulta de resumos e andamentos rejeita redirecionamento para outra rota e formulário de login, evitando apresentar sessão expirada como lista vazia. PDFs abertos pela extensão passam pela verificação do cabeçalho PDF. |
| Prazos do Estado em aba própria | A MTPrev já relaciona expedientes e prazos aos movimentos, incluindo regras próprias para MTPrev. Mantida essa organização; a aba CDSP não foi transplantada. |
| Interceptação de links e downloads nativos para acrescentar capa | Mantida a abertura nativa. A capa é escolhida nos comandos da MTPrev e se aplica à seleção, aos filtros, aos resultados da busca ou ao processo completo em modo unificado. |
| Comparação integral de PDFs em Duplicados SPA2 | Diferença relevante: o pacote CDSP compara o conjunto integral; a MTPrev usa critérios de campos no workspace. Evolução futura de triagem, fora da prioridade escolhida nesta adaptação. |
| Correção, agravo e Ofícios SPA2 | O pacote contém adaptações dos formulários nativos e confirmação de eventos. Exigem comparação própria com as regras MTPrev; não foram transplantados nesta etapa. |
| Aplicativo desktop e orquestrador de Ofícios | Componentes separados da extensão. Não necessários para os recursos de autos escolhidos. |

Referências do ZIP: `src/cover.js`, `src/cover-pdf.js`, `src/cover-viewer.js`, `src/autos.js`, `src/autos-panel.js`, `src/pdf-offscreen.js`, `src/pdf-text.js` e `src/correction.js`. A implementação foi adaptada aos contratos da MTPrev; não foram incorporados painel CDSP, identidade Saúde, arquivo privado de credenciais nem serviço adicional.

## Como usar

1. Na pendência, abra o painel **Documentos do processo** e carregue a fonte desejada.
2. Marque **Incluir capa MTPrev no PDF unificado**.
3. Use **Selecionados**, **Abrir todos** ou **Processo Completo**, escolha **Unificado** e a ordem. Também vale para os resultados de uma pesquisa interna.
4. Para pesquisar, use **Buscar nos PDFs**. Um resultado informa a página e oferece **Abrir na página N**.

A opção de capa inicia desmarcada. Ela não modifica os arquivos do SPA. O resultado é uma cópia de consulta: as assinaturas digitais devem ser conferidas nos originais. Campos ausentes são omitidos; dados longos continuam em páginas adicionais de capa. Caracteres fora da fonte PDF padrão são representados por `?`.

Na cópia com capa, todos os documentos selecionados precisam ser lidos; uma falha impede a geração e o painel oferece a fonte original pelo fluxo já existente. Limites: 80 PDFs, 30 MB por PDF e 120 MB no conjunto. O modo unificado sem capa mantém seu comportamento anterior de informar documentos ignorados. Nenhuma assinatura, ciência ou movimentação processual é executada por estes recursos.

A análise de imagem predominante é conservadora, não um detector de OCR: uma imagem grande pode conter informação não pesquisável mesmo havendo cabeçalho textual. A pesquisa percorre no máximo 600 páginas e informa resultado inconclusivo quando não consegue examinar todo o conteúdo e não encontra o termo.

## Validação local

`tests/autos_features.test.cjs` cobre PDF real com capa, continuidade dos campos, ordem das páginas, rejeição de geração parcial, contexto de processo, injeção no iframe solicitante, página encontrada, páginas digitalizadas, limite de busca, sessão expirada e abertura do resultado.

`python3 tests/firefox_menu.py --autos` exercita os scripts da extensão instalada no Firefox com pendência, andamento e PDF fictícios, incluindo o carregamento sob demanda da biblioteca e a geração da capa. Não acessa sistemas autenticados.

Os testes locais não equivalem à homologação no SPA real. A adaptação conserva a versão 0.0.1 e não publica a extensão nem cria tags.
