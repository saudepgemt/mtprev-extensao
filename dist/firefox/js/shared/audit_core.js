/* Regras compartilhadas de produtividade e auditoria. Sem credenciais. */
(() => {
  'use strict';
  if(globalThis.MTPrevAuditCore)return;
  const SPREADSHEET_ID='1zRJqH93nnZSn5fZcUHYy5mtRs7gkaFkS6_XBngNyyRM';
  const HEADERS={
    Produtividade:['event_id','processo','procedimento_id','assessor','evento','data_minutada','data_recebimento','prazo','dispensa','origem_spa','registrado_em','usuario_registro','fonte_status'],
    Protocolos:['event_id','lote_id','etapa','iniciado_em','atualizado_em','origem_spa','operador','selecionados','documentos','assinados','enviados','confirmados','falhas','resultado','evidencia','procedimentos']
  };
  const EVENTS=['Petição elaborada','Minuta elaborada','Minuta enviada ao(à) procurador(a)'];
  const RESULTS=['iniciado','enviado_sem_confirmacao','sucesso_confirmado','falha','indeterminado'];
  const norm=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  const eventKey=text=>norm(text).replace(/\(a\)/g,'').replace(/\s+/g,' ').replace(/^minuta enviada a procuradora?$/,'minuta enviada ao procurador');
  function iso(value){const raw=String(value||'');if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/i.test(raw))return '';const date=new Date(raw);return Number.isFinite(date.getTime())?date.toISOString():'';}
  function spaDate(value){
    const raw=String(value||'').trim();
    if(/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)$/i.test(raw))return iso(raw);
    const br=raw.match(/^(\d\d)\/(\d\d)\/(\d{4})(?:\s*(?:às|as)?\s*(\d\d):(\d\d)(?::(\d\d))?)?$/i);
    if(!br)return '';
    const stamp=`${br[3]}-${br[2]}-${br[1]}T${br[4]||'23'}:${br[5]||'59'}:${br[6]||'00'}-04:00`;
    return iso(stamp);
  }
  const day=value=>{const stamp=iso(value);return stamp?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(stamp)):'';};
  const count=value=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):0;
  const text=(value,max=500)=>String(value??'').replace(/[\u0000-\u0008]/g,'').slice(0,max);
  function normalizeEvent(sheet,input){
    if(!HEADERS[sheet] || !input || typeof input!=='object')throw Error('Tipo de registro inválido.');
    const row=Object.fromEntries(HEADERS[sheet].map(key=>[key,text(input[key])]));
    if(!/^[a-zA-Z0-9:_-]{8,180}$/.test(row.event_id))throw Error('Identificador de evento inválido.');
    const url=new URL(row.origem_spa);
    if(url.protocol!=='https:'||!['spa.pge.mt.gov.br','pge.mt.spa.coreplan.com.br'].includes(url.hostname))throw Error('Origem SPA inválida.');
    row.origem_spa=url.origin+url.pathname;
    if(sheet==='Produtividade'){
      row.data_minutada=iso(row.data_minutada);row.data_recebimento=iso(row.data_recebimento);row.prazo=iso(row.prazo);
      if(!row.assessor.trim()||!row.data_minutada||!EVENTS.some(event=>eventKey(event)===eventKey(row.evento)))throw Error('Produtividade exige assessor, data exata e evento reconhecido.');
      row.dispensa=norm(input.dispensa)==='sim'||input.dispensa===true?'sim':norm(input.dispensa)==='nao'||input.dispensa===false?'nao':'nao_informado';
      if(/dispensa/.test(norm(row.evento)))row.dispensa='sim';
      row.registrado_em=iso(row.registrado_em)||new Date().toISOString();
    }else{
      if(!RESULTS.includes(row.resultado)||!row.lote_id)throw Error('Resultado ou lote inválido.');
      for(const key of ['selecionados','documentos','assinados','enviados','confirmados','falhas'])row[key]=input[key]===undefined||input[key]===null||input[key]===''?'':count(input[key]);
      row.iniciado_em=iso(row.iniciado_em);row.atualizado_em=iso(row.atualizado_em)||new Date().toISOString();
      if(row.resultado!=='sucesso_confirmado')row.confirmados=0;
      row.procedimentos=text(input.procedimentos,12000);
      // Apenas evidências selecionadas, nunca conteúdo de formulário, senha ou token.
      row.evidencia=text(input.evidencia,300);
    }
    return row;
  }
  function fromValues(sheet,values){return values.filter(row=>row[0]&&row[0]!=='event_id').map(row=>Object.fromEntries(HEADERS[sheet].map((key,i)=>[key,row[i]??''])));}
  function unique(rows){return [...new Map(rows.filter(row=>row.event_id).map(row=>[row.event_id,row])).values()];}
  function ranking(rows,{from='',to='',event=''}={}){
    const byPerson=new Map();
    for(const row of unique(rows)){
      if(!row.assessor||!iso(row.data_minutada)||norm(row.dispensa)!=='nao'||/dispensa/.test(norm(row.evento))||!event||eventKey(row.evento)!==eventKey(event))continue;
      const date=day(row.data_minutada);if((from&&date<from)||(to&&date>to))continue;
      const key=norm(row.assessor);if(!byPerson.has(key))byPerson.set(key,{assessor:row.assessor,total:0,noPrazo:0,foraPrazo:0,semPrazo:0,horas:[],ultima:''});
      const person=byPerson.get(key);person.total++;
      if(iso(row.prazo)){if(Date.parse(row.data_minutada)<=Date.parse(row.prazo))person.noPrazo++;else person.foraPrazo++;}else person.semPrazo++;
      if(iso(row.data_recebimento)&&Date.parse(row.data_minutada)>=Date.parse(row.data_recebimento))person.horas.push((Date.parse(row.data_minutada)-Date.parse(row.data_recebimento))/3600000);
      if(row.data_minutada>person.ultima)person.ultima=row.data_minutada;
    }
    return [...byPerson.values()].sort((a,b)=>b.total-a.total||a.assessor.localeCompare(b.assessor,'pt-BR')).map((row,index)=>({...row,posicao:index+1,mediaHoras:row.horas.length?row.horas.reduce((a,b)=>a+b,0)/row.horas.length:null}));
  }
  function batches(rows,{from='',to=''}={}){
    const result=new Map();
    for(const row of unique(rows)){
      const date=day(row.iniciado_em||row.atualizado_em);if((from&&date<from)||(to&&date>to))continue;
      const previous=result.get(row.lote_id);
      if(!previous||Date.parse(row.atualizado_em)>=Date.parse(previous.atualizado_em))result.set(row.lote_id,row);
    }
    return [...result.values()].sort((a,b)=>Date.parse(b.atualizado_em)-Date.parse(a.atualizado_em));
  }
  async function eventId(value){const bytes=new TextEncoder().encode(value);const hash=await crypto.subtle.digest('SHA-256',bytes);return 'spa_'+Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');}
  function protocolOutcome(result={},receipt=''){
    const evidence=norm(receipt),selected=count(result.selectedCount);
    const confirmed=Number(evidence.match(/\b(\d+)\s+(?:processos?|peticoes|peticao)\s+(?:foram\s+)?protocolad[oa]s?\s+com\s+sucesso\b/)?.[1]||0);
    const failure=/\b(?:erro|falha|nao foi possivel)\b/.test(evidence);
    return {resultado:failure?'falha':confirmed>0&&confirmed===selected?'sucesso_confirmado':result.submitted?'enviado_sem_confirmacao':'indeterminado',
      selecionados:selected||'',documentos:result.totalDocuments===undefined?'':count(result.totalDocuments),assinados:result.signedDocuments===undefined?'':count(result.signedDocuments),enviados:result.submitted?selected:'',
      confirmados:!failure&&confirmed>0&&confirmed===selected?confirmed:0,falhas:failure?'':0,
      evidencia:text(receipt||'Envio observado sem confirmação individual dos itens pelo SPA.',300)};
  }
  async function productivityFromTimeline(doc,record,event){
    if(!EVENTS.includes(event))throw Error('Escolha o evento de produtividade nas configurações.');
    const selector='.workspace-preview__timeline-item,.workspace-preview__timeline-entry,.workspace-preview__movement,.workspace-preview__activity,.timeline-item,.timeline__item,.timeline-entry';
    const all=Array.from(doc.querySelectorAll(selector)),rows=[];let skipped=0;
    for(const node of all.filter(node=>!all.some(other=>other!==node&&other.contains(node)))){
      let title=node.querySelector('[class*="timeline-title"],[class*="timeline__title"],[class*="movement-title"],h3,h4,h5,strong')?.textContent||'';
      if(eventKey(title)!==eventKey(event)){
        const titleStrong=Array.from(node.querySelectorAll?.('strong')||[]).find(e=>eventKey(e.textContent)===eventKey(event));
        if(titleStrong)title=titleStrong.textContent;
        else if(eventKey(node.textContent).startsWith(eventKey(event)+' '))title=event;
      }
      const pieceType=node.getAttribute('data-piece-type')||record.manifestationSuggested||record.tipoPeca||'';
      if(eventKey(title)!==eventKey(event)||/\bdispensa\b/.test(norm(pieceType)))continue;
      let actor=node.querySelector('[class*="timeline-user"],[class*="timeline-author"],[class*="timeline__user"],[class*="timeline__author"],[class*="movement-user"],[class*="activity-author"],.mtprev-movement-person');
      if(!actor){
        const avatar=node.querySelector('[class*="avatar"]');
        actor=Array.from(avatar?.parentElement?.children||[]).find(e=>e!==avatar&&!e.contains(avatar)&&!e.matches('img,svg,button,time,[class*="avatar"]')&&!e.querySelector('img,svg,button,time')&&e.textContent.trim());
      }
      const dateNode=node.querySelector('time[datetime],time,[data-datetime]');
      let rawDate=dateNode?.getAttribute('datetime')||dateNode?.getAttribute('data-datetime')||dateNode?.textContent?.split(' · ')[0]||'';
      if(/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d(?::\d\d)?$/.test(rawDate))rawDate+='-04:00';
      const fullDate=String(node.textContent||'').match(/\b\d\d\/\d\d\/\d{4}\s*(?:às|as)?\s*\d\d:\d\d(?::\d\d)?/i)?.[0]||'';
      const date=spaDate(rawDate)||spaDate(fullDate);
      const author=actor?.textContent?.trim();
      // Nunca usar o assessor sugerido ou o usuário logado como autor da peça.
      if(!author||!date){skipped++;continue;}
      const identity=node.getAttribute('data-event-id')||node.id||[norm(event),date,norm(author)].join('|');
      const id=await eventId([location.origin,record.procedureId,identity].join('|'));
      rows.push(normalizeEvent('Produtividade',{event_id:id,processo:record.processNumber,procedimento_id:record.procedureId,assessor:author,evento:event,data_minutada:date,
        data_recebimento:spaDate(node.getAttribute('data-received-at')),prazo:spaDate(node.getAttribute('data-deadline')),dispensa:pieceType?'nao':'nao_informado',origem_spa:location.origin+'/workspace/processes/'+record.procedureId+'/timeline',fonte_status:pieceType?'andamento_spa':'tipo_peca_nao_informado'}));
    }
    return {rows,skipped};
  }
  globalThis.MTPrevAuditCore=Object.freeze({SPREADSHEET_ID,HEADERS,EVENTS,RESULTS,norm,eventKey,iso,spaDate,day,count,normalizeEvent,fromValues,unique,ranking,batches,eventId,protocolOutcome,productivityFromTimeline});
  if(typeof module!=='undefined')module.exports=globalThis.MTPrevAuditCore;
})();
