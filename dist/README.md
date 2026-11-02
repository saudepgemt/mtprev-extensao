# Pacotes para instalar após clonar o repositório

- **Chrome / Edge:** carregue a pasta `dist/chrome-store` em `chrome://extensions` (Modo do desenvolvedor → Carregar sem compactação).
- **Firefox:** carregue `dist/firefox/manifest.json` em `about:debugging#/runtime/this-firefox` → Carregar extensão temporária.

Os pacotes estão prontos; não é preciso instalar Node.js para usá-los.

Para ativar o MCP no novo computador, abra as **Opções** da extensão, clique em **Importar configuração MCP**, escolha o arquivo `mtprev-mcp-settings.json` levado separadamente, marque a autorização e clique em **Salvar e autorizar** → **Testar conexão salva**.

O Git não transporta as configurações do navegador. O arquivo de transferência contém uma credencial e fica fora do repositório. Senhas de assinatura do SIGADOC não fazem parte dele.

Depois de alterar o código, atualize estes dois pacotes na raiz do projeto:

```bash
node scripts/build-github.js
```

Inclua as alterações de `dist/chrome-store` e `dist/firefox` no mesmo commit do código. `dist/local-test` e `dist/firefox-local-test` são cópias privadas e não devem ser versionadas.
