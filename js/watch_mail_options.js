/* Configuracao local de alertas Microsoft 365 do Acompanhamento Especial. */
(() => {
  'use strict';
  const KEY='MTPREV_WATCH_MAIL_OAUTH_CONFIG_V1';
  const $=id=>document.getElementById(id);
  const elements={clientId:$('watch-mail-client'),tenant:$('watch-mail-tenant'),recipient:$('watch-mail-recipient'),enabled:$('watch-mail-enabled'),consent:$('watch-mail-consent')};
  const status=$('watch-mail-status');
  const show=(message,error=false)=>{status.textContent=message;status.dataset.error=String(error);};
  const save=async()=>{
    const c={
      clientId:elements.clientId.value.trim(),
      tenant:elements.tenant.value.trim(),
      recipient:elements.recipient.value.trim(),
      enabled:elements.enabled.checked,
      consent:elements.consent.checked
    };
    const isGuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    if(!isGuid(c.clientId) || !(isGuid(c.tenant) || c.tenant==='organizations')) throw new Error('Informe Client ID e Tenant ID válidos (UUID).');
    if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c.recipient)) throw new Error('Informe um e-mail destinatário válido.');
    if(c.enabled && !c.consent) throw new Error('Para envio automático, confirme a autorização dos dados processuais.');
    await chrome.storage.local.set({[KEY]:c,MTPREV_WATCH_MAIL_RECIPIENT:c.recipient});
    return c;
  };
  const action=async(type,notify)=>{
    try {show('Processando…');const r=await chrome.runtime.sendMessage({type});if(!r?.ok) throw new Error(r?.error||'Operação não concluída');show(r.message||notify||'Pronto.');}
    catch(e){show(e?.message||'Falha de conexão.',true);}
  };
  $('watch-mail-form').addEventListener('submit',async e=>{e.preventDefault();try{await save();show('Preferências salvas. Conecte a conta antes de enviar.');}catch(err){show(err.message,true);}});
  $('watch-mail-connect').addEventListener('click',async()=>{try{await save();await action('MTPREV_MAIL_OAUTH_CONNECT');}catch(e){show(e.message,true);}});
  $('watch-mail-test').addEventListener('click',()=>action('MTPREV_MAIL_OAUTH_TEST'));
  $('watch-mail-disconnect').addEventListener('click',()=>action('MTPREV_MAIL_OAUTH_DISCONNECT'));
  $('watch-mail-check').addEventListener('click',()=>action('MTPREV_MAIL_OAUTH_STATUS'));
  Promise.all([chrome.storage.local.get(KEY),chrome.runtime.sendMessage({type:'MTPREV_MAIL_OAUTH_STATUS'})]).then(([data,result])=>{
    const c=data[KEY]||{};
    Object.entries(elements).forEach(([name,node])=>{
      if(node.type==='checkbox') node.checked=Boolean(c[name]);else node.value=c[name]||'';
    });
    $('watch-mail-redirect').textContent=result?.redirect||'Verifique o ID da extensão';
    show(result?.connected ? 'Conta Microsoft conectada nesta sessão.' : 'E-mail desconectado. É necessário conectar a conta antes de enviar.');
  }).catch(err=>show('Não foi possível carregar as opções de e-mail: '+err.message,true));
})();
