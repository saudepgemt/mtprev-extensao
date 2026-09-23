# CDSP - Extensão Geral

Extensão Chrome unificada da CDSP para uso no SPA/SIGADOC.

Versão atual versionada neste repositório: **2.30**.

Nesta versão, o fluxo de Ofícios/SIGADOC preserva a base estável da `v2.02` e inclui o PDF do expediente após a assinatura. Cada transição que pode recarregar a página registra a próxima etapa antes do clique. A extensão só remove a pendência e o PDF temporário depois de confirmar a página de destino; se o portal não avançar, interrompe o fluxo para conferência, sem reenviar a ação automaticamente. O painel do SIGADOC também restaura sua posição somente dentro da área visível da janela. A automação só continua quando iniciada pelo clique em `Preencher + Assinar` na própria aba.

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
