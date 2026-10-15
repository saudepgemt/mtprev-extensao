# Verificação do MTPrev — 14/10/2026

## Diagnóstico e correções

- **Contexto invalidado:** os rastreamentos enviados apontam para `chrome.storage.local.get` e `chrome.runtime.getURL` em versões anteriores do código. Essas APIs deixam de funcionar nos scripts que permaneceram em uma aba após a extensão ser recarregada, atualizada ou desativada. A correção anterior protegia essas chamadas, mas o bridge ainda mantinha um intervalo de observação das rotas. Agora a invalidação interrompe esse intervalo e os listeners de rota, bloqueia novas chamadas de comunicação e preserva a orientação para atualizar a aba. O extrator comunica esse estado ao bridge por um evento local; nenhum payload operacional foi alterado. Outros erros continuam sendo reportados.
- **Carregamento do tema:** `manifest.json` inclui `css/menu.css` depois de `css/extrator.css` no SPA. Os módulos são criados dinamicamente no DOM da própria página; a janela principal não usa Shadow DOM nem iframe. Algumas ferramentas de documentos usam iframes, mas não hospedam essa janela. O problema encontrado não era um CSS fora do manifest.
- **Ícones:** os caminhos relativos dos SVGs não eram adequados ao CSS de um content script. Foram substituídos por `chrome-extension://__MSG_@@extension_id__/images/material-rounded/...`, conforme a documentação do Chrome. Os arquivos existem e o manifest já declara `images/material-rounded/*.svg` como recursos acessíveis ao SPA. Não há fontes ou CDN em tempo de execução. Os ícones das abas, antes ocultos até 380px, agora ficam acima dos textos nessas larguras.
- **Liquid Glass:** a janela anterior estava 94% opaca. Agora tem opacidade de fundo de 78%, blur de 16px, reflexo discreto e superfícies translúcidas. O fallback sólido permanece fora de `@supports`. Regras antigas da logo interna foram removidas; o elemento continua oculto, preservando o DOM. Foco visível e redução de movimento continuam presentes.
- **PDF:** o erro enviado comprova que uma URL válida não foi identificada; não comprova ausência física do arquivo. A busca continua limitada a páginas identificadas no pacote e consultas GET. Uma falha de rede/HTTP numa página não impede tentar a próxima. Se todas falham, o erro de consulta é preservado. Se não há identificação segura, aparece uma mensagem específica, sem selecionar PDFs ambíguos ou criar um substituto. Os dados extraídos continuam sendo salvos e copiados; o botão indica alerta quando o anexo não está disponível. A invalidação do contexto não é apresentada como ausência de PDF.

Referência dos caminhos CSS: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts#access-other-files

## Verificações realizadas

- Manifest convertido para JSON e existência de todos os scripts e estilos declarados verificada.
- Caminhos dos SVGs no CSS verificados contra os arquivos empacotados.
- `git diff --check` sem erros.
- 18 verificações de comunicação e contexto no Chrome headless com APIs simuladas: armazenamento, mensagens, invalidação síncrona e em callbacks, parada de verificações, preservação de falhas não relacionadas e ausência de erros/rejeições sem tratamento.
- 21 verificações de PDF com respostas simuladas: identificação por ID, links relativos, iframe, HTML, deduplicação, ambiguidade, origem externa, preservação do link, armazenamento de PDF válido, rejeição de HTML, recuperação por consultas de leitura e distinção de erro HTTP.
- Prévia local carregando os arquivos reais `content_bridge.js`, Triagem, Redação e Coordenação: 12 combinações de módulo/largura e 18 combinações de aba/formulário expandido em 350, 390 e 450px. Nenhum overflow horizontal ou erro de JavaScript registrado.
- Os dez SVGs da navegação foram carregados como imagens dos arquivos reais, além da inspeção das máscaras CSS. Logo do cabeçalho visível, nenhuma logo interna visível e minimização correta.
- Inspeção visual de captura a 390px, disponível em `mtprev-liquid-glass-preview.png`. O fundo é uma página de demonstração, sem dados reais.

Na prévia local, as URLs com `__MSG_@@extension_id__` são mapeadas explicitamente para os arquivos do projeto, simulando a substituição feita pelo Chrome. A prévia valida renderização e arquivos, mas não é uma sessão instalada da extensão no SPA.

## Limitações e pendências

Não houve acesso ao SPA autenticado. Não foram executadas ações reais de triagem, protocolo, relatórios, edição de processos, assinatura ou tramitação. A disponibilidade do PDF que originou o aviso não pode ser confirmada sem a página e o documento reais. Não foi identificado um runner de testes automatizados existente no projeto; os testes descritos são verificações locais específicas desta correção.

## Recarregar e conferir

1. Em `chrome://extensions`, confira se a extensão carregada usa esta pasta do projeto e recarregue-a.
2. Atualize todas as abas abertas do SPA. Scripts de abas antigas não recuperam um contexto invalidado por conta própria.
3. Confira a logo única, os ícones das duas navegações, o vidro, a minimização e as preferências já existentes.
4. Repita a extração do caso que apresentou aviso de PDF. Se persistir, registre a mensagem nova, o ID do expediente e a estrutura do link exibido na página, sem alterar o processo.
5. Se aparecer novamente a linha antiga do rastreamento, confira se outra cópia da extensão está carregada e se a aba realmente foi atualizada.
