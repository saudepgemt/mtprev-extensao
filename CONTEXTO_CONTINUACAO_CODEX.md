# Contexto para continuar no Codex

Este arquivo serve para retomar o trabalho em outro computador/notebook sem perder o contexto principal desta conversa.

## Repositorio

- GitHub: https://github.com/joaofgomess/extensao-geral.git
- Branch principal: `main`
- Versao atual da extensao: `1.56`
- Ultima tag publicada no repositorio: `v1.56`

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

## Regras permanentes combinadas

- Quando o usuario anexar uma versao nova de alguma extensao/modulo, comparar com as alteracoes feitas neste chat.
- Se uma alteracao feita aqui nao estiver no arquivo novo anexado, reaplicar a alteracao antes de consolidar.
- Nao reintroduzir o modo escuro na extensao geral.
- Extrator e modo escuro devem ficar separados do menu geral quando existirem como extensoes separadas.
- O menu geral deve ser compacto, movel e com memoria opcional de minimizacao/posicao.
- A ferramenta de busca nos autos nao deve aparecer em paginas de caixa/listagem de processos.
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

Gerar pasta e zip em:

```text
D:\Users\05170669127\Documents\Codex\2026-08-26\outputs\
```

No notebook, ajustar o caminho para o usuario local.

## Observacao sobre chats

O ideal e entrar no notebook com a mesma conta OpenAI/Codex e procurar esta tarefa no historico do Codex. Se ela nao aparecer imediatamente, usar este arquivo como ponto de retomada e o repositorio GitHub como fonte do estado real do codigo.
