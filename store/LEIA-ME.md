# Publicar a MTPrev na Chrome Web Store

Pacote: `dist/mtprev-0.0.1-chrome-web-store.zip`, relativo à raiz do projeto. O ZIP contém `manifest.json` diretamente na raiz e somente os arquivos da lista `scripts/runtime-files.js`. Não envie o projeto inteiro nem o ZIP antigo.

## Arquivos para o painel

| Campo | Arquivo |
| --- | --- |
| Extensão | `../dist/mtprev-0.0.1-chrome-web-store.zip` |
| Nome e descrição | `FICHA_DA_LOJA.md` |
| Propósito, permissões e dados | `../JUSTIFICATIVAS_PRIVACIDADE_CHROME_WEB_STORE.txt` |
| Política a hospedar | `../privacy.html` |
| Ícone 128 × 128 | `../images/icon-mtprev128.png` |
| Imagem promocional 440 × 280 | `assets/promocional-440x280.png` |
| Capturas 1280 × 800 | `assets/01-menu-1280x800.png`, `assets/02-triagem-1280x800.png` |

## Antes de enviar

1. Hospede `privacy.html` em uma URL HTTPS pública, acessível sem login. O arquivo é independente e pode ser servido como uma página estática. Use essa URL no campo de política de privacidade. Nenhuma hospedagem foi criada por este preparo.
2. Em `chrome://extensions`, ative o modo de desenvolvedor e carregue a pasta `dist/chrome-store` para verificar no Chrome com sua conta autorizada. Teste os módulos no SPA/SPA2 e o preenchimento no SIGADOC em um fluxo de teste. A aprovação da loja não substitui essa verificação.
3. Nas opções da extensão, configure o serviço de andamentos somente com um endereço válido fornecido pelo administrador e marque a autorização. Sem isso, a consulta e o acompanhamento de andamentos ficam indisponíveis; os demais módulos não dependem dessa autorização.
4. As senhas fixas do SIGADOC e o endereço com chave do serviço externo foram retirados do pacote. Troque/revogue os valores que estavam no código anterior se ainda forem válidos; eles podem permanecer em backups e histórico Git. Não publique esses arquivos antigos. A senha de protocolo agora dura a sessão do navegador e deve ser informada novamente após reiniciar para as rotinas programadas.
5. A base `data/equipe.xlsx` usada pelos relatórios continua no pacote. Ela contém nomes de integrantes da equipe e ficará acessível a qualquer pessoa que baixar uma extensão pública; confira se essa base pode ser distribuída publicamente.

## Envio

1. Entre no [painel de desenvolvedor](https://chrome.google.com/webstore/devconsole), conclua seu cadastro e adicione um novo item.
2. Carregue o ZIP indicado acima.
3. Preencha a ficha usando `FICHA_DA_LOJA.md`, informe **Arthur Costa Dias**, **arthurcostadias1@gmail.com** e selecione distribuição **Pública**.
4. Envie ícone, imagem promocional e capturas. Informe a URL pública da política e os textos de privacidade/permissões.
5. Preencha as instruções de teste para a análise. O SPA/SIGADOC exigem autenticação: se o Google pedir acesso, forneça uma conta de demonstração autorizada no campo privado do painel. Não coloque credenciais no código, na descrição pública ou nas imagens. Consulte `INSTRUCOES_REVISAO.md`.
6. Confira os campos obrigatórios apontados pelo painel e envie para revisão. A conta, a hospedagem, o upload e o envio à análise ficam a cargo do desenvolvedor. Não foram executados automaticamente.

## Versões e tags

A numeração própria da MTPrev começa em `0.0.1`, substituindo a numeração herdada da extensão usada como base. O histórico Git é preservado.

Para cada lançamento, atualize `version` e `version_name` no `manifest.json`, mantenha as referências de versão na documentação consistentes e gere um novo pacote. Os empacotadores de Chrome e Firefox leem a versão do manifesto.

Use tags no formato `v0.0.1`, `v0.0.2` etc. Depois de validar e criar o commit do lançamento, crie a tag correspondente:

```bash
git tag -a v0.0.1 -m "MTPrev 0.0.1"
```

A tag identifica o commit do lançamento; ela não publica a extensão na loja. Para as próximas versões, aumente a numeração. O reinício em `0.0.1` se destina à primeira publicação própria: versões inferiores não atualizam instalações com uma versão maior sob a mesma identidade de extensão. Consulte as [regras de versão do Chrome](https://developer.chrome.com/docs/extensions/reference/manifest/version).

## Gerar novamente

```bash
node scripts/build-chrome-store.js
node --test tests/*.test.cjs
python3 tests/firefox_menu.py
python3 tests/firefox_menu.py --store-assets
```

O empacotador usa Node.js e o comando `zip`. Ele verifica referências a recursos e possíveis credenciais fixas antes de gerar o pacote e um arquivo SHA-256. Para uma nova versão já enviada à loja, aumente `version` no manifesto e gere outro ZIP.

O teste visual usa Firefox e uma página local isolada; não acessa dados reais nem testa atos autenticados em produção. Os testes Node verificam também o caminho de PDF offscreen do Chrome com simulações. Ainda é necessário conferir a versão no Chrome com os sistemas reais antes do envio. As imagens usam os mesmos scripts e estilos de interface, sem dados reais.

Referências oficiais consultadas: [preparação do pacote](https://developer.chrome.com/docs/webstore/prepare), [imagens](https://developer.chrome.com/docs/webstore/images), [campos de privacidade](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) e [envio para publicação](https://developer.chrome.com/docs/webstore/publish).
