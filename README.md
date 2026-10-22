# CDSP - Extensão Geral

Extensão unificada da CDSP para uso no SPA/SIGADOC, com pacotes para Chrome e Firefox.

Versão atual: **2.72** (`manifest.version = 2.0.72`).

## Chrome Web Store

Execute `node scripts/build-chrome-store.js` para gerar
`dist/mtprev-2.0.72-chrome-web-store.zip`, com Manifest V3 na raiz e somente os
arquivos de execução. Requer Node.js e o comando `zip`.
O [guia de publicação](store/LEIA-ME.md) reúne os textos da ficha pública,
justificativas de permissões, imagens e instruções para hospedar a política de
privacidade. Desenvolvedor: Arthur Costa Dias — arthurcostadias1@gmail.com.

A versão de publicação remove as credenciais fixas do código. A consulta de
andamentos exige configurar e autorizar o serviço externo nas opções da extensão.
As senhas de assinatura são fornecidas pelo usuário; a senha de protocolo dura
somente a sessão do navegador e precisa ser informada novamente após reiniciar.
Chrome mínimo: 116. Teste a pasta `dist/chrome-store` no Chrome com uma conta
autorizada antes de enviar o ZIP à loja.

## Teste local com as credenciais anteriores

Execute `node scripts/build-local-test.js --firefox` para gerar cópias locais com
as credenciais de teste de `.local/test-credentials.json`. Esse arquivo é privado,
ignorado pelo Git e não entra no pacote da loja. O comando usa o código atual dos
painéis, portanto execute-o novamente depois de editar a extensão.

- Chrome: em `chrome://extensions`, use **Carregar sem compactação** e selecione
  `dist/local-test`.
- Firefox: em `about:debugging#/runtime/this-firefox`, use **Carregar extensão
  temporária** e selecione `dist/firefox-local-test/manifest.json`.

Desative a outra instalação da MTPrev durante o teste para evitar duas extensões
atuando na mesma página. A cópia aparece como **MTPrev - Extensão Geral (teste
local)**. O serviço de andamentos é configurado na primeira inicialização; as
credenciais anteriores do SIGADOC são usadas quando a identidade correspondente
é reconhecida na página. Uma senha digitada no menu tem preferência. A opção de
desativar o serviço continua funcionando e não é revertida ao reiniciar.

Essas pastas contêm credenciais e servem somente para testes locais. Para publicar,
continue usando `scripts/build-chrome-store.js` e o ZIP específico da loja.

O fluxo de Ofícios/SIGADOC confirma classificação e destinatário antes de preencher descrição, assunto, tabela e fechamento. O conteúdo do editor e o campo usado na gravação são conferidos antes de iniciar a assinatura, com recuperação automática quando o SIGADOC recarrega o formulário.

Após a assinatura, a extensão inclui o PDF do expediente como Capturado quando ele estiver disponível. Uma falha nessa inclusão é registrada e o fluxo segue sem o anexo, mantendo a tramitação obrigatória. A seleção do modelo Capturado usa um único clique nativo; a extensão acompanha a gravação, a autenticação, a Juntada e o retorno ao ofício pai. A continuação depende do comando inicial em `Preencher + Assinar`, e os estados são salvos antes das transições entre páginas.

Desde a versão 2.63, `Cadastrar Agravo` seleciona exatamente o assunto **Urgência**. A versão 2.64 também inclui **Avaliação Psicopedagógica**, **Med Escolar**, **Setasc Idoso**, **Infor SEDUC** e **Alta Home Care** no ciclo completo de assinatura, Capturado quando houver expediente, tramitação e encerramento no SPA. Orçamento permanece fora desse ciclo.

Este repositório contém a extensão. O aplicativo de operações tem versionamento separado; sua versão 0.3.11 utiliza a extensão 2.64.

## Estrutura

- `manifest.json`: manifesto MV3 da extensão.
- `js/`, `css/`, `images/`, `data/`: código e recursos da extensão.
- `README_CARREGAR.txt`: instruções para carregar localmente no Chrome.
- `GUIA_DE_UPDATES.txt`: regras de manutenção para próximos updates.

## Carregar no Firefox

Requisitos: Firefox **128 ou superior** e Node.js **18 ou superior** para gerar o
pacote. Na pasta do projeto, execute:

```sh
node scripts/build-firefox.js
```

1. No Firefox, abra `about:debugging#/runtime/this-firefox`.
2. Clique em **Carregar extensão temporária…** e selecione
   `dist/firefox/manifest.json` (não o manifesto da raiz).
3. Autorize o acesso aos sites usados pela extensão, se solicitado, e recarregue
   as abas do SPA/SIGADOC.

Essa instalação precisa ser carregada novamente após reiniciar o Firefox.
Depois de editar o código, gere o pacote novamente e clique em **Recarregar**
na tela de depuração. Para instalação permanente no Firefox padrão, o pacote
precisa passar pela assinatura da Mozilla.

O gerador mantém o manifesto da raiz para Chrome e cria um manifesto Firefox
com scripts de background ordenados e identificação estável. A leitura e a
pesquisa de PDFs usam o mesmo PDF.js local diretamente no background do Firefox.
O pacote contém apenas os recursos da extensão; arquivos obrigatórios ausentes
interrompem a geração, incluindo os scripts dos painéis carregados sob demanda.

O carregamento da Triagem usa as dependências presentes no repositório e só
informa sucesso depois de confirmar a montagem do painel. Falhas aparecem no
menu radial. As confirmações de ciência, classificação e encerramento continuam
disponíveis com o diálogo nativo quando o adaptador opcional não está instalado.

Validação automatizada:

```sh
node --test tests/*.test.cjs
```

Teste dos cliques com o Firefox instalado e Python 3:

```sh
python3 tests/firefox_menu.py
# Para outro caminho do navegador:
python3 tests/firefox_menu.py --firefox /caminho/para/firefox
```

Esse teste usa um perfil temporário e uma cópia do pacote autorizada a acessar
somente a página de teste local adicional. Confere os seis submenus da Triagem,
seus controles visíveis, a base de assessores, a restauração após recarregar e
os erros de carregamento de scripts e ícones. Também gera o relatório de
duplicados em uma tabela local com grupos recolhidos, carregamento atrasado e
duas páginas, e verifica o contraste dos botões nos temas claro e escuro.
Não executa atos nos portais reais.

O relatório de duplicados expande cada grupo da página e aguarda os expedientes
antes de comparar. Mantém os filtros e a seleção de páginas existentes; sem
seleção, percorre todas as páginas. O painel informa o progresso, a conferência
dos PDFs e eventuais falhas de carregamento, permitindo tentar novamente.

As cores dos botões usam `css/theme.css`, compartilhado pelo menu, pelos
relatórios e pelo SIGADOC. O tema acompanha os marcadores claro/escuro da página
(`cdsp-spa-dark-mode`, `dark`, `data-theme` ou `data-bs-theme`) e aceita a escolha
explícita `data-mt-theme="light|dark"` no menu. Os botões nativos do portal não
são alterados.

Também foram verificados no Firefox 157, em perfil temporário: carregamento,
mensagens, armazenamento, alarme de acompanhamento e extração/pesquisa em PDF de
duas páginas. Os fluxos autenticados de SPA/SIGADOC ainda precisam de conferência
no ambiente de uso.

Referências: [background no Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background),
[suporte a MAIN no Firefox 128](https://blog.mozilla.org/addons/2024/07/10/manifest-v3-updates-landed-in-firefox-128/)
e [instalação temporária](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).

## Versionamento

Cada release deve ser registrada com commit e tag:

```powershell
git add .
git commit -m "Versão x.xx"
git tag vx.xx
git push
git push origin vx.xx
```

Os arquivos `.zip` gerados para publicação não ficam no Git por padrão.

## Acompanhamento de processos (2.65)

No menu do SPA, use **Acompanhar processos**, informe o CNJ e a instancia e clique em **Acompanhar este processo**. A consulta PJe/TJMT roda a cada 30 minutos com o Chrome aberto, com verificacao manual, historico local, indicador de novas alteracoes e notificacoes. A primeira consulta cria a referencia. Falhas preservam os dados anteriores e aparecem no painel. A lista pertence ao perfil do Chrome. Encerramentos internos do SPA nao sao consultados. Recarregue a extensao e as abas do SPA apos atualizar.

Teste automatizado: node --test tests/process_watch.test.cjs

## Menu radial MTPrev (2.66)

Navegacao pelos quatro modulos existentes com logo central, submenus radiais, SVGs locais, arraste por Pointer Events e preservacao dos paineis operacionais. Detalhes e limites dos testes em [docs/menu-radial.md](docs/menu-radial.md).

Na versao 2.67, a navegacao radial fica visualmente solta, sem card. O painel operacional aparece somente apos selecionar uma opcao final; Voltar ao menu restaura o submenu.

## Apoio ao POP MTPrev (2.68)

Acompanhamento Especial no topo do menu radial, identificacao separada de destinatarios Estado/MTPrev no Andamento PJe e novas secoes de diagnostico, duplicidade e grupos prioritarios para revisao humana. Somente fluxos SPA do manual fornecido. Detalhes, fontes e limites: [adequacao-pop-mtprev.md](docs/adequacao-pop-mtprev.md).

Na versao 2.69, Duplicados volta a usar somente a logica antiga, com Abrir Duplicados e Relatorio Duplicados compartilhados entre Saude e MTPrev. A conferencia separada de duplicidade MTPrev foi removida.

Na versao 2.70, os paineis apresentam logo MTPrev, titulo da opcao e apenas Voltar no cabecalho. O carregamento de PDFs continua vinculado aos comandos de leitura, nao a abertura do menu.

## Busca no workspace com carregamento incremental (ajuste de Triagem)

No workspace, o campo **Processo ou expediente** pesquisa o conteúdo já carregado. Para procurar entre todos os cards do workspace, digite um identificador e pressione **Enter** ou clique em **Buscar em todos os cards da caixa**. A extensão percorre a lista, usa **Carregar mais** quando disponível, acumula os cards lidos e mostra a cobertura. Se não houver total verificável, a leitura é informada como parcial/não confirmada. Ações operacionais continuam independentes dessa seleção de diagnóstico.

Teste local: `node --test tests/workspace_lazy.test.cjs tests/lazy_records.test.cjs`. A leitura na interface autenticada ainda exige teste supervisionado.
