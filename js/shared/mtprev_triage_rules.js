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
      deadline: record.pjeDeadline || 'Não informado; conferir SPA/PJe', deadlineStatus: record.deadlineStatus || 'Não identificado; conferir SPA/PJe', documentRead: Boolean(documentText) };
  }
  globalThis.MTPrevTriageRules = Object.freeze({ norm, recipient, diagnose, procedures: PROCEDURES.map(([name,,stages]) => ({ name, stages })) });
})();
