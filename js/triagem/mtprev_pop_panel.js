(() => {
  'use strict';
  if (window.MTPrevPopPanel) return;
  const R = window.MTPrevTriageRules;
  const el = (tag, text, parent) => { const node = document.createElement(tag); if (text) node.textContent = text; if (parent) parent.appendChild(node); return node; };
  function field(parent, title, value) { const p = el('p', '', parent); el('strong', title + ': ', p); p.appendChild(document.createTextNode(value || 'Não identificado')); }
  function links(parent, record) {
    for (const item of [...(record.expedientes || []), ...(record.pendencyUrl ? [{ url: record.pendencyUrl, label: 'Pendência SPA' }] : [])]) {
      try { const url = new URL(item.url, location.href); if (url.protocol !== 'https:' || !['spa.pge.mt.gov.br', 'pge.mt.spa.coreplan.com.br'].includes(url.hostname)) continue;
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
  function createLegacy(api, mode = 'diagnostic') {
    const root = el('details'); root.className = 'mtprev-pop-support';
    root.style.cssText = 'margin:8px 0;padding:8px;border:1px solid #52616c;border-radius:7px;background:#1f2d3a;color:#f1f5f9;overflow-wrap:anywhere;';
    el('summary', mode === 'priorities' ? 'Grupos prioritários e distribuição — revisão' : 'Diagnóstico e Distribuição MTPrev', root);
    el('p', 'Apoio MTPrev conforme POP, Manual de Demandas Judiciais (09/2025) e PROPOSTA de Triagem/Distribuição da Diretoria Jurídica. Encaminhamentos são sugestões para revisão: não atribuem responsáveis, não alteram o SPA e não confirmam prazos. Abrangência: registros carregados/visíveis ou selecionados.', root);
    if (mode === 'diagnostic') {
      const flow = el('details', '', root); el('summary', 'Conferência do fluxo SPA e responsabilidades', flow);
      el('p', 'Leitura do expediente → conferência de competência, regularidade da intimação, legitimidade, eventuais nulidades e prazo oficial → escolha humana entre observação, confirmar análise, sugerir encerramento ou solicitar redistribuição. O Procurador responsável decide o protocolo ou a devolução da minuta. Assinatura e envio de CI seguem o fluxo próprio. Fonte: manual, p. 34–54.', flow);
    }
    const chart = el('details', '', root);
    el('summary', 'Critérios da proposta de distribuição', chart);
    el('p', 'Execuções individuais → Ney; execuções coletivas sem recurso → Victor Gabriel; recursos de execuções coletivas → Ney; execução de honorários → Ana Clara. Pensão por morte → Gabrielle, exceto casos ligados a subsídio/vida funcional do instituidor → Maria Fernanda ou Ana Julia. Contribuição não doente → Yuri; no recurso → Gabrielle. Aposentadoria, residual civil/militar, contribuição doente e pauta de julgamento → Maria Fernanda ou Ana Julia. Imposto de Renda → Clarissa. Mandado de segurança e contrarrazões (com exceções) → Yuri. Atos específicos de triagem e juntada: conferir Ana Clara/Thais. Atribuição de procurador conforme o organograma.', chart);
    el('p', 'A proposta não define divisão automática entre assessoras com matérias compartilhadas nem todos os casos de conflito. Peças e matérias são etapas diferentes. Revisão humana obrigatória.', chart);
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
          function section(title) { const node = el('section', '', article); node.className = 'mtprev-pop-section'; el('h4', title, node); return node; }
          const facts = section('Dados identificados · fatos extraídos');
          for (const [key, label] of [['processNumber','Processo'],['expedienteId','Expediente'],['party','Destinatário informado'],['actionClass','Classe informada'],['assunto','Assunto informado'],['relevantDate','Data informada']]) {
            if (record[key]) field(facts, label, record[key]);
          }
          field(facts, 'Origem dos metadados', record.metadataSource || 'Leitura do SPA; conferir os campos originais');
          const checks = section('Conferências · inferências e sugestões, não decisões');
          const pending = section('Pendências · informações não confirmadas');
          const guidance = section('Orientações · POP e revisão humana');
          const routing = section('Distribuição sugerida · PROPOSTA do organograma (revisar)');
          const distribution = diagnosis.distribution || R.suggestDistribution?.(record, consent.checked ? (read?.text || '') : '') || { candidates: [], notes: ['Não disponível nesta versão das regras.'] };
          for (const suggestion of distribution.candidates || []) {
            const card = el('div', '', routing);
            card.style.cssText = 'margin:8px 0;padding:10px;background:#263f51;border:1px solid #52778c;border-radius:9px;';
            el('strong', suggestion.category + ' — ' + suggestion.reason, card);
            for (const assessor of suggestion.assessores || []) {
              field(card, 'Assessor(a) sugerido(a)', assessor.name);
              field(card, 'Procurador indicado', assessor.procuradores);
              field(card, 'Cobertura de peças na proposta', assessor.pecas);
            }
            if (suggestion.detail) field(card, 'Ressalva', suggestion.detail);
            field(card, 'Base da indicação', suggestion.source);
          }
          if (!distribution.candidates?.length) field(routing, 'Encaminhamento', 'Não identificado com segurança: revisão humana necessária.');
          for (const note of distribution.notes || []) field(routing, 'Atenção', note);
          field(routing, 'Fonte', distribution.source || 'Organograma de triagem/distribuição, p. 1');
          field(routing, 'Situação', 'Proposta sujeita a validação; nenhuma redistribuição executada.');
          for (const [key, label] of [['party','Destinatário'],['actionClass','Classe processual'],['pjeDeadline','Prazo oficial']]) if (!record[key]) field(pending, label, 'Não disponível nos dados coletados; conferir no SPA/documento.');
          field(guidance, 'Conferência obrigatória', 'Regularidade da intimação, legitimidade e prazo oficial devem ser conferidos pelo responsável. O diagnóstico não confirma esses requisitos e não pratica atos.');
          if (mode === 'diagnostic') {
            field(checks, 'Destinatário da intimação', diagnosis.recipient.label);
            field(checks, 'Origem do destinatário', diagnosis.recipient.reason);
            if (diagnosis.recipient.id) field(checks, 'Identificador do destinatário', diagnosis.recipient.id);
            field(checks, 'Competência sugerida', diagnosis.competence); field(checks, 'Justificativa', diagnosis.reason);
            field(checks, 'Natureza da ação', diagnosis.nature); field(checks, 'Procedimento identificado', diagnosis.procedure);
            field(checks, 'Origem do procedimento', diagnosis.procedureSource);
            field(checks, 'Assunto previdenciário', diagnosis.pensionSubject); field(checks, 'Peça processual', diagnosis.suggestedPiece);
            field(checks, 'Prazo registrado no SPA/PJe', diagnosis.deadline);
            field(checks, 'Situação do prazo', diagnosis.deadlineStatus);
            field(checks, 'Duplicidade', 'Consulte o Relatorio Duplicados na aba Duplicados — mesma lógica para todas as unidades.');
            for (const candidate of diagnosis.procedureCandidates) field(checks, `Etapas do POP — ${candidate.name} (não define a peça)`, candidate.stages.join(' · '));
          }
          if (!diagnosis.priorities.length && mode === 'priorities') el('p', 'Nenhum indício dos três grupos prioritários. Não significa exclusão jurídica.', article);
          for (const priority of diagnosis.priorities) { field(checks, priority.label, priority.status); field(checks, 'Critério', priority.reason); field(checks, priority.source, priority.sample); }
          for (const check of diagnosis.manualChecks || []) field(guidance, check.source + ' — conferir', check.instruction);
          if (consent.checked && (!read?.popReadReliable)) field(pending, 'Leitura documental', read?.error || 'Inconclusiva ou sem texto confiável; mantidos apenas os metadados.');
          else if (consent.checked && !read?.popReadComplete) field(pending, 'Leitura documental', 'Parcial: os indícios usam apenas o texto disponível. Conferir os documentos não lidos.');
          const evidence = el('details', '', facts); el('summary', 'Dados utilizados e suas origens', evidence);
          for (const item of diagnosis.evidence) field(evidence, `${item.field} — ${item.source}`, item.value);
          links(article, record); review(article, record, diagnosis);
        }
        status.textContent = `${shown} registro(s) exibido(s) de ${records.length} analisado(s). Revisão humana obrigatória; nenhum prazo ou ato foi alterado.`;
      } catch (error) { status.textContent = error.message; }
      finally { button.disabled = false; unit.disabled = false; consent.disabled = false; }
    });
    return root;
  }
  // Triagem visual de leitura: reusa o leitor do SPA2, sem executar atos.
  let cssInstalled = false;
  function installReportStyle() {
    if (cssInstalled || document.getElementById('mtprev-triagem-report-style')) return;
    cssInstalled = true;
    const style = document.createElement('style');
    style.id = 'mtprev-triagem-report-style';
    style.textContent = `
    .mtprev-triage-entry{color:#eaf2f8;font:13px/1.5 system-ui,sans-serif;}
    .mtprev-triage-entry *,.mtprev-triage-modal *{box-sizing:border-box;}
    .mtprev-triage-entry__head{padding:12px;border:1px solid #49748c;border-radius:11px;background:linear-gradient(105deg,#17344b,#245875);}
    .mtprev-triage-entry__head strong{display:block;font-size:15px;margin-bottom:3px;color:white;}
    .mtprev-triage-entry__head small{color:#ccdfeb;display:block;}
    .mtprev-triage-entry__actions{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px;}
    .mtprev-triage-entry button,.mtprev-triage-modal button{cursor:pointer;border:1px solid #adcadf;border-radius:7px;padding:9px 12px;font:750 12px system-ui,sans-serif;background:#eaf4fc;color:#1b405b;}
    .mtprev-triage-entry button:disabled,.mtprev-triage-modal button:disabled{cursor:not-allowed;opacity:.55;}
    .mtprev-triage-entry .mtprev-triage-primary,.mtprev-triage-modal .mtprev-triage-primary{background:#1778c8;color:white;border-color:#1778c8;}
    .mtprev-triage-entry__note{margin:8px 2px 0;color:#b5c9d9;font-size:11px;}
    .mtprev-triage-modal{position:fixed;inset:0;z-index:2147483646;background:rgba(8,21,35,.72);display:flex;align-items:center;justify-content:center;padding:14px;font:13px/1.45 system-ui,sans-serif;color:#253b53;}
    .mtprev-triage-dialog{width:min(1240px,100%);max-height:calc(100dvh - 28px);display:flex;flex-direction:column;border:1px solid #7ca7c0;border-radius:14px;overflow:hidden;background:#f0f5fa;box-shadow:0 20px 80px rgba(0,0,0,.38);}
    .mtprev-triage-head{flex-shrink:0;display:flex;align-items:center;gap:12px;background:linear-gradient(105deg,#18374e,#286382);color:white;border-bottom:3px solid #41a1c9;padding:13px 16px;}
    .mtprev-triage-brand{height:48px;min-width:70px;max-width:110px;display:flex;align-items:center;justify-content:center;padding:6px 9px;background:#102e41;border:1px solid #3e7b95;border-radius:10px;}
    .mtprev-triage-brand img{max-width:100%;max-height:35px;object-fit:contain;}
    .mtprev-triage-brand b{color:#59c7bd;font-size:16px;}
    .mtprev-triage-head-title{flex:1;min-width:160px;}
    .mtprev-triage-head-title strong{font-size:17px;display:block;}
    .mtprev-triage-head-title small{font-size:11px;color:#c3dfec;display:block;margin-top:3px;}
    .mtprev-triage-head button{flex:none;background:#e7f3ff;color:#183c55;}
    .mtprev-triage-main{min-height:0;overflow:auto;padding:16px;}
    .mtprev-triage-note{font-size:12px;background:#e3eff8;border:1px solid #c4dae9;border-radius:9px;padding:10px 12px;color:#3c5870;margin:0 0 12px;}
    .mtprev-triage-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:12px;}
    .mtprev-triage-stat{border:1px solid #d4e2eb;border-left:4px solid var(--stat-color,#2780af);border-radius:10px;background:#fff;padding:12px;min-width:0;}
    .mtprev-triage-stat small{display:block;font-size:11px;color:#60778c;font-weight:700;}
    .mtprev-triage-stat strong{display:block;font-size:25px;color:#1b3951;margin-top:4px;font-weight:850;}
    .mtprev-triage-stat .stat-icon{float:right;background:#e9f3f9;padding:4px 7px;border-radius:7px;font-size:15px;color:#245a79;}
    .mtprev-triage-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0;}
    .mtprev-triage-tools input,.mtprev-triage-tools select{min-width:0;border:1px solid #bdcedd;border-radius:7px;background:#fff;color:#25435c;padding:10px;font:13px system-ui,sans-serif;}
    .mtprev-triage-tools input[type=search]{flex:2;min-width:170px;}
    .mtprev-triage-tools select{flex:1;min-width:160px;}
    .mtprev-triage-switch{display:flex;gap:6px;}
    .mtprev-triage-switch button[aria-pressed=true]{background:#216d9f;color:white;border-color:#216d9f;}
    .mtprev-triage-row{border:1px solid #c7dae5;border-left:5px solid var(--row-color,#4887a5);border-radius:9px;background:white;margin:8px 0;overflow:hidden;}
    .mtprev-triage-row-head{padding:11px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
    .mtprev-triage-row-head input{accent-color:#176aa6;width:16px;height:16px;flex:none;}
    .mtprev-triage-process{flex:1;min-width:145px;}
    .mtprev-triage-process strong{display:block;color:#193a54;font-size:13px;}
    .mtprev-triage-process small{display:block;color:#6a7c8d;font-size:11px;margin-top:2px;}
    .mtprev-triage-target{flex:2;min-width:210px;color:#36546a;}
    .mtprev-triage-target strong{display:block;font-size:12px;color:#274a62;}
    .mtprev-triage-target small{font-size:11px;color:#648093;display:block;}
    .mtprev-triage-badge{border-radius:999px;padding:5px 9px;white-space:nowrap;font-size:11px;font-weight:750;background:#eaf3f9;color:#185a7a;}
    .mtprev-triage-row details{border-top:1px solid #dbe7f0;padding:0 12px;}
    .mtprev-triage-row details summary{padding:10px 0;cursor:pointer;font-weight:750;color:#176497;font-size:12px;}
    .mtprev-triage-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;font-size:12px;margin-bottom:12px;}
    .mtprev-triage-detail-grid section{padding:9px;border:1px solid #d8e4ec;border-radius:8px;background:#f5f9fc;min-width:0;overflow-wrap:anywhere;}
    .mtprev-triage-detail-grid b{display:block;color:#60768a;margin-bottom:4px;}
    .mtprev-triage-row a{color:#146b9d;font-weight:700;}
    .mtprev-triage-review{display:grid;gap:7px;margin:12px 0;padding:10px;background:#e9f3f8;border-radius:8px;}
    .mtprev-triage-review select,.mtprev-triage-review textarea{border:1px solid #b0cad8;border-radius:7px;background:white;color:#254253;padding:8px;width:100%;font:12px system-ui,sans-serif;}
    .mtprev-triage-review textarea{min-height:54px;resize:vertical;}
    .mtprev-triage-group{background:#d8eaf5;padding:10px;border-radius:9px;font-weight:850;color:#1c4965;margin:16px 0 7px;}
    .mtprev-triage-pager{display:flex;justify-content:center;margin:15px 0;}
    .mtprev-triage-loadbox{border:1px solid #9bc7dc;background:#f7fbfe;border-radius:12px;padding:20px;max-width:590px;margin:16px auto;text-align:center;}
    .mtprev-triage-progress{height:11px;border-radius:999px;background:#d9e5ef;overflow:hidden;margin:12px 0;border:1px solid #bed2e1;}
    .mtprev-triage-progress span{display:block;height:100%;width:0;background:#197fbd;transition:width .18s ease;}
    .mtprev-triage-error{border:1px solid #d4a6a3;color:#863a35;background:#fff0ee;padding:12px;border-radius:9px;}
    .mtprev-triage-empty{border:1px solid #c6dae8;background:white;padding:20px;text-align:center;border-radius:10px;color:#5b7386;}

    /* Janela tipo iframe com navegação própria; sem iframe real / novo login no SPA. */
    .mtprev-triage-dialog{width:min(1450px,100%);max-height:calc(100dvh - 22px);}
    .mtprev-triage-workspace{display:flex;flex:1;min-height:0;background:#eff5fa;}
    .mtprev-triage-sidebar{flex:0 0 218px;min-width:190px;overflow:auto;background:#173a50;color:#eaf5fc;padding:20px 12px;border-right:1px solid #478299;}
    .mtprev-triage-side-title{display:block;font-size:11px;letter-spacing:.12em;margin:0 10px 7px;color:#86cee5;}
    .mtprev-triage-side-hint{font-size:12px;line-height:1.45;color:#c9dde7;margin:0 10px 16px;}
    .mtprev-triage-side-button{display:flex!important;flex-direction:column;align-items:flex-start;text-align:left!important;width:100%;border-radius:9px!important;padding:11px 12px!important;margin:5px 0;border:1px solid transparent!important;background:#224d65!important;color:#e8f3f9!important;gap:3px;}
    .mtprev-triage-side-button small{font-size:10px;opacity:.8;font-weight:400;}
    .mtprev-triage-side-button:hover{background:#346f89!important;}
    .mtprev-triage-side-button[aria-current=page]{background:#eaf7fc!important;color:#17405a!important;border-color:#9dcbdc!important;box-shadow:inset 4px 0 #2ba5c7;}
    .mtprev-triage-side-divider{font-size:10px;font-weight:850;letter-spacing:.08em;margin:19px 10px 7px;color:#a1d4e5;}
    .mtprev-triage-side-note{padding:10px;font-size:11px;color:#c4dce7;border-radius:9px;border:1px solid #416b7e;background:#1d465b;line-height:1.45;margin-top:14px;}
    .mtprev-triage-main{flex:1;min-width:0;min-height:0;overflow:auto;padding:18px 20px;overscroll-behavior:contain;}
    .mtprev-assessor-avatar{width:29px;height:29px;flex:none;position:relative;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid #aacbd9;color:#2c637d;background:#e1eff5;font-size:10px;font-weight:850;overflow:hidden;}
    .mtprev-assessor-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#e1eff5;}
    .mtprev-assessor-label{display:inline-flex;align-items:center;gap:8px;min-width:0;vertical-align:middle;}
    .mtprev-assessor-label>span:last-child{min-width:0;overflow-wrap:anywhere;}
    .mtprev-triage-owner-line{display:flex!important;flex-wrap:wrap;align-items:center;gap:7px;}
    .mtprev-triage-group{display:flex;align-items:center;justify-content:space-between;gap:10px;background:linear-gradient(90deg,#d8eaf4,#edf7fb);border:1px solid #c6e0ec;}
    .mtprev-triage-row{box-shadow:0 1px 3px rgba(25,57,78,.06);transition:box-shadow .18s ease,border-color .18s ease;}
    .mtprev-triage-row:hover{box-shadow:0 5px 17px rgba(31,78,110,.13);border-color:#85b7cf;}
    .mtprev-triage-head{background:linear-gradient(110deg,#183a53,#205c78 60%,#287f9b);}
    @media(max-width:850px){.mtprev-triage-workspace{flex-direction:column;}.mtprev-triage-sidebar{flex:0 0 auto;min-width:0;max-height:210px;}.mtprev-triage-main{padding:11px;}}
    @media(max-width:900px){.mtprev-triage-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.mtprev-triage-detail-grid{grid-template-columns:1fr}.mtprev-triage-head{gap:7px;padding:9px}.mtprev-triage-brand{min-width:50px}.mtprev-triage-main{padding:9px}}
    `;
    document.head.appendChild(style);
  }
  function reportNode(tag, cls = '', content = '') {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content !== '') node.textContent = content;
    return node;
  }
  function fmtDuration(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, '0')}s`;
  }
  const reportKey = record => [record.processNumber || '', record.expedienteId || '', record.rowKey || record.id || ''].join('|');
  function classifyTriage(records) {
    const unique = new Map();
    for (const record of records) {
      const key = reportKey(record);
      if (key !== '||' && !unique.has(key)) unique.set(key, record);
    }
    return [...unique.values()].map(record => {
      const diagnosis = R.diagnose(record);
      const distribution = diagnosis.distribution || R.suggestDistribution?.(record) || {candidates:[],notes:[]};
      const candidates = distribution.candidates || [];
      const people = [...new Map(candidates.flatMap(c => c.assessores || []).map(p => [p.name,p])).values()];
      const kind = candidates.length === 1 && people.length === 1 ? 'matched' : candidates.length ? 'review' : 'unknown';
      return {record,diagnosis,distribution,candidates,people,kind,key:reportKey(record)};
    });
  }

  // Fotografias são reutilizadas somente quando já estão disponíveis no SPA.
  // Não faz requisições a endpoints de perfis nem infere a identidade pela foto.
  function assessorPhotoUrl(personName, records = []) {
    const clean = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const name = clean(personName);
    if (!name || name.startsWith('sem assessor') || name.startsWith('revisao necessaria')) return '';
    const safe = raw => {
      try {
        const url = new URL(raw, location.href);
        if (url.protocol !== 'https:' || url.origin !== location.origin) return '';
        return url.href;
      } catch (_) { return ''; }
    };
    const record = records.find(item => clean(item?.assessor || item?.name) === name && (item.assessorPhotoUrl || item.avatarUrl || item.photoUrl));
    const supplied = safe(record?.assessorPhotoUrl || record?.avatarUrl || record?.photoUrl);
    if (supplied) return supplied;
    const images = [...document.querySelectorAll('img[src]')].filter(img =>
      !img.closest('.mtprev-triage-modal,#spa-cdsp-management-report-modal,#mtprev-management-launcher'));
    for (const img of images.slice(0, 250)) {
      const caption = clean([img.alt,img.title,img.dataset?.name,img.dataset?.assessor].filter(Boolean).join(' '));
      const holder = img.closest('[data-user-name],[data-assessor-name],.user-card,.person-card,.team-member,li,article');
      const context = clean(holder?.getAttribute('data-user-name') || holder?.getAttribute('data-assessor-name') || holder?.textContent?.slice(0,220));
      if (caption !== name && !(context && context.includes(name) && context.length <= name.length + 90)) continue;
      const url = safe(img.currentSrc || img.getAttribute('src'));
      if (url) return url;
    }
    return '';
  }

  function assessorAvatar(personName, extraRecords = []) {
    const node = document.createElement('span');
    node.className = 'mtprev-assessor-avatar';
    node.setAttribute('aria-hidden','true');
    const tokens = String(personName || '?').trim().split(/\s+/).filter(Boolean);
    const initials = tokens.length > 1 ? (tokens[0][0]+tokens[tokens.length-1][0]).toUpperCase() : (tokens[0]?.slice(0,2) || '?').toUpperCase();
    node.textContent = initials;
    const url = assessorPhotoUrl(personName, extraRecords);
    if (url) {
      const img = document.createElement('img');img.alt='';img.loading='lazy';img.src=url;
      img.addEventListener('error',()=>img.remove(),{once:true});node.appendChild(img);
    }
    return node;
  }
  function assessorLabel(personName, records = []) {
    const wrap = document.createElement('span');wrap.className='mtprev-assessor-label';
    wrap.append(assessorAvatar(personName,records));
    const name = document.createElement('span');name.textContent=personName || 'Não identificado';name.title=personName || '';
    wrap.append(name);return wrap;
  }

  function createModernReport(api) {
    installReportStyle();
    const root = reportNode('section','mtprev-triage-entry');
    const heading = reportNode('div','mtprev-triage-entry__head');
    heading.append(reportNode('strong','','Triagem e distribuição · MTPrev'));
    heading.append(reportNode('small','','Uma leitura da mesa, sugestões pelo organograma e revisão por processo.'));
    root.append(heading);
    const actions = reportNode('div','mtprev-triage-entry__actions');
    const generate = reportNode('button','mtprev-triage-primary','Gerar relatório de triagem');
    generate.type='button';
    const reopen = reportNode('button','','Reabrir último relatório');
    reopen.type='button'; reopen.hidden=true;
    actions.append(generate,reopen); root.append(actions);
    const hint = reportNode('p','mtprev-triage-entry__note','A classificação é consultiva. Nenhuma ciência, distribuição ou encerramento será executado.');
    root.append(hint);
    const status = reportNode('p','mtprev-triage-entry__note');status.setAttribute('role','status');root.append(status);
    let last = null, currentController = null, modal = null;

    function makeModal() {
      modal?.remove();
      const overlay = reportNode('div','mtprev-triage-modal');
      overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
      overlay.setAttribute('aria-label','Relatório de Triagem MTPrev');
      const shell=reportNode('div','mtprev-triage-dialog');
      const header=reportNode('div','mtprev-triage-head');
      const brand=reportNode('div','mtprev-triage-brand');
      const imageUrl=window.SPA_CDSP_TRIAGEM_CONFIG?.headerImageUrl || '';
      if (imageUrl) {
        const img=reportNode('img');img.alt='MTPrev';img.src=imageUrl;
        img.onerror=()=>{img.remove();brand.append(reportNode('b','','MTPrev'));};
        brand.append(img);
      } else brand.append(reportNode('b','','MTPrev'));
      header.append(brand);
      const h=reportNode('div','mtprev-triage-head-title');
      h.append(reportNode('strong','','Relatório de Triagem e Distribuição'));
      h.append(reportNode('small','','Proposta de organograma · recomendações para conferência humana'));
      header.append(h);
      const close=reportNode('button','','Fechar');close.type='button';
      close.addEventListener('click',()=>{if(currentController)currentController.abort();overlay.remove();modal=null;});
      header.append(close);
      const area=reportNode('div','mtprev-triage-workspace');
      const aside=reportNode('aside','mtprev-triage-sidebar');aside.setAttribute('aria-label','Navegação dos relatórios de triagem');
      const main=reportNode('div','mtprev-triage-main');
      area.append(aside,main);shell.append(header,area);overlay.append(shell);
      document.body.append(overlay);
      overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close.click();}});
      modal=overlay;
      aside.append(reportNode('strong','mtprev-triage-side-title','RELATÓRIOS'));
      aside.append(reportNode('p','mtprev-triage-side-hint','A mesma leitura permite várias maneiras de revisar os expedientes.'));
      return main;
    }
    function showLoad(main) {
      main.replaceChildren();
      const box=reportNode('div','mtprev-triage-loadbox');
      const msg=reportNode('strong','','Preparando leitura da mesa…');
      const detail=reportNode('p','','Identificando quantidade de processos e filtros atuais.');
      const progress=reportNode('div','mtprev-triage-progress');const fill=reportNode('span');progress.append(fill);
      const cancel=reportNode('button','','Interromper leitura');cancel.type='button';
      cancel.addEventListener('click',()=>currentController?.abort());
      box.append(msg,detail,progress,cancel);main.append(box);
      return ({count,total,rounds,pages})=>{
        const n=Number(count) || 0, t=Number(total);
        const valid=Number.isFinite(t) && t>0;
        const pct=valid?Math.min(100,Math.floor(n/t*100)):0;
        msg.textContent=valid?`Lendo processos: ${n} de ${t} (${pct}%)`:`Lendo processos: ${n}`;
        detail.textContent=`Lotes de até 100 · ${Number.isFinite(Number(rounds))?rounds:'–'}${Number.isFinite(Number(pages))?' / '+pages:''} concluídos · ${fmtDuration(Date.now()-startedAt)} decorridos`;
        fill.style.width=`${pct}%`;
      };
    }
    let startedAt=0;
    async function generateReport() {
      if(currentController) return;
      const main=makeModal();
      startedAt=Date.now();
      currentController=new AbortController();
      generate.disabled=true;
      const showProgress=showLoad(main);
      try {
        let records,coverage='partial',total;
        if(window.SpaAdapter?.route?.().kind==='workspace') {
          const result=await window.SpaAdapter.collectWorkspaceRecords({signal:currentController.signal,onProgress:showProgress});
          records=result.records||[];coverage=result.reason;total=result.total;
        } else {
          records=api.getRecords()||[];total=records.length;
          showProgress({count:records.length,total});
        }
        if(currentController.signal.aborted)return;
        if(!records.length)throw new Error('Nenhum expediente foi encontrado na tela ou na mesa atual.');
        const rows=classifyTriage(records);
        last={rows,elapsed:Date.now()-startedAt,coverage,total,at:new Date()};
        reopen.hidden=false;
        status.textContent=`Última análise: ${rows.length} expediente(s). ${coverage==='complete'?'Leitura completa.':'Cobertura não confirmada.'}`;
        renderReport(main,last);
      } catch(error) {
        if(currentController?.signal.aborted) {
          main.replaceChildren(reportNode('p','mtprev-triage-note','Leitura interrompida. Nenhuma movimentação foi realizada.'));
        } else {
          const errorBox=reportNode('p','mtprev-triage-error',`Não foi possível gerar o relatório: ${error?.message||error}`);
          main.replaceChildren(errorBox);
        }
      } finally {
        currentController=null;generate.disabled=false;
      }
    }
    function renderReport(main,data) {
      const rows=data.rows;
      const matched=rows.filter(x=>x.kind==='matched').length;
      const review=rows.filter(x=>x.kind==='review').length;
      const unknown=rows.filter(x=>x.kind==='unknown').length;
      main.replaceChildren();
      const summary=reportNode('div','mtprev-triage-note',`${rows.length} expedientes examinados · ${fmtDuration(data.elapsed)} · ${data.coverage==='complete'?'Leitura completa da mesa.':'Leitura parcial ou apenas registros visíveis — confirme a cobertura.'} Nenhuma alteração foi feita no SPA.`);
      main.append(summary);
      const metrics=reportNode('div','mtprev-triage-stats');
      for(const item of [
        {label:'Analisados',value:rows.length,mark:'▣',color:'#197ca8'},
        {label:'Sugestão encontrada',value:matched,mark:'✓',color:'#267f83'},
        {label:'Escolha necessária',value:review,mark:'◇',color:'#a47b25'},
        {label:'Sem classificação',value:unknown,mark:'?',color:'#925a78'}]) {
        const card=reportNode('div','mtprev-triage-stat');card.style.setProperty('--stat-color',item.color);
        card.append(reportNode('span','stat-icon',item.mark));card.append(reportNode('small','',item.label));card.append(reportNode('strong','',String(item.value)));
        metrics.append(card);
      }
      main.append(metrics);
      const toolbar=reportNode('div','mtprev-triage-tools');
      const search=reportNode('input');search.type='search';search.placeholder='Buscar número, assunto ou assessor…';search.setAttribute('aria-label','Buscar no relatório');
      const select=reportNode('select');select.setAttribute('aria-label','Filtrar situação');
      for(const [value,label] of [['all','Todas as situações'],['matched','Sugestão encontrada'],['review','Escolha necessária'],['unknown','Sem classificação']]){
        const option=reportNode('option','',label);option.value=value;select.append(option);
      }
      const switcher=reportNode('div','mtprev-triage-switch');
      const byProcess=reportNode('button','','Por processo');byProcess.type='button';
      const byPerson=reportNode('button','','Por assessor');byPerson.type='button';
      switcher.append(byProcess,byPerson);
      const selectAll=reportNode('button','','Marcar até 100');selectAll.type='button';
      const exportCsv=reportNode('button','','Exportar CSV');exportCsv.type='button';
      toolbar.append(search,select,switcher,selectAll,exportCsv);main.append(toolbar);
      const selectedNotice=reportNode('p','mtprev-triage-note','Marcar é apenas para organizar a revisão nesta tela. Não distribui nem encerra expedientes.');main.append(selectedNotice);
      const list=reportNode('div');main.append(list);
      const pager=reportNode('div','mtprev-triage-pager');main.append(pager);
      const selected=new Set();let view='process',pageSize=40;
      const normalized=(value)=>R.norm(value||'');
      const summarySearch=x=>normalized([x.record.processNumber,x.record.expedienteId,x.record.assunto,x.record.manifestationSuggested,...x.people.map(p=>p.name)].join(' '));
      function filtered(){
        const q=normalized(search.value);
        return rows.filter(x=>(select.value==='all'||x.kind===select.value)&&(!q||summarySearch(x).includes(q)));
      }
      function setButtons(){
        byProcess.setAttribute('aria-pressed',String(view==='process'));
        byPerson.setAttribute('aria-pressed',String(view==='assessor'));
        selectedNotice.textContent=`${selected.size} expediente(s) marcados para revisão · marcar não altera o SPA.`;
      }
      function openAllowedLink(parent,record){
        const items=[record.pendencyUrl,...(record.expedientes||[]).map(e=>e.url)].filter(Boolean);
        const match=items.find(value=>{try{const u=new URL(value,location.href);return u.protocol==='https:'&&['spa.pge.mt.gov.br','pge.mt.spa.coreplan.com.br'].includes(u.hostname)}catch(_){return false}});
        if(!match)return;
        const a=reportNode('a','','Abrir expediente no SPA');a.href=new URL(match,location.href).href;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);
      }
      function addRow(target,x){
        const article=reportNode('article','mtprev-triage-row');
        article.style.setProperty('--row-color',x.kind==='matched'?'#2b8c94':x.kind==='review'?'#be9655':'#888aa5');
        const strip=reportNode('div','mtprev-triage-row-head');
        const checkbox=reportNode('input');checkbox.type='checkbox';checkbox.checked=selected.has(x.key);checkbox.setAttribute('aria-label',`Marcar processo ${x.record.processNumber||'não identificado'}`);
        checkbox.addEventListener('change',()=>{checkbox.checked?selected.add(x.key):selected.delete(x.key);setButtons();});
        strip.append(checkbox);
        const p=reportNode('div','mtprev-triage-process');
        p.append(reportNode('strong','',x.record.processNumber||'Processo sem número'));p.append(reportNode('small','',`Expediente ${x.record.expedienteId||'não informado'}`));strip.append(p);
        const targetNames=x.people.map(p=>p.name).join(' ou ');
        const owners=[...new Set(x.people.map(p=>p.procuradores).filter(Boolean))].join(' · ');
        const dest=reportNode('div','mtprev-triage-target');
        const ownersLine=reportNode('strong','mtprev-triage-owner-line');
        if(x.people.length){
          x.people.forEach((person,index)=>{if(index)ownersLine.append(document.createTextNode(' ou '));ownersLine.append(assessorLabel(person.name));});
        } else ownersLine.textContent='Responsável não identificado';
        dest.append(ownersLine);
        dest.append(reportNode('small','',owners?`Procurador: ${owners}`:'Conferir matéria e tipo de peça'));
        strip.append(dest);
        const badgeLabel=x.kind==='matched'?'✓ Sugestão encontrada':x.kind==='review'?'◇ Escolha necessária':'? Sem classificação';
        strip.append(reportNode('span','mtprev-triage-badge',badgeLabel));article.append(strip);
        const details=reportNode('details');
        details.append(reportNode('summary','','Ver critérios e registrar conferência'));
        const info=reportNode('div','mtprev-triage-detail-grid');
        function detailField(label,value){const s=reportNode('section');s.append(reportNode('b','',label));s.append(document.createTextNode(value||'Não informado'));info.append(s);}
        detailField('Assunto',x.record.assunto);
        detailField('Tipo de peça / manifestação',x.record.manifestationSuggested);
        detailField('Matéria e justificativa',x.candidates.map(c=>`${c.category}: ${c.reason}`).join(' | ')||'Não enquadrado na proposta.');
        detailField('Regras e ressalvas',x.distribution.notes?.join(' | ')||'Conferir se a proposta está vigente e aplicável.');
        detailField('Procurador indicado no organograma',owners);
        detailField('Fonte e cobertura',`${x.distribution.source||'Proposta do organograma'}; ${x.record.metadataSource||'Metadados do SPA'}`);
        details.append(info);
        const origin=reportNode('div');openAllowedLink(origin,x.record);details.append(origin);
        const rev=reportNode('div','mtprev-triage-review');
        rev.append(reportNode('strong','','Registro local de conferência (não altera o SPA)'));
        const revStatus=reportNode('select');
        for(const value of ['Pendente','Conferido — manter indicação','Conferido — corrigir indicação']){const option=reportNode('option','',value);option.value=value;revStatus.append(option);}
        const note=reportNode('textarea');note.placeholder='Anotação de conferência…';note.setAttribute('aria-label','Anotação da revisão');
        const revKey=x.key;let saved={};
        try{saved=JSON.parse(localStorage.getItem('MTPREV_POP_REVIEWS')||'{}')[revKey]||{}}catch(_){}
        revStatus.value=saved.status||'Pendente';note.value=saved.note||'';
        const feedback=reportNode('small');
        function save(){
          try{const db=JSON.parse(localStorage.getItem('MTPREV_POP_REVIEWS')||'{}');db[revKey]={status:revStatus.value,note:note.value,at:new Date().toISOString(),indication:x.diagnosis.competence};localStorage.setItem('MTPREV_POP_REVIEWS',JSON.stringify(db));feedback.textContent='Conferência registrada neste navegador.';}
          catch(_){feedback.textContent='Não foi possível salvar a conferência no armazenamento local.';}
        }
        revStatus.addEventListener('change',save);note.addEventListener('change',save);
        rev.append(revStatus,note,feedback);details.append(rev);article.append(details);target.append(article);
      }
      function render(){
        setButtons();list.replaceChildren();pager.replaceChildren();
        const matching=filtered();
        if(!matching.length){list.append(reportNode('div','mtprev-triage-empty','Nenhum processo encontrado para essa pesquisa.'));return;}
        const shown=matching.slice(0,pageSize);
        if(view==='process'){shown.forEach(x=>addRow(list,x));}
        else {
          const groups=new Map();
          for(const x of shown){const assessor=x.kind==='matched'?x.people[0].name:'Revisão necessária / sem responsável único';if(!groups.has(assessor))groups.set(assessor,[]);groups.get(assessor).push(x);}
          for(const [assessor,items] of [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0],'pt-BR'))){
            const group=reportNode('div','mtprev-triage-group');
            const title=assessor!=='Revisão necessária / sem responsável único' ? assessorLabel(assessor) : reportNode('span','',assessor);
            group.append(title,reportNode('span','',`${items.length} processo(s) exibido(s)`));list.append(group);
            items.forEach(x=>addRow(list,x));
          }
        }
        if(shown.length<matching.length){const more=reportNode('button','','Mostrar mais 40');more.type='button';more.addEventListener('click',()=>{pageSize+=40;render();});pager.append(more);}
      }
      search.addEventListener('input',()=>{pageSize=40;render();});
      select.addEventListener('change',()=>{pageSize=40;render();});
      byProcess.addEventListener('click',()=>{view='process';render();});
      byPerson.addEventListener('click',()=>{view='assessor';render();});
      selectAll.addEventListener('click',()=>{filtered().slice(0,100).forEach(x=>selected.add(x.key));render();});
      exportCsv.addEventListener('click',()=>{
        const csvValue=value=>{let text=String(value??'');if(/^[\t\r\n=+\-@]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
        const dataRows=[['Processo','Expediente','Assunto','Situação','Assessor(es) sugerido(s)','Procurador(es)','Justificativa'],
          ...filtered().map(x=>[x.record.processNumber,x.record.expedienteId,x.record.assunto,x.kind,x.people.map(p=>p.name).join(' / '),[...new Set(x.people.map(p=>p.procuradores))].join(' / '),x.candidates.map(c=>c.reason).join(' | ')])];
        const content='\uFEFF'+dataRows.map(row=>row.map(csvValue).join(';')).join('\r\n');
        const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
        const a=reportNode('a');a.href=url;a.download='mtprev-triagem-revisao.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
      });
      const sidebar=modal?.querySelector('.mtprev-triage-sidebar');
      const makeSideButton=(label,description,fn,active)=>{
        const button=reportNode('button','mtprev-triage-side-button');button.type='button';
        button.append(reportNode('span','',label));
        if(description)button.append(reportNode('small','',description));
        button.setAttribute('aria-current',active?'page':'false');
        button.addEventListener('click',fn);return button;
      };
      function redrawSide(){
        if(!sidebar)return;
        sidebar.replaceChildren();
        sidebar.append(reportNode('strong','mtprev-triage-side-title','RELATÓRIOS'));
        sidebar.append(reportNode('p','mtprev-triage-side-hint','Todas as visualizações usam os mesmos dados coletados.'));
        sidebar.append(makeSideButton('Por processo','Lista e critérios',()=>{view='process';render();},view==='process'));
        sidebar.append(makeSideButton('Por assessor','Sugestões agrupadas',()=>{view='assessor';render();},view==='assessor'));
        const divider=reportNode('div','mtprev-triage-side-divider','FILTRAR POR SITUAÇÃO');sidebar.append(divider);
        for(const [key,label,description] of [
          ['all','Todos os processos','Sem filtro de situação'],
          ['matched','Sugestões encontradas','Um responsável indicado'],
          ['review','Escolha necessária','Mais de uma opção'],
          ['unknown','Sem classificação','Conferência manual']
        ]) sidebar.append(makeSideButton(label,description,()=>{select.value=key;pageSize=40;render();},select.value===key));
        if(window.SPA_CDSP_MANAGEMENT_REPORT_PANEL_INITIALIZED){
          sidebar.append(reportNode('div','mtprev-triage-side-divider','OUTROS RELATÓRIOS'));
          sidebar.append(makeSideButton('Painel Gerencial','Dashboards da mesa',()=>{
            modal?.querySelector('.mtprev-triage-head button')?.click();
            document.dispatchEvent(new Event('mtprev:management:open'));
          },false));
        }
        sidebar.append(reportNode('div','mtprev-triage-side-note','Nenhuma seleção altera expedientes ou distribui tarefas no SPA.'));
      }
      // Atualiza a navegação quando a pesquisa ou o tipo de visualização muda.
      const syncSide=()=>redrawSide();
      search.addEventListener('input',syncSide);
      select.addEventListener('change',syncSide);
      byProcess.addEventListener('click',syncSide);
      byPerson.addEventListener('click',syncSide);
      sidebar?.addEventListener('click',event=>{if(event.target.closest('button'))queueMicrotask(redrawSide);});
      render();redrawSide();
    }
    generate.addEventListener('click',generateReport);
    reopen.addEventListener('click',()=>{if(last)renderReport(makeModal(),last);});
    return root;
  }

  function create(api,mode='diagnostic'){return mode==='priorities'?createLegacy(api,mode):createModernReport(api);}
  window.MTPrevPopPanel = Object.freeze({ create, classifyTriage });
})();
