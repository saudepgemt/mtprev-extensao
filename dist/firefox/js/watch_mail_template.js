/* E-mail responsivo, sem dependencias externas; conteudo PJe sempre escapado. */
(() => {
  'use strict';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean = (value, length = 240) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, length);
  const cnj = value => String(value ?? '').replace(/\D/g, '');
  const formatNumber = value => {
    const digits = cnj(value);
    return digits.length === 20 ? digits.replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/, '$1-$2.$3.$4.$5.$6') : clean(value, 40);
  };
  const formatDate = value => {
    const str = String(value || '');
    const match = str.match(/^(\d{4})(\d{2})(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return `${str.slice(8,10)}/${str.slice(5,7)}/${str.slice(0,4)}`;
    const d = new Date(str);
    return Number.isFinite(d.getTime()) ? d.toLocaleString('pt-BR') : 'Não informada';
  };
  const origin = 'https://pge.mt.spa.coreplan.com.br';
  function links(record) {
    // Caminhos conhecidos do SPA; nao aceitar URLs arbitrarias de PJe, DOM ou terceiros.
    const digits = cnj(record?.number);
    const search = `${origin}/procedures/search?gq=${encodeURIComponent(formatNumber(digits))}`;
    const id = String(record?.expedienteId || '');
    const direct = /^\d{1,16}$/.test(id) ? `${origin}/procedures/${id}` : null;
    return {search, direct};
  }
  function movementFor(record, values, test = false) {
    const latest = test && record?.spaLatestMovement ? record.spaLatestMovement : record?.latestMovement || record?.spaLatestMovement;
    if (Array.isArray(values) && values.length) return values.map(item => {
      if (typeof item === 'object' && item) return {description:clean(item.description || item.text || 'Movimentação identificada', 700),date:formatDate(item.date || item.at),code:clean(item.code, 50)};
      return {description:clean(item, 700),date:'',code:''};
    }).slice(0, 12);
    if (latest?.description) return [{description:clean(latest.description,700),date:formatDate(latest.date),code:clean(latest.code,50)}];
    // Nao confundir alteracoes de expedientes com movimentacoes do processo.
    // Em cadastros antigos sem latestMovement, solicite nova consulta manual.
    return [];
  }
  function build(record, values, {test = false} = {}) {
    const number = formatNumber(record?.number) || 'Não informado';
    const subjectName = clean(record?.subject || '', 100) || 'Assunto não informado';
    const parties = clean(record?.parties || '', 200) || 'Não informadas';
    const court = clean(test && record?.spaLatestMovement ? record.spaLatestMovement.source : record?.tribunal || '', 80) || 'SPA / PJe';
    const movements = movementFor(record, values, test);
    const {search, direct} = links(record);
    const subject = `[Acompanhamento Especial] Movimentação no Processo ${number} - ${subjectName} - ${clean(record?.parties || 'Partes não informadas', 80)}`;
    const headline = test ? 'Teste de notificação — última movimentação' : 'Nova movimentação identificada';
    const reported = formatDate(test && record?.spaLatestMovement ? record?.spaCheckedAt : record?.checkedAt || record?.spaCheckedAt || new Date().toISOString());
    const rows = movements.map((m, i) => `<tr><td style="border-bottom:1px solid #e2ebf2;padding:14px 16px;vertical-align:top"><div style="font-size:11px;font-weight:700;color:#207a9a;margin-bottom:5px">MOVIMENTAÇÃO ${i+1}${m.date ? ` · ${escapeHtml(m.date)}` : ''}</div><div style="font-size:14px;line-height:1.55;color:#18344b">${escapeHtml(m.description)}</div>${m.code ? `<div style="font-size:11px;color:#60768a;margin-top:5px">Código: ${escapeHtml(m.code)}</div>` : ''}</td></tr>`).join('');
    const button = (text,url,secondary=false) => `<a href="${escapeHtml(url)}" style="display:inline-block;box-sizing:border-box;text-decoration:none;border-radius:8px;padding:12px 17px;margin:0 8px 8px 0;font-weight:700;font-size:13px;border:1px solid ${secondary?'#bbd1df':'#177c99'};background:${secondary?'#ffffff':'#177c99'};color:${secondary?'#23516b':'#ffffff'}">${escapeHtml(text)}</a>`;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#eff4f8;color:#18344b;font-family:Arial,Helvetica,sans-serif"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #d8e4ed;border-radius:14px;overflow:hidden"><tr><td style="padding:24px 26px;background:#173b55;color:white"><div style="font-size:11px;letter-spacing:2px;color:#81d5ee;font-weight:bold">MTPREV · ACOMPANHAMENTO ESPECIAL</div><div style="font-size:22px;line-height:1.3;font-weight:bold;margin:12px 0 4px;color:#fff">${escapeHtml(headline)}</div><div style="font-size:12px;color:#c7e2f0">Consulta registrada em ${escapeHtml(reported)}</div></td></tr><tr><td style="padding:24px 26px"><div style="font-size:12px;color:#5a7184;margin-bottom:12px">Acompanhamento de movimentações processuais</div><div style="background:#f1f7fa;border:1px solid #dbe8ee;border-radius:9px;padding:16px"><div style="font-size:11px;color:#607c8d;font-weight:bold;letter-spacing:1px">NÚMERO DO PROCESSO</div><div style="font-size:18px;font-weight:bold;color:#164c67;word-break:break-word;margin:4px 0 12px">${escapeHtml(number)}</div><table role="presentation" style="width:100%;font-size:13px;line-height:1.65"><tr><td style="width:90px;color:#668093;vertical-align:top">Assunto</td><td style="color:#203d51;font-weight:bold">${escapeHtml(subjectName)}</td></tr><tr><td style="color:#668093;vertical-align:top">Partes</td><td style="color:#203d51">${escapeHtml(parties)}</td></tr><tr><td style="color:#668093;vertical-align:top">Origem</td><td style="color:#203d51">${escapeHtml(court)}</td></tr>${direct ? `<tr><td style="color:#668093;vertical-align:top">Expediente</td><td style="color:#203d51">${escapeHtml(record.expedienteId)}</td></tr>` : ''}</table></div><h2 style="font-size:15px;color:#143b53;margin:25px 0 10px">${test ? 'Última movimentação registrada (teste)' : `Movimentações encontradas (${movements.length})`}</h2><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #dfe9f0;border-radius:9px">${rows || '<tr><td style="padding:15px;color:#60768a">Nenhuma movimentação salva para exibir.</td></tr>'}</table><div style="margin-top:22px">${direct ? button('Abrir expediente no SPA',direct) : ''}${button('Localizar processo no SPA',search,Boolean(direct))}</div><div style="font-size:12px;line-height:1.5;color:#657e8e;margin-top:4px">${direct ? 'Consulte os andamentos na página oficial do expediente.' : 'O ID interno do expediente ainda não está cadastrado; use a pesquisa pelo número CNJ.'}</div></td></tr><tr><td style="padding:19px 26px;background:#e9f1f6;color:#5c7486;font-size:11px;line-height:1.6">${test ? '<b>ENVIO DE TESTE.</b> A mensagem utiliza a última movimentação que a extensão tinha armazenada. ' : ''}Aviso automático de acompanhamento MTPrev. Os dados devem ser conferidos no SPA/PJe antes de qualquer providência. Não responda a esta mensagem.</td></tr></table></body></html>`;
    const plain = [headline, `Processo: ${number}`,`Assunto: ${subjectName}`,`Partes: ${parties}`,`Origem: ${court}`,`Consulta: ${reported}`,'', ...movements.map(m => `${m.date ? m.date + ' — ' : ''}${m.description}`),'',...(direct ? [`Abrir expediente: ${direct}`] : []),`Localizar processo: ${search}`,'', 'Dados sujeitos a conferência no SPA/PJe.'].join('\n');
    return {subject,html,plain,hasMovement:movements.length>0,link:direct||search};
  }
  globalThis.MTPrevMailTemplate = {build, links, formatNumber, escapeHtml};
})();
