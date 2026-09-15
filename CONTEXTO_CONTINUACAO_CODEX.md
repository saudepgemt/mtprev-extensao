# Contexto para continuar no Codex

Este arquivo serve para retomar o trabalho em outro computador/notebook sem perder o contexto principal desta conversa.

## Repositorio

- GitHub: https://github.com/joaofgomess/extensao-geral.git
- Branch principal: `main`
- Versao atual da extensao: `1.85`
- Ultima tag publicada no repositorio: `v1.85`

## Como retomar no notebook

1. Instalar o Git.
2. Instalar/abrir o Codex ou ChatGPT com Codex.
3. Entrar na mesma conta usada nesta maquina.
4. Clonar o repositorio:

```powershell
git clone https://github.com/joaofgomess/extensao-geral.git
cd extensao-geral
```

5. Pedir ao Codex: "Leia o arquivo CONTEXTO_CONTINUACAO_CODEX.md e continue a partir dele."

## Estado atual da extensao

A extensao unificada se chama `CDSP - Extensao Geral`.

Modulos principais:

- Triagem e Protocolo
- Redacao e Correcao
- Coordenacao
- Oficios
- Ferramenta raiz de busca nos autos processuais
- Integracao MCP/PJe na aba Andamento PJe

## Ultimas alteracoes relevantes

Versao `1.55`:

- A abertura de documentos do Andamento PJe voltou ao modo rapido anterior: abre pelo SPA.
- Foi mantida uma conferencia leve por ID entre o item aberto no SPA e o ID retornado pelo Andamento PJe/MCP.
- Essa conferencia nao baixa documento pelo PJe antes de abrir, para nao prejudicar o tempo.
- Na tabela do Cadastrar Agravo:
  - a primeira coluna ficou sem preenchimento azul;
  - o rotulo ficou `Agravado`;
  - o texto `e Outros` passou para a segunda coluna, apos o nome preenchido.
- As regras em `GUIA_DE_UPDATES.txt` e `README_CARREGAR.txt` foram atualizadas para evitar regressao.

Versao `1.56`:

- O SIGADOC passou a ter menu compacto proprio, separado do menu geral do SPA.
- O menu do SIGADOC concentra as funcoes do Extrator: `Preencher SIGADOC`, `Preencher + Assinar` quando a tela permitir, e automacao da lista de processos.
- Na lista de documentos do SIGADOC, o botao `Visitar lista` abre cada link `PGE-OFI-...`, aguarda brevemente e volta pelo historico do navegador para continuar o proximo item.
- A automacao da lista usa `sessionStorage` por aba e possui botao `Parar`.

Versao `1.57`:

- O Fluxo de Correcao passou a ter filtro `Recebido`.
- No filtro `Recebido`, valores do mesmo dia exibidos pelo SPA como minuto(s), hora(s) ou segundo(s) sao agrupados em uma unica opcao `Hoje`.
- Os demais valores da coluna `Recebido`, como dias, continuam aparecendo como opcoes proprias.
- A base interna `data/equipe.xlsx` foi atualizada na pasta da versao `1.57` e deve ser preservada como base oficial nos proximos updates.

Versao `1.58`:

- No modulo Redacao e Correcao, o botao `Cadastrar Agravo` passou a ter um botao pequeno `Copiar` associado visualmente, para recopia da ultima tabela de agravo gerada.
- A tabela de agravo salva para recopia e dinamica: sempre que um novo cadastro de agravo e iniciado, a memoria e substituida pela tabela do processo atual.
- Foi criado o fluxo `Simples Encerramento`, com selecao progressiva de tipo, peca, ID, data e checklist.
- No `Simples Encerramento`, ficou parametrizada a combinacao `Preclusao Consumativa` + `Contestacao`, gerando texto HTML formatado e copiando automaticamente para a area de transferencia.
- O texto do `Simples Encerramento` tambem pode ser copiado novamente pelo botao `Copiar`, inclusive apos fechar a caixa de visualizacao.

Versao `1.59`:

- No relatorio de duplicados, o botao `Validar` passou a aplicar o marcador `Conferido` por requisicao direta ao endpoint de marcadores do SPA, com fallback pelo clique visual do modal.
- A busca do marcador no modal agora prioriza o marcador visivel/ativo em `Meus marcadores`, evitando selecionar marcadores homonimos escondidos em outras abas do modal.

Versao `1.60`:

- O `Validar` do relatorio de duplicados passou a seguir o fluxo visual do SPA: abrir marcador, selecionar o checkbox `Conferido`, clicar fora do modal e conferir se o marcador apareceu na pendencia.
- A validacao agora so retorna sucesso depois de confirmar o marcador na area `#procedure-show-markers` ou em uma releitura fresca da pagina; se falhar, a aba da pendencia permanece aberta para verificacao.

Versao `1.61`:

- A rotina do `Validar` foi ajustada para tratar `Conferido` como nome do marcador, nao como nome do checkbox.
- O script agora localiza a linha do marcador pelo texto `.text-marker` e marca especificamente a checkbox `marker-procedure-check` dessa mesma linha.

Versao `1.62`:

- A selecao da checkbox do marcador `Conferido` passou a usar tentativas nativas sequenciais no SPA: clique no label associado, clique direto no input `marker-procedure-check`, espera do AJAX do SPA e fallback por jQuery/eventos quando disponivel.
- A rotina deixou de marcar `checked` artificialmente no fluxo visual; a checkbox precisa ser realmente selecionada pelo SPA antes da conferencia da pendencia.

Versao `1.63`:

- O fallback de aplicacao do marcador `Conferido` passou a usar o formato de parametros real do SPA: `marker_procedures[marker_id]` e `marker_procedures[procedure_id]`.
- Quando o clique visual nao seleciona a checkbox, a rotina aciona o proprio handler `change` do SPA via jQuery, marcando a checkbox da linha do marcador e aguardando o AJAX terminar antes da conferencia.
- Em caso de marcadores homonimos, a busca prioriza o texto exatamente `Conferido` e marcadores particulares/visiveis.

Versao `1.64`:

- O `Validar` do relatorio de duplicados passou a aplicar o marcador `Conferido` acionando diretamente o mesmo Ajax usado pelo SPA na checkbox `marker-procedure-check`: `POST /marker_procedures`, `dataType: "script"` e objeto `marker_procedures` com `marker_id` e `procedure_id`.
- O fallback direto passou a usar requisicao urlencoded igual ao jQuery do SPA, sem parametros extras, mantendo apenas `marker_procedures[marker_id]` e `marker_procedures[procedure_id]`.
- O fechamento do modal de marcadores tambem procura o controle visivel `Fechar`, para disparar a recarga nativa dos marcadores antes da conferencia final.

Versao `1.65`:

- O `Validar` voltou a priorizar o mesmo percurso manual do SPA: localizar o marcador particular `Conferido` em `Meus marcadores`, clicar primeiro no `label`/checkbox e fechar o modal para recarregar a pendencia.
- O Ajax do SPA e a requisicao direta ficaram como contingencias posteriores a conferencia visual. Uma tentativa Ajax que falhe restaura o estado original da checkbox, para que ela nunca bloqueie o clique nativo por parecer selecionada sem ter sido persistida.
- O fallback direto nao dispara mais um segundo evento `change` depois do POST confirmado, evitando duplicacao da operacao e estado divergente da checkbox.

Versao `1.66`:

- O `Validar` deixou de tratar a estrutura inicial do modal como carregamento concluido. Agora ele aguarda especificamente a linha visivel do marcador particular `Conferido` e a checkbox `marker-procedure-check` habilitada em `Meus marcadores` antes de tentar o clique.
- A aba auxiliar usada para validar e sempre fechada ao fim, inclusive em falhas. Ela nao e mais ativada, de modo que a pessoa permanece no relatorio de duplicados durante todo o fluxo.

Versao `1.67`:

- A acao `Ultima peticao PGE` foi mantida na barra comum de acoes de `Autos`, `Pasta` e `Andamento PJE`, sem aparecer dentro do menu de filtros. No Andamento PJE, ela consulta o cache de Autos/Pasta em segundo plano para localizar a peca, sem trocar a fonte visivel.
- Cada cartao de `Prazos em aberto do Estado` no Andamento PJE passou a ter `Abrir PDF`, que resolve e abre o expediente especifico vinculado ao prazo pela mesma rotina ja usada nas movimentacoes.

Versao `1.68`:

- `Ultima decisao` foi adicionada a barra de acoes de `Autos`, `Pasta` e `Andamento PJE`. Em Autos/Pasta, abre a decisao mais recente identificada pela data dos documentos; no Andamento PJE, chama a mesma rotina existente dos filtros para localizar a decisao vinculada. Os demais comandos rapidos continuam ocultos no Andamento e `Ultima decisao` tambem permanece dentro do menu de filtros, como na `1.66`. `Ultima peticao PGE` permanece apenas nos fluxos de Autos/Pasta, como antes.
- Os botoes `Abrir PDF` de `Prazos em aberto do Estado` foram mantidos.

Versao `1.69`:

- O Fluxo de Correcao passou a reconhecer tambem o link `Editar passo` quando ele estiver dentro de uma etapa `Minuta elaborada`, alem do texto completo `Visualizar e editar minuta`.
- A busca do link da minuta passou a aguardar ate 30 segundos. A fila local nao e mais removida antes da navegacao: apos o clique nativo, a extensao confirma a URL do editor e, se o SPA nao navegar, abre diretamente a URL da minuta como contingencia.

Versao `1.70`:

- O Fluxo de Correcao voltou a aceitar exclusivamente o link `Visualizar e editar minuta`. `Editar passo`, `Aceitar passo` e outros controles de etapa nao pertencem a esse fluxo e nao podem ser usados como fallback.
- Foram mantidas a espera de ate 30 segundos, a confirmacao da URL do editor e a contingencia de abertura direta da mesma minuta quando o clique nativo nao navegar.

Versao `1.71`:

- A aba interna `Encerrar` foi removida do modulo Triagem e Protocolo. O encerramento do fluxo permanece disponivel somente pelo botao `Encerrar` no cabecalho do painel da Triagem.
- A checkbox `Abrir minimizado` do menu geral foi movida para o cabecalho, ao lado de `CDSP`, e permanece visivel tanto com o painel aberto quanto recolhido.

Versao `1.72`:

- A checkbox `Abrir minimizado` foi reposicionada no extremo direito do cabecalho do menu geral, antes do botao de recolher, para permanecer visualmente separada do titulo `CDSP` nos estados aberto e recolhido.

Versao `1.73`:

- O fluxo `Simples Encerramento` passou a ter os 32 modelos previstos nos quatro grupos: Preclusao Consumativa, Preclusao Temporal, Conteudo ao qual nao cabe Recorrer/Manifestar e Demais Situacoes.
- Os modelos exibem campos progressivos, escolhas mutuamente exclusivas e checklist obrigatorio; `Retorno dos Autos` preserva a hierarquia visual entre os itens.
- Datas usam `dd/mm/aaaa`; numeros CNJ sao formatados e validados. Os prazos passam a contar no dia seguinte, com calendario geral do TJMT de 2026, fins de semana e feriados nacionais como base de continuidade.
- O texto gerado continua em Times New Roman 14, espacamento 1,15 e recuo de primeira linha de 1,25 cm. Avisos operacionais ficam em vermelho na interface e nao entram no texto copiado.

Versao `1.74`:

- Ao gerar um Simples Encerramento, a extensao mantem a copia do texto e abre automaticamente o fluxo de elaboracao de peticao do TJ correspondente ao grau do processo.
- O fluxo percorre Modelos Publicos > SGJ > NSUS > Procedimentos > 2 - Simples Encerramento e escolhe a pasta/modelo correspondente a Preclusao Temporal, Conteudo ao qual nao cabe Recorrer/Manifestar, Demais Situacoes ou Preclusao Consumativa.
- A extensao solicita acesso opcional e limitado a `docs.google.com` somente no clique de gerar e tenta substituir o marcador `INSERIR O TEXTO DO SIMPLES ENCERRAMENTO` na minuta. Se o editor nao confirmar a substituicao, o texto continua copiado para colagem manual.

Versao `1.75`:

- Corrigido o bloqueio do Chrome que impedia a abertura da minuta ao tentar pedir permissao do Google Docs depois do clique original.
- O acesso a `docs.google.com` passou a ser declarado no manifesto, limitado exclusivamente a inserir o texto do Simples Encerramento no marcador da minuta. O fluxo de abertura e edicao agora segue no mesmo clique, sem solicitacao dinamica de permissao.

Versao `1.76`:

- Corrigida a selecao da pasta do Simples Encerramento: o caminho agora aceita exclusivamente a pasta `Procedimentos`, sem confundir com `Triagem - Procedimentos` ou outra pasta com texto semelhante.

Versao `1.77`:

- Corrigida a cascata de campos da Preclusao Consumativa: os IDs agora identificam a peca correspondente e, nas pecas corrigidas, aparecem antes da data.
- Os textos de checklist foram ajustados para mencionar corretamente a peca protocolada, incluir "de multa" e tratar Apelacao/Recurso Inominado como posteriores a sentenca.
- Em Agravo de Instrumento, a verificacao de recurso posterior passou a incluir Agravo Interno.
- Em Preclusao Temporal, Recurso Inominado ficou restrito ao Juizado, com prazo de 10 dias uteis. Os demais prazos foram preservados conforme rito e a contagem continua no dia seguinte a intimacao.
- Nas opcoes de rito Crianca de Apelacao, Agravo de Instrumento, Embargos de Declaracao e Agravo Interno, a verificacao final de Tempestividade passou a ser checkbox obrigatoria e integra o texto gerado. Os demais avisos operacionais continuam somente na interface.

Versao `1.78`:

- Foi criado o `Fluxo de Triagem`, dentro da aba Triagem e acima de `Filtro de expediente`, para complementar a classificacao do processo a partir da pendencia.
- O fluxo oferece Informacoes adicionais opcionais, Manifestacao Sugerida pesquisavel sem opcoes duplicadas, Designar ao assessor(a), escolha exclusiva de Tera Oficio e Observacao condicionada.
- Ao classificar, a extensao abre o passo `Complementar classificacao do processo`, preenche os campos do SPA e somente salva apos confirmar cada selecao. Caso o assessor nao seja localizado, interrompe o salvamento e orienta o preenchimento manual.
- Quando Tera Oficio for `Sim`, cria a Nova Tarefa com tipo Oficio, usuario Enzo Luiz Sawiski Lamin, prazo de 1 dia util, vencimento no proximo dia util considerando fins de semana e feriados nacionais, e a mesma observacao da classificacao.

Versao `1.79`:

- No Simples Encerramento, em Conteudo ao qual nao cabe Recorrer/Manifestar > Embargos de Declaracao > Sentenca, a multa em liminar passou a ser escolha exclusiva: sem multa, ou multa revogada posteriormente. O ID da decisao de revogacao somente aparece na segunda escolha e e obrigatorio.
- Os caminhos de Despacho/Liminar/Decisao Monocratica e Acordao continuam sem solicitar ID de revogacao.
- Em Conteudo ao qual nao cabe Recorrer/Manifestar > Agravo Interno, o ID da decisao passou a anteceder a data, e os fundamentos finais sao alternativas exclusivas: selecionar um unico fundamento libera a geracao.
- Em Conteudo ao qual nao cabe Recorrer/Manifestar > Impugnacao ao Cumprimento de Sentenca, o ID da impugnacao passou a anteceder a data.

Versao `1.80`:

- A planilha `data/equipe.xlsx` foi atualizada e passou a ser a fonte unica de assessores ativos nos Fluxos de Triagem e de Correcao. Somente nomes com `Saiu da Equipe = Nao Saiu da Equipe` aparecem no filtro de assessor, na devolucao e na designacao da Triagem.
- A lista fixa de devolucao do Fluxo de Correcao foi removida. Alteracoes futuras na equipe devem ser feitas na planilha, sem alterar o codigo.
- Em Devolver ao assessor, foi incluido o campo digitavel opcional Observacao. Quando preenchido, ele e enviado ao campo `ATR007573` antes do salvamento da devolucao.

Versao `1.81`:

- As cobrancas de Triagem passaram a usar exclusivamente a coluna `Recebido`, com disparo a partir de 3 dias uteis na Caixa Geral do Triador.
- Na Caixa Geral do Revisor, a cobranca de Correcao passou a usar exclusivamente a coluna `Recebido`, com disparo a partir de 2 dias uteis. Pecas a Retificar permanecem com o criterio anterior de 3 dias uteis na caixa.
- As mensagens prontas de cobranca agora separam os processos por setor e, dentro dele, por responsavel, em tabela textual pronta para copia.

Versao `1.82`:

- `Pecas a Retificar` deixou de integrar a cobranca de Correcao e passou a integrar a cobranca de Peca, pois a pendencia ja esta sob responsabilidade de quem minuta apos a revisao.
- A cobranca de Peca distingue, em blocos e tabelas proprios, os processos criticos da Caixa Geral do Redator e as Pecas a Retificar com 3 ou mais dias uteis na caixa.

Versao `1.83`:

- A base `data/equipe.xlsx` foi sincronizada com a planilha entregue na pasta `1.82`, preservando Maria Leticia Mendonca e Silva como integrante ativa.
- Aline Cristina de Souza passou a constar como `Nao Saiu da Equipe`. A formula da coluna `Saiu da Equipe` preserva essa excecao, para que ela continue aparecendo nas listas de assessores apesar de nao participar dos fluxos de processo.

Versao `1.84`:

- O texto padrao de `CUMP GERAL` no SIGADOC passou a aceitar tambem o modelo recriado `SAUDE - CUMP`, sem sufixo de subscritor. Quando houver modelos com sufixo, a extensao continua priorizando essa forma.

Versao `1.85`:

- No Fluxo de Triagem, a Observacao do Processo passou a ser um campo digitavel facultativo proprio. Com oficio, a Observacao do Oficio preenche somente a Nova Tarefa e a Observacao do Processo preenche somente a complementacao do processo. Sem oficio, somente a Observacao do Processo pode ser preenchida.
- O Fluxo de Correcao passou a aceitar caixas com colunas diferentes: campos inexistentes nao bloqueiam Atualizar filtros nem Abrir e seus filtros sao ocultados automaticamente.

## Regras permanentes combinadas

- Quando o usuario anexar uma versao nova de alguma extensao/modulo, comparar com as alteracoes feitas neste chat.
- Se uma alteracao feita aqui nao estiver no arquivo novo anexado, reaplicar a alteracao antes de consolidar.
- Nao reintroduzir o modo escuro na extensao geral.
- No SPA, as funcoes do Extrator ficam integradas no modulo `Oficios` do menu geral.
- No SIGADOC, carregar apenas o menu compacto proprio do Extrator/SIGADOC, sem menu geral do SPA e sem botoes soltos.
- O menu geral deve ser compacto, movel e com memoria opcional de minimizacao/posicao.
- No modulo Triagem e Protocolo, nao reintroduzir a aba ou comandos internos de `Encerrar`; preservar somente o botao `Encerrar` do cabecalho. A checkbox `Abrir minimizado` do menu geral deve ficar no extremo direito do cabecalho, antes do botao de recolher, e permanecer visivel quando o painel estiver recolhido.
- A ferramenta de busca nos autos nao deve aparecer em paginas de caixa/listagem de processos.
- No Fluxo de Correcao, preservar o filtro `Recebido`, agrupando minuto(s), hora(s) e segundo(s) como `Hoje` e mantendo os demais periodos como opcoes proprias.
- No Fluxo de Correcao, preservar a abertura confiavel exclusivamente pelo link `Visualizar e editar minuta`. Nao usar `Editar passo`, `Aceitar passo` nem outro controle de etapa. Aguardar o carregamento por ate 30 segundos, manter a fila ate confirmar a URL da minuta e usar navegacao direta apenas se o clique nativo nao produzir a transicao.
- No modulo Redacao e Correcao, preservar o botao pequeno `Copiar` ao lado de `Cadastrar Agravo`, com memoria dinamica da ultima tabela gerada.
- Preservar o fluxo `Simples Encerramento` com os 32 modelos parametrizados nos quatro grupos. Manter a exibicao progressiva, os campos condicionais, o checklist obrigatorio, a copia automatica/manual, a formatacao Times New Roman 14 com espacamento 1,15 e recuo de 1,25 cm. Avisos operacionais devem aparecer somente na interface, em vermelho e negrito, nunca no texto copiado, exceto pelas verificacoes obrigatorias de Tempestividade nos ritos Crianca da Preclusao Temporal, que integram o texto gerado. Em Conteudo ao qual nao cabe Recorrer/Manifestar, preservar a multa em liminar de Embargos de Declaracao > Sentenca como escolha exclusiva, com ID obrigatorio apenas para multa revogada; em Agravo Interno, preservar os fundamentos finais como escolhas exclusivas e o ID antes da data; em Impugnacao ao Cumprimento de Sentenca, preservar o ID antes da data.
- Preservar o `Fluxo de Triagem` dentro da aba Triagem, acima de `Filtro de expediente`. Ele deve abrir exclusivamente o passo `Complementar classificacao do processo`, preencher ATR001330, ATR007587, ATR007588 e ATR007594, confirmar as selecoes Select2 e interromper antes de salvar quando o assessor nao for localizado. Em Tera Oficio = Sim, preencher tambem a Nova Tarefa com ATR007590 = Oficio, ATR007591 = Enzo Luiz Sawiski Lamin, ATR007592 = 1, ATR007593 = proximo dia util nacional e ATR007589 igual a observacao selecionada. Em Tera Oficio = Nao, a observacao manual e opcional e nao deve criar/preencher Nova Tarefa.
- A coluna `Saiu da Equipe` de `data/equipe.xlsx` e a fonte unica da lista de assessores dos Fluxos de Triagem e Correcao: incluir somente `Nao Saiu da Equipe`, sem manter lista fixa de nomes no codigo. No Fluxo de Correcao, preservar tambem o preenchimento opcional de Observacao em `ATR007573` ao devolver ao assessor.
- No Simples Encerramento, preservar a abertura automatica do modelo pelo caminho Modelos Publicos > SGJ > NSUS > Procedimentos > 2 - Simples Encerramento, com selecao por tipo e tentativa de substituir o marcador da minuta no Google Docs. A pasta `Procedimentos` deve ser localizada por correspondencia exata, sem aceitar `Triagem - Procedimentos` nem outra pasta semelhante. O acesso declarado a `docs.google.com` deve continuar estritamente restrito a esse fluxo, sem solicitacao dinamica de permissao.
- No relatorio de duplicados, preservar a aplicacao persistente do marcador `Conferido`, aguardando a linha particular visivel e sua checkbox habilitada em `Meus marcadores`. Priorizar o clique nativo no label/input antes de qualquer Ajax; tentativas que falharem devem restaurar a checkbox. Usar handler `change` do SPA ou fallback com `marker_procedures[...]` somente como contingencia, com conferencia obrigatoria na pendencia. A aba auxiliar deve permanecer em segundo plano e sempre ser fechada ao final.
- Nos Autos processuais, preservar `Ultima decisao` na barra de acoes de `Autos`, `Pasta` e `Andamento PJE`. Em Autos/Pasta, identificar a decisao mais recente pela data; no Andamento PJE, chamar a mesma rotina de decisao vinculada dos filtros. No `Andamento PJE`, ocultar os demais comandos rapidos e manter tambem `Ultima decisao` dentro dos filtros, como na `1.66`. `Ultima peticao PGE` permanece apenas em Autos/Pasta. Nos cartoes de `Prazos em aberto do Estado`, preservar `Abrir PDF` ligado ao expediente daquele prazo.
- Preservar o fluxo do GitHub: toda alteracao consolidada deve atualizar a versao, passar pelas validacoes, gerar pasta e ZIP de output, receber commit, tag correspondente e push para o GitHub.
- Na Coordenacao, preservar as cobrancas de Triagem pela coluna `Recebido` a partir de 3 dias uteis e de Revisor pela coluna `Recebido` a partir de 2 dias uteis. As mensagens devem continuar agrupadas por gestor, mas organizar visualmente os processos por setor e responsavel.
- Na Coordenacao, `Pecas a Retificar` pertencem exclusivamente a `Cobrar Peca`, com 3 dias uteis ou mais na caixa. Preservar a separacao visual entre essas pecas e os processos criticos da Caixa Geral do Redator.
- Na base `data/equipe.xlsx`, preservar Aline Cristina de Souza e Maria Leticia Mendonca e Silva como `Nao Saiu da Equipe`, para que ambas constem nas listas de assessores dos Fluxos de Triagem e Correcao.
- No SIGADOC, preservar a selecao de `CUMP GERAL` tanto para modelos com sufixo de subscritor quanto para o modelo-base recriado `SAUDE - CUMP`, sem vincular o fluxo a identificadores numericos do sistema.
- No Fluxo de Triagem, preservar a separacao entre Observacao do Processo, facultativa e exclusiva da complementacao, e Observacao do Oficio, obrigatoria somente com oficio e exclusiva da Nova Tarefa. No Fluxo de Correcao, tratar colunas ausentes como filtros indisponiveis, sem interromper a leitura ou abertura de processos.

## Arquivos importantes

- `manifest.json`: metadados e permissoes da extensao.
- `js/content_bridge.js`: ponte entre pagina SPA/SIGADOC e background.
- `js/background.js`: rotinas em background, abas, downloads, PDF, MCP e automacoes.
- `js/triagem/spa_extension_panel.js`: menu da triagem, autos processuais, duplicados, Andamento PJe e ferramenta raiz.
- `js/prazos/deadline_report_panel.js`: modulo Redacao e Correcao, fluxo de correcao e cadastro de agravo.
- `js/gestao/management_report_panel.js`: modulo Coordenacao/relatorio gerencial.
- `js/extrator/content.js`: funcionalidades de oficios/extrator.
- `data/equipe.xlsx`: base interna da equipe.
- `GUIA_DE_UPDATES.txt`: regras para preservar em updates futuros.

## Validacao padrao antes de entregar

```powershell
node --check js/background.js
node --check js/content_bridge.js
node --check js/triagem/spa_extension_panel.js
node --check js/prazos/deadline_report_panel.js
node --check js/gestao/management_report_panel.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
git diff --check
```

## Empacotamento padrao

Gerar pasta e zip diretamente na pasta principal compartilhada do projeto:

```text
D:\Users\PGE-MT\Desktop\Extensao-Geral\
```

Usar sempre o nome `CDSP Extensao Geral - x.xx`, ajustando `x.xx` para a versao entregue.

Exemplo mais recente:

```text
D:\Users\PGE-MT\Desktop\Extensao-Geral\CDSP Extensao Geral - x.xx
D:\Users\PGE-MT\Desktop\Extensao-Geral\CDSP Extensao Geral - x.xx.zip
```

Todas as novas versoes, pastas e ZIPs a serem usadas devem ficar dentro de `D:\Users\PGE-MT\Desktop\Extensao-Geral`.

## Observacao sobre chats

O ideal e entrar no notebook com a mesma conta OpenAI/Codex e procurar esta tarefa no historico do Codex. Se ela nao aparecer imediatamente, usar este arquivo como ponto de retomada e o repositorio GitHub como fonte do estado real do codigo.
