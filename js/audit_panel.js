/* Interface no mundo isolado: OAuth e Sheets ficam exclusivamente no background. */
(() => {
  'use strict';
  if(globalThis.__mtprevAuditPanel)return;globalThis.__mtprevAuditPanel=true;
  const C=globalThis.MTPrevAuditCore;
  const call=async(type,payload={})=>{const r=await chrome.runtime.sendMessage({type,...payload});if(!r?.ok)throw Error(r?.error||'Integração indisponível.');return r;};
  const node=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
  const date=value=>C.iso(value)?new Date(value).toLocaleString('pt-BR',{timeZone:'America/Cuiaba'}):'Não informado';
  let importing=false,modal=null,importController=null;
  async function open(){
    modal?.remove();const overlay=node('section','','mtprev-audit-overlay');modal=overlay;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Produtividade e protocolos');
    const dialog=node('div','','mtprev-audit-dialog'),head=node('header','','mtprev-audit-head'),title=node('div');title.append(node('h2','Produtividade e protocolos'),node('small','Registros da planilha Logs SPA — MTPrev'));head.append(title);
    const close=node('button','Fechar');close.onclick=()=>{importController?.abort();overlay.remove();};head.append(close);dialog.append(head);
    const body=node('div','','mtprev-audit-body'),toolbar=node('div','','mtprev-audit-toolbar');
    const prod=node('button','Produtividade'),proto=node('button','Protocolos'),reload=node('button','Ler planilha'),sync=node('button','Sincronizar pendentes'),importButton=node('button','Importar produtividade da mesa'),settings=node('button','Configurações');
    const from=node('input'),to=node('input');from.type=to.type='date';
    const now=C.day(new Date().toISOString());from.value=now.slice(0,7)+'-01';to.value=now;
    for(const [caption,input] of [['De',from],['Até',to]]){const label=node('label',caption);label.append(input);toolbar.append(label);}
    toolbar.append(prod,proto,reload,sync,importButton,settings);body.append(toolbar);
    const message=node('div','Lendo os registros da planilha…','mtprev-audit-note');message.setAttribute('role','status');body.append(message);
    const content=node('div');body.append(content);dialog.append(body);overlay.append(dialog);document.body.append(overlay);
    overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close.click();}});
    let data=null,mode='prod';
    function table(headers,rows){
      content.replaceChildren();const wrap=node('div','','mtprev-audit-table-wrap'),table=node('table','','mtprev-audit-table'),head=node('thead'),hr=node('tr');
      headers.forEach(h=>hr.append(node('th',h)));head.append(hr);table.append(head);const tbody=node('tbody');table.append(tbody);wrap.append(table);content.append(wrap);
      let offset=0;const more=node('button','Mostrar mais 100');
      function append(){for(const values of rows.slice(offset,offset+100)){const tr=node('tr');for(const value of values)tr.append(node('td',String(value??'')));tbody.append(tr);}offset+=100;more.hidden=offset>=rows.length;}
      more.onclick=append;content.append(more);append();if(!rows.length)content.append(node('p','Nenhum registro nesse período.'));
    }
    function render(){
      if(!data)return;prod.setAttribute('aria-pressed',String(mode==='prod'));proto.setAttribute('aria-pressed',String(mode==='proto'));
      const filter={from:from.value,to:to.value,event:data.config.event};
      if(mode==='prod'){
        const rows=C.ranking(data.Produtividade,filter);
        const pendingType=C.unique(data.Produtividade).filter(row=>C.norm(row.dispensa)==='nao_informado').length;
        message.textContent=(data.config.event?'Evento contado: '+data.config.event+'. Dispensas excluídas. ':'Escolha o evento que conta como minuta nas Configurações. ')+`${data.pending} registro(s) local(is) aguardando sincronização. `+(pendingType?`${pendingType} evento(s) sem tipo de peça: confira a coluna dispensa na planilha (sim/nao); ainda não entram no ranking. `:'')+'Prazo só é aferido quando a fonte informa uma data exata vinculada ao evento.';
        table(['Posição','Assessor','Minutadas','No prazo','Fora do prazo','Sem prazo informado','Média recebimento → minuta (h)','Última minuta'],rows.map(r=>[r.posicao,r.assessor,r.total,r.noPrazo,r.foraPrazo,r.semPrazo,r.mediaHoras===null?'Não informado':r.mediaHoras.toFixed(1),date(r.ultima)]));
      }else{
        const rows=C.batches(data.Protocolos,filter);message.textContent=`${rows.length} lote(s) no período. “Enviado” não equivale a sucesso confirmado pelo SPA. O histórico registra as operações observadas pela extensão habilitada.`;
        const label={iniciado:'Iniciado — sem resultado registrado',enviado_sem_confirmacao:'Enviado — aguardando confirmação',sucesso_confirmado:'Sucesso confirmado',falha:'Falha observada',indeterminado:'Resultado não confirmado'};
        const quantity=value=>value===''||value===undefined?'Não informado':value;
        table(['Lote','Etapa','Início','Última atualização','Operador','Selecionados','Documentos','Assinados','Enviados','Confirmados','Falhas','Resultado','Evidência'],rows.map(r=>[r.lote_id,r.etapa,date(r.iniciado_em),date(r.atualizado_em),r.operador,quantity(r.selecionados),quantity(r.documentos),quantity(r.assinados),quantity(r.enviados),quantity(r.confirmados),quantity(r.falhas),label[r.resultado]||r.resultado,r.evidencia]));
      }
    }
    async function load(){reload.disabled=true;message.textContent='Lendo a planilha…';try{data=await call('MTPREV_AUDIT_DATA');render();}catch(e){message.textContent=e.message;}finally{reload.disabled=false;}}
    prod.onclick=()=>{mode='prod';render();};proto.onclick=()=>{mode='proto';render();};from.onchange=to.onchange=render;reload.onclick=load;
    settings.onclick=()=>chrome.runtime.sendMessage({type:'MTPREV_OPEN_OPTIONS'});
    sync.onclick=async()=>{sync.disabled=true;try{await call('MTPREV_AUDIT_SYNC');await load();}catch(e){message.textContent=e.message;}finally{sync.disabled=false;}};
    importButton.disabled=importing;
    importButton.onclick=async()=>{
      if(importing)return;importing=true;importButton.disabled=true;const controller=new AbortController();importController=controller;
      const stop=node('button','Interromper importação');stop.onclick=()=>controller.abort();toolbar.append(stop);
      try{
        const info=await call('MTPREV_AUDIT_STATUS');if(!info.config.enabled||!info.config.event)throw Error('Conecte a planilha, habilite a integração e selecione o evento de produtividade nas Configurações.');
        if(!globalThis.SpaAdapter?.isWorkspace())throw Error('Abra a mesa de processos do SPA para importar.');
        const collection=await (globalThis.MTPrevWorkspaceCache?.collect||globalThis.SpaAdapter.collectWorkspaceRecords)({signal:controller.signal,allowScroll:false,onProgress:p=>{message.textContent=`Lendo mesa: ${p.count} de ${p.total??'?'}…`;}});
        if(collection.reason!=='complete')throw Error('Leitura da mesa incompleta. Nenhum evento foi importado.');
        const ids=new Map();for(const record of collection.records){const id=String(record.procedureId||record.rowKey||'');if(/^\d+$/.test(id))ids.set(id,{...record,procedureId:id});}
        let checked=0,failed=0,skipped=0,events=0;const queue=[...ids.values()];let cursor=0;
        async function worker(){while(cursor<queue.length){controller.signal.throwIfAborted();const record=queue[cursor++];
          try{
            const response=await fetch('/workspace/processes/'+record.procedureId+'/timeline',{credentials:'same-origin',redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]),headers:{Accept:'text/html, application/json'}});
            if(!response.ok)throw Error('HTTP '+response.status);let html=await response.text();if(/^\s*\{/.test(html)){const json=JSON.parse(html);html=json.html||json.content||'';}
            const result=await C.productivityFromTimeline(new DOMParser().parseFromString(html,'text/html'),record,info.config.event);skipped+=result.skipped;
            for(let i=0;i<result.rows.length;i+=100)await call('MTPREV_AUDIT_CAPTURE',{sheet:'Produtividade',rows:result.rows.slice(i,i+100)});events+=result.rows.length;
          }catch(e){controller.signal.throwIfAborted();failed++;}
          checked++;message.textContent=`Andamentos: ${checked}/${queue.length}. ${events} evento(s); ${skipped} sem autor/data exata; ${failed} processo(s) não lido(s).`;
        }}
        await Promise.all(Array.from({length:Math.min(4,queue.length)},()=>worker()));
        await call('MTPREV_AUDIT_SYNC');await load();message.textContent+=` Importação: ${events} evento(s), ${skipped} sem autoria/data e ${failed} processo(s) não lido(s).`;
      }catch(e){message.textContent=e.message;}finally{importing=false;importController=null;importButton.disabled=false;stop.remove();}
    };
    void load();
  }
  document.addEventListener('mtprev:audit:open',()=>void open());
  // Captura de lotes manuais: somente formulário nativo de protocolo, após submit.
  const PENDING='MTPREV_AUDIT_MANUAL_BATCH_V1';
  let captureEnabled=false,productionConfig={},productionTimer,productionReading=false;
  const observedEvents=new Set();
  function queueProductionScan(){clearTimeout(productionTimer);productionTimer=setTimeout(()=>void captureVisibleProduction(),700);}
  async function captureVisibleProduction(){
    if(!captureEnabled||!productionConfig.event||productionReading)return;
    productionReading=true;
    try{
      const snapshots=globalThis.SpaAdapter?.workspacePreviewRecords?.()||[];
      for(const record of snapshots){
        const id=String(record.rowKey||record.procedureId||'');if(!/^\d+$/.test(id))continue;
        const root=Array.from(document.querySelectorAll('.workspace-preview__document[data-procedure-id]')).find(node=>node.getAttribute('data-procedure-id')===id);
        if(!root)continue;
        const result=await C.productivityFromTimeline(root,{...record,procedureId:id},productionConfig.event);
        const rows=result.rows.filter(row=>!observedEvents.has(row.event_id));
        for(let offset=0;offset<rows.length;offset+=100){const batch=rows.slice(offset,offset+100);await call('MTPREV_AUDIT_CAPTURE',{sheet:'Produtividade',rows:batch});batch.forEach(row=>observedEvents.add(row.event_id));}
      }
    }catch(_){}finally{productionReading=false;}
  }
  call('MTPREV_AUDIT_STATUS').then(r=>{captureEnabled=r.config.enabled===true;productionConfig=r.config;queueProductionScan();}).catch(()=>{});
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local'&&changes.MTPREV_AUDIT_CONFIG_V1){productionConfig=changes.MTPREV_AUDIT_CONFIG_V1.newValue||{};captureEnabled=productionConfig.enabled===true;queueProductionScan();}
  });
  document.addEventListener('submit',event=>{
    if(!captureEnabled||!/^\/procedures\/massive\/2760\/?$/.test(location.pathname)||document.documentElement.dataset.mtprevAuditScheduled)return;
    const form=event.target;if(!(form instanceof HTMLFormElement)||form.id!=='massive-form')return;
    const checks=[...document.querySelectorAll('.check-procedures-table:checked')];
    const marker=parseInt(document.querySelector('#procedures-marker')?.textContent||'',10);
    const selected=Number.isSafeInteger(marker)&&marker>0?marker:checks.length;if(!selected)return;
    const now=new Date().toISOString(),id='manual_'+crypto.randomUUID();
    const procedures=checks.map(input=>input.closest('tr')?.textContent.match(/\d{7}-\d\d\.\d{4}\.\d\.\d\d\.\d{4}/)?.[0]||'').filter(Boolean);
    const row={event_id:id+'_envio',lote_id:id,etapa:'protocolo_manual',iniciado_em:now,atualizado_em:now,origem_spa:location.origin+location.pathname,selecionados:selected,enviados:selected,resultado:'enviado_sem_confirmacao',evidencia:'Submissão do formulário de protocolo observada; conclusão ainda não confirmada. Identificadores listados somente para linhas visíveis.',procedimentos:procedures.join(';')};
    const accountScope=new URL(location.href).searchParams.get('user_id')||'';
    const flashBefore=Array.from(document.querySelectorAll('.alert-success,.alert-danger,#flash_notice,#flash_alert')).map(e=>e.textContent.trim()).join(' ').slice(0,300);
    queueMicrotask(()=>{
      if(event.defaultPrevented)return;
      try{sessionStorage.setItem(PENDING,JSON.stringify({row,at:Date.now(),accountScope,flashBefore}));}catch(_){}
      void call('MTPREV_AUDIT_CAPTURE',{sheet:'Protocolos',rows:[row]}).catch(()=>{});
    });
  },true);
  let resuming=false;
  async function resumeManualLog(){
    if(resuming)return;
    let pending;try{pending=JSON.parse(sessionStorage.getItem(PENDING)||'null');}catch(_){return;}
    if(!pending)return;
    if(Date.now()-pending.at>10*60*1000){sessionStorage.removeItem(PENDING);return;}
    resuming=true;
    try{
      const state=await call('MTPREV_AUDIT_STATUS');if(!state.config.enabled)return;
      await call('MTPREV_AUDIT_CAPTURE',{sheet:'Protocolos',rows:[pending.row]});
      const flash=Array.from(document.querySelectorAll('.alert-success,.alert-danger,#flash_notice,#flash_alert')).map(e=>e.textContent.trim()).join(' ').slice(0,300);
      const currentAccount=new URL(location.href).searchParams.get('user_id')||'';
      if(flash && flash!==pending.flashBefore && currentAccount===pending.accountScope){
        const result=C.protocolOutcome({submitted:true,selectedCount:pending.row.selecionados},flash);
        await call('MTPREV_AUDIT_CAPTURE',{sheet:'Protocolos',rows:[{...pending.row,...result,event_id:pending.row.lote_id+'_resposta',atualizado_em:new Date().toISOString()}]});
        sessionStorage.removeItem(PENDING);void call('MTPREV_AUDIT_SYNC').catch(()=>{});
      }
    }catch(_){}finally{resuming=false;} // Pendência preservada para a próxima navegação na mesma aba.
  }
  setTimeout(()=>void resumeManualLog(),1500);
  let flashTimer;
  new MutationObserver(records=>{
    if(records.some(record=>record.target?.closest?.('.workspace-preview__document')||Array.from(record.addedNodes).some(node=>node.nodeType===1&&(node.matches?.('.workspace-preview__document')||node.querySelector?.('.workspace-preview__document')))))queueProductionScan();
    if(records.some(record=>Array.from(record.addedNodes).some(node=>node.nodeType===1&&(node.matches?.('.alert-success,.alert-danger,#flash_notice,#flash_alert')||node.querySelector?.('.alert-success,.alert-danger,#flash_notice,#flash_alert'))))){
      clearTimeout(flashTimer);flashTimer=setTimeout(()=>void resumeManualLog(),250);
    }
  }).observe(document.documentElement,{subtree:true,childList:true});
  // Uma navegação isolada nunca prova que todos os itens do lote foram aceitos.
  // Mantém o estado enviado_sem_confirmacao até haver evidência vinculada ao lote.
})();
