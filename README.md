# CDSP - Extensão Geral

Extensão Chrome unificada da CDSP para uso no SPA/SIGADOC.

Versão atual versionada neste repositório: **2.65** (`manifest.version = 2.0.65`).

O fluxo de Ofícios/SIGADOC confirma classificação e destinatário antes de preencher descrição, assunto, tabela e fechamento. O conteúdo do editor e o campo usado na gravação são conferidos antes de iniciar a assinatura, com recuperação automática quando o SIGADOC recarrega o formulário.

Após a assinatura, a extensão inclui o PDF do expediente como Capturado quando ele estiver disponível. Uma falha nessa inclusão é registrada e o fluxo segue sem o anexo, mantendo a tramitação obrigatória. A seleção do modelo Capturado usa um único clique nativo; a extensão acompanha a gravação, a autenticação, a Juntada e o retorno ao ofício pai. A continuação depende do comando inicial em `Preencher + Assinar`, e os estados são salvos antes das transições entre páginas.

Desde a versão 2.63, `Cadastrar Agravo` seleciona exatamente o assunto **Urgência**. A versão 2.64 também inclui **Avaliação Psicopedagógica**, **Med Escolar**, **Setasc Idoso**, **Infor SEDUC** e **Alta Home Care** no ciclo completo de assinatura, Capturado quando houver expediente, tramitação e encerramento no SPA. Orçamento permanece fora desse ciclo.

Este repositório contém a extensão. O aplicativo de operações tem versionamento separado; sua versão 0.3.11 utiliza a extensão 2.64.

## Estrutura

- `manifest.json`: manifesto MV3 da extensão.
- `js/`, `css/`, `images/`, `data/`: código e recursos da extensão.
- `README_CARREGAR.txt`: instruções para carregar localmente no Chrome.
- `GUIA_DE_UPDATES.txt`: regras de manutenção para próximos updates.

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
