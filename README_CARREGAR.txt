CDSP Extensao Geral - 2.28

Menu compacto no SPA:
- Triagem e Protocolo
- Redacao e Correcao
- Coordenacao
- Oficios

Incluido no pacote:
- CDSP - Extrator SPA/SIGADOC 3.15

Removido desta versao:
- CDSP - Modo Escuro SPA

Comportamento:
- O nome publico da extensao no Chrome e "CDSP - Extensao Geral"; o menu interno permanece compacto como "CDSP".
- O menu geral e pequeno, movimentavel e parecido com o painel da Triagem.
- A navegacao entre Triagem e Protocolo, Redacao e Correcao, Coordenacao e Oficios acontece no mesmo menu.
- O menu geral memoriza posicao e modulo ativo; a checkbox "Abrir minimizado", no extremo direito do cabecalho antes do botao de recolher, define se novas abas do SPA abrem com o menu principal recolhido e permanece visivel quando o painel esta recolhido.
- Em Triagem e Protocolo, o encerramento do fluxo fica somente no botao "Encerrar" do cabecalho; nao ha mais aba interna de encerramento.
- A aba Triagem inclui o `Fluxo de Triagem`, acima de `Filtro de expediente`, organizado nos submenus `Classificar Processo` e `Sugerir encerramento`. Na classificacao, o fluxo pesquisa Manifestacao Sugerida sem duplicidades e permite deixar `Designar ao assessor(a)` em branco. Quando houver assessor escolhido, a extensao o confirma no SPA; quando estiver vazio, ela prossegue sem bloquear a classificacao. Com oficio, a Observacao do Oficio predefinida vai somente para a Nova Tarefa, com prazo de 1 dia util; o responsavel e selecionavel entre Gabrielle Rodrigues Silva Espindola, Matheus Augusto Ferreira Brandão, Beatriz Vitoria Miranda Silva Cerqueira, Anna Julia Ferreira da Mata e Yasmim Marques Nascimento, que permanece preselecionada. A confirmacao do responsavel aceita o complemento de funcao apresentado pelo Select2 remoto do SPA. A Observacao do Processo digitavel e facultativa vai somente para a classificacao. Antes de salvar, o fluxo confere os campos efetivamente preenchidos. Sem oficio, apenas a Observacao do Processo pode ser preenchida e a Nova Tarefa nao e criada. O motivo do submenu de encerramento e da caixa aberta pelo relatorio de duplicadas e pesquisavel, com o mesmo comportamento da Manifestacao Sugerida; a observacao continua opcional.
- O SPA tem o modulo Oficios dentro do menu geral, reunindo as acoes do Extrator de forma organizada.
- Na caixa do SPA, o botao SIG abre a pagina do processo em segundo plano e extrai os dados completos pelo mesmo fluxo do botao interno.
- Se a aba temporaria nao responder, o modulo tenta uma leitura direta da pagina do processo como contingencia.
- Ao rolar sobre o menu na tela inicial, a pagina do SPA volta a rolar quando o menu ou a lista interna chegam ao limite.
- O botao de Agravo de Instrumento fica dentro do modulo Redacao e Correcao no menu geral, como "Cadastrar Agravo".
- O botao "Cadastrar Agravo" escolhe automaticamente o fluxo TRF quando o numero CNJ contem ".4.01."; nesses casos abre "Cadastrar Agravo de Instrumento TRF".
- No Agravo TRF, o codigo final 9360 usa a Turma Recursal dos Juizados Especiais Federais da SJMT; os codigos 3600 a 3606 usam o Tribunal Regional Federal da 1a Regiao.
- No Agravo TRF, a competencia preenchida e "TRF1-5a e 6a Turmas-Direito Adm/Civil/Comercial".
- O preenchimento do cadastro de Agravo reconhece tanto os campos do modelo estadual quanto os do modelo TRF, com fallback por rotulo do campo.
- Na tabela copiada do agravo, estadual e federal, o rotulo fica como "Agravado" e o valor da segunda coluna recebe "e Outros" depois do nome.
- A tabela copiada do agravo, estadual e federal, usa Times New Roman 12, primeira coluna sem preenchimento colorido, colunas de 6,64cm e 12,28cm, texto justificado, sem negrito e sem recuo inicial; o HTML inclui colgroup, largura total de 18,92cm e estilos mso para ajudar o Word/Docs a preservar as medidas ao colar.
- Ao lado do botao Cadastrar Agravo ha um botao pequeno Copiar, que recopia a ultima tabela de agravo gerada; a memoria e atualizada sempre que um novo cadastro e iniciado.
- O botao solto/flutuante de Agravo de Instrumento nao e mais criado na tela do SPA.
- O modulo Redacao e Correcao inclui o bloco compacto "Fluxo de Correcao".
- No Fluxo de Correcao, "Atualizar filtros" le todas as paginas da caixa de correcao e monta filtros arrastaveis, com a ordem salva na memoria do navegador.
- O filtro `Assessor(a)` do Fluxo de Correcao mostra somente os nomes efetivamente presentes na caixa lida; a base interna de equipe ativa e usada apenas em `Devolver ao assessor`.
- Os filtros de Assessor(a), Orgao julgador, Manifestacao sugerida e Polo passivo aceitam multiplas selecoes.
- O Fluxo de Correcao tambem filtra por Recebido; minuto(s), hora(s) e segundo(s) aparecem agrupados como "Hoje", e os demais periodos permanecem como opcoes proprias.
- O Fluxo de Correcao identifica as colunas disponiveis em cada caixa: filtros cujas colunas nao existirem sao ocultados sem impedir a atualizacao ou abertura das pendencias.
- A leitura dos filtros usa a posicao visivel das colunas da tabela, para alinhar "Manifestacao Sugerida" com os valores exibidos no SPA.
- Todos os filtros sao opcionais; se todos ficarem vazios, o botao "Abrir" pergunta antes de abrir todos os processos lidos.
- O botao "Abrir" abre as pendencias filtradas e, em cada aba, aciona automaticamente "Visualizar e editar minuta".
- No Fluxo de Correcao, a abertura da minuta usa o clique nativo do SPA, prepara o historico da aba em duas etapas e ajusta a seta nativa de voltar para retornar a pendencia correta.
- Se o SPA ignorar o clique da minuta, o Fluxo de Correcao confirma a navegacao pela URL do editor e usa abertura direta como contingencia; a fila so e removida depois que a minuta realmente abre.
- O Fluxo de Correcao aciona exclusivamente o link "Visualizar e editar minuta"; outros botoes de etapa nao fazem parte desse fluxo.
- O Fluxo de Correcao inclui atalhos unicos para "Enviar ao procurador", "Sugerir encerramento de tarefa" e "Devolver ao assessor", cada um com opcoes "Tela da pendencia" e "Tela da Minuta".
- "Enviar ao procurador" direciona ao passo 2882, "Sugerir encerramento de tarefa" ao passo 2756 e "Devolver ao assessor" ao passo 2786, confirmando no botao Salvar quando a tela do passo abre.
- O modulo Redacao e Correcao inclui o fluxo "Simples Encerramento", com selecao progressiva de tipo, peca, ID, data e checklist.
- No Simples Encerramento, estao parametrizados os 32 modelos dos grupos Preclusao Consumativa, Preclusao Temporal, Conteudo ao qual nao cabe Recorrer/Manifestar e Demais Situacoes. O fluxo tem campos progressivos, escolhas exclusivas, checklist obrigatorio e copia automatica/manual em HTML formatado com Times New Roman 14, espacamento 1,15 e primeira linha de 1,25cm. Em Conteudo ao qual nao cabe Recorrer/Manifestar > Embargos de Declaracao > Sentenca, o ID da decisao de revogacao aparece somente quando a multa em liminar foi revogada; ele nao aparece nem e exigido na opcao "Nao foi fixada multa em liminar". Na Preclusao Consumativa, os IDs indicam a peca a que se referem e precedem a data nas pecas corrigidas; em Preclusao Temporal, Recurso Inominado fica restrito ao Juizado, com prazo de 10 dias uteis.
- Ao gerar um Simples Encerramento, a extensao abre a elaboracao de peticao do TJ, percorre Modelos Publicos > SGJ > NSUS > Procedimentos > 2 - Simples Encerramento e seleciona o modelo do tipo escolhido. A pasta `Procedimentos` e identificada pelo nome exato, sem confundir com `Triagem - Procedimentos`. O acesso declarado e limitado a docs.google.com permite substituir o marcador da minuta sem pedido dinamico durante o clique; se a confirmacao falhar, o texto continua copiado para colagem manual.
- Datas usam o formato dd/mm/aaaa; numeros CNJ sao formatados e validados. Os prazos contam a partir do dia seguinte, considerando o calendario geral do TJMT de 2026, fins de semana e feriados nacionais como base de continuidade.
- Os avisos operacionais aparecem em vermelho e negrito somente no checklist e nao entram no texto copiado. A excecao sao as verificacoes obrigatorias de Tempestividade nos ritos Crianca da Preclusao Temporal, que sao checkboxes e entram no texto gerado.
- A ferramenta de busca nos autos processuais fica carregada como ferramenta raiz nas paginas de processo, elaboracao de pecas, novos passos e cadastro de agravos do SPA, mesmo quando outro modulo esta ativo, mas nao aparece nas paginas de caixa/listagem de processos.
- O botao "Peticao inicial" da busca nos autos usa o Andamento PJE como confirmacao adicional quando ele estiver disponivel, sem bloquear a acao caso essa consulta falhe ou nao retorne a movimentacao. A extensao analisa os PDFs da primeira movimentacao, examina primeiro o documento nomeado como Peticao Inicial e, se ele for apenas uma capa com "Peticao Inicial em Anexo", procura a peca efetiva nos demais documentos dessa primeira data. Se o PDF efetivo nao trouxer texto suficiente para a confirmacao, usa como contingencia o proximo documento com tipo tecnico de Peticao Inicial, sem aceitar a capa rejeitada.
- O botao "Peticao inicial" abre um submenu com "Peticao Inicial" e "Anexos da Peticao Inicial". A primeira opcao abre somente a peca efetiva; a segunda abre, em uma unica aba, os demais PDFs da primeira movimentacao, sem repetir a peca principal.
- A checkbox "Abrir minimizado" do painel de Autos define se novas paginas de processo abrem esse painel recolhido.
- A aba "Andamento PJE" consulta o Worker/MCP institucional e mostra movimentos com expedientes vinculados, ciencia, prazo legal, prazo final, parte, procuradoria e status do expediente.
- O visual da aba "Andamento PJE" foi ampliado, com timeline mais legivel, blocos de expediente maiores e grade clara para ciencia, expedicao e prazos.
- A acao "Ultima decisao" fica na barra de acoes dos Autos, da Pasta e do Andamento PJE. No Andamento PJE, ela usa a mesma rotina dos filtros para localizar a decisao vinculada; os demais comandos rapidos continuam ocultos e o botao tambem permanece dentro do menu de filtros, como na versao 1.66.
- Cada cartao de "Prazos em aberto do Estado" no Andamento PJE possui o botao "Abrir PDF", que abre o expediente vinculado ao prazo.
- No painel interno "Autos do processo", o botao "Processo Completo" abre um seletor em duas etapas: primeiro Unificado ou Separado; depois Crescente ou Decrescente.
- O painel de autos carrega automaticamente; use "Atualizar" apenas para refazer a leitura.
- A ordenacao dos autos usa data/hora e ID; quando documentos entram no mesmo minuto, o ID crescente preserva a peca principal antes dos anexos.
- "Unificado" baixa os PDFs diretos em paralelo limitado e mescla localmente em um unico arquivo, sem CDN e sem usar a rota documents.pdf como fluxo principal.
- "Separado" agrupa documentos da mesma data/hora como um andamento em estilo PJE; ao visualizar o andamento, carrega o documento principal e pre-carrega os anexos em fila leve para acelerar o clique.
- A aba separada mostra um indicador simples de "Carregando PDF..." enquanto o frame do documento abre.
- O botao "Abrir tudo" tambem usa seletor em duas etapas e abre somente os itens filtrados na tela.
- Use as checkboxes para abrir/unificar PDFs selecionados manualmente; a pesquisa dentro dos PDFs tambem possui "Abrir todos" para os resultados encontrados.
- A biblioteca local pdf-lib fica embutida no pacote e e carregada sob demanda apenas ao escolher "Unificado"; jsPDF/jsPDF-AutoTable continuam fora do pacote.
- Nos Oficios, o bloco anexado ao SIGADOC usa o link dos Documentos Externos/autos processuais no lugar do link simples do processo no SPA, preservando o link do expediente.
- O modulo Coordenacao/Gestao usa a base interna data/equipe.xlsx para identificar setores, sem consultar Google Sheets.
- A base interna de equipe fica em Excel com tabela e filtros para facilitar edicao local.
- A base Excel e carregada diretamente pelo painel da Coordenacao, evitando falha de leitura no service worker.
- O relatorio gerencial da Coordenacao inclui os botoes Cobrar Triagem, Cobrar Correcao e Cobrar Peca dentro do relatorio gerado.
- As cobrancas usam os processos ja lidos pelo relatorio, sem reler a tabela do SPA ao clicar nos botoes.
- As mensagens de cobranca sao agrupadas por gestor de setor; Triagem usa gestores proprios e Correcao/Peca usam os gestores de producao. Cada mensagem separa os processos por setor e responsavel, em tabela textual pronta para copia.
- Cobrar Triagem usa `Recebido` a partir de 3 dias uteis. Na Correcao, Caixa Geral do Revisor usa `Recebido` a partir de 2 dias uteis. Pecas a Retificar entram em Cobrar Peca a partir de 3 dias uteis e ficam separadas dos processos criticos da Caixa Geral do Redator.
- Os botoes de cobranca abrem uma caixa com mensagens prontas e opcoes para copiar uma mensagem ou todas.
- O relatorio gerencial marca triagem/revisor/correcao/procurador como critico a partir de 2 dias uteis, ignorando fins de semana e feriados nacionais de data fixa.
- A permissao para Google Sheets foi removida do manifest.
- A logo do relatorio gerencial em tela aparece inteira dentro de uma faixa de cabecalho compacta, sem recorte.
- Os botoes do modulo Oficios preservam as cores e icones originais do Extrator: SIG em azul, SPA em verde e estados originais.
- Os modulos usam o mesmo padrao visual, com a marca antiga da Triagem e mesmo estilo de log no menu geral.
- O modulo de Triagem foi atualizado para a base CDSP_Triagem_1.0.14.
- O menu de pesquisa de documentos da Triagem preserva os filtros "Manifestacoes em Geral", "Nota tecnica do NAT" e "Informacoes da SES".
- No SPA, o Extrator usa o modulo Oficios; no SIGADOC, aparece um menu compacto proprio somente com as funcoes do SIGADOC.
- No SIGADOC nao aparece o menu geral do SPA; aparece apenas o menu do Extrator/SIGADOC.
- No SIGADOC, a lista de documentos possui automacao para visitar cada PGE-OFI visivel, abrir o documento e voltar pelo historico do navegador para seguir o proximo.
- O Extrator seleciona o Modelo do SIGADOC antes do Texto padrao: Oficio para modelos comuns e Comunicacao Interna para os novos tipos de pericia.
- Para `CUMP GERAL`, o Extrator aceita o texto padrao `SAUDE - CUMP` recriado, mesmo quando nao houver sufixo de subscritor.
- Antes de gravar ou assinar um oficio, o Extrator confirma que o SIGADOC concluiu a selecao do destinatario, inclusive ID e descricao da lotacao. Para `SES-UNIJUR`, ele repete a confirmacao assincrona e interrompe o fluxo caso algum campo obrigatorio nao seja confirmado.
- Novos tipos mapeados no Extrator: PERICIA ESTADO, PERICIA JUSTICA GRATUITA, AUDIENCIA e SINF DANO MORAL.
- PERICIA ESTADO e PERICIA JUSTICA GRATUITA preenchem, assinam e param na pagina pos-assinatura, sem tramitar, baixar arquivo ou copiar texto.
- AUDIENCIA e SINF DANO MORAL apenas preenchem a minuta, sem assinatura automatica.
- As bibliotecas jsPDF/jsPDF-AutoTable foram removidas para evitar rejeicao Blue Argon na Chrome Web Store; os relatorios usam Excel e impressao nativa do Chrome para salvar em PDF.
- A aba Programada da Triagem inclui o passo "Protocolar agravo de instrumento"; ele localiza o card "Realizar peticionamento em massa - Agravo de instrumento", seleciona "Minuta elaborada", marca "Selecao por pagina" e segue o mesmo fluxo de senha/assinatura dos demais protocolos.
- O relatorio de processos duplicados inclui as colunas "Manifestacao Sugerida" e "Prazo PJE".
- A coluna "Manifestacao Sugerida" do relatorio de duplicados aceita o identificador tecnico "manifestation" e a grafia legada "Manisfestacao Sugerida" usada pelo SPA.
- O relatorio de duplicados remove repeticoes exatas vindas da propria tabela do SPA e destaca visualmente pendencias realmente iguais quando os metadados principais coincidem.
- A conferencia de duplicados tambem compara o texto dos PDFs dos expedientes dentro do mesmo processo, sem depender de assunto semelhante.
- A comparacao por PDF usa pdf.js local, offscreen, texto bruto, cache interno e concorrencia baixa, sem CDN e sem biblioteca nova, e recebe destaque visual reforcado quando os expedientes forem iguais.
- Processos identificados como SES nao aparecem no relatorio de duplicados nem no atalho de abrir duplicados.
- Processos parcialmente marcados com "Conferido" continuam aparecendo; apenas processos com todas as pendencias marcadas ficam ocultos, e as pendencias marcadas recebem destaque vermelho.
- No relatorio de duplicados, o botao "Validar" aguarda a linha visivel do marcador particular "Conferido", com sua checkbox pronta em Meus marcadores, antes de clicar. Todo o processo ocorre em aba auxiliar de segundo plano, que e fechada ao final sem transportar a pessoa para fora do relatorio. Cada pendencia tambem possui o botao proprio `Sugerir encerramento`: ele abre apenas aquela pendencia em segundo plano, preenche o motivo e a observacao opcional no passo do SPA e salva; nao existe acao em lote para encerramento.

Teste local:
1. Abra chrome://extensions.
2. Ative o Modo do desenvolvedor.
3. Clique em "Carregar sem compactacao".
4. Selecione esta pasta: CDSP Extensao Geral - 2.28.
5. Acesse https://spa.pge.mt.gov.br/ e https://sigadoc.mt.gov.br/.

Publicacao:
- Envie o arquivo ZIP "CDSP Extensao Geral - 2.28.zip" no painel da Chrome Web Store.
