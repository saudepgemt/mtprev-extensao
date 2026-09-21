# Contexto para continuar no Codex

Este arquivo serve para retomar o trabalho em outro computador/notebook sem perder o contexto principal desta conversa.

## Repositorio

- GitHub: https://github.com/joaofgomess/extensao-geral.git
- Branch principal: `main`
- Versao atual da extensao: `2.07`
- Ultima tag publicada no repositorio: `v2.07`

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

- No Simples Encerramento, em Conteudo ao qual nao cabe Recorrer/Manifestar > Embargos de Declaracao > Sentenca, a multa em liminar passou a ser escolha exclusiva: sem multa, ou multa revogada posteriormente. O ID da decisao de revogacao somente aparece na segunda escolha e e obrigatorio; na opcao "Nao foi fixada multa em liminar", ele nao aparece nem e exigido.
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

Versao `1.86`:

- O filtro `Assessor(a)` do Fluxo de Correcao voltou a listar somente os nomes encontrados na caixa de leitura atual. A base `data/equipe.xlsx` continua sendo usada exclusivamente na selecao de `Devolver ao assessor`.

Versao `1.87`:

- No Fluxo de Triagem, a Nova Tarefa de oficio passou a ser direcionada para Yasmim Marques Nascimento. A classificacao agora repete a tentativa dos seletores e confere todos os campos obrigatorios antes de salvar.
- No SIGADOC, a selecao de SES-UNIJUR passou a aguardar a confirmacao assincrona do ID, sigla e descricao da lotacao. O fluxo nao grava nem assina se o destinatario, o conteudo ou outro campo obrigatorio nao estiver confirmado.

Versao `1.88`:

- O Fluxo de Triagem foi dividido nos submenus `Classificar Processo` e `Sugerir encerramento`. A classificacao com oficio agora permite escolher o responsavel pela Nova Tarefa em lista fixa, com Yasmim Marques Nascimento preselecionada.
- O encerramento sugerido foi disponibilizado no Fluxo de Triagem e como botao individual no relatorio de duplicados. Ambos usam os motivos do SPA, assumem `Outros` por padrao, aceitam Observacao facultativa e so a pendencia escolhida no relatorio e aberta em segundo plano.
- A extensao aguarda o campo dinamico Observacao da etapa 2756 depois da escolha do Motivo e confirma o Motivo antes de salvar.

Versao `1.89`:

- O campo Motivo de Sugerir encerramento tornou-se pesquisavel tanto no submenu do Fluxo de Triagem quanto na caixa aberta pelo relatorio de duplicados. A digitacao filtra os motivos, Enter escolhe a primeira opcao encontrada e `Outros` permanece o padrao.

Versao `1.90`:

- `Designar ao assessor(a)` tornou-se opcional no Fluxo de Triagem. A extensao somente seleciona e valida esse campo quando houver um nome escolhido; em branco, ela continua o preenchimento e o salvamento normalmente.
- A confirmacao do responsavel pelo oficio passou a aceitar o sufixo de funcao retornado pelo Select2 remoto do SPA. Isso corrige o falso erro da Nova Tarefa quando Yasmim Marques Nascimento ja tinha sido selecionada.
- A base `data/equipe.xlsx` foi confrontada com o SPA e teve corrigidas as grafias de Alexandre Emílio de Oliveira, Fransquislaine de Jesus Anicézio, João Víctor Silva dos Santos de Oliveira e Joyce Mylena Gonçalves de Araujo.

Versao `1.91`:

- Corrigido o campo condicional do ID de revogacao no Simples Encerramento. Em `Conteudo ao qual nao cabe Recorrer/Manifestar > Embargos de Declaracao > Sentenca > Procedimento Comum > Nao foi fixada multa em liminar`, o ID nao aparece nem e exigido. Ele permanece visivel e obrigatorio somente quando a multa foi revogada posteriormente.

Versao `1.92`:

- O botao `Peticao inicial` dos Autos processuais passou a exigir dupla confirmacao: o PDF deve ser a propria Peticao Inicial e seu ID deve estar vinculado a uma movimentacao de Peticao Inicial no Andamento PJE. Anexos e documentos que apenas mencionem a peticao nao podem ser abertos por esse atalho.

Versao `1.93`:

- Refinada a confirmacao da Peticao Inicial para os retornos do MNI/PJe sem IDs vinculados. O vinculo por ID continua prioritario; na ausencia dele, a extensao exige documento e movimentacao ambos identificados como Peticao Inicial e usa a menor diferenca de data/hora para selecionar o PDF correto.

Versao `1.94`:

- O botao `Peticao inicial` passou a abrir um submenu com `Peticao Inicial` e `Anexos da Peticao Inicial`. Os anexos sao abertos juntos em uma unica aba, sem a peca principal, usando IDs vinculados ou o grupo de mesma data/hora como contingencia.

Versao `1.95`:

- O atalho `Peticao Inicial` passou a conferir o texto dos PDFs da primeira movimentacao antes de abrir. Ele prioriza o arquivo nomeado como Peticao Inicial, mas, quando o conteudo indicar apenas `Peticao Inicial em Anexo`, localiza a peca inicial efetiva entre os demais arquivos da mesma primeira data. A opcao de anexos abre todos os demais PDFs dessa data, sem repetir a peca efetiva.

Versao `1.96`:

- Corrigida a contingencia da identificacao por conteudo da Peticao Inicial. Depois de rejeitar uma capa cujo texto seja apenas `Peticao Inicial em Anexo`, se o PDF real nao tiver texto extraivel suficiente, o fluxo abre o proximo documento da primeira movimentacao que o SPA classificar tecnicamente como Peticao Inicial. No HTML de referencia, isso seleciona o documento `29867917 - Peticao inicial em pdf`, sem voltar a abrir a capa `29867916`.

Versao `1.97`:

- O Andamento PJe/MNI deixou de ser bloqueador para o atalho `Peticao Inicial`. Quando a consulta falhar ou nao identificar a movimentacao, a extensao continua pelo PDF identificado nos Autos, aplica a conferencia de conteudo e a contingencia tecnica da primeira movimentacao. Quando o Andamento PJe responder, sua vinculacao por ID continua sendo usada como prioridade adicional.

Versao `1.98`:

- O Fluxo de Triagem passou a isolar cada Select2 remoto antes de pesquisar. Assim, o responsavel pelo oficio e selecionado exclusivamente no campo `Usuario` da Nova Tarefa, sem alterar `Designar ao assessor(a)`.
- A sugestao de encerramento passou a aguardar por ate 20 segundos o campo dinamico `Observacao` carregado pelo SPA e a procura somente no formulario visivel da etapa.
- Foram adicionados os tipos `ALTA` e `INFOR SEDUC` ao Fluxo de Triagem e ao Extrator do SIGADOC.
- Os modelos documentados de oficio deixaram de depender de `Texto padrao`: a extensao preenche Modelo, destinatario, classificacao, descricao, assunto, tabela, links e corpo proprio. Tabela, links e corpo usam Times New Roman 12; os titulos ficam em negrito e o fechamento permanece `Atenciosamente`.
- Para os destinatarios, `AUDIENCIA` usa `UNIJUR`; Avaliacao Psicopedagogica e Medicamento Escolar preservam `SEDUC-UAS`; SETASC IDOSO preserva `SETASC-CPPDDH`.

Versao `1.99`:

- O menu de Oficios do SIGADOC passou a ter o campo opcional `Senha do SIGADOC`.
- A senha digitada permanece somente no `sessionStorage` do SIGADOC e e removida ao encerrar a sessao; ela nao e salva em `localStorage` nem no armazenamento da extensao.
- A assinatura continua tentando primeiro a credencial interna. Somente se o modal de senha permanecer aberto, a extensao tenta a senha opcional da sessao para o mesmo subscritor; se as duas falharem, interrompe o fluxo sem concluir a pos-assinatura.

Versao `2.00`:

- A classificacao dos oficios passou a acionar o fluxo nativo do SIGADOC: informa a sigla `091`, chama `ajax_classificacao()` e aguarda o retorno de ID, sigla e descricao antes de prosseguir.
- Se a consulta assincrona for bloqueada, a extensao usa `retorna_classificacao()` no contexto da pagina como contingencia. O preenchimento e interrompido quando o SIGADOC nao confirma a classificacao.
- Todos os tipos documentados de oficio agora possuem classificacao `091` na matriz interna. A conferencia nao depende do ID numerico fixo: aceita o identificador retornado pelo proprio SIGADOC quando a sigla e a descricao estiverem corretas.

Versao `2.01`:

- A classificacao passou a reproduzir o gesto exigido pelo SIGADOC: apos preencher `091`, o campo recebe foco e perde foco, disparando o `onblur` que preenche a descricao visivel da classificacao.
- A consulta por `ajax_classificacao()` e o callback `retorna_classificacao()` permanecem como contingencias sequenciais quando o desfoco nativo nao concluir a selecao.

Versao `2.02`:

- Corrigida a perda de foco da `Senha do SIGADOC`: o menu proprio nao e reconstruido enquanto esse campo estiver ativo, permitindo digitacao continua mesmo com atualizacoes observadas na pagina.

Versao `2.03`:

- Em `Preencher + Assinar`, a extensao passou a anexar automaticamente ao oficio o PDF do expediente que originou a demanda no SPA.
- Depois da assinatura do oficio, o fluxo abre `Anexar`, seleciona o modelo `Capturado`, preenche o arquivo do expediente, assina o documento `PGE-CAP` e retorna ao oficio para concluir o comportamento ja configurado de download ou tramitacao.
- A anexacao tem uma segunda tentativa completa. Se as duas falharem, o menu registra o motivo e o oficio continua sem anexo, sem interromper a conclusao do fluxo principal.

Versao `2.04`:

- A anexacao do expediente foi alinhada ao fluxo operacional do SIGADOC: apos o oficio assinado, a extensao prioriza `Incluir documento`, escolhe `Capturado`, replica o destinatario e a classificacao do oficio e usa uma descricao que identifica o PDF como expediente vinculado a pendencia geradora.
- O PDF e inserido no campo `Arquivo PDF`, o documento capturado e gravado e a extensao reconhece `Autenticar` ou `Assinar` para repetir a senha usada no oficio antes de retornar ao fluxo normal de tramitacao.

Versao `2.05`:

- O detalhe de qualquer `Erro no SIGADOC`, inclusive em preenchimento, assinatura e pos-assinatura, passou a aparecer de forma persistente no status do menu e no tooltip do botao.
- O botao em estado de erro nao e mais restaurado automaticamente, permitindo conferir a causa e tentar novamente pelo mesmo comando.
- Corrigida a validacao final do SIGADOC, que usava uma referencia inexistente e podia informar erro mesmo com os campos visivelmente preenchidos.
- A troca de Modelo e de Texto padrao agora aguarda a reconstrucao assincrona real do formulario antes de continuar; a extensao nao depende mais de um segundo clique nem de espera fixa para preencher, validar ou assinar.

Versao `2.06`:

- O passo `OK` do oficio chama `gravarDoc()` no contexto nativo do SIGADOC e mantem a assinatura pendente ate a pagina disponibilizar a proxima acao.
- A extensao diferencia a acao `Assinar` da pagina do documento da confirmacao na tela de autenticacao, para so selecionar senha depois que os controles da assinatura estiverem realmente visiveis.
- Quando o SIGADOC ainda estiver transitando entre as telas, a verificacao e reagendada automaticamente, sem exigir um segundo clique da pessoa usuaria.

Versao `2.07`:

- Corrigida a passagem do `OK` para assinatura: a extensao voltou a acionar diretamente o botao `btnGravar`, preservando o handler `gravarDoc()` do formulario do SIGADOC.
- A verificacao posterior da assinatura permanece ativa, mas somente apos o `OK` ser efetivamente disparado pelo proprio controle da tela.

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
- Preservar o fluxo `Simples Encerramento` com os 32 modelos parametrizados nos quatro grupos. Manter a exibicao progressiva, os campos condicionais, o checklist obrigatorio, a copia automatica/manual, a formatacao Times New Roman 14 com espacamento 1,15 e recuo de 1,25 cm. Avisos operacionais devem aparecer somente na interface, em vermelho e negrito, nunca no texto copiado, exceto pelas verificacoes obrigatorias de Tempestividade nos ritos Crianca da Preclusao Temporal, que integram o texto gerado. Em Conteudo ao qual nao cabe Recorrer/Manifestar, preservar a multa em liminar de Embargos de Declaracao > Sentenca como escolha exclusiva: o ID de revogacao aparece e e obrigatorio apenas para multa revogada, nunca para "Nao foi fixada multa em liminar"; em Agravo Interno, preservar os fundamentos finais como escolhas exclusivas e o ID antes da data; em Impugnacao ao Cumprimento de Sentenca, preservar o ID antes da data.
- Preservar o `Fluxo de Triagem` dentro da aba Triagem, acima de `Filtro de expediente`, com os submenus `Classificar Processo` e `Sugerir encerramento`. Ele deve abrir exclusivamente o passo `Complementar classificacao do processo`, preencher ATR001330, ATR007587 e ATR007594. ATR007588 e opcional na extensao: so deve ser enviado e confirmado quando houver um assessor selecionado; vazio, nao pode interromper o fluxo. Em Tera Oficio = Sim, preencher tambem a Nova Tarefa com ATR007590 = Oficio, ATR007591 igual ao responsavel selecionado na lista fixa de oficios, ATR007592 = 1, ATR007593 = proximo dia util nacional e ATR007589 igual a observacao selecionada. Yasmim Marques Nascimento e o valor preselecionado e sua confirmacao deve aceitar o complemento de funcao adicionado pelo SPA. Antes de salvar, confirmar todos os campos efetivamente preenchidos. Em Tera Oficio = Nao, a observacao manual e opcional e nao deve criar/preencher Nova Tarefa. O submenu de encerramento e o botao individual do relatorio de duplicados devem abrir o passo 2756, usar Motivo pesquisavel e `Outros` por padrao, preencher a Observacao opcional carregada dinamicamente pelo SPA e salvar sem criar acao em lote.
- A coluna `Saiu da Equipe` de `data/equipe.xlsx` e a fonte unica da lista de assessores ativos da Designacao da Triagem e de `Devolver ao assessor` no Fluxo de Correcao: incluir somente `Nao Saiu da Equipe`, sem manter lista fixa de nomes no codigo. O filtro `Assessor(a)` do Fluxo de Correcao deve listar exclusivamente os nomes da caixa de leitura atual. Preservar tambem o preenchimento opcional de Observacao em `ATR007573` ao devolver ao assessor.
- No Simples Encerramento, preservar a abertura automatica do modelo pelo caminho Modelos Publicos > SGJ > NSUS > Procedimentos > 2 - Simples Encerramento, com selecao por tipo e tentativa de substituir o marcador da minuta no Google Docs. A pasta `Procedimentos` deve ser localizada por correspondencia exata, sem aceitar `Triagem - Procedimentos` nem outra pasta semelhante. O acesso declarado a `docs.google.com` deve continuar estritamente restrito a esse fluxo, sem solicitacao dinamica de permissao.
- No relatorio de duplicados, preservar a aplicacao persistente do marcador `Conferido`, aguardando a linha particular visivel e sua checkbox habilitada em `Meus marcadores`. Priorizar o clique nativo no label/input antes de qualquer Ajax; tentativas que falharem devem restaurar a checkbox. Usar handler `change` do SPA ou fallback com `marker_procedures[...]` somente como contingencia, com conferencia obrigatoria na pendencia. A aba auxiliar deve permanecer em segundo plano e sempre ser fechada ao final.
- Nos Autos processuais, preservar `Ultima decisao` na barra de acoes de `Autos`, `Pasta` e `Andamento PJE`. Em Autos/Pasta, identificar a decisao mais recente pela data; no Andamento PJE, chamar a mesma rotina de decisao vinculada dos filtros. No `Andamento PJE`, ocultar os demais comandos rapidos e manter tambem `Ultima decisao` dentro dos filtros, como na `1.66`. `Ultima peticao PGE` permanece apenas em Autos/Pasta. Nos cartoes de `Prazos em aberto do Estado`, preservar `Abrir PDF` ligado ao expediente daquele prazo.
- Nos Autos processuais, o atalho `Peticao inicial` deve usar a movimentacao de Peticao Inicial no Andamento PJE como confirmacao adicional, sem bloquear a abertura quando o MNI/PJe falhar ou nao retornar a movimentacao. Conferir o conteudo dos PDFs da primeira movimentacao: examinar primeiro o arquivo cujo nome/tipo indique Peticao Inicial; se o texto indicar somente `Peticao Inicial em Anexo`, procurar a peca efetiva nos demais arquivos da primeira data. Se a peca efetiva nao tiver texto extraivel suficiente, usar somente o proximo documento com classificacao tecnica de Peticao Inicial como contingencia, sem reconsiderar a capa rejeitada. Nao abrir anexos, comprovantes, procuracoes ou substabelecimentos apenas porque mencionam a peticao.
- Nos Autos processuais, manter o submenu `Peticao Inicial` e `Anexos da Peticao Inicial`. Os anexos devem abrir juntos em uma unica aba e corresponder aos demais arquivos da primeira data de movimentacao, sem incluir a peca principal efetivamente identificada.
- Preservar o fluxo do GitHub: toda alteracao consolidada deve atualizar a versao, passar pelas validacoes, gerar pasta e ZIP de output, receber commit, tag correspondente e push para o GitHub.
- Na Coordenacao, preservar as cobrancas de Triagem pela coluna `Recebido` a partir de 3 dias uteis e de Revisor pela coluna `Recebido` a partir de 2 dias uteis. As mensagens devem continuar agrupadas por gestor, mas organizar visualmente os processos por setor e responsavel.
- Na Coordenacao, `Pecas a Retificar` pertencem exclusivamente a `Cobrar Peca`, com 3 dias uteis ou mais na caixa. Preservar a separacao visual entre essas pecas e os processos criticos da Caixa Geral do Redator.
- Na base `data/equipe.xlsx`, preservar Aline Cristina de Souza e Maria Leticia Mendonca e Silva como `Nao Saiu da Equipe`, para que ambas constem nas listas de assessores dos Fluxos de Triagem e Correcao.
- No SIGADOC, preservar a selecao de `CUMP GERAL` tanto para modelos com sufixo de subscritor quanto para o modelo-base recriado `SAUDE - CUMP`, sem vincular o fluxo a identificadores numericos do sistema.
- No SIGADOC, antes de gravar ou assinar, preservar a confirmacao assincrona integral do destinatario: ID, sigla e descricao da lotacao. Para SES-UNIJUR, repetir a solicitacao ate a confirmacao e interromper o fluxo caso qualquer campo obrigatorio nao esteja preenchido, sem acionar `OK` nem assinatura antecipadamente.
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
