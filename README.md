<p align="center">
  <img src="images/logo-mtprev.png" alt="Identidade visual do MTPrev" width="220">
</p>

<h1 align="center">MTPrev — Extensão Geral</h1>

<p align="center">
  Uma forma mais simples de consultar, organizar e acompanhar processos e expedientes no dia a dia.
</p>

<p align="center">
  <strong>Chrome / Chromium · Firefox · SPA clássico · SPA2 (Coreplan) · SIGADOC</strong>
</p>

<p align="center">
  <a href="#o-projeto">O projeto</a> ·
  <a href="#funcionalidades">Funcionalidades</a> ·
  <a href="#instalação">Instalação</a> ·
  <a href="#desenvolvimento">Desenvolvimento</a> ·
  <a href="#equipe">Equipe</a>
</p>

---

## O projeto

O **MTPrev** é uma extensão de navegador criada para apoiar quem trabalha diariamente com processos judiciais e administrativos. A proposta é reunir, em uma interface acessível, ferramentas que economizam tempo em tarefas repetitivas — sem tirar do profissional a responsabilidade pela análise e pelas decisões.

A extensão acrescenta recursos ao **SPA da PGE/MT**, tanto na interface clássica quanto no **workspace Coreplan (SPA2)**, e oferece rotinas de apoio ao **SIGADOC**. Ela não substitui esses sistemas, não amplia as permissões do usuário e não dispensa a conferência das informações nas fontes oficiais.

O projeto é desenvolvido de maneira colaborativa, com atenção à usabilidade, à organização dos fluxos de trabalho e à adaptação às mudanças de interface dos sistemas.

## Funcionalidades

### Menu radial e navegação

O menu radial reúne os módulos da extensão em um único ponto da tela. Pode ser movido, recolhido e expandido, permitindo abrir as ferramentas sem interromper a navegação. Os painéis seguem uma identidade visual em **azul-petróleo**, com foco em legibilidade e aproveitamento do espaço.

### Triagem de processos

A triagem oferece recursos de apoio à leitura e ao tratamento de expedientes: atualização da lista, consulta de informações, abertura pontual de processos e preparação de ações compatíveis com a tela e com as permissões disponíveis.

No **SPA2**, a leitura da mesa pode ser feita por lotes, preservando os filtros selecionados e mostrando o progresso. Quando a cobertura não pode ser confirmada, a extensão deve indicar que o resultado é parcial.

### Relatório de possíveis duplicatas

O relatório ajuda a localizar **expedientes potencialmente relacionados ao mesmo processo**, para que a equipe possa conferir se existe alguma duplicidade de trabalho.

A comparação no workspace considera principalmente o **número CNJ**, as **partes ativas** e a **data de distribuição**. Os resultados são agrupados para facilitar a revisão, com indicadores de semelhança, busca, seleção de candidatos e acesso aos expedientes.

A pontuação de 0 a 100 é uma **regra de triagem**, não uma probabilidade estatística. Um mesmo número de processo pode corresponder a expedientes distintos e legítimos.

O relatório completo pode ser guardado localmente para consulta posterior, quando a versão instalada oferecer esse recurso. A opção de atualizar solicita uma nova leitura da mesa. As sugestões de encerramento, inclusive em lote quando disponíveis, exigem **revisão e confirmação humana**.

### Painel gerencial

O **Painel Gerencial de Processos** transforma os dados da mesa em indicadores, tabelas e visualizações para apoiar a distribuição e o acompanhamento do trabalho.

Conforme os dados disponíveis, permite observar o volume de expedientes, a distribuição entre assessores, a carga crítica, os prazos e a permanência dos processos na caixa. Filtros ajudam a analisar recortes específicos, e os relatórios podem oferecer exportação para conferência e uso interno.

Os indicadores refletem a **visão e os filtros consultados**. Não devem ser interpretados como um retrato de toda a instituição quando a coleta estiver limitada a uma mesa.

### Acompanhamento Especial

Permite cadastrar processos pelo número CNJ e acompanhar as movimentações identificadas nas consultas ao **PJe/TJMT**.

A primeira consulta estabelece uma referência; as seguintes verificam alterações em relação ao último resultado conhecido. Os cards organizam o histórico e distinguem novidades, registros já lidos e falhas de consulta. Notificações do navegador podem ser exibidas quando configuradas e autorizadas.

A disponibilidade das consultas depende da configuração do serviço externo e da autenticação necessária. **O acompanhamento não substitui a consulta oficial ao processo e não monitora, por si só, os encerramentos internos do SPA.**

### Autos, andamentos e documentos PDF

Nas páginas de processo, o MTPrev reúne atalhos para fontes como **autos, pasta do expediente, andamentos do SPA e dados do PJe**, quando disponíveis.

O leitor facilita a organização de documentos por data, a abertura de PDFs e a pesquisa por termos nos arquivos acessíveis. Também pode oferecer recursos para consultar ou reunir documentos e incluir uma capa informativa MTPrev em cópias de consulta.

A leitura é feita conforme a necessidade. Documentos digitalizados sem camada de texto podem não ser integralmente pesquisáveis.

### Relatório de peças

Ajuda a identificar e organizar manifestações e peças processuais a partir dos documentos disponíveis, apresentando **classificações sugeridas** e grupos prioritários para revisão.

As sugestões são apoio à conferência: não equivalem à classificação definitiva e não substituem a leitura da peça.

### Prazos e gestão da mesa

Os módulos de **Prazos** e **Gestão** apoiam a identificação de pendências, a análise de informações da mesa e a exportação de resultados, conforme os recursos disponíveis na versão instalada.

A ausência de um prazo em um relatório **não comprova que ele inexiste**. A conferência no sistema de origem continua indispensável.

### Ofícios e SIGADOC

As rotinas de **Ofícios** auxiliam o preenchimento e a tramitação de documentos no SIGADOC, incluindo, conforme o fluxo, a escolha de modelos, a classificação, o destinatário, a preparação para assinatura e a juntada de arquivos.

Assinaturas, protocolos e tramitações dependem das credenciais, das permissões e da confirmação do usuário.

## Instalação

### Chrome ou Chromium

1. Baixe o projeto ou clone o repositório.
2. Abra `chrome://extensions`.
3. Ative o **Modo do desenvolvedor**.
4. Selecione **Carregar sem compactação**.
5. Escolha a pasta que contém `manifest.json`.
6. Recarregue as abas do SPA e do SIGADOC.

Para atualizar uma instalação local, mantenha a estrutura da pasta e recarregue a extensão em `chrome://extensions`. Algumas funcionalidades exigem configurações adicionais na página de opções.

### Firefox (desenvolvimento)

A construção da versão de desenvolvimento requer **Node.js 18+** e **Firefox 128+**:

```bash
node scripts/build-firefox.js
```

Em seguida, abra `about:debugging#/runtime/this-firefox`, escolha **Carregar extensão temporária** e selecione `dist/firefox/manifest.json`.

A extensão temporária precisa ser carregada novamente após reiniciar o Firefox. Para distribuição permanente, é necessário um pacote assinado.

## Configuração e privacidade

Algumas integrações — especialmente as consultas ao **PJe/TJMT** — dependem de um serviço externo configurado e autorizado nas opções da extensão.

- Não compartilhe senhas, cookies de sessão, tokens ou documentos restritos.
- Relatórios e acompanhamentos podem ser armazenados no perfil local do navegador; sua remoção pode apagar esses dados.
- Evite consultas desnecessárias e interrompa novas coletas quando os sistemas apresentarem instabilidade.
- Respeite as permissões e as regras institucionais aplicáveis ao tratamento dos dados.

> **Importante:** o MTPrev é uma ferramenta complementar de apoio. Não é uma funcionalidade oficial do SPA, do PJe ou do SIGADOC. Qualquer ação com efeitos processuais exige conferência no sistema de origem.

## Desenvolvimento

A estrutura principal do repositório inclui:

| Caminho | Finalidade |
| --- | --- |
| `manifest.json` | Configuração e permissões da extensão |
| `js/` | Painéis, integrações e lógica da aplicação |
| `css/` | Estilos e identidade visual |
| `images/` | Logos, ícones e recursos gráficos |
| `data/` | Dados auxiliares |
| `docs/` | Documentação e notas técnicas |
| `tests/` | Testes automatizados |
| `scripts/` | Scripts de construção e empacotamento |

Para executar os testes:

```bash
node --test tests/*.test.cjs
```

Para gerar o pacote de publicação do Chrome, quando o script estiver disponível na versão local:

```bash
node scripts/build-chrome-store.js
```

### Fluxo de colaboração

O desenvolvimento é organizado em branches:

- **`main`** — versão estável.
- **`test`** — integração e validação das alterações.
- **`feature/*` e `fix/*`** — desenvolvimento de funcionalidades e correções específicas.

A prática recomendada é criar uma branch a partir da `test`, implementar e testar as alterações e integrá-las à `test` após revisão. A atualização da `main` deve ocorrer somente depois da validação.

Os testes automatizados não substituem os testes supervisionados nos sistemas autenticados, principalmente em operações de assinatura, movimentação e gravação de dados.

## Equipe

O **MTPrev — Extensão Geral** foi desenvolvido por:

**Arthur Costa Dias · Marcela Paesano · João Guilherme Ferreira Gomes dos Santos**

O projeto reúne contribuições de desenvolvimento, aprimoramento de interfaces e construção de ferramentas para tornar mais simples a rotina de trabalho com processos.

---

<p align="center">
  <strong>MTPrev — Extensão Geral</strong><br>
  Menos tarefas repetitivas. Mais tempo para o trabalho que exige análise.
</p>
