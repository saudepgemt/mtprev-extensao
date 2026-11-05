# Regras de triagem e distribuição — MTPrev

**Fonte:** `Organograma Diretoria Jurídica MTPREV - TRIAGEM.pdf`, página 1, intitulado **PROPOSTA - TRIAGEM**.

A funcionalidade é **consultiva**: o diagnóstico sugere assessores e informa o procurador previsto na proposta. Não redistribui expedientes, grava andamentos, altera prazos nem escolhe automaticamente uma pessoa quando a proposta prevê mais de uma.

| Matéria ou providência | Sugestão de responsável | Procurador previsto | Observação |
| --- | --- | --- | --- |
| Execuções individuais | Ney Geraldo Galdino de Miranda Junior | Lucas e Diego | Peças: 100% conforme proposta |
| Recursos de execuções coletivas | Ney Geraldo Galdino de Miranda Junior | Lucas e Diego | Separar de execuções coletivas sem recurso |
| Pensão por morte (em geral) | Gabrielle Teixeira Vater de Araujo | Lucas e Diego | Ações exclusivas de pensão por morte; conferir exceção de subsídio/vida funcional |
| Recurso de contribuição não doente | Gabrielle Teixeira Vater de Araujo | Lucas e Diego | Distinguir de contribuição não doente sem recurso |
| Triagem em geral | Diego Metello, Ana Clara Ramos Rodrigues da Silva e Thais Pereira Schmidt | Lucas e Diego | O documento não define uma divisão automática entre essas pessoas |
| Confirmação de pauta de julgamento; execução de honorários | Ana Clara Ramos Rodrigues da Silva | Lucas e Diego | Providências de triagem, distintas da elaboração de peças de pauta |
| Juntada de comprovante de cumprimento de ordem judicial | Thais Pereira Schmidt | Lucas e Diego | Providência específica |
| Execuções coletivas, exceto recursos | Victor Gabriel Lelis de Bessa | Lucas e Diego | Não confundir com os recursos de execução coletiva |
| Imposto de Renda | Clarissa Taques Barini Pires | Lucas e Diego | Peças: todas inclusive recursos de decisão monocrática, **exceto recursos de acórdãos** |
| Aposentadoria; residual civil/militar; contribuição doente; contribuição doente + IR; pauta de julgamento; pensão por morte envolvendo subsídio/vida funcional do instituidor | Maria Fernanda Bezerra Capilé **ou** Ana Julia Basei de Paula | Diego (Maria Fernanda); Lucas (Ana Julia) | Proposta prevê ambas, sem regra de alternância/carga |
| Contribuição não doente (civil/militar); mandado de segurança | Yuri de Freitas Vezaro | Lucas e Diego | Peças: contestação, contrarrazões e petição simples |
| Contrarrazões, exceto matérias de Victor Gabriel | Yuri de Freitas Vezaro | Lucas e Diego | Havendo coincidência com execução coletiva, indicar necessidade de revisão |

## Regras de prudência

1. A seleção usa primeiro **Assunto** e **Classe** para matéria; **Manifestação sugerida** e **Último andamento** apenas como indícios de tipo de peça/providência.
2. O texto integral de documentos não atribui responsável sem metadados confiáveis; poderá exigir revisão.
3. Se a matéria for **execução** sem identificação da modalidade, a extensão não escolhe entre Ney e Victor.
4. A expressão **100%** reflete a coluna *Peças* da proposta, não uma pontuação de confiança nem um comando para redistribuir integralmente o volume de trabalho.
5. A distinção entre **procurador** e **assessor** é mantida; a indicação não confirma designação funcional vigente.
6. Quando há mais de uma sugestão, a escolha permanece com a pessoa responsável pela triagem.
7. A proposta anexa não comprova aprovação institucional nem atualização posterior; conferir sua vigência antes de usar o resultado operacionalmente.

## Interface

SPA → MTPrev → **Triagem → Diagnóstico e Distribuição MTPrev** → **Gerar diagnóstico**.

A seção **Distribuição sugerida** mostra assessor, procurador, peças, motivo e ressalvas. A revisão humana fica registrada no navegador, no mecanismo já existente.

## Implantação

Substituir os dois arquivos conservando as pastas:
- `js/shared/mtprev_triage_rules.js`
- `js/triagem/mtprev_pop_panel.js`

Atualizar a extensão em `chrome://extensions` e recarregar o SPA. Executar os testes com `node --test tests/organograma_distribuicao.test.cjs`.
