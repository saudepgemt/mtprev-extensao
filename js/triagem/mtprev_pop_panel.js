(() => {
  'use strict';
  if (window.MTPrevPopPanel) return;
  const R = window.MTPrevTriageRules;
  const el = (tag, text, parent) => { const node = document.createElement(tag); if (text) node.textContent = text; if (parent) parent.appendChild(node); return node; };
  function field(parent, title, value) { const p = el('p', '', parent); el('strong', title + ': ', p); p.appendChild(document.createTextNode(value || 'Não identificado')); }
  function links(parent, record) {
    for (const item of [...(record.expedientes || []), ...(record.pendencyUrl ? [{ url: record.pendencyUrl, label: 'Pendência SPA' }] : [])]) {
      try { const url = new URL(item.url, location.href); if (url.protocol !== 'https:' || url.hostname !== 'spa.pge.mt.gov.br') continue;
        const link = el('a', item.label || 'Abrir expediente', parent); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.style.cssText = 'display:inline-block;margin:4px 10px 4px 0;color:#b9e0ff;';
      } catch (_) { /* Ignore invalid source links. */ }
    }
  }
  function review(parent, record, diagnosis) {
    const key = [record.processNumber, record.expedienteId, record.rowKey || record.id].join('|');
    const label = el('label', 'Revisão humana (registro local; não altera o SPA)', parent);
    const select = el('select', '', label);
    for (const name of ['Pendente', 'Conferido — manter indicação', 'Conferido — corrigir indicação']) { const option = el('option', name, select); option.value = name; }
    const note = el('textarea', '', parent); note.placeholder = 'Conclusão do assessor / correção da sugestão'; note.setAttribute('aria-label', 'Conclusão da revisão humana');
    try { const saved = JSON.parse(localStorage.getItem('MTPREV_POP_REVIEWS') || '{}')[key]; if (saved) { select.value = saved.status; note.value = saved.note || ''; } } catch (_) {}
    const save = () => {
      try { const records = JSON.parse(localStorage.getItem('MTPREV_POP_REVIEWS') || '{}'); records[key] = { status: select.value, note: note.value, at: new Date().toISOString(), indication: diagnosis.competence }; localStorage.setItem('MTPREV_POP_REVIEWS', JSON.stringify(records)); } catch (_) { feedback.textContent = 'Não foi possível salvar a revisão neste navegador.'; }
    };
    const feedback = el('small', '', parent);
    select.addEventListener('change', save); note.addEventListener('change', save);
  }
  function create(api, mode = 'diagnostic') {
    const root = el('details'); root.className = 'mtprev-pop-support';
    root.style.cssText = 'margin:8px 0;padding:8px;border:1px solid #52616c;border-radius:7px;background:#1f2d3a;color:#f1f5f9;overflow-wrap:anywhere;';
    el('summary', mode === 'priorities' ? 'Grupos prioritários MTPrev — revisão' : 'Diagnóstico da Triagem', root);
    el('p', 'Apoio MTPrev conforme POP e Manual de Demandas Judiciais (09/2025), somente fluxos SPA: p. 10–14 e 34–54. Não confirma competência, peça ou prazo e não executa atos. Analisa somente as linhas expandidas/visíveis da página com os filtros atuais, ou a pendência aberta.', root);
    if (mode === 'diagnostic') {
      const flow = el('details', '', root); el('summary', 'Conferência do fluxo SPA e responsabilidades', flow);
      el('p', 'Leitura do expediente → conferência de competência, regularidade da intimação, legitimidade, eventuais nulidades e prazo oficial → escolha humana entre observação, confirmar análise, sugerir encerramento ou solicitar redistribuição. O Procurador responsável decide o protocolo ou a devolução da minuta. Assinatura e envio de CI seguem o fluxo próprio. Fonte: manual, p. 34–54.', flow);
    }
    const unitLabel = el('label', 'Unidade destas sugestões', root);
    const unit = el('select', '', unitLabel);
    for (const [value, title] of [['mtprev', 'MTPrev — apoio ao POP'], ['saude', 'Saúde — manter fluxo existente']]) { const option = el('option', title, unit); option.value = value; }
    try { unit.value = localStorage.getItem('MTPREV_POP_SUPPORT_UNIT') || 'mtprev'; } catch (_) {}
    let priorityFilter;
    if (mode === 'priorities') {
      const label = el('label', 'Grupo de indícios para revisão', root);
      priorityFilter = el('select', '', label);
      for (const [value, title] of [['all', 'Todos'], ['impugnacao', 'Impugnação ao cumprimento de sentença'], ['pauta', 'Intimação de pauta de julgamento'], ['coletivas', 'Demandas coletivas'], ['unknown', 'Não identificado']]) { const option = el('option', title, priorityFilter); option.value = value; }
    }
    const consentLabel = el('label', '', root); consentLabel.style.display = 'block';
    const consent = el('input', '', consentLabel); consent.type = 'checkbox';
    consentLabel.appendChild(document.createTextNode(' Consultar texto dos expedientes com o leitor existente (somente leitura)'));
    const button = el('button', mode === 'priorities' ? 'Preparar grupos para revisão' : 'Gerar diagnóstico', root); button.type = 'button';
    const status = el('p', '', root); status.setAttribute('role', 'status');
    const output = el('div', '', root);
    unit.addEventListener('change', () => { try { localStorage.setItem('MTPREV_POP_SUPPORT_UNIT', unit.value); } catch (_) {} output.replaceChildren(); });
    button.addEventListener('click', async () => {
      if (unit.value !== 'mtprev') { status.textContent = 'Selecione MTPrev para estas sugestões. Os comandos e relatórios existentes da Saúde permanecem disponíveis.'; return; }
      button.disabled = true; unit.disabled = true; consent.disabled = true; output.replaceChildren(); status.textContent = 'Lendo metadados disponíveis…';
      try {
        const records = api.getRecords();
        if (!records.length) { status.textContent = 'Nenhuma linha visível. Expanda os grupos da caixa ou abra uma pendência e tente novamente.'; return; }
        const supports = new Map();
        if (consent.checked) {
            for (let index = 0; index < records.length; index += 4) {
              status.textContent = `Consultando expedientes ${index + 1}–${Math.min(index + 4, records.length)} de ${records.length}…`;
              const result = await api.readDocuments(records.slice(index, index + 4));
              if (!result?.ok) throw new Error(result?.error || 'Não foi possível ler os expedientes.');
              for (const item of result.results || []) supports.set(item.id, item);
            }
        }
        let shown = 0;
        for (const record of records) {
          const read = supports.get(record.id), diagnosis = read?.popSupport || R.diagnose(record);
          if (priorityFilter && priorityFilter.value !== 'all' && (priorityFilter.value === 'unknown' ? diagnosis.priorities.length > 0 : !diagnosis.priorities.some((item) => item.key === priorityFilter.value))) continue;
          shown++;
          const article = el('article', '', output); article.style.cssText = 'border-top:1px solid #52616c;padding:10px 0;';
          el('strong', `${record.processNumber || 'Processo não identificado'} — expediente ${record.expedienteId || 'não identificado'}`, article);
          if (mode === 'diagnostic') {
            field(article, 'Destinatário da intimação', diagnosis.recipient.label);
            field(article, 'Origem do destinatário', diagnosis.recipient.reason);
            if (diagnosis.recipient.id) field(article, 'Identificador do destinatário', diagnosis.recipient.id);
            field(article, 'Competência sugerida', diagnosis.competence); field(article, 'Justificativa', diagnosis.reason);
            field(article, 'Natureza da ação', diagnosis.nature); field(article, 'Procedimento identificado', diagnosis.procedure);
            field(article, 'Origem do procedimento', diagnosis.procedureSource);
            field(article, 'Assunto previdenciário', diagnosis.pensionSubject); field(article, 'Peça processual', diagnosis.suggestedPiece);
            field(article, 'Prazo registrado no SPA/PJe', diagnosis.deadline);
            field(article, 'Situação do prazo', diagnosis.deadlineStatus);
            field(article, 'Duplicidade', 'Consulte o Relatorio Duplicados na aba Duplicados — mesma lógica para todas as unidades.');
            for (const candidate of diagnosis.procedureCandidates) field(article, `Etapas do POP — ${candidate.name} (não define a peça)`, candidate.stages.join(' · '));
          }
          if (!diagnosis.priorities.length && mode === 'priorities') el('p', 'Nenhum indício dos três grupos prioritários. Não significa exclusão jurídica.', article);
          for (const priority of diagnosis.priorities) { field(article, priority.label, priority.status); field(article, 'Critério', priority.reason); field(article, priority.source, priority.sample); }
          for (const check of diagnosis.manualChecks || []) field(article, check.source + ' — conferir', check.instruction);
          if (consent.checked && (!read?.popReadReliable)) field(article, 'Leitura documental', read?.error || 'Inconclusiva ou sem texto confiável; mantidos apenas os metadados.');
          else if (consent.checked && !read?.popReadComplete) field(article, 'Leitura documental', 'Parcial: os indícios usam apenas o texto disponível. Conferir os documentos não lidos.');
          const evidence = el('details', '', article); el('summary', 'Dados utilizados e suas origens', evidence);
          for (const item of diagnosis.evidence) field(evidence, `${item.field} — ${item.source}`, item.value);
          links(article, record); review(article, record, diagnosis);
        }
        status.textContent = `${shown} registro(s) exibido(s) de ${records.length} analisado(s). Revisão humana obrigatória; nenhum prazo ou ato foi alterado.`;
      } catch (error) { status.textContent = error.message; }
      finally { button.disabled = false; unit.disabled = false; consent.disabled = false; }
    });
    return root;
  }
  window.MTPrevPopPanel = Object.freeze({ create });
})();
