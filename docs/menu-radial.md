# Menu radial MTPrev — 2.70

O cabeçalho operacional contém a logo MTPrev, o título da opção selecionada
(Triagem, Duplicados, Peças, Fluxo de Correção etc.) e somente Voltar.
O mesmo botão Voltar retorna ao anel contextual; não é recriado a cada abertura.
Pronto, Abrir minimizado e o controle de minimizar permanecem no DOM para
compatibilidade com os handlers antigos, ocultos na apresentação radial.
O acompanhamento também usa logo, título e Voltar no cabeçalho.

Na navegação o wrapper é invisível: fundo transparente, sem borda/sombra e com
pointer-events:none nas áreas vazias. Recolhido mostra apenas o círculo central.
Expandido mostra Acompanhamento Especial no topo e os quatro módulos existentes.
O acompanhamento abre diretamente o painel existente, sem submenu e sem migrar
a lista salva. Selecionar um dos demais módulos mostra suas opções.
Selecionar a opção final oculta todo o radial e abre o painel operacional.
Cabeçalho e acompanhamento ficam disponíveis no painel; Voltar ao menu retorna
ao submenu. Formulários permanecem no DOM durante a navegação.

A camada de navegação usa os quatro módulos existentes de `content_bridge.js`.
Triagem aciona os seis botões reais de `.mtprev-context-nav` com seus listeners
originais. Redação e Coordenação expõem seções existentes por
`data-mtprev-radial-option`; Ofícios usa os títulos das seções disponíveis no contexto.
Selecionar uma seção abre o painel sem gerar relatório ou iniciar automação.
Os controles operacionais permanecem no DOM e mantêm seus estados.

O centro abre e recolhe o anel, com transições de 240 ms e escalonamento de 20 ms.
O arraste usa Pointer Events, captura do ponteiro, limiar de 6 px, atualização
por requestAnimationFrame/translate3d e gravação da posição ao soltar.
Quando recolhido, o limite considera apenas o círculo visível, com margem de
8 px das bordas da janela. O anel invisível não restringe o movimento. Ao abrir,
o menu completo é reposicionado para caber na tela. A posição recolhida é
restaurada antes de carregar o módulo ativo, inclusive junto às bordas.
O cabeçalho mantém arraste e duplo clique. Não há fonte ou biblioteca remota.

`Voltar`, `Voltar ao menu` e Escape permitem navegar sem recriar os
formulários. O anel fechado usa inert. Os controles de acompanhamento permanecem
na barra auxiliar do painel operacional. Anéis extensos usam páginas de opções reais.

## Verificação executada

No Firefox instalado, `python3 tests/firefox_menu.py` verifica o pacote real em
perfil temporário: arraste com ponteiro nativo aos quatro cantos, supressão do
clique após arrastar, posição após recarregar e expansão dentro da janela,
além dos submenus de Triagem. Usa uma página SPA local sem atos nos portais.

Executar `powershell -File tests/run_radial_browser.ps1` em um Windows com Chrome.
O teste carrega os arquivos reais JS/CSS do componente em uma página local com
handlers operacionais simulados. Passou em larguras de widget de 350, 390, 450 e
760 px; 450 px também com preferência de movimento reduzido.

Foram verificados abertura/fechamento, supressão de clique após arraste,
movimento conjunto dos círculos, persistência pela chamada do adaptador,
acionamento do handler da opção, retorno com Escape, preservação do formulário,
limites da janela, ausência de sobreposição de círculos, contenção das legendas
e instalação idempotente.

Os eventos de arraste são sintéticos. A captura nativa é substituída por um
stub apenas na página de teste, pois eventos sintéticos não criam um ponteiro
ativo do navegador. O teste de persistência verifica escrita/leitura no
localStorage, sem recarregar a extensão real. Chrome headless impõe largura
mínima à janela; as larguras citadas são do widget, não da janela do navegador.

Ainda é necessária homologação no SPA autenticado: carregamento real dos quatro
módulos, mouse/toque com captura nativa, navegação completa com Tab/Enter/Espaço,
duplo clique no cabeçalho e restauração da posição após recarregar a aba real.
As consultas, endpoints e rotinas de negócio não foram alterados.
