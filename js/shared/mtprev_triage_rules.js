/* Read-only, evidence-based MTPrev support. No procedural acts or deadline computation. */
(() => {
  "use strict";
  const norm = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const text = (value) => typeof value === 'object' && value ? String(value.name || value.nome || value.label || '') : String(value || '');
  const aliases = {
    estado: ['Estado de Mato Grosso'],
    mtprev: ['MTPrev', 'Fundação Mato Grosso Previdência', 'Fundação Mato Grosso Previdência MTPrev']
  };
  function recipient(exp = {}, config = {}) {
    const raw = exp.recipientName || exp.recipient || exp.party;
    const name = text(raw);
    const id = String(exp.recipientId || exp.partyId || (typeof raw === 'object' && raw ? raw.id || raw.cnpj || '' : ''));
    let kind = 'unknown', source = name ? 'Destinatário/parte do expediente' : 'Destinatário não informado';
    const matches = Object.keys(aliases).filter((key) => [...aliases[key], ...(config.aliases?.[key] || [])].map(norm).includes(norm(name)));
    if (matches.length === 1) kind = matches[0];
    const ids = Object.keys(aliases).filter((key) => id && (config.recipientIds?.[key] || []).map(String).includes(id));
    if (ids.length === 1) {
      if (kind !== 'unknown' && kind !== ids[0]) return { kind: 'unknown', label: name, id, source, reason: 'Conflito entre nome e identificador; conferir destinatário.' };
      kind = ids[0]; source = 'Identificador estruturado do destinatário';
    }
    return { kind, id, label: kind === 'estado' ? 'Estado de Mato Grosso' : kind === 'mtprev' ? 'Fundação Mato Grosso Previdência — MTPrev' : name || 'Não identificado', source,
      reason: kind === 'unknown' ? 'Destinatário não reconhecido; procuradoria e partes gerais do processo não determinam quem foi intimado.' : `${source}: ${name || id}.` };
  }
  const PROCEDURES = [
    ['Mandado de segurança', /\bmandado de seguranca\b/, ['Prestação de informações', 'Análise de liminares', 'Sentença e recursos']],
    ['Juizado Especial', /\bjuizado especial\b|\brecurso inominado\b/, ['Contestação', 'Instrução probatória', 'Sentença', 'Embargos de declaração', 'Recurso inominado']],
    ['Cumprimento de sentença', /\bcumprimento (?:de |da )sentenca\b/, ['Intimação para cumprimento', 'Conferência de cálculos', 'Impugnação ao cumprimento de sentença', 'Requisições de pagamento, RPV e precatório']],
    ['Execução', /\bexecucao\b/, ['Verificação do título', 'Excesso de execução', 'Providências processuais aplicáveis']],
    ['Incidentes', /\btutela provisoria\b|\bincidentes?\b|\birdr\b|\bdesconsideracao da personalidade juridica\b/, ['Tutelas provisórias', 'IRDR', 'Desconsideração da personalidade jurídica']],
    ['Procedimento comum', /\bprocedimento comum\b/, ['Contestação', 'Réplica ou manifestação', 'Instrução probatória', 'Sentença', 'Recursos']]
  ];
  // Proposta de distribuição — Organograma Diretoria Jurídica MTPrev / TRIAGEM,
  // página 1. Apoio exclusivamente consultivo: não redistribui processos.
  // "100%" no documento refere-se à cobertura de peças indicada, não à certeza da regra.
  const DISTRIBUTION_TEAM = Object.freeze({
    ney: { name: 'Ney Geraldo Galdino de Miranda Junior', procuradores: 'Lucas e Diego', pecas: '100% nas execuções individuais; recursos de execuções coletivas' },
    gabrielle: { name: 'Gabrielle Teixeira Vater de Araujo', procuradores: 'Lucas e Diego', pecas: '100% das ações exclusivas de pensão por morte; contribuição não doente (recurso)' },
    diego: { name: 'Diego Metello', procuradores: 'Lucas e Diego', pecas: 'Não especificadas no organograma' },
    anaClara: { name: 'Ana Clara Ramos Rodrigues da Silva', procuradores: 'Lucas e Diego', pecas: '100%' },
    thais: { name: 'Thais Pereira Schmidt', procuradores: 'Lucas e Diego', pecas: '100%' },
    victor: { name: 'Victor Gabriel Lelis de Bessa', procuradores: 'Lucas e Diego', pecas: 'Execuções coletivas, exceto recursos' },
    clarissa: { name: 'Clarissa Taques Barini Pires', procuradores: 'Lucas e Diego', pecas: 'Todas, inclusive recurso de decisão monocrática; exceto recursos de acórdãos' },
    maria: { name: 'Maria Fernanda Bezerra Capilé', procuradores: 'Diego', pecas: '100%' },
    anaJulia: { name: 'Ana Julia Basei de Paula', procuradores: 'Lucas', pecas: '100%' },
    yuri: { name: 'Yuri de Freitas Vezaro', procuradores: 'Lucas e Diego', pecas: 'Contestação, contrarrazões e petição simples' },
  });
  function suggestDistribution(record = {}, documentText = '') {
    // Só metadados de assunto/classe fundamentam o encaminhamento por matéria.
    // Documentos podem reforçar a conferência, mas não gerar um destinatário por si só.
    const matter = norm([record.assunto, record.actionClass].filter(Boolean).join(' '));
    const action = norm([record.manifestationSuggested, record.lastProgress].filter(Boolean).join(' '));
    const document = norm(documentText).slice(0, 1500);
    const raw = [matter, action].filter(Boolean).join(' ');
    const candidates = [];
    const notes = [];
    const add = (id, people, category, reason, source, detail = '') => {
      if (candidates.some(item => item.id === id)) return;
      candidates.push({ id, category, reason, source, detail,
        assessores: people.map(key => ({ ...DISTRIBUTION_TEAM[key] })) });
    };
    const has = (scope, re) => re.test(scope);
    const execution = has(matter, /\bexecuc(?:ao|oes)\b|\bcumprimento individual\b/);
    const collective = has(matter, /\bcoletiv[ao]s?\b|\bsentenca coletiva\b/);
    const appeal = has(raw, /\brecurso(?:s)?\b|\bagrav[os]\b|\bapelac(?:ao|oes)\b|\bembarg[os]\b/);
    const honorary = has(matter, /\bhonorari(?:o|os)\b/) && has(matter, /\bexecuc(?:ao|oes)\b|\bcumprimento\b/);
    const pensionDeath = has(matter, /\bpensao por morte\b/);
    const pensionSpecial = pensionDeath && has(matter, /\bsubsidio\b|\bvida funcional\b|\binstituidor\b/);
    const sickContrib = has(matter, /\bcontribuic(?:ao|oes)\b/) && has(matter, /\bdoente\b/) && !has(matter, /\bnao doente\b/);
    const nonSickContrib = has(matter, /\bcontribuic(?:ao|oes)\b/) && has(matter, /\bnao doente\b/);
    const retirement = has(matter, /\baposentadoria\b/);
    const residual = has(matter, /\bresidua(?:l|is)\b/) && has(matter, /\bcivil\b|\bmilitar\b/);
    const incomeTax = has(matter, /\bimposto de renda\b|\btributac(?:ao|oes) do ir\b|\b ir\b/);
    const judgmentAgenda = has(raw, /\bpauta (?:de |para )?julgamento\b|\bsessao de julgamento\b/);
    const confirmAgenda = judgmentAgenda && has(action, /\bconfirm(?:ar|acao)\b|\bconferir\b/);
    const counterArguments = has(action, /\bcontrarrazo(?:es|es)\b/) || has(matter, /\bcontrarrazo(?:es|es)\b/);
    const judgementAppeal = has(raw, /\brecurso(?:s)? de acordaos?\b|\brecurso(?:s)? contra acordaos?\b|\bapelac(?:ao|oes)\b.{0,25}\bacordao\b/);

    if (honorary) add('honorarios', ['anaClara'], 'Matéria / triagem', 'Execução de honorários.', 'Assunto ou classe do SPA');
    else if (execution && collective && appeal) add('exec_coletiva_recurso', ['ney'], 'Matéria / peça', 'Recursos de execuções coletivas.', 'Assunto/classe e manifestação do SPA');
    else if (execution && collective) add('exec_coletiva', ['victor'], 'Matéria / peça', 'Execução coletiva, exceto recursos.', 'Assunto ou classe do SPA');
    else if (execution && has(matter, /\bindividual\b|\bindividuais\b/)) add('exec_individual', ['ney'], 'Matéria / peça', 'Execução individual.', 'Assunto ou classe do SPA');
    else if (execution) notes.push('Execução sem indicação confiável de modalidade (individual/coletiva/recurso): conferir antes de distribuir.');

    if (pensionSpecial) add('pensao_vida_funcional', ['maria', 'anaJulia'], 'Matéria / peça', 'Pensão por morte envolvendo subsídio ou vida funcional do instituidor.', 'Assunto ou classe do SPA');
    else if (pensionDeath) add('pensao_morte', ['gabrielle'], 'Matéria / peça', 'Pensão por morte, sem o enquadramento especial identificado.', 'Assunto ou classe do SPA', 'Verificar se há subsídio/vida funcional do instituidor antes de confirmar.');

    if (nonSickContrib && appeal) add('contrib_nao_doente_recurso', ['gabrielle'], 'Matéria / peça', 'Recurso de contribuição não doente.', 'Assunto/classe e manifestação do SPA');
    else if (nonSickContrib) add('contrib_nao_doente', ['yuri'], 'Matéria / peça', 'Contribuição não doente (civil ou militar).', 'Assunto ou classe do SPA');
    else if (sickContrib || retirement || residual) add('materias_maria_ana', ['maria', 'anaJulia'], 'Matéria / peça', 'Aposentadoria, residual civil/militar ou contribuição doente.', 'Assunto ou classe do SPA');
    else if (incomeTax) add('ir', ['clarissa'], 'Matéria / peça', 'Imposto de Renda.', 'Assunto ou classe do SPA',
      judgementAppeal ? 'O organograma exclui recursos de acórdãos da cobertura de peças. Conferir responsável.' : 'Peças: todas, inclusive recurso de decisão monocrática; exceto recurso de acórdão.');
    if (incomeTax && sickContrib) {
      notes.push('Contribuição doente com IR: priorizar o enquadramento específico de matéria compartilhada; conferir eventual atuação separada em IR.');
    }

    if (judgmentAgenda) {
      if (confirmAgenda) add('confirmar_pauta', ['anaClara'], 'Triagem / providência', 'Confirmar pauta de julgamento.', 'Manifestação ou último andamento do SPA');
      // O organograma prevê pauta como matéria para duas assessoras, mas
      // confirmação da pauta é providência de triagem distinta.
      if (!pensionDeath && !execution && !nonSickContrib && !sickContrib && !incomeTax)
        add('pauta_materia', ['maria', 'anaJulia'], 'Matéria / peça', 'Pauta de julgamento.', 'Assunto/manifestações do SPA', 'Distinguir elaboração de peça da mera confirmação da pauta.');
    }
    if (has(matter, /\bmandado de seguranca\b|\b ms\b/)) add('mandado_seguranca', ['yuri'], 'Matéria / peça', 'Mandado de segurança (MS).', 'Assunto ou classe do SPA');
    if (has(action, /\bjuntad[ao]s?\b.{0,65}\bcomprovante\b|\bcomprovante\b.{0,65}\bcumprimento\b/) &&
      has(action, /\bordem judicial\b|\bcumprimento\b/))
      add('juntada_comprovante', ['thais'], 'Triagem / providência', 'Juntada de comprovante de cumprimento de ordem judicial.', 'Manifestação ou último andamento do SPA');
    if (counterArguments) {
      if (execution && collective && !appeal) notes.push('Contrarrazões em execução coletiva: verificar a exceção referente às matérias de Victor Gabriel.');
      else if (execution && collective) notes.push('Há recurso de execução coletiva e contrarrazões: conferir se a peça pertence a Ney ou à regra geral de contrarrazões de Yuri.');
      else add('contrarrazoes', ['yuri'], 'Peça', 'Contrarrazões em geral, excetuadas as matérias de Victor Gabriel.', 'Manifestação do SPA');
    }
    if (has(action, /\btriagem\b/) && !candidates.length) {
      notes.push('Triagem genérica consta para Diego Metello, Ana Clara Ramos e Thais Pereira; o organograma não estabelece divisão exclusiva entre eles.');
    }
    if (!matter && document) notes.push('Há texto documental, mas assunto/classe não constam nos metadados do SPA: encaminhamento automático não sugerido. Conferir o documento.');
    if (!candidates.length) notes.push('Matéria ou tipo de peça não enquadrados de forma suficiente na proposta. Revisar manualmente.');
    if (candidates.length > 1) notes.push('Mais de uma regra foi acionada. Conferir matéria, peça e etapa antes de escolher o destino.');
    if (candidates.some(item => item.assessores.length > 1)) notes.push('A matéria aparece para mais de uma assessora. O organograma não define critério de divisão de carga; não foi escolhido um nome automaticamente.');
    return { source: 'Proposta — Organograma Diretoria Jurídica MTPrev — TRIAGEM, p. 1',
      candidates, notes, requiresHumanReview: true, writesToSpa: false };
  }
  function diagnose(record = {}, documentText = '') {
    const evidence = [];
    const add = (field, value, source) => { if (value) evidence.push({ field, value: String(value).slice(0, 500), source }); };
    const meta = norm([record.actionClass, record.assunto, record.lastProgress, record.manifestationSuggested].filter(Boolean).join(' '));
    const doc = norm(documentText);
    for (const field of ['actionClass', 'assunto', 'lastProgress', 'manifestationSuggested', 'processParties', 'party', 'relevantDate']) add(field, record[field], 'Metadados visíveis do SPA');
    const r = recipient(record);
    const pension = /\baposentadoria\b|\bpensao\b|\btempo de (?:servico|contribuicao)\b|\bprevidenciari[oa]s?\b/.test(meta);
    const excluded = /\babono de permanencia\b/.test(meta);
    const foundation = r.kind === 'mtprev' || /\bmtprev\b|\bfundacao mato grosso previdencia\b/.test(norm(record.processParties));
    const special = /\bmandado de seguranca\b|\bcontrat[oa]s?\b|\baquisico?es?\b|\bcumprimento de decisa[oa]\b/.test(meta);
    const manualChecks = [];
    const manual = (pattern, instruction, page, scope = meta) => { if (pattern.test(scope)) manualChecks.push({ instruction, source: `Manual de Demandas Judiciais — fluxo SPA, p. ${page}` }); };
    manual(/\babono de permanencia\b/, 'Conferir fundamento de atuação e orientação de redistribuição à Subprocuradoria Geral Judicial. Não redistribuir automaticamente.', '36');
    manual(/\brpv\b|\bprecatorio\b/, 'Conferir a orientação de encaminhamento à Coordenadoria de Execução e Precatório/Núcleo de Precatórios. Menção histórica não define o destinatário competente.', '36');
    manual(/\b(?:execucao|cumprimento de sentenca)\b.{0,100}\bhonorarios\b/, 'Conferir a orientação de redistribuição ao Núcleo de Execução para execução/cumprimento de honorários.', '36');
    manual(/\bexecucao fiscal\b/, 'Conferir a orientação de encaminhamento à Subprocuradoria Geral Fiscal.', '36');
    manual(/\bmt saude\b/, 'Conferir a orientação de encaminhamento ao setor MT Saúde, sem aplicar essas regras ao fluxo legado da Saúde.', '36');
    manual(/\bcumprimento\b.{0,100}\bcoletiv[ao]\b/, 'Conferir o fluxo de cumprimento individual de sentença coletiva, observação e análise de redistribuição pela autoridade responsável. Validar sindicato, ano e faixa de valor no caso concreto.', '38 e 44', meta + ' ' + doc);
    manual(/\bcumprimento (?:de |da )sentenca\b/, 'Conferir a necessidade de tarefas de Impugnação ao Cumprimento de Sentença e Comunicação Interna. A CI segue para assinatura do Procurador e posterior envio à Coordenadoria de Cálculo. Não criar tarefas automaticamente.', '44 e 46–49');
    manual(/\bliminar\b/, 'Se houver intimação conjunta de cumprimento de liminar e contestação, conferir necessidade de tarefas distintas de Contestação e Petição. Conferir os prazos oficiais; não aplicar números fixos do manual.', '44');
    manual(/\bncope\b|\bexecucao individual\b/, 'Conferir enquadramento no fluxo NCOPE, valor em UPF, legitimidade, prescrição, tese jurídica e documentação; a chefia deve revisar o encaminhamento. Não concluir enquadramento apenas por termos ou valores.', '44–45');
    let competence = 'Não identificada pelos critérios disponíveis';
    let reason = 'Sem metadados suficientes para indicar competência. A ausência de indícios não exclui a competência.';
    if (excluded || special) { competence = 'Competência que exige conferência'; reason = excluded ? 'Abono de permanência: excluído dos temas previdenciários pelo trecho 2.1.1 do POP. Conferir eventual fundamento autônomo de atuação.' : 'Conferir atribuições institucionais e, em mandado de segurança, a autoridade responsável pelo ato: constar como coatora em conjunto não basta (POP 2.1.1).'; }
    else if (foundation || pension) { competence = 'Competência provável da MTPrev'; reason = foundation ? 'A Fundação foi identificada no destinatário do expediente ou nas partes informadas do processo.' : 'Tema previdenciário identificado nos metadados, independentemente das partes. Conferir as ressalvas do POP.'; }
    if (manualChecks.some((item) => item.source.endsWith('36'))) { competence = 'Competência que exige conferência'; reason = 'Há indícios sujeitos a conferência de encaminhamento no fluxo SPA do manual (p. 36). Não presumir competência nem redistribuir por palavras-chave.'; }
    const natureCandidates = [];
    if (pension && !excluded) natureCandidates.push('Previdenciária');
    if (/\bindeniza|\bdano moral\b|\bdanos materiais\b/.test(meta)) natureCandidates.push('Indenizatória');
    if (/\bfuncional\b|\bservidor\b|\bremuneracao\b|\babono de permanencia\b/.test(meta)) natureCandidates.push('Funcional');
    if (/\badministrativ|\bcontrato\b|\blicitacao\b/.test(meta)) natureCandidates.push('Administrativa');
    const authoritative = norm(record.actionClass);
    let candidates = PROCEDURES.filter(([,pattern]) => pattern.test(authoritative || meta));
    const procedureSource = candidates.length ? 'Metadados visíveis do SPA' : doc ? 'Texto extraído (indício documental; conferir)' : 'Não identificado';
    if (!candidates.length && doc) candidates = PROCEDURES.filter(([,pattern]) => pattern.test(doc));
    const procedure = candidates.length === 1 ? candidates[0][0] : candidates.length ? 'Necessita conferência: ' + candidates.map(([name]) => name).join(' / ') : 'Não identificado';
    const priorities = [];
    const detect = (key, label, pattern) => {
      const fromMeta = pattern.test(meta), fromDoc = pattern.test(doc);
      if (!fromMeta && !fromDoc) return;
      const source = fromMeta ? 'Metadados visíveis do SPA' : 'Texto extraído pelo leitor existente';
      const matchedText = fromMeta ? meta : doc;
      const matchIndex = pattern.exec(matchedText)?.index || 0;
      const sample = matchedText.slice(Math.max(0, matchIndex - 100), matchIndex + 350);
      priorities.push({ key, label, status: 'Necessita conferência', reason: 'Indício textual; não confirma a providência exigida. Regras definitivas dependem dos expedientes de referência.', source, sample });
      add(label, sample, source);
    };
    detect('impugnacao', 'Impugnação ao cumprimento de sentença', /\bimpugnacao\b.{0,100}\bcumprimento\b|\bcumprimento\b.{0,100}\bimpugnacao\b/);
    detect('pauta', 'Intimação de pauta de julgamento', /\bpauta (?:de |para )?julgamento\b|\bsessao de julgamento\b/);
    detect('coletivas', 'Demandas coletivas', /\bacao civil publica\b|\bacao coletiva\b|\bmandado de seguranca coletivo\b|\bdireitos individuais homogeneos\b|\bsentenca coletiva\b/);
    const spaPiece = String(record.manifestationSuggested || '').trim();
    const hasSpaPiece = spaPiece && !/^sem\b|^nao (?:identificad|informad)/.test(norm(spaPiece));
    return { competence, reason, recipient: r, nature: natureCandidates.length ? natureCandidates.join(' / ') + ' (indício; conferir)' : 'Não identificado', procedure, procedureSource, procedureCandidates: candidates.map(([name,,stages]) => ({ name, stages })),
      pensionSubject: pension ? record.assunto || 'Indício previdenciário nos metadados' : 'Não identificado',
      suggestedPiece: hasSpaPiece ? `Informada no SPA: ${spaPiece} — conferir adequação ao expediente` : 'Necessita conferência humana; não definida por palavras-chave', priorities, evidence, manualChecks, requiresHumanReview: true,
      deadline: record.pjeDeadline || 'Não informado; conferir SPA/PJe', deadlineStatus: record.deadlineStatus || 'Não identificado; conferir SPA/PJe', documentRead: Boolean(documentText), distribution: suggestDistribution(record, documentText) };
  }
  globalThis.MTPrevTriageRules = Object.freeze({ norm, recipient, diagnose, suggestDistribution, procedures: PROCEDURES.map(([name,,stages]) => ({ name, stages })) });
})();
