# Contexto para continuar no Codex

Este arquivo serve para retomar o trabalho em outro computador/notebook sem perder o contexto principal desta conversa.

## Repositorio

- GitHub: https://github.com/joaofgomess/extensao-geral.git
- Branch principal: `main`
- Versao atual da extensao: `1.65`
- Ultima tag publicada no repositorio: `v1.65`

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

## Regras permanentes combinadas

- Quando o usuario anexar uma versao nova de alguma extensao/modulo, comparar com as alteracoes feitas neste chat.
- Se uma alteracao feita aqui nao estiver no arquivo novo anexado, reaplicar a alteracao antes de consolidar.
- Nao reintroduzir o modo escuro na extensao geral.
- No SPA, as funcoes do Extrator ficam integradas no modulo `Oficios` do menu geral.
- No SIGADOC, carregar apenas o menu compacto proprio do Extrator/SIGADOC, sem menu geral do SPA e sem botoes soltos.
- O menu geral deve ser compacto, movel e com memoria opcional de minimizacao/posicao.
- A ferramenta de busca nos autos nao deve aparecer em paginas de caixa/listagem de processos.
- No Fluxo de Correcao, preservar o filtro `Recebido`, agrupando minuto(s), hora(s) e segundo(s) como `Hoje` e mantendo os demais periodos como opcoes proprias.
- No modulo Redacao e Correcao, preservar o botao pequeno `Copiar` ao lado de `Cadastrar Agravo`, com memoria dinamica da ultima tabela gerada.
- Preservar o fluxo `Simples Encerramento`; por enquanto somente `Preclusao Consumativa` + `Contestacao` esta parametrizado, e os demais tipos/pecas devem permanecer preparados para parametrizacao futura.
- No relatorio de duplicados, preservar a aplicacao persistente do marcador `Conferido`, priorizando o marcador particular ativo em `Meus marcadores` e o clique nativo no label/input antes de qualquer Ajax. Tentativas que falharem devem restaurar a checkbox; usar handler `change` do SPA ou fallback com `marker_procedures[...]` somente como contingencia, sempre com conferencia obrigatoria na pendencia antes de fechar a aba.
- Preservar o fluxo do GitHub: cada entrega importante deve gerar commit, tag e zip/pasta de output.

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
