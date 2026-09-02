CDSP Extensao Geral - 1.61

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
- O menu geral memoriza posicao e modulo ativo; a checkbox "Abrir minimizado" define se novas abas do SPA abrem com o menu principal recolhido.
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
- Os filtros de Assessor(a), Orgao julgador, Manifestacao sugerida e Polo passivo aceitam multiplas selecoes.
- O Fluxo de Correcao tambem filtra por Recebido; minuto(s), hora(s) e segundo(s) aparecem agrupados como "Hoje", e os demais periodos permanecem como opcoes proprias.
- A leitura dos filtros usa a posicao visivel das colunas da tabela, para alinhar "Manifestacao Sugerida" com os valores exibidos no SPA.
- Todos os filtros sao opcionais; se todos ficarem vazios, o botao "Abrir" pergunta antes de abrir todos os processos lidos.
- O botao "Abrir" abre as pendencias filtradas e, em cada aba, aciona automaticamente "Visualizar e editar minuta".
- No Fluxo de Correcao, a abertura da minuta usa o clique nativo do SPA, prepara o historico da aba em duas etapas e ajusta a seta nativa de voltar para retornar a pendencia correta.
- O Fluxo de Correcao inclui atalhos unicos para "Enviar ao procurador", "Sugerir encerramento de tarefa" e "Devolver ao assessor", cada um com opcoes "Tela da pendencia" e "Tela da Minuta".
- "Enviar ao procurador" direciona ao passo 2882, "Sugerir encerramento de tarefa" ao passo 2756 e "Devolver ao assessor" ao passo 2786, confirmando no botao Salvar quando a tela do passo abre.
- O modulo Redacao e Correcao inclui o fluxo "Simples Encerramento", com selecao progressiva de tipo, peca, ID, data e checklist.
- No Simples Encerramento, esta parametrizada a combinacao Preclusao Consumativa + Contestacao, que gera e copia automaticamente o texto em HTML formatado em Times New Roman 14, espacamento 1,15 e primeira linha de 1,25cm.
- A ferramenta de busca nos autos processuais fica carregada como ferramenta raiz nas paginas de processo, elaboracao de pecas, novos passos e cadastro de agravos do SPA, mesmo quando outro modulo esta ativo, mas nao aparece nas paginas de caixa/listagem de processos.
- A checkbox "Abrir minimizado" do painel de Autos define se novas paginas de processo abrem esse painel recolhido.
- A aba "Andamento PJE" consulta o Worker/MCP institucional e mostra movimentos com expedientes vinculados, ciencia, prazo legal, prazo final, parte, procuradoria e status do expediente.
- O visual da aba "Andamento PJE" foi ampliado, com timeline mais legivel, blocos de expediente maiores e grade clara para ciencia, expedicao e prazos.
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
- As mensagens de cobranca sao agrupadas por gestor de setor; Triagem usa gestores proprios e Correcao/Peca usam os gestores de producao.
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
- No relatorio de duplicados, o botao "Validar" localiza o marcador pelo nome "Conferido", marca a checkbox associada a esse marcador, confere se ele apareceu na pendencia e mantem a aba aberta se a confirmacao falhar.

Teste local:
1. Abra chrome://extensions.
2. Ative o Modo do desenvolvedor.
3. Clique em "Carregar sem compactacao".
4. Selecione esta pasta: CDSP Extensao Geral - 1.61.
5. Acesse https://spa.pge.mt.gov.br/ e https://sigadoc.mt.gov.br/.

Publicacao:
- Envie o arquivo ZIP "CDSP Extensao Geral - 1.61.zip" no painel da Chrome Web Store.
