# MTPrev — Gmail OAuth + destinatários no Acompanhamento Especial

## O que foi implementado

- Cliente OAuth do tipo **Extensão do Chrome** via `chrome.identity.getAuthToken` (Google, sem cliente secreto).
- Conta remetente institucional indicada e **verificada** pela identidade retornada pelo Google (`userinfo.email`).
- Escopo exclusivo de envio `gmail.send` mais escopo para identificar a conta `userinfo.email`; não há leitura da caixa de entrada.
- Lista de destinatários **padrão** nas Configurações da extensão **e** no Acompanhamento Especial.
- Para cada processo CNJ: adicionar e-mails específicos, desmarcar destinatários padrão ou desativar notificações.
- Botões **Enviar e-mail de teste** no Acompanhamento e em cada processo. Antes do envio, é mostrado `confirm()` com a lista real de destinatários.
- Envio real pelo Gmail API `users.messages.send`; destinatários em **Bcc** e remetente em **To**.
- Testes não contêm número CNJ ou descrições dos autos.
- Alertas automáticos apenas quando a consulta detecta movimentações novas depois da primeira leitura e após o usuário ativar o envio e consentir.
- Erros de envio ficam visíveis no acompanhamento. Uma falha de envio automático não é reenviada automaticamente nesta versão.

## Configuração necessária no Google Cloud

1. No projeto **Envio de Email - PJE**, habilite a **Gmail API**.
2. Em **Google Auth Platform > Público-alvo**, enquanto `Externo / Testando`, inclua o **Gmail institucional remetente** como usuário de teste.
3. Em **Acesso a dados**, adicione os escopos:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/userinfo.email`
4. Em **Clientes > Criar cliente**, escolha **Extensão do Chrome**. Nome sugerido: `MTPrev - Alertas Gmail`.
5. Informe o **ID da extensão**: `hlmpphdngoibhfhlgheobekbkhabcgpj`. **Não** é o Client ID OAuth.
6. Ao criar o cliente, copie o valor final parecido com `123456789-abc.apps.googleusercontent.com`.
7. Abra `manifest.json` no projeto e substitua **somente**:

   `COLE_AQUI_SEU_CLIENT_ID.apps.googleusercontent.com`

   pelo **Client ID OAuth** real. Não use Client Secret. Não é necessário preencher URI para o cliente do tipo Extensão do Chrome.
8. Recarregue a extensão em `chrome://extensions` e atualize a página do SPA.
9. Em **Configurações MTPrev > Notificações Gmail**, informe o remetente institucional, destinatários padrão, autorize o compartilhamento e, se desejar, marque envio automático. Clique **Salvar** e depois **Conectar Gmail**.
10. Confirme o primeiro teste para um endereço sob seu controle. Depois use o teste por processo para verificar acréscimos e exclusões.

**Atenção:** o ID `hlmpphdngoibhfhlgheobekbkhabcgpj` deve permanecer o mesmo após recarregar a extensão. Mover a pasta de extensão descompactada pode mudar o ID; nesse caso, o cliente OAuth precisará ser revisado ou o ID estabilizado com a chave pública adequada. Nunca coloque a chave privada da extensão no projeto.

## Como funcionam as listas

Destinatários efetivos = `(padrões ∪ adicionais do processo) − excluídos do processo`.

- Não são cadastrados mais de **40 destinatários** por envio.
- Repetições são removidas e endereços são validados.
- A lista padrão pertence ao perfil local da extensão, assim como as exceções de cada processo.
- Exclusões sobrepõem inclusões caso o mesmo endereço apareça nos dois lugares.
- Para desativar todos os avisos de um processo, desmarque **Enviar avisos deste processo** e salve.

## Restrições de segurança e operação

- **O pacote não está pronto para enviar e-mails reais até o Client ID OAuth ser inserido no manifesto e a conta ser autorizada.** O ID da extensão, sozinho, não habilita a conexão.
- O acesso via Gmail é **individual por perfil do Chrome**. Para um único remetente institucional, autorize somente a instalação destinada a executar notificações. **Não distribua tokens ou credenciais** aos outros usuários.
- **Não há sincronização entre instalações**: se outra pessoa cadastrar um processo em outro Chrome, esse processo não aparece automaticamente na lista do remetente. Para compartilhamento e notificações com navegador fechado, será necessário um backend com armazenamento centralizado, autenticação e auditoria.
- A consulta do Acompanhamento Especial é disparada ao abrir páginas do SPA ou manualmente em **Verificar agora**. Esta implementação não cria monitoramento independente 24 horas.
- O Google OAuth no modo `Externo / Testando` poderá exigir reautorização frequente. Planeje produção e eventual verificação antes de uso institucional contínuo.
- Envie apenas dados processuais que possam ser comunicados aos destinatários escolhidos, considerando o sigilo dos processos, as normas institucionais e a LGPD.
- A confirmação do Gmail API significa que ele aceitou o envio, **não** que a mensagem foi entregue ou lida.
- Mensagens automáticas que falharem são indicadas como erro, mas **não** são reenviadas automaticamente nesta etapa.

## Instalação

Extraia o ZIP sobre a pasta atual da extensão, preservando a estrutura `mtprev-extensao/` e substituindo **somente** os arquivos listados na atualização. Não apague a pasta `.local` do projeto existente. Recarregue o Chrome e faça o primeiro teste.

## Verificações realizadas

- Verificação de sintaxe JavaScript e de sintaxe JSON do manifesto.
- Testes com Gmail API simulada; não houve acesso à conta institucional ou envio real.
- Suíte existente: 62 de 70 testes aprovados; 8 falhas anteriores relacionadas aos recursos de Autos e dependências de empacotamento permanecem fora do escopo.
