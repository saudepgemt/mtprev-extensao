# Painel sólido — 14/10/2026

Este ajuste substitui o tema Liquid Glass descrito na verificação anterior.

Paleta recuperada de `git show HEAD:css/menu.css`: fundo `#17212b`, cabeçalho `#1f2d3a`, botões `#263544`, bordas `#344253`. Layout, ícones locais, logo única, formulários e acessibilidade foram preservados. Blur, superfícies de vidro, reflexos e gradientes foram removidos. Seleção usa fundo e peso de texto, sem contorno ou linha azul permanente; o hover azul é discreto e o foco de teclado permanece visível.

O `dblclick` do cabeçalho usa a mesma função do botão de minimizar, incluindo a gravação do estado existente. Ignora controles interativos e gestos identificados como arraste. As preferências de abertura e a lógica operacional dos módulos não foram alteradas.

Verificações locais no Chrome headless: 12 combinações módulo/largura e 18 combinações aba/formulário expandido em 350, 390 e 450px sem overflow; dez SVGs de navegação carregados; logo apenas no cabeçalho; nenhum erro JavaScript. Treze verificações adicionais passaram, incluindo duplo clique nos dois estados, controles excluídos, botão original, arraste, posição persistida, ausência de vidro e bordas neutras. Foram usados eventos de mouse e pointer simulados; a captura do pointer foi simulada na prévia, não houve interação física com o mouse. O hover foi revisado nas regras CSS; não foi validado com um cursor físico. APIs e respostas da extensão foram simuladas. Não houve acesso ao SPA autenticado nem execução de operações reais.

Prévia local: `mtprev-solid-preview.png` (fundo de demonstração, sem dados reais).

Para aplicar: recarregue a extensão em `chrome://extensions` e atualize todas as abas abertas do SPA. Confira o duplo clique na área livre do cabeçalho, o botão de minimizar e o arraste com o mouse no ambiente real.
