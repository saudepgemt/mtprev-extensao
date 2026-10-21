# Compatibilidade com o SPA Coreplan

O manifest já autoriza `https://pge.mt.spa.coreplan.com.br/*` em permissões, scripts de conteúdo e recursos públicos. Isso permite carregar a extensão, mas não adapta validações internas nem comprova que a estrutura do sistema é a mesma.

## Implementado

- `js/background.js`: valida os dois domínios; novas rotinas usam o Coreplan como caixa padrão; rotinas já salvas preservam seu domínio. A busca de abas não mistura caixas dos dois ambientes. No Coreplan, passos em massa precisam ser encontrados na interface: os IDs legados `2760` e `2778` não são presumidos.
- `js/extrator/content.js`: inicializa também no Coreplan e aceita URLs de processos, pastas e PDFs dos dois domínios.
- `js/process_watch_background.js`: aceita mensagens do novo SPA, usando a validação do background.
- `js/triagem/mtprev_pop_panel.js`: permite abrir links de expedientes do novo domínio.
- `js/triagem/spa_extension_panel.js`: reconhece links do Coreplan em documentos e ajusta a orientação sobre pop-ups.

O manifest editado pelo usuário foi preservado. Não foram alterados dados, cookies, processos ou rotinas salvas. Nenhuma automação foi executada no SPA.

## Mapear o ambiente autenticado

1. Recarregue a extensão em `chrome://extensions` e atualize a aba do novo SPA. Confira que a extensão carregada é a desta pasta.
2. Entre normalmente com sua conta no novo domínio. Sessão, cookies e preferências de página do domínio antigo não são automaticamente transferidos pelo navegador.
3. Abra o DevTools (F12), vá a **Sources → Snippets**, crie um snippet e cole o conteúdo de `tools/mapear-spa.js`. Execute na caixa e depois em um processo de exemplo. O snippet somente lê o DOM; não envia requisições, não clica e não altera dados. Não colete o relatório durante uma operação em andamento.
4. O console mostrará contagens de seletores, nomes técnicos das colunas, rotas, disponibilidade de jQuery/DataTables e presença do painel. IDs de processo/documento e parâmetros de consulta são omitidos; IDs de passos em massa são mantidos por serem configuração do fluxo.
5. Use esse relatório para comparar a estrutura real com a tabela abaixo. Se houver diferenças, adapte os seletores correspondentes antes de executar operações em lote.

| Área | Elementos a conferir | Arquivos principais |
| --- | --- | --- |
| Janela, menu e acompanhamento | Painel injetado; comunicação; DOM compartilhado | `js/content_bridge.js`, `js/process_watch_panel.js`, `js/radial_menu.js` |
| Triagem, duplicados, peças e filtros | `#procedures-box`, `tr.group-item`, colunas `data-name`, jQuery/DataTables | `js/triagem/spa_extension_panel.js` |
| Rotinas em massa | Links `/procedures/massive/...`, rótulos dos passos, perfil/caixa e usuário correto | `js/background.js` |
| Extração e anexos | `/procedures/:id`, `/folder`, `#main-procedure`, link e ID do expediente, `/coresigner/info/...pdf` | `js/extrator/content.js` |
| Redação e Coordenação | Colunas da caixa, campos dos formulários e rótulos de ações | `js/prazos/deadline_report_panel.js`, `js/gestao/management_report_panel.js` |
| Designações | IDs de usuários, equipe ativa e opções realmente oferecidas no novo SPA | `js/shared/active_team_database.js` e configurações de cada módulo |

Os demais IDs fixos de etapas, classificações e usuários existentes no projeto também precisam ser conferidos; não foram trocados por suposição. Se a nova aplicação mudou as rotas ou a estrutura da página, este ajuste de domínio é apenas a primeira parte da migração. O diagnóstico não identifica APIs carregadas apenas por chamadas de rede; nesses casos é necessário inspecionar a aba Network, sem compartilhar cookies, tokens ou dados pessoais.

Para usar a rotina programada no novo ambiente, revise e salve a configuração na caixa correta do Coreplan. A migração não converte automaticamente configurações que ainda apontam para o domínio antigo.

## Validação e limite

`node --test tests/spa_hosts.test.cjs`: 13 testes passaram, cobrindo ambos os domínios, bloqueio de hosts não autorizados, URLs de processo/PDF, isolamento das abas por origem, descoberta de links e manutenção dos fallbacks apenas no ambiente legado. Testes usam funções reais e APIs simuladas; não acessam o SPA.

A página pública do Coreplan não pôde ser consultada pela ferramenta de navegação desta sessão. Não houve acesso autenticado: geração de relatórios, protocolo, ciência, classificação, encerramento, assinatura e tramitação reais não foram validados. A confirmação completa depende do mapeamento acima.
