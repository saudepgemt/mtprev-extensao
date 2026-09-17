# CDSP - Extensão Geral

Extensão Chrome unificada da CDSP para uso no SPA/SIGADOC.

Versão atual versionada neste repositório: **1.90**.

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
