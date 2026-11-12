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
    el('summary', 'Critérios da tabela de distribuição', chart);
    el('p', 'Execuções individuais → Ney; execuções coletivas sem recurso → Victor Gabriel; recursos de execuções coletivas → Ney; execução de honorários → Ana Clara. Pensão por morte → Gabrielle, exceto casos ligados a subsídio/vida funcional do instituidor → Maria Fernanda ou Luma. Contribuição não doente → Yuri; no recurso → Gabrielle. Aposentadoria, residual civil/militar, contribuição doente e pauta de julgamento → Maria Fernanda ou Luma. Imposto de Renda → Clarissa. Mandado de segurança e contrarrazões (com exceções) → Yuri. Atos específicos de triagem e juntada: conferir Ana Clara/Thais. Atribuição de procurador conforme a tabela de triagem.', chart);
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
          const routing = section('Distribuição sugerida · PROPOSTA da tabela de triagem (revisar)');
          const distribution = diagnosis.distribution || R.suggestDistribution?.(record, consent.checked ? (read?.text || '') : '') || { candidates: [], notes: ['Não disponível nesta versão das regras.'] };
          for (const suggestion of distribution.candidates || []) {
            const card = el('div', '', routing);
            card.style.cssText = 'margin:8px 0;padding:10px;background:#263f51;border:1px solid #52778c;border-radius:9px;';
            el('strong', suggestion.category + ' — ' + suggestion.reason, card);
            for (const assessor of suggestion.assessores || []) {
              field(card, 'Assessor(a) sugerido(a)', assessor.name);
              field(card, 'Procurador indicado', assessor.procuradores);
              field(card, 'Cobertura de peças na tabela', assessor.pecas);
            }
            if (suggestion.detail) field(card, 'Ressalva', suggestion.detail);
            field(card, 'Base da indicação', suggestion.source);
          }
          if (!distribution.candidates?.length) field(routing, 'Encaminhamento', 'Não identificado com segurança: revisão humana necessária.');
          for (const note of distribution.notes || []) field(routing, 'Atenção', note);
          field(routing, 'Fonte', distribution.source || 'TRIAGEM.pdf — MTPrev, p. 1');
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
    .mtprev-triage-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-bottom:12px;}
    .mtprev-triage-modal button.mtprev-triage-stat{text-align:left;font:inherit;cursor:pointer;border:1px solid #d4e2eb;border-left:4px solid var(--stat-color,#2780af);border-radius:10px;background:#fff;padding:12px;min-width:0;transition:box-shadow .15s ease,background-color .15s ease;}
    .mtprev-triage-modal button.mtprev-triage-stat:hover{background:#f6fafc;box-shadow:0 3px 9px #183c5514;}
    .mtprev-triage-modal button.mtprev-triage-stat[aria-pressed=true]{box-shadow:inset 0 0 0 1px var(--stat-color);}
    .mtprev-triage-modal button.mtprev-triage-stat:focus-visible{outline:2px solid #197ca8;outline-offset:2px;}
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
    .mtprev-triage-subject{display:grid;gap:2px;padding:5px 8px;margin:3px 0 5px;background:#eaf5fb;border-left:3px solid #277ea2;border-radius:5px;overflow-wrap:anywhere;}
    .mtprev-triage-subject b{font-size:10px;color:#365e75;text-transform:uppercase;letter-spacing:.035em;}
    .mtprev-triage-subject strong{font-size:13px!important;color:#12394f!important;line-height:1.3;}
    .mtprev-triage-row-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
    .mtprev-triage-row-actions a,.mtprev-triage-row-actions button{font-size:11px;padding:6px 9px;white-space:normal;border-radius:7px;border:1px solid #9dc5d8;color:#1a5574;background:#f1f9fc;text-decoration:none;font-weight:800;}
    .mtprev-triage-row-actions button:disabled{opacity:.55;cursor:not-allowed;}
    .mtprev-triage-row-actions a:focus-visible,.mtprev-triage-row-actions button:focus-visible{outline:2px solid #267aa3;outline-offset:2px;}
    .mtprev-triage-batch-feedback{font-weight:700;}

    .mtprev-triage-badge{border-radius:999px;padding:5px 9px;white-space:nowrap;font-size:11px;font-weight:750;background:#eaf3f9;color:#185a7a;}
    .mtprev-triage-row details{border-top:1px solid #dbe7f0;padding:0 12px;}
    .mtprev-triage-row details summary{padding:10px 0;cursor:pointer;font-weight:750;color:#176497;font-size:12px;}
    .mtprev-triage-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;font-size:12px;margin-bottom:12px;}
    .mtprev-triage-detail-grid section{padding:9px;border:1px solid #d8e4ec;border-radius:8px;background:#f5f9fc;min-width:0;overflow-wrap:anywhere;}
    .mtprev-triage-detail-grid b{display:block;color:#60768a;margin-bottom:4px;}
    .mtprev-triage-expanded-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;padding-bottom:14px;align-items:start;}
    .mtprev-triage-expanded-column{min-width:0;}
    .mtprev-triage-column-title{margin:0 0 12px;color:#274a62;font-size:14px;font-weight:750;}
    .mtprev-triage-expanded-column .mtprev-triage-detail-grid{grid-template-columns:1fr;}
    .mtprev-triage-expanded-column .mtprev-triage-review{margin:0 0 12px;}
    .mtprev-triage-expanded-column .mtprev-triage-review:last-child{margin-bottom:0;}
    .mtprev-triage-expanded-column .mtprev-triage-review select,.mtprev-triage-expanded-column .mtprev-triage-review input[type=text],.mtprev-triage-expanded-column .mtprev-triage-review textarea{box-sizing:border-box;min-width:0;}
    .mtprev-triage-process-origin{margin-bottom:12px;}
    @media(max-width:900px){.mtprev-triage-expanded-layout{grid-template-columns:1fr;gap:16px;}}
    .mtprev-triage-row a{color:#146b9d;font-weight:700;}
    .mtprev-triage-review{display:grid;gap:7px;margin:12px 0;padding:10px;background:#e9f3f8;border-radius:8px;}
    .mtprev-triage-review select,.mtprev-triage-review input[type=text],.mtprev-triage-review textarea{border:1px solid #b0cad8;border-radius:7px;background:white;color:#254253;padding:8px;width:100%;font:12px system-ui,sans-serif;}
    .mtprev-triage-review textarea{min-height:74px;resize:vertical;}
    .mtprev-triage-review label{font-size:11px;color:#254253;font-weight:750;display:grid;gap:5px;}
    .mtprev-triage-review label[hidden]{display:none;}
    .mtprev-triage-review small{font-size:11px;color:#4c6b7c;line-height:1.4;}
    .mtprev-triage-review .mtprev-triage-choice-warning{color:#84511b;background:#fff5e4;padding:8px;border-radius:7px;}
    .mtprev-triage-review button{justify-self:start;background:#175e7e;color:white;padding:8px 12px;border:0;border-radius:7px;font-weight:750;cursor:pointer;}
    .mtprev-triage-expanded-column .mtprev-triage-review,.mtprev-triage-expanded-column .mtprev-triage-detail-grid section{background:#eff5f9;border:1px solid #cfdee7;border-radius:5px;padding:10px;}
    .mtprev-triage-expanded-column .mtprev-triage-review strong{color:#274a62;font-size:12px;}
    .mtprev-triage-card-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;}
    .mtprev-triage-card-actions button{background:#175e7e;color:#fff;border:0;border-radius:7px;padding:9px 12px;font-weight:750;cursor:pointer;}
    .mtprev-triage-card-actions button:disabled{opacity:.55;cursor:not-allowed;}
    .mtprev-triage-card-actions button:focus-visible{outline:2px solid #267aa3;outline-offset:2px;}

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
    .mtprev-triage-procurador{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 6px;margin-top:7px;padding:7px 10px;border:1px solid #c7dce9;border-radius:7px;background:#f2f7fb;color:#244e6b;font-size:13px;line-height:1.45;}
    .mtprev-triage-procurador strong{color:#244e6b;font-weight:700;}
    .mtprev-triage-procurador span{color:#183e59;font-weight:600;overflow-wrap:anywhere;}
    .mtprev-assessor-label{display:inline-flex;align-items:center;gap:8px;min-width:0;vertical-align:middle;}
    .mtprev-assessor-label>span:last-child{min-width:0;overflow-wrap:anywhere;}
    .mtprev-triage-owner-line{display:flex!important;flex-wrap:wrap;align-items:center;gap:7px;}
    .mtprev-triage-group{display:flex;align-items:center;justify-content:space-between;gap:10px;background:linear-gradient(90deg,#d8eaf4,#edf7fb);border:1px solid #c6e0ec;}
    .mtprev-triage-row{box-shadow:0 1px 3px rgba(25,57,78,.06);transition:box-shadow .18s ease,border-color .18s ease;}
    .mtprev-triage-row:hover{box-shadow:0 5px 17px rgba(31,78,110,.13);border-color:#85b7cf;}
    .mtprev-triage-head{background:linear-gradient(110deg,#183a53,#205c78 60%,#287f9b);}
    .mtprev-triage-entry__refresh{display:flex;align-items:center;gap:7px;margin:10px 3px 4px;font-size:11px;color:#bcd6e5;line-height:1.4;cursor:pointer}
    .mtprev-triage-entry__refresh input{accent-color:#2da8cc;width:15px;height:15px}
    .mtprev-triage-row{border-radius:12px;border-color:#d2e2ee;background:#fff}
    .mtprev-triage-side-button:focus-visible{outline:2px solid #77d9f0;outline-offset:2px}

    /* Mesma identidade do menu: petroleo, superficies planas e acentos ciano. */
    .mtprev-triage-modal{--triage-ink:#193d50;--triage-panel:#233f51;--triage-line:#486779;--triage-accent:#84d0e7;font-family:system-ui,'Segoe UI',sans-serif;}
    .mtprev-triage-dialog{border-radius:12px;border-color:#598299;background:#edf3f7;box-shadow:0 12px 42px #0b24364d;}
    .mtprev-triage-head{background:linear-gradient(105deg,#1b3c50,#246379);border-bottom:1px solid #568598;padding:14px 18px;}
    .mtprev-triage-head-title strong{font-size:17px;font-weight:700;letter-spacing:0;}
    .mtprev-triage-head-title small{font-size:12px;color:#d0e3eb;}
    .mtprev-triage-head button{background:#233f51;border-color:#598299;color:#edf8fc;border-radius:7px;}
    .mtprev-triage-brand{background:#18394c;border-color:#548da5;border-radius:10px;}
    .mtprev-triage-workspace{background:#edf3f7;}
    .mtprev-triage-main{padding:18px;}
    .mtprev-triage-stats{gap:10px;margin-bottom:16px;}
    .mtprev-triage-modal button.mtprev-triage-stat{background:var(--triage-panel);border:1px solid var(--triage-line);border-radius:9px;padding:12px 14px;box-shadow:none;}
    .mtprev-triage-modal button.mtprev-triage-stat small{color:#d3e5ed;font-size:12px;font-weight:600;}
    .mtprev-triage-modal button.mtprev-triage-stat strong{color:#fff;font-size:25px;font-weight:700;}
    .mtprev-triage-modal button.mtprev-triage-stat .stat-icon{background:#1c3647;color:var(--triage-accent);border-radius:6px;}
    .mtprev-triage-modal button.mtprev-triage-stat:hover{background:#2d5267;border-color:var(--triage-accent);box-shadow:none;}
    .mtprev-triage-modal button.mtprev-triage-stat[aria-pressed=true]{border-color:var(--triage-accent);box-shadow:inset 0 0 0 1px var(--triage-accent);}
    .mtprev-triage-tools{padding:12px;background:#1b3d50;border:1px solid #476b80;border-radius:9px;gap:8px;margin:0 0 16px;}
    .mtprev-triage-modal .mtprev-triage-tools button{background:#25475c;color:#eef7fb;border-color:#65879b;border-radius:6px;font-weight:600;}
    .mtprev-triage-modal .mtprev-triage-tools button:hover:not(:disabled){background:#34627a;}
    .mtprev-triage-tools input,.mtprev-triage-tools select{background:#f8fbfd;border-color:#aac6d6;border-radius:6px;font-size:12px;}
    .mtprev-triage-tools .mtprev-triage-switch button[aria-pressed=true]{background:#dceff8;color:#163e56;border-color:#84d0e7;}
    .mtprev-triage-row{border:1px solid #b9cfdd;border-radius:8px;background:#fff;box-shadow:none;margin:0 0 12px;}
    .mtprev-triage-row:nth-of-type(even){background:#f4f8fb;}
    .mtprev-triage-row:hover{border-color:#719db4;box-shadow:none;}
    .mtprev-triage-row-head{padding:16px;gap:16px;}
    .mtprev-triage-process strong{font-size:13px;color:#183d54;}
    .mtprev-triage-target strong{font-weight:650;}
    .mtprev-triage-subject{background:transparent;border:0;border-left:2px solid #7eb6cd;border-radius:0;padding:3px 9px;margin:7px 0;}
    .mtprev-triage-subject b{font-size:10px;color:#58768a;}
    .mtprev-triage-procurador{background:#e9f2f7;border:0;border-radius:5px;padding:6px 9px;}
    .mtprev-triage-row-actions a,.mtprev-triage-row-actions button{background:#eef5f9;border-color:#a9c6d6;font-weight:600;border-radius:6px;}
    .mtprev-triage-badge{background:#e2f0f5;border-radius:5px;color:#24536a;font-weight:600;}
    .mtprev-triage-row-head.mtprev-triage-card-summary{display:block;padding:0;}
    .mtprev-triage-card-top{display:flex;align-items:center;gap:16px;padding:11px 16px;background:var(--triage-panel);border-bottom:1px solid var(--triage-line);}
    .mtprev-triage-card-top .mtprev-triage-process{display:flex;align-items:center;flex-wrap:wrap;gap:8px 28px;min-width:0;}
    .mtprev-triage-card-top .mtprev-triage-process strong{color:#fff;}
    .mtprev-triage-card-top .mtprev-triage-process small{margin:0;font-size:12px;color:#d3e5ed;}
    .mtprev-triage-card-top .mtprev-triage-badge{flex:none;white-space:normal;text-align:center;}
    .mtprev-triage-modal .mtprev-triage-card-top .mtprev-triage-badge--review{background:#facc15!important;color:#422f00!important;}
    .mtprev-triage-modal .mtprev-triage-card-top .mtprev-triage-badge--unknown{background:#c73535!important;color:#fff!important;}
    .mtprev-triage-modal .mtprev-triage-card-top .mtprev-triage-badge--matched{background:#237b43!important;color:#fff!important;}
    .mtprev-triage-card-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;padding:16px;align-items:start;}
    .mtprev-triage-card-body .mtprev-triage-subject{min-width:0;margin:0;padding:5px 12px;}
    .mtprev-triage-card-body .mtprev-triage-subject strong{font-size:15px!important;}
    .mtprev-triage-card-subject-column{min-width:0;display:grid;gap:12px;}
    .mtprev-triage-card-body .mtprev-triage-target{display:grid;gap:6px;min-width:0;overflow-wrap:anywhere;}
    .mtprev-triage-card-footer{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;padding:0 16px 14px;}
    .mtprev-triage-card-footer .mtprev-triage-row-actions{flex:1;min-width:0;}
    .mtprev-triage-card-footer .mtprev-triage-badge{flex:none;padding:9px 12px;border:1px solid #c4dde8;}
    @media(max-width:650px){.mtprev-triage-card-body{grid-template-columns:1fr;gap:14px;}.mtprev-triage-card-footer{align-items:flex-start;flex-direction:column;}.mtprev-triage-card-footer .mtprev-triage-badge{align-self:flex-end;}}
    .mtprev-triage-row details{border-color:#cfdee7;}
    .mtprev-triage-row details summary{font-weight:600;color:#315f78;}
    .mtprev-triage-detail-grid section{border-radius:5px;background:#eff5f9;border-color:#cfdee7;}
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
  // A proposta da tabela de triagem NÃO permite deduzir um assessor apenas do CNJ.
  // Correções manuais ficam locais e separadas dos dados retornados pelo SPA.
  const manualCategories = Object.freeze([
    ['exec_individual','Execução individual','Execução individual',''],
    ['exec_coletiva','Execução coletiva (não recurso)','Execução coletiva',''],
    ['exec_coletiva_recurso','Recurso de execução coletiva','Execução coletiva','Recurso de execução coletiva'],
    ['exec_honorarios','Execução de honorários','Execução de honorários',''],
    ['pensao','Pensão por morte (geral)','Pensão por morte',''],
    ['pensao_funcional','Pensão por morte — subsídio/vida funcional','Pensão por morte envolvendo vida funcional do instituidor',''],
    ['contrib_nao','Contribuição não doente','Contribuição não doente',''],
    ['contrib_nao_recurso','Recurso de contribuição não doente','Contribuição não doente','Recurso'],
    ['contrib_doente','Contribuição doente','Contribuição doente',''],
    ['contrib_doente_ir','Contribuição doente + IR','Contribuição doente com imposto de renda',''],
    ['aposentadoria','Aposentadoria','Aposentadoria',''],
    ['residual','Residual civil/militar','Residual civil e militar',''],
    ['imposto_renda','Imposto de Renda','Imposto de Renda',''],
    ['pauta','Pauta de julgamento','Pauta de julgamento',''],
    ['confirmar_pauta','Confirmar pauta de julgamento','','Confirmar pauta de julgamento'],
    ['mandado_seguranca','Mandado de segurança','Mandado de segurança',''],
    ['juntada_comprovante','Juntada de comprovante de cumprimento de ordem judicial','','Juntada de comprovante de cumprimento de ordem judicial'],
    ['contrarrazoes','Contrarrazões (exceto matérias de Victor)','','Contrarrazões'],
  ]);
  function currentRules() {
    const rules = window.MTPrevTriageRules;
    if (!rules || typeof rules.suggestDistribution !== 'function' || !rules.version) {
      throw new Error('As regras da tabela de triagem não foram carregadas nesta versão. Substitua também js/shared/mtprev_triage_rules.js, recarregue a extensão e atualize a página do SPA.');
    }
    return rules;
  }
  const manualStorageKey = key => {
    let user = '';
    try { user = new URL(location.href).searchParams.get('user_id') || ''; } catch (_) {}
    return 'MTPREV_TRIAGE_MANUAL_V2:' + location.origin + ':' + user + ':' + key;
  };
  function storedManualChoice(key) {
    try { return localStorage.getItem(manualStorageKey(key)) || ''; } catch (_) { return ''; }
  }
  function applyTriageSuggestion(row, categoryId = '') {
    const rules = currentRules();
    const option = manualCategories.find(item => item[0] === categoryId);
    // Uma entrada manual pode ser usada para REVISÃO; nunca sobrescreve o assunto de origem.
    const inputs = option ? { ...row.record, assunto: option[2], actionClass: '', manifestationSuggested: option[3], lastProgress: '' } : row.record;
    // Diagnóstico do SPA permanece fiel aos dados originais. A matéria manual
    // influencia somente a sugestão, com proveniência claramente identificada.
    const diagnosis = rules.diagnose(row.record);
    const proposed = option ? rules.suggestDistribution(inputs) : diagnosis.distribution || rules.suggestDistribution(inputs);
    const distribution = option ? {
      ...proposed,
      source: 'Matéria informada manualmente para conferência · ' + proposed.source,
      candidates: proposed.candidates.map(candidate => ({ ...candidate, source: 'Classificação manual, não informada pelo SPA' }))
    } : proposed;
    const candidates = distribution.candidates || [];
    const people = [...new Map(candidates.flatMap(c => c.assessores || []).map(person => [person.name,person])).values()];
    Object.assign(row, { diagnosis, distribution, candidates, people, manualLabel: option?.[1] || '', manualChoice: categoryId,
      kind: candidates.length === 0 ? 'unknown' : option ? 'review' : candidates.length === 1 && people.length === 1 ? 'matched' : 'review' });
    return row;
  }
  function classifyTriage(records) {
    currentRules(); // Falhar visivelmente se só foi instalado o painel, sem o arquivo de regras.
    const unique = new Map();
    for (const record of records) {
      const key = reportKey(record);
      if (key !== '||' && !unique.has(key)) unique.set(key, record);
    }
    return [...unique.values()].map(record => {
      const row = { record, key: reportKey(record) };
      return applyTriageSuggestion(row, storedManualChoice(row.key));
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

  // Os registros vêm do SPA. Só abrimos URLs HTTPS dos domínios autorizados.
  // Não tentamos deduzir qual é a decisão usando apenas o número do processo.
  function safeSpaHref(raw) {
    try {
      if (!raw) return '';
      const u = new URL(String(raw), location.href);
      return u.protocol === 'https:' && ['spa.pge.mt.gov.br', 'pge.mt.spa.coreplan.com.br'].includes(u.hostname) ? u.href : '';
    } catch (_) { return ''; }
  }
  function procedureHref(record) {
    const existing = safeSpaHref(record?.pendencyUrl);
    if (existing) return existing;
    const id = String(record?.procedureId || record?.rowKey || '').trim();
    return /^\d+$/.test(id) ? safeSpaHref('/procedures/' + id) : '';
  }
  function spaAssignmentText(value,assessors=[]) {
    const normalize=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
    const text=normalize(value);
    if(/\b(?:nao|sem|cancelad\w*|revogad\w*|desfeit\w*)\b/.test(text))return false;
    const target=text.match(/\b(?:distribuid[oa]|designad[oa]|atribuid[oa])\s+(?:para|ao(?:\s*\(a\))?|a(?:\s*\(o\))?)\s+(?:(?:o|a|um|uma)\s+)?(.+)/)?.[1];
    if(!target)return false;
    if(/^assessor(?:a|\(a\))?(?:\b|\s|[(:-]|$)/.test(target))return true;
    return assessors.some(name=>{
      const person=normalize(name);
      return person.split(' ').length>=2 && (target===person || target.startsWith(person+' ') || target.startsWith(person+' -') || target.startsWith(person+'('));
    });
  }
  function recentSpaAssignment(doc,assessors=[]) {
    const selector='.workspace-preview__timeline-item,.workspace-preview__timeline-entry,.workspace-preview__movement,.workspace-preview__activity,.timeline-item,.timeline__item,.timeline-entry';
    const nodes=Array.from(doc.querySelectorAll(selector));
    const entries=nodes.filter(node=>!nodes.some(other=>other!==node && other.contains(node))).map((node,index)=>{
      const titleNode=node.querySelector('[class*="timeline-title"],[class*="timeline__title"],[class*="movement-title"],[class*="activity-title"],h3,h4,h5');
      const text=String(titleNode?.textContent || node.textContent || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
      const explicit=node.querySelector('time[datetime]')?.getAttribute('datetime') || node.getAttribute('datetime');
      const date=String(node.textContent||'').match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s*(?:[aà]s\s*)?(\d{1,2}):(\d{2}))?/i);
      const timestamp=explicit?Date.parse(explicit):date?Date.UTC(+date[3],+date[2]-1,+date[1],+(date[4]||0),+(date[5]||0)):NaN;
      return {text,timestamp,index};
    });
    entries.sort((a,b)=>Number.isFinite(a.timestamp)&&Number.isFinite(b.timestamp)?b.timestamp-a.timestamp || a.index-b.index:a.index-b.index);
    const recent=entries.slice(0,3);
    // O autor do andamento nao e necessariamente o assessor designado.
    const assigned=recent.some(({text})=>spaAssignmentText(text,assessors));
    return {assigned,readable:recent.length>0};
  }
  const spaAssignmentCache=new Map();
  const SPA_ASSIGNMENT_CACHE_TTL=10*60*1000;
  async function excludeAssignedSpaRecords(records,{signal,onProgress=()=>{},force=false}={}) {
    const scope=globalThis.MTPrevWorkspaceCache?.scope?.() || location.href || location.origin;
    for(const [key,value] of spaAssignmentCache)if(Date.now()-value.at>=SPA_ASSIGNMENT_CACHE_TTL || value.scope!==scope)spaAssignmentCache.delete(key);
    const groups=new Map(), excluded=new Set();let checked=0,failed=0;
    for(const record of records){
      const id=String((/^\d+$/.test(String(record.rowKey||''))?record.rowKey:'') || record.procedureId || '').trim() || procedureHref(record).match(/\/procedures\/(\d+)(?:[/?#]|$)/)?.[1];
      if(!id || !/^\d+$/.test(id)){failed++;continue;}
      if(!groups.has(id))groups.set(id,[]);
      groups.get(id).push(record);
    }
    const queue=Array.from(groups),total=queue.length,batchSize=100,concurrency=16;
    let cursor=0,batchEnd=0,batch=0,reused=0;
    const batches=Math.ceil(total/batchSize);
    const progress=()=>onProgress({checked,total,excluded:excluded.size,failed,batch,batches,batchSize,concurrency,reused});
    async function worker(){
      while(cursor<batchEnd){
        signal?.throwIfAborted();
        const [id,items]=queue[cursor++];
        const assessors=items.map(item=>item.assessor).filter(name=>typeof name==='string' && name.trim());
        // O ultimo andamento do card tambem e evidencia recente do proprio SPA.
        // Nao depende de quem realizou a distribuicao nem de quem esta conectado.
        if(items.some(item=>spaAssignmentText(item.lastProgress,assessors))){
          items.forEach(record=>excluded.add(record));checked++;progress();continue;
        }
        const cacheKey=scope+'|'+id+'|'+assessors.join('|'),cached=force?null:spaAssignmentCache.get(cacheKey);
        if(cached){
          if(cached.assigned)items.forEach(record=>excluded.add(record));
          checked++;reused++;progress();continue;
        }
        const controller=new AbortController();
        const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
        const timer=setTimeout(abort,15000);
        try{
          const url=new URL('/workspace/processes/'+id+'/timeline',location.origin);
          const response=await fetch(url.href,{credentials:'same-origin',redirect:'error',headers:{Accept:'text/html, application/json'},signal:controller.signal});
          if(!response.ok)throw new Error('HTTP '+response.status);
          let html=await response.text();
          if(/^\s*\{/.test(html)){const json=JSON.parse(html);html=typeof json.html==='string'?json.html:typeof json.content==='string'?json.content:'';}
          if(!html || /<form[^>]+(?:sign.in|login)/i.test(html))throw new Error('Andamentos indisponíveis');
          const result=recentSpaAssignment(new DOMParser().parseFromString(html,'text/html'),assessors);
          if(!result.readable)throw new Error('Andamentos não reconhecidos');
          spaAssignmentCache.set(cacheKey,{scope,at:Date.now(),assigned:result.assigned});
          if(result.assigned)items.forEach(record=>excluded.add(record));
        }catch(error){signal?.throwIfAborted();failed+=items.length;}
        finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
        checked++;progress();
      }
    }
    while(cursor<total){
      signal?.throwIfAborted();batch++;batchEnd=Math.min(cursor+batchSize,total);progress();
      await Promise.all(Array.from({length:Math.min(concurrency,batchEnd-cursor)},()=>worker()));
    }
    return {records:records.filter(record=>!excluded.has(record)),triagedRecords:records.filter(record=>excluded.has(record)),excluded:excluded.size,failed};
  }
  function decisionPdfCandidate(record) {
    const sources = [
      ...(Array.isArray(record?.expedientes) ? record.expedientes : []),
      ...(Array.isArray(record?.documents) ? record.documents : []),
      ...(Array.isArray(record?.tasks) ? record.tasks : [])
    ];
    if (record?.decisionPdfUrl) sources.push({url:record.decisionPdfUrl,label:'Decisão'});
    for (const source of sources) {
      if (!source || typeof source !== 'object') continue;
      const label = String([source.label,source.type,source.description,source.title].filter(Boolean).join(' '))
        .normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      if (!/decisao|sentenca|acordao/.test(label)) continue;
      let href = safeSpaHref(source.pdfUrl || source.url || source.viewerUrl);
      if (!href) continue;
      try {
        let parsed = new URL(href);
        if (parsed.pathname === '/pdfjs/web/viewer.html') {
          const file = parsed.searchParams.get('file');
          href = safeSpaHref(file && new URL(file, parsed.origin).href);
          if (!href) continue;
          parsed = new URL(href);
        }
        if (!/\.pdf$/i.test(parsed.pathname)) continue;
        return href;
      } catch (_) { /* URL não confirmada. */ }
    }
    return '';
  }
  function openDecisionLastPage(pdfUrl, feedback) {
    // A aba precisa ser criada pelo clique, antes da consulta assíncrona.
    const opened = window.open('about:blank', '_blank');
    if (!opened) { feedback.textContent='O Chrome bloqueou a nova aba. Autorize pop-ups para o SPA ou abra pelo processo.'; return; }
    try { opened.opener = null; } catch (_) {}
    feedback.textContent='Consultando a quantidade de páginas da decisão…';
    if (!window.chrome?.runtime?.sendMessage) {
      opened.location.href = pdfUrl;
      feedback.textContent='PDF aberto. A contagem de páginas não está disponível neste contexto.';
      return;
    }
    try {
      window.chrome.runtime.sendMessage({type:'MTPREV_TRIAGE_PDF_PAGE_COUNT',url:pdfUrl}, response => {
        const pages = response?.ok && Number.isSafeInteger(response.pages) && response.pages > 0 ? response.pages : 0;
        try {
          const target = new URL(pdfUrl);
          if (pages) target.hash = 'page=' + pages;
          opened.location.href = target.href;
        } catch (_) { /* A aba pode ter sido fechada. */ }
        feedback.textContent = pages
          ? `Decisão aberta na página ${pages} de ${pages}. Confira o conteúdo antes de designar.`
          : 'PDF aberto na primeira página: não foi possível determinar com segurança a última página.';
      });
    } catch (_) {
      try { opened.location.href = pdfUrl; } catch (_) {}
      feedback.textContent='PDF aberto sem posicionamento automático na última página.';
    }
  }

  function createModernReport(api) {
    installReportStyle();
    const root = reportNode('section','mtprev-triage-entry');
    const heading = reportNode('div','mtprev-triage-entry__head');
    heading.append(reportNode('strong','','Triagem e distribuição · MTPrev'));
    heading.append(reportNode('small','','Relatório com assunto do SPA, sugestão de assessor e acesso ao processo para designar.'));
    root.append(heading);
    const actions = reportNode('div','mtprev-triage-entry__actions');
    const generate = reportNode('button','mtprev-triage-primary','Gerar relatório de triagem');
    generate.type='button';
    const reopen = reportNode('button','','Reabrir último relatório');
    reopen.type='button'; reopen.hidden=true;
    const forceLabel=reportNode('label','mtprev-triage-entry__refresh');
    const forceRefresh=reportNode('input');forceRefresh.type='checkbox';
    forceLabel.append(forceRefresh,document.createTextNode(' Atualizar a triagem salva (ler a mesa e os andamentos novamente)'));
    actions.append(generate,reopen); root.append(actions,forceLabel);
    const hint = reportNode('p','mtprev-triage-entry__note','O relatório é consultivo. A designação só ocorre após a confirmação no formulário oficial do SPA.');
    root.append(hint);
    const status = reportNode('p','mtprev-triage-entry__note');status.setAttribute('role','status');root.append(status);
    let last = null, currentController = null, modal = null, pendingMain=null, lastScope='', attemptedScope='';
    const reportScope=()=>window.MTPrevWorkspaceCache?.scope?.()||'';
    const savedReportKey='MTPREV_TRIAGE_SAVED_REPORT_V1';
    function restoreReport(){
      const scope=reportScope();
      if(!scope)return;
      try{
        const cached=JSON.parse(localStorage.getItem(savedReportKey)||'null');
        if(cached?.scope!==scope || cached.rulesVersion!==currentRules().version || !Array.isArray(cached.data?.rows) || !Array.isArray(cached.data?.triagedRows))return;
        last={...cached.data,at:new Date(cached.data.at),fromCache:true};lastScope=scope;reopen.hidden=false;
      }catch(_){}
    }
    function updateMenuProgress(state,text,value=0){
      const stage=document.querySelector('#cdsp-general-shell .mtprev-orbit');
      if(!stage)return;
      stage.querySelector('.mtprev-triage-menu-progress')?.remove();
      stage.dataset.triageState=state;stage.dataset.triageProgress=String(value);
      document.dispatchEvent(new CustomEvent('mtprev:triage:progress',{detail:{state,text,value}}));
      const compact=stage.querySelector('.mtprev-grid-compact-copy small');
      if(compact)compact.textContent=state==='loading'?`Triagem · ${value}%`:state==='ready'?'Triagem pronta':'Triagem interrompida';
    }

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
      h.append(reportNode('small','','Proposta de tabela de triagem · recomendações para conferência humana'));
      if(last)h.append(reportNode('small','',`Triagem de ${new Date(last.at).toLocaleString('pt-BR')}${last.fromCache?' · resultado salvo':''}`));
      header.append(h);
      const refreshReport=reportNode('button','','Atualizar triagem');refreshReport.type='button';
      refreshReport.addEventListener('click',()=>{forceRefresh.checked=true;modal?.remove();modal=null;void generateReport();});
      const close=reportNode('button','','Fechar');close.type='button';
      close.addEventListener('click',()=>{overlay.remove();modal=null;});
      header.append(refreshReport,close);
      const area=reportNode('div','mtprev-triage-workspace');
      const main=reportNode('div','mtprev-triage-main');
      area.append(main);shell.append(header,area);overlay.append(shell);
      document.body.append(overlay);
      overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close.click();}});
      modal=overlay;
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
      return ({count,total,rounds,pages,phase,batch,batches,concurrency,reused})=>{
        const n=Number(count) || 0, t=Number(total);
        const valid=Number.isFinite(t) && t>0;
        const pct=valid?Math.min(100,Math.floor(n/t*100)):0;
        msg.textContent=phase==='assignments'?`Conferindo os 3 últimos andamentos: ${n} de ${t}`:valid?`Lendo processos: ${n} de ${t} (${pct}%)`:`Lendo processos: ${n}`;
        detail.textContent=phase==='assignments'
          ?`Grupo ${batch||1} de ${batches||Math.ceil(t/100)||1} · até 100 processos por grupo · até ${concurrency||16} consultas simultâneas${reused?' · '+reused+' reaproveitadas':''} · ${fmtDuration(Date.now()-startedAt)} decorridos. Pode fechar esta janela; a leitura continua.`
          :`Lotes de até 100 · ${Number.isFinite(Number(rounds))?rounds:'–'}${Number.isFinite(Number(pages))?' / '+pages:''} concluídos · ${fmtDuration(Date.now()-startedAt)} decorridos`;
        fill.style.width=`${pct}%`;
        updateMenuProgress('loading',msg.textContent,pct);
      };
    }
    let startedAt=0;
    async function generateReport(background=false) {
      if(currentController) return;
      if(!forceRefresh.checked){if(!last)restoreReport();if(last && lastScope===reportScope()){openReport();return;}}
      background=background===true;
      const scope=reportScope();
      const main=reportNode('div','mtprev-triage-main');
      attemptedScope=scope;
      pendingMain=main;
      startedAt=Date.now();
      currentController=new AbortController();
      generate.disabled=true;
      const showProgress=showLoad(main);
      updateMenuProgress('loading','Preparando triagem em segundo plano…',0);
      if(!background)document.dispatchEvent(new Event('mtprev:triage:loading'));
      try {
        currentRules(); // Não coletar centenas de cards quando a lógica de distribuição está ausente.
        let records,coverage='partial',total,fromCache=false;
        if(window.SpaAdapter?.route?.().kind==='workspace') {
          const result=await (window.MTPrevWorkspaceCache?.collect || window.SpaAdapter.collectWorkspaceRecords)({signal:currentController.signal,onProgress:showProgress,force:forceRefresh.checked,allowScroll:false});
          records=result.records||[];coverage=result.reason;total=result.total;fromCache=Boolean(result.fromCache);
        } else {
          records=api.getRecords()||[];total=records.length;
          showProgress({count:records.length,total});
        }
        if(currentController.signal.aborted)return;
        if(!records.length)throw new Error('Nenhum expediente foi encontrado na tela ou na mesa atual.');
        let assignmentCheck={excluded:0,failed:0};
        if(window.SpaAdapter?.route?.().kind==='workspace'){
          showProgress({count:0,total:records.length,phase:'assignments'});
          assignmentCheck=await excludeAssignedSpaRecords(records,{signal:currentController.signal,force:forceRefresh.checked,onProgress:({checked,...progress})=>showProgress({...progress,count:checked,phase:'assignments'})});
          records=assignmentCheck.records;
        }
        if(currentController.signal.aborted)return;
        const rows=classifyTriage(records);
        const triagedRows=classifyTriage(assignmentCheck.triagedRecords||[]).map(row=>({...row,kind:'triaged',people:[],candidates:[]}));
        if(scope && reportScope()!==scope)throw new DOMException('Mesa ou filtros alterados','AbortError');
        lastScope=scope;
        last={rows,triagedRows,elapsed:Date.now()-startedAt,coverage,total,at:new Date(),fromCache};
        if(scope && coverage==='complete' && !assignmentCheck.failed){
          try{localStorage.setItem(savedReportKey,JSON.stringify({scope,rulesVersion:currentRules().version,data:last}));}catch(_){status.textContent='Não foi possível guardar a triagem no navegador.';}
        }
        forceRefresh.checked=false;
        reopen.hidden=false;
        status.textContent=`Última análise: ${rows.length} expediente(s). ${coverage==='complete'?'Leitura completa.':'Cobertura não confirmada.'} ${assignmentCheck.excluded} já designado(s) retirado(s).`+(assignmentCheck.failed?` Não foi possível conferir os andamentos de ${assignmentCheck.failed} expediente(s), mantidos na lista.`:'');
        renderReport(main,last);
        updateMenuProgress('ready',`Triagem pronta · ${rows.length+triagedRows.length} expedientes`,100);
        currentController=null;pendingMain=null;
        openReport();
      } catch(error) {
        if(currentController?.signal.aborted) {
          updateMenuProgress('stopped','Leitura da triagem interrompida');
          main.replaceChildren(reportNode('p','mtprev-triage-note','Leitura interrompida. Nenhuma movimentação foi realizada.'));
        } else {
          updateMenuProgress('error',`Triagem: ${error?.message||error}`);
          const errorBox=reportNode('p','mtprev-triage-error',`Não foi possível gerar o relatório: ${error?.message||error}`);
          main.replaceChildren(errorBox);
        }
      } finally {
        currentController=null;pendingMain=null;generate.disabled=false;
      }
    }
    function renderReport(main,data) {
      const sourceRows=data.rows;
      let rows=[],triagedRows=[];
      function refreshTriageState(){
        let reviews={};try{reviews=JSON.parse(localStorage.getItem('MTPREV_POP_REVIEWS')||'{}');}catch(_){}
        rows=[];const done=new Map();
        for(const row of data.triagedRows||[])done.set(row.key,{...row,triagedAutomatically:true});
        for(const row of sourceRows){
          const manual=/^Conferido\s*[—–-]\s*(?:manter|corrigir) indicação$/.test(reviews[row.key]?.status||'');
          if(manual || done.has(row.key))done.set(row.key,{...(done.get(row.key)||row),kind:'triaged',triagedManually:manual,people:[],candidates:[]});
          else rows.push(row);
        }
        for(const row of done.values())if(/^Conferido\s*[—–-]\s*(?:manter|corrigir) indicação$/.test(reviews[row.key]?.status||''))row.triagedManually=true;
        triagedRows=Array.from(done.values());
      }
      refreshTriageState();
      const matched=rows.filter(x=>x.kind==='matched').length;
      const review=rows.filter(x=>x.kind==='review').length;
      const unknown=rows.filter(x=>x.kind==='unknown').length;
      main.replaceChildren();
      const metrics=reportNode('div','mtprev-triage-stats');
      for(const item of [
        {label:'Analisados',value:rows.length+triagedRows.length,mark:'▣',color:'#197ca8',filter:'analyzed'},
        {label:'Sugestão encontrada',value:matched,mark:'✓',color:'#267f83',filter:'matched'},
        {label:'Escolha necessária',value:review,mark:'◇',color:'#a47b25',filter:'review'},
        {label:'Sem classificação',value:unknown,mark:'?',color:'#925a78',filter:'unknown'},
        {label:'Já triados',value:triagedRows.length,mark:'✓',color:'#32836b',filter:'triaged'}]) {
        const card=reportNode('button','mtprev-triage-stat');card.style.setProperty('--stat-color',item.color);
        card.type='button';card.dataset.filter=item.filter;
        card.title=item.filter==='triaged'?'Ver triados manualmente e designações identificadas automaticamente nos 3 últimos andamentos do SPA':`Exibir: ${item.label}`;
        card.addEventListener('click',()=>{select.value=item.filter;view='process';pageSize=40;render();});
        card.append(reportNode('span','stat-icon',item.mark));card.append(reportNode('small','',item.label));card.append(reportNode('strong','',String(item.value)));
        metrics.append(card);
      }
      main.append(metrics);
      const toolbar=reportNode('div','mtprev-triage-tools');
      const search=reportNode('input');search.type='search';search.placeholder='Buscar número, assunto ou assessor…';search.setAttribute('aria-label','Buscar no relatório');
      const select=reportNode('select');select.setAttribute('aria-label','Filtrar situação');
      for(const [value,label] of [['all','Aguardando triagem'],['analyzed','Todos os analisados'],['matched','Sugestão encontrada'],['review','Escolha necessária'],['unknown','Sem classificação'],['triaged','Já triados']]){
        const option=reportNode('option','',label);option.value=value;select.append(option);
      }
      const switcher=reportNode('div','mtprev-triage-switch');
      const byProcess=reportNode('button','','Por processo');byProcess.type='button';
      const byPerson=reportNode('button','','Por assessor');byPerson.type='button';
      switcher.append(byProcess,byPerson);
      const selectAll=reportNode('button','','Marcar até 100');selectAll.type='button';
      const exportCsv=reportNode('button','','Exportar CSV');exportCsv.type='button';
      const nextSelected=reportNode('button','mtprev-triage-primary','Abrir próximo selecionado no SPA');nextSelected.type='button';nextSelected.disabled=true;
      nextSelected.title='Abre um processo por clique. Não executa designação nem ciência automaticamente.';
      toolbar.append(search,select,switcher,selectAll,nextSelected,exportCsv);main.append(toolbar);
      const selectedNotice=reportNode('p','mtprev-triage-note');selectedNotice.hidden=true;main.append(selectedNotice);
      const list=reportNode('div');main.append(list);
      const pager=reportNode('div','mtprev-triage-pager');main.append(pager);
      const selected=new Set(), openedForReview=new Set();let view='process',pageSize=40;
      const normalized=(value)=>R.norm(value||'');
      const summarySearch=x=>normalized([x.record.processNumber,x.record.expedienteId,x.record.assunto,x.record.manifestationSuggested,...x.people.map(p=>p.name)].join(' '));
      function filtered(){
        const q=normalized(search.value);
        const source=select.value==='analyzed'?[...rows,...triagedRows]:select.value==='triaged'?triagedRows:rows;
        return source.filter(x=>(select.value==='all'||select.value==='analyzed'||x.kind===select.value)&&(!q||summarySearch(x).includes(q)));
      }
      function setButtons(){
        for(const card of metrics.children)card.setAttribute('aria-pressed',String(card.dataset.filter===select.value));
        byProcess.setAttribute('aria-pressed',String(view==='process'));
        byPerson.setAttribute('aria-pressed',String(view==='assessor'));
        const pending = rows.filter(x => selected.has(x.key) && !openedForReview.has(x.key) && procedureHref(x.record)).length;
        nextSelected.disabled = pending === 0;
        nextSelected.textContent = `Abrir próximo no SPA (${pending})`;
        selectedNotice.hidden=true;
        selectedNotice.textContent='';
      }
      nextSelected.addEventListener('click', () => {
        const item = rows.find(x => selected.has(x.key) && !openedForReview.has(x.key) && procedureHref(x.record));
        if (!item) { setButtons();return; }
        const href = procedureHref(item.record);
        const opened = window.open(href,'_blank');
        try { if (opened) opened.opener=null; } catch (_) {}
        if (!opened) { selectedNotice.hidden=false;selectedNotice.textContent='O Chrome bloqueou a abertura. Permita pop-ups do SPA ou use o botão individual “Abrir para designar”.';return; }
        openedForReview.add(item.key);
        setButtons();
      });
      function openAllowedLink(parent,record){
        const items=[record.pendencyUrl,...(record.expedientes||[]).map(e=>e.url)].filter(Boolean);
        const match=items.find(value=>{try{const u=new URL(value,location.href);return u.protocol==='https:'&&['spa.pge.mt.gov.br','pge.mt.spa.coreplan.com.br'].includes(u.hostname)}catch(_){return false}});
        if(!match)return;
        const a=reportNode('a','','Abrir expediente no SPA');a.href=new URL(match,location.href).href;a.target='_blank';a.rel='noopener noreferrer';parent.append(a);
      }
      function addRow(target,x){
        if(x.kind==='triaged'){
          const card=reportNode('article','mtprev-triage-row');card.style.setProperty('--row-color','#32836b');
          const body=reportNode('div','mtprev-triage-target');body.style.padding='14px';
          body.append(reportNode('strong','',x.record.processNumber||'Processo sem número'));
          body.append(reportNode('small','',`Expediente ${x.record.expedienteId||'não informado'}`));
          body.append(reportNode('strong','','✓ Já triado'));
          body.append(reportNode('small','',x.triagedManually&&x.triagedAutomatically?'Triado manualmente e confirmado pela análise automática dos 3 últimos andamentos.':x.triagedManually?'Triado manualmente — conferência registrada neste navegador.':'Triado automaticamente — designação identificada nos 3 últimos andamentos do SPA.'));
          const href=procedureHref(x.record);
          if(href){const link=reportNode('a','','Abrir no SPA ↗');link.href=href;link.target='_blank';link.rel='noopener noreferrer';body.append(link);}
          card.append(body);target.append(card);return;
        }
        const article=reportNode('article','mtprev-triage-row');
        article.style.setProperty('--row-color',x.kind==='matched'?'#2b8c94':x.kind==='review'?'#be9655':'#888aa5');
        const strip=reportNode('div','mtprev-triage-row-head mtprev-triage-card-summary');
        const cardTop=reportNode('div','mtprev-triage-card-top');
        const cardBody=reportNode('div','mtprev-triage-card-body');
        const subjectColumn=reportNode('div','mtprev-triage-card-subject-column');
        const checkbox=reportNode('input');checkbox.type='checkbox';checkbox.checked=selected.has(x.key);checkbox.setAttribute('aria-label',`Marcar processo ${x.record.processNumber||'não identificado'}`);
        checkbox.addEventListener('change',()=>{checkbox.checked?selected.add(x.key):selected.delete(x.key);setButtons();});
        const p=reportNode('div','mtprev-triage-process');
        p.append(reportNode('strong','',x.record.processNumber||'Processo sem número'));p.append(reportNode('small','',`Expediente ${x.record.expedienteId||'não informado'}`));cardTop.append(p,checkbox);
        const targetNames=x.people.map(p=>p.name).join(' ou ');
        const owners=[...new Set(x.people.map(p=>p.procuradores).filter(Boolean))].join(' · ');
        const dest=reportNode('div','mtprev-triage-target');
        const ownersLine=reportNode('strong','mtprev-triage-owner-line');
        if(x.people.length){
          ownersLine.append(document.createTextNode(x.people.length===1?'Assessor sugerido: ':'Assessores sugeridos: '));
          x.people.forEach((person,index)=>{if(index)ownersLine.append(document.createTextNode(' ou '));ownersLine.append(assessorLabel(person.name));});
        } else ownersLine.textContent='Assessor sugerido: sem sugestão identificada';
        dest.append(ownersLine);
        if(x.people.length)dest.append(reportNode('small','',x.people.length===1?'Sugerido pelo sistema para este processo':'Sugeridos pelo sistema — conferir e escolher o responsável'));
        const spaSubject = String(x.record.assunto || x.record.assuntoPrincipal || x.record.subject || '').trim();
        const theme=reportNode('div','mtprev-triage-subject');
        theme.append(reportNode('b','','Assunto informado pelo SPA'));
        theme.append(reportNode('strong','',spaSubject || 'Não fornecido pelo SPA — conferir manualmente'));
        if(x.manualLabel)theme.append(reportNode('small','',`Matéria revisada manualmente: ${x.manualLabel}`));
        const noMetadata=!(x.record.assunto || x.record.assuntoPrincipal || x.record.subject || x.record.actionClass || x.record.classe || x.record.manifestationSuggested || x.record.manifestacaoSugerida || x.record.lastProgress);
        if(owners){
          const procurador=reportNode('div','mtprev-triage-procurador');
          procurador.append(reportNode('strong','','Procurador:'),reportNode('span','',owners));
          dest.append(procurador);
        } else dest.append(reportNode('small','',noMetadata?'SPA não forneceu matéria nem manifestação':'Conferir matéria e tipo de peça'));
        try { const choice=JSON.parse(localStorage.getItem('MTPREV_POP_REVIEWS')||'{}')[x.key];
          if(choice?.assessor)dest.append(reportNode('small','',`Designação escolhida (rascunho): ${choice.assessor}`));
        } catch(_){}
        subjectColumn.append(theme);cardBody.append(subjectColumn,dest);
        const rowActions=reportNode('div','mtprev-triage-row-actions');
        const processUrl=procedureHref(x.record);
        if(processUrl){
          const open=reportNode('a','','Abrir no SPA para designar ↗');open.href=processUrl;open.target='_blank';open.rel='noopener noreferrer';
          open.title='Abre o processo. A designação ocorre no fluxo “Complementar classificação do processo” após conferência e confirmação.';
          rowActions.append(open);
        }
        const pdfUrl=decisionPdfCandidate(x.record);
        const pdfButton=reportNode('button','','Decisão · última página');pdfButton.type='button';
        pdfButton.disabled=!pdfUrl;
        pdfButton.title=pdfUrl?'Abrir PDF identificado como decisão/sentença/acórdão pelo SPA, na última página se a contagem for possível.':'Não há link de PDF identificado como decisão nos metadados deste processo. Consulte Autos e PDFs no SPA.';
        const pdfFeedback=reportNode('small');pdfFeedback.setAttribute('role','status');
        pdfButton.addEventListener('click',()=>{if(pdfUrl)openDecisionLastPage(pdfUrl,pdfFeedback);});
        rowActions.append(pdfButton);
        if(!pdfUrl && processUrl){const fallback=reportNode('a','','Ver documentos no SPA ↗');fallback.href=processUrl;fallback.target='_blank';fallback.rel='noopener noreferrer';rowActions.append(fallback);}
        rowActions.append(pdfFeedback);
        subjectColumn.append(rowActions);
        const badgeLabel=x.kind==='matched'?'✓ Sugestão encontrada':x.kind==='review'?'◇ Escolha necessária':'? Sem classificação';
        const badgeKind=x.kind==='matched'?'matched':x.kind==='review'?'review':'unknown';
        const badge=reportNode('span',`mtprev-triage-badge mtprev-triage-badge--${badgeKind}`,badgeLabel);
        const badgeColors={review:['#facc15','#422f00'],unknown:['#c73535','#ffffff'],matched:['#237b43','#ffffff']}[badgeKind];
        badge.style.setProperty('background-color',badgeColors[0],'important');
        badge.style.setProperty('color',badgeColors[1],'important');
        cardTop.insertBefore(badge,checkbox);
        strip.append(cardTop,cardBody);article.append(strip);
        const details=reportNode('details');
        details.append(reportNode('summary','','Ver critérios e registrar conferência'));
        const expandedLayout=reportNode('div','mtprev-triage-expanded-layout');
        const processColumn=reportNode('section','mtprev-triage-expanded-column');
        processColumn.append(reportNode('h3','mtprev-triage-column-title','Informações do processo'));
        const assignmentColumn=reportNode('section','mtprev-triage-expanded-column');
        assignmentColumn.append(reportNode('h3','mtprev-triage-column-title','Designação e conferência'));
        expandedLayout.append(processColumn,assignmentColumn);
        details.append(expandedLayout);
        const info=reportNode('div','mtprev-triage-detail-grid');
        function detailField(label,value){const s=reportNode('section');s.append(reportNode('b','',label));s.append(document.createTextNode(value||'Não informado'));info.append(s);}
        detailField('Assunto informado pelo SPA',x.record.assunto || x.record.assuntoPrincipal || x.record.subject);
        detailField('Classe informada pelo SPA',x.record.actionClass || x.record.classe);
        detailField('Tipo de peça / manifestação',x.record.manifestationSuggested);
        detailField('Matéria e justificativa',x.candidates.map(c=>`${c.category}: ${c.reason}`).join(' | ')||'Não enquadrado na tabela.');
        detailField('Regras e ressalvas',x.distribution.notes?.join(' | ')||'Conferir se a tabela está vigente e aplicável.');
        detailField('Procurador indicado na tabela de triagem',owners);
        detailField('Fonte e cobertura',`${x.distribution.source||'Proposta da tabela de triagem'}; ${x.record.metadataSource||'Metadados do SPA'}`);
        processColumn.append(info);
        const origin=reportNode('div','mtprev-triage-process-origin');openAllowedLink(origin,x.record);processColumn.append(origin);
        const manualBox=reportNode('div','mtprev-triage-review');
        manualBox.append(reportNode('strong','','Enquadramento assistido pela tabela de triagem'));
        manualBox.append(reportNode('p','','Após conferir o expediente, escolha a matéria ou peça. A sugestão será marcada para revisão humana e salva apenas neste navegador.'));
        const manualSelect=reportNode('select');manualSelect.setAttribute('aria-label','Matéria conferida manualmente');
        const emptyOption=reportNode('option','','Usar somente os dados recebidos do SPA');emptyOption.value='';manualSelect.append(emptyOption);
        for (const [value,label] of manualCategories) {
          const option=reportNode('option','',label);option.value=value;manualSelect.append(option);
        }
        manualSelect.value=x.manualChoice || '';
        manualSelect.addEventListener('change',()=>{
          try {
            const key=manualStorageKey(x.key);
            if (manualSelect.value) localStorage.setItem(key,manualSelect.value);
            else localStorage.removeItem(key);
          } catch (_) {}
          applyTriageSuggestion(x,manualSelect.value);
          const from=main.scrollTop;
          render();
          main.scrollTop=from;
        });
        manualBox.append(manualSelect);
        const assignBox = reportNode('div','mtprev-triage-review');
        assignBox.append(reportNode('strong','','Designação proposta — escolha humana'));
        assignBox.append(reportNode('small','', 'Escolha um assessor da tabela ou informe outro profissional habilitado no SPA. Os dados são salvos neste navegador. Use Triar no SPA para revisar a manifestação, configurar ofício e confirmar a designação.'));
        const revKey=x.key;let saved={};
        try{saved=JSON.parse(localStorage.getItem('MTPREV_POP_REVIEWS')||'{}')[revKey]||{}}catch(_){}
        const labelField=(label, control)=>{const labelNode=reportNode('label','',label);labelNode.append(control);assignBox.append(labelNode);return control;};
        const assessorSelect=reportNode('select');assessorSelect.setAttribute('aria-label','Assessor para designação');
        const assessorDefault=reportNode('option','','Selecionar assessor(a)');assessorDefault.value='';assessorSelect.append(assessorDefault);
        const team=(currentRules().team||[]).map(person=>person.name);
        for(const name of team){const option=reportNode('option','',name);option.value=name;assessorSelect.append(option);}
        const customOption=reportNode('option','','Outro assessor habilitado no SPA…');customOption.value='__custom__';assessorSelect.append(customOption);
        const names=team;
        assessorSelect.value=saved.assessor && names.includes(saved.assessor) ? saved.assessor : saved.assessor ? '__custom__' : '';
        labelField('Assessor(a) responsável',assessorSelect);
        const customName=reportNode('input');customName.type='text';customName.placeholder='Nome exato exibido no SPA';customName.value=saved.assessor && !names.includes(saved.assessor)?saved.assessor:'';
        labelField('Nome manual, se não constar na tabela',customName);
        customName.parentElement.hidden=assessorSelect.value!=='__custom__';
        const procuradorSelect=reportNode('select');procuradorSelect.setAttribute('aria-label','Procurador de referência');
        for(const [value,label] of [['','A confirmar no SPA'],['Dorigatti','Dorigatti'],['Miyoshi','Miyoshi'],['Dorigatti e Miyoshi','Dorigatti e Miyoshi']]){const o=reportNode('option','',label);o.value=value;procuradorSelect.append(o);}
        procuradorSelect.value=saved.procurador||'';labelField('Procurador de referência',procuradorSelect);
        const subjectInput=reportNode('input');subjectInput.type='text';subjectInput.placeholder='Assunto conferido no expediente';subjectInput.value=saved.assuntoTriagem||x.manualLabel||x.record.assunto||x.record.assuntoPrincipal||'';
        labelField('Assunto para triagem (editável)',subjectInput);
        const message=reportNode('textarea');message.placeholder='Texto livre, instruções, providências e justificativa de conflito…';message.value=saved.textoDesignacao||'';
        labelField('Texto da designação / justificativa',message);
        const choiceWarning=reportNode('small','mtprev-triage-choice-warning', x.kind==='matched'?'Confira o assessor no SPA antes de confirmar.':'Há conflito, enquadramento manual ou ausência de indicação única: escolha o responsável e registre a justificativa.');
        assignBox.append(choiceWarning);
        const formFeedback=reportNode('small');
        const chosenAssessor=()=>assessorSelect.value==='__custom__'?customName.value.trim():assessorSelect.value;
        const saveDraft=()=>{
          try{const db=JSON.parse(localStorage.getItem('MTPREV_POP_REVIEWS')||'{}');db[revKey]={...(db[revKey]||{}),assessor:chosenAssessor(),procurador:procuradorSelect.value,assuntoTriagem:subjectInput.value.trim(),textoDesignacao:message.value,at:new Date().toISOString()};localStorage.setItem('MTPREV_POP_REVIEWS',JSON.stringify(db));formFeedback.textContent='Dados salvos neste navegador. Use Triar no SPA para continuar.';return true;}
          catch(_){formFeedback.textContent='Não foi possível salvar a escolha local.';return false;}
        };
        assessorSelect.addEventListener('change',()=>{customName.parentElement.hidden=assessorSelect.value!=='__custom__';const selectedPerson=(currentRules().team||[]).find(p=>p.name===assessorSelect.value);if(selectedPerson){procuradorSelect.value=selectedPerson.procuradores||'';}saveDraft();});
        for(const control of [customName,procuradorSelect,subjectInput,message])control.addEventListener('change',saveDraft);
        const triageButton=reportNode('button','','Triar no SPA');triageButton.type='button';
        const targetUrl=processUrl ? new URL(processUrl) : null;
        const targetProcedureId=targetUrl?.pathname.match(/^\/procedures\/(\d+)(?:\/|$)/)?.[1];
        triageButton.disabled=!targetProcedureId || targetUrl.origin!==location.origin;
        triageButton.addEventListener('click',()=>{
          if(!chosenAssessor()){formFeedback.textContent='Selecione o assessor responsável antes de triar.';assessorSelect.focus();return;}
          if(!saveDraft())return;
          const target=window.open('about:blank','_blank');
          if(!target){formFeedback.textContent='Permita a abertura de abas para iniciar a triagem no SPA.';return;}
          try{
            target.sessionStorage.removeItem('SPA_CDSP_TRIAGE_CLASSIFICATION_ACTION');
            target.sessionStorage.removeItem('SPA_CDSP_TRIAGE_CLOSURE_ACTION');
            target.sessionStorage.setItem('MTPREV_TRIAGE_CARD_HANDOFF',JSON.stringify({procedureId:targetProcedureId,createdAt:Date.now(),assessor:chosenAssessor(),manifestation:x.record.manifestationSuggested||'',additionalInfo:subjectInput.value.trim(),processObservation:message.value}));
            target.opener=null;
            target.location.replace(targetUrl.href);
            formFeedback.textContent='Triagem aberta no processo selecionado. Revise os campos e confirme Classificar processo na nova aba.';
          }catch(_){target.close();formFeedback.textContent='Não foi possível abrir o fluxo de triagem. Use Abrir no SPA para designar.';}
        });
        const cardActions=reportNode('div','mtprev-triage-card-actions');cardActions.append(triageButton);
        formFeedback.setAttribute('role','status');
        manualBox.append(reportNode('small','', 'O assunto original do SPA não é alterado por esta escolha.'));processColumn.append(manualBox);assignmentColumn.append(assignBox);
        const rev=reportNode('div','mtprev-triage-review');
        rev.append(reportNode('strong','','Registro local de conferência (não altera o SPA)'));
        const revStatus=reportNode('select');
        for(const value of ['Pendente','Conferido — manter indicação','Conferido — corrigir indicação']){const option=reportNode('option','',value);option.value=value;revStatus.append(option);}
        const note=reportNode('textarea');note.placeholder='Anotação de conferência…';note.setAttribute('aria-label','Anotação da revisão');
        revStatus.value=saved.status||'Pendente';note.value=saved.note||'';
        const feedback=reportNode('small');
        function save(){
          try{const db=JSON.parse(localStorage.getItem('MTPREV_POP_REVIEWS')||'{}');db[revKey]={...(db[revKey]||{}),status:revStatus.value,note:note.value,at:new Date().toISOString(),indication:x.diagnosis.competence};localStorage.setItem('MTPREV_POP_REVIEWS',JSON.stringify(db));feedback.textContent='Conferência registrada neste navegador.';render();}
          catch(_){feedback.textContent='Não foi possível salvar a conferência no armazenamento local.';}
        }
        revStatus.addEventListener('change',save);note.addEventListener('change',save);
        rev.append(revStatus,note,feedback);assignmentColumn.append(rev,cardActions,formFeedback);article.append(details);target.append(article);
      }
      function render(){
        refreshTriageState();
        setButtons();list.replaceChildren();pager.replaceChildren();
        const metricNumbers=[rows.length+triagedRows.length, rows.filter(x=>x.kind==='matched').length, rows.filter(x=>x.kind==='review').length, rows.filter(x=>x.kind==='unknown').length,triagedRows.length];
        [...metrics.children].forEach((card,i)=>{const label=card.querySelector('strong');if(label)label.textContent=String(metricNumbers[i]);});
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
        const dataRows=[['Processo','Expediente','Assunto informado pelo SPA','Enquadramento manual','Situação','Assessor(es) sugerido(s)','Procurador(es)','Justificativa','Assessor escolhido','Procurador escolhido','Assunto editado','Texto de designação'],
          ...filtered().map(x=>[x.record.processNumber,x.record.expedienteId,x.record.assunto || x.record.assuntoPrincipal || x.record.subject,x.manualLabel || '',x.kind,x.people.map(p=>p.name).join(' / '),[...new Set(x.people.map(p=>p.procuradores))].join(' / '),x.candidates.map(c=>c.reason).join(' | '),...(()=>{let d={};try{d=JSON.parse(localStorage.getItem('MTPREV_POP_REVIEWS')||'{}')[x.key]||{}}catch(_){}return[d.assessor||'',d.procurador||'',d.assuntoTriagem||'',d.textoDesignacao||''];})()])];
        const content='\uFEFF'+dataRows.map(row=>row.map(csvValue).join(';')).join('\r\n');
        const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
        const a=reportNode('a');a.href=url;a.download='mtprev-triagem-revisao.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
      });
      render();
    }
    function openReport(){
      if(currentController && pendingMain){currentController.abort();return;}
      if(!last)restoreReport();
      if(last && (!lastScope || lastScope===reportScope())){
        renderReport(makeModal(),last);
        document.querySelector('#cdsp-general-shell .mtprev-triage-menu-progress')?.remove();
        const compact=document.querySelector('#cdsp-general-shell .mtprev-grid-compact-copy small');
        if(compact)compact.textContent='Abrir ferramentas';
        return;
      }
      void generateReport();
    }
    document.addEventListener('mtprev:triage:open',openReport);
    function watchTriageScope(){
      const scope=reportScope();
      if(currentController && attemptedScope && attemptedScope!==scope){currentController.abort();attemptedScope='';last=null;return;}
      if(last && lastScope!==scope){
        last=null;reopen.hidden=true;
        document.querySelector('#cdsp-general-shell .mtprev-triage-menu-progress')?.remove();
        const compact=document.querySelector('#cdsp-general-shell .mtprev-grid-compact-copy small');
        if(compact)compact.textContent='Abrir ferramentas';
      }
    }
    const scopeTimer=setInterval(()=>{if(root.isConnected)watchTriageScope();else if(document.readyState!=='loading'){clearInterval(scopeTimer);currentController?.abort();document.removeEventListener('mtprev:triage:open',openReport);}},2000);
    generate.addEventListener('click',()=>generateReport());
    reopen.addEventListener('click',openReport);
    return root;
  }

  function create(api,mode='diagnostic'){return mode==='priorities'?createLegacy(api,mode):createModernReport(api);}
  window.MTPrevPopPanel = Object.freeze({ create, classifyTriage });
})();
