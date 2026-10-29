# MTPrev — E-mail HTML e consulta diária do Acompanhamento Especial

## O que esta atualização entrega

- E-mail responsivo no estilo azul-petróleo, compatível com Gmail e Outlook: cabeçalho, número CNJ, assunto, partes, origem, movimentações, rodapé e botões para o SPA.
- Assunto: `[Acompanhamento Especial] Movimentação no Processo X - Assunto - Partes`. O teste acrescenta `[TESTE]` antes do assunto.
- Envio por Gmail API em MIME `multipart/alternative`: HTML estilizado + texto simples (fallback). Os destinatários permanecem em Bcc.
- Links **Abrir expediente no SPA** (somente quando o ID interno do expediente foi informado/identificado) e **Localizar processo no SPA** (busca pelo CNJ).
- Para cada processo, em **Dados do processo e destinatários de notificações**, é possível salvar **Assunto**, **Partes** e **ID do expediente**. São campos opcionais; dados ausentes não são inventados.
- **Enviar última movimentação (TESTE)**, global ou por processo: escolhe a movimentação mais recente salva para enviar uma mensagem HTML de teste aos destinatários efetivos, após confirmação. O teste não marca a movimentação como nova nem altera o prazo da consulta diária.
- Só há alerta automático quando uma **movimentação do PJe realmente nova** é detectada após a primeira consulta. Alteração isolada no registro de expediente não envia e-mail automático.
- Verificação automática limitada a uma rodada por **24 horas** nesta instalação: alarme da extensão + recuperação quando o Chrome inicia ou abre o SPA. Verificações manuais continuam disponíveis e não resetam o relógio automático.
- Descrições identificadas como sigilosas pelo PJe são substituídas por texto genérico, orientando a consultar os autos.

## Instalação incremental

1. Faça backup dos arquivos de sua instalação (principalmente se tiver alterações não commitadas).
2. Extraia o ZIP **por cima da pasta pai que contém `mtprev-extensao/`**, mantendo a estrutura das pastas e substituindo somente os arquivos incluídos.
3. Confira que os scripts `js/watch_mail_template.js`, `js/watch_mail_oauth.js` e `js/process_watch_background.js` estão na pasta `js/`.
4. Recarregue a extensão em `chrome://extensions` e depois atualize a página SPA com `Ctrl+Shift+R`.
5. No Acompanhamento Especial, abra o processo e clique em **Verificar agora** se ainda não houver movimentação salva.
6. Abra **Dados do processo e destinatários de notificações**, informe Assunto e Partes; para o botão direto, inclua o **ID interno real** do expediente e clique **Salvar destinatários**.
7. Na seção **Notificações por Gmail**, confirme a lista padrão, inclusões e exclusões por processo e o consentimento do remetente nas opções da extensão.
8. Clique em **Enviar última movimentação (TESTE)** e confira destinatários e assunto na confirmação antes de enviar.

Um exemplo visual está em `docs/EXEMPLO_EMAIL_ACOMPANHAMENTO.html`, com número e pessoas fictícios. Abra no navegador para examinar o layout; não é preciso hospedar esse HTML. O e-mail real é gerado programaticamente pelo script, sem carregar imagens externas.

## Configuração Google indispensável

- A Gmail API deve estar ativada no Google Cloud, com cliente OAuth do tipo **Extensão do Chrome** para o ID `hlmpphdngoibhfhlgheobekbkhabcgpj`.
- `manifest.json -> oauth2.client_id` precisa conter o **Client ID real**, não o texto de exemplo. **Este pacote não altera o manifesto**, preservando o ID que você já colocou.
- A conta Gmail remetente precisa estar conectada e ter concedido o escopo `gmail.send` (e `userinfo.email` para verificar a identidade). O campo remetente deve ser a mesma conta Google autenticada.
- A opção **Enviar avisos automaticamente** e o consentimento devem estar ativados. O envio de teste sempre exige confirmação explícita.

## Limitações e segurança

- **Sem servidor, a verificação não ocorre enquanto o Chrome está fechado ou o computador desligado.** Quando reabrir, a extensão tenta a verificação que estiver pendente. Alarme não garante horário exato se a máquina estiver suspensa.
- **A conta Gmail institucional só envia na instalação autorizada**; processos cadastrados em outros computadores não são automaticamente sincronizados.
- A primeira consulta estabelece a referência e **não envia e-mail**. O teste manual pode enviar a última movimentação já armazenada mesmo que não seja nova.
- **O botão Abrir expediente depende do ID interno correto.** Sem ele, o botão de busca por CNJ é mostrado. Não inventamos IDs.
- Se o PJe não tiver descrição de movimentação salva, o teste orientará a consultar o processo antes.
- Uma falha de envio automático fica registrada no card do processo, mas a versão atual **não possui fila de reenvio garantido**. Uma falha do Gmail não garante notificação posterior.
- A confirmação da Gmail API significa aceite do envio, não entrega ou leitura.
- Só cadastre destinatários autorizados a receber as informações. O e-mail contém dados processuais potencialmente protegidos pela LGPD e por regras de sigilo.
- No Google OAuth `Externo / Testando`, tokens podem expirar rapidamente; antes de implantar na instituição, planeje a configuração de produção.

## Testes locais

- `node --check` nos JavaScripts alterados.
- `node --test tests/watch_mail_oauth.test.cjs tests/process_watch.test.cjs tests/process_watch_daily.test.cjs tests/firefox.test.cjs`.
- Testes do envio usam um simulador da Gmail API; nenhum e-mail real foi enviado durante o desenvolvimento.
- A suíte completa pode continuar indicando falhas preexistentes em Autos/PDFs e empacotamento.
