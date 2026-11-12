(() => {
  'use strict';
  const C=globalThis.MTPrevAuditCore;
  const form=document.getElementById('audit-form'),status=document.getElementById('audit-status'),event=document.getElementById('audit-event');
  for(const title of C.EVENTS){const option=document.createElement('option');option.value=title;option.textContent=title;event.append(option);}
  const call=async(type,payload={})=>{const r=await chrome.runtime.sendMessage({type,...payload});if(!r?.ok)throw Error(r?.error||'Integração indisponível.');return r;};
  function show(r){
    document.getElementById('audit-enabled').checked=r.config.enabled===true;event.value=r.config.event||'';
    document.getElementById('audit-account').textContent=r.config.account||'Conta não conectada';
    status.textContent=`${r.pending} registro(s) pendente(s). `+(r.lastSync?'Última sincronização: '+new Date(r.lastSync).toLocaleString('pt-BR')+'. ':'')+(r.lastError||'');
  }
  form.addEventListener('submit',async e=>{e.preventDefault();try{show(await call('MTPREV_AUDIT_SAVE',{enabled:document.getElementById('audit-enabled').checked,event:event.value}));}catch(error){status.textContent=error.message;}});
  for(const [id,type] of [['audit-connect','MTPREV_AUDIT_CONNECT'],['audit-sync','MTPREV_AUDIT_SYNC']])document.getElementById(id).addEventListener('click',async()=>{
    const button=document.getElementById(id);button.disabled=true;status.textContent='Conectando à planilha…';
    try{show(await call(type));}catch(error){status.textContent=error.message;}finally{button.disabled=false;}
  });
  call('MTPREV_AUDIT_STATUS').then(show,error=>{status.textContent=error.message;});
})();
