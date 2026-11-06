(() => {
  'use strict';
  const KEY = 'MTPREV_WATCH_GMAIL_CONFIG_V1';
  const $ = id => document.getElementById(id);
  const sender = $('watch-mail-sender');
  const consent = $('watch-mail-consent');
  const enabled = $('watch-mail-enabled');
  const status = $('watch-mail-status');
  const emailRegex = /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/;
  const parseEmails = (input) => {
    const entries = Array.isArray(input) ? input : String(input || '').split(/[\n,;]+/);
    const list = [...new Set(entries.map(item=>String(item).trim().toLowerCase()).filter(Boolean))];
    for (const mail of list) if (!emailRegex.test(mail) || mail.length > 254) throw new Error(`Destinatário inválido: ${mail.slice(0,80)}`);
    if (list.length>40) throw new Error('Limite de 40 destinatários.');
    return list;
  };
  const mode = () => $('watch-mail-mode-manual').checked ? 'manual' : 'oauth';
  function show(message, error = false) { status.textContent = message;status.dataset.error = String(error); }
  function renderMode() {
    const manual = mode() === 'manual';
    $('watch-mail-manual-controls').hidden = !manual;
    $('watch-mail-oauth-controls').hidden = manual;
    enabled.disabled = manual;
    if (manual) enabled.checked = false;
    sender.required = !manual;
    $('watch-mail-mode-note').textContent = manual
      ? 'Modo manual: a MTPrev prepara rascunhos para revisão. Nenhum e-mail é enviado automaticamente, e a escolha da conta remetente acontece no aplicativo de e-mail.'
      : 'Modo Gmail: a extensão usa a Gmail API com OAuth e pode enviar alertas automáticos somente quando autorizados.';
  }
  for (const id of ['watch-mail-mode-manual','watch-mail-mode-oauth']) $(id).addEventListener('change',renderMode);
  async function save() {
    const current = (await chrome.storage.local.get(KEY))[KEY] || {};
    const deliveryMode = mode();
    const address = sender.value.trim().toLowerCase();
    if (address && !emailRegex.test(address)) throw new Error('Endereço institucional inválido.');
    if (deliveryMode === 'oauth' && !emailRegex.test(address)) throw new Error('Informe a conta Gmail institucional remetente.');
    if (deliveryMode === 'oauth' && enabled.checked && !consent.checked) throw new Error('Confirme a autorização antes de ativar alertas automáticos.');
    const c = {...current,sender:address,deliveryMode,enabled:deliveryMode === 'oauth' && enabled.checked,consent:consent.checked};
    await chrome.storage.local.set({[KEY]:c});
    return c;
  }
  const action = async type => {
    try {
      show('Verificando…');
      const result = await chrome.runtime.sendMessage({type});
      if (!result?.ok) throw new Error(result?.error || 'Operação não concluída.');
      show(result.message || 'Configuração verificada.');
    } catch(error) {show(error?.message || 'Falha de conexão.',true);}
  };
  $('watch-mail-form').addEventListener('submit', async event=>{
    event.preventDefault();
    try {
      const c=await save();
      show(c.deliveryMode==='manual'
        ? 'Preferências salvas. Para enviar, abra um rascunho e confirme no aplicativo de e-mail.'
        : 'Configurações da Gmail API salvas neste navegador.');
    } catch(error){show(error.message,true);}
  });
  $('watch-mail-connect').addEventListener('click', async()=>{
    try {if(mode()!=='oauth') throw new Error('Selecione Gmail API para conectar.');await save();await action('MTPREV_MAIL_OAUTH_CONNECT');}
    catch(error){show(error.message,true);}
  });
  $('watch-mail-test').addEventListener('click',async()=>{
    try {
      if(mode()!=='oauth') throw new Error('Selecione Gmail API ou use Preparar rascunho de teste.');
      const current=await save();
      const emails=parseEmails(current.defaults||[]);
      if(!emails.length) throw new Error('Cadastre destinatários no Acompanhamento Especial.');
      if(!window.confirm(`Enviar teste pelo Gmail institucional para ${emails.join(', ')}?`)) return;
      await action('MTPREV_MAIL_OAUTH_TEST');
    }catch(error){show(error.message,true);}
  });
  $('watch-mail-disconnect').addEventListener('click',()=>action('MTPREV_MAIL_OAUTH_DISCONNECT'));
  $('watch-mail-check').addEventListener('click',()=>action('MTPREV_MAIL_OAUTH_STATUS'));
  $('watch-mail-compose').addEventListener('click', async()=>{
    try {
      const c=await save();
      if(c.deliveryMode!=='manual') throw new Error('Selecione o modo manual.');
      if(!c.consent) throw new Error('Confirme a autorização para compartilhar dados com os destinatários.');
      const to=parseEmails(c.defaults||[]);
      if(!to.length) throw new Error('Cadastre destinatários padrão no Acompanhamento Especial.');
      if(!window.confirm(`Abrir um RASCUNHO de teste para ${to.length} destinatário(s)?\nO envio só ocorrerá após sua confirmação no aplicativo de e-mail.`)) return;
      const url='mailto:?'+new URLSearchParams({bcc:to.join(','),subject:'[MTPrev] Teste de configuração de e-mail',body:'Mensagem de teste preparada manualmente pela extensão MTPrev. Revise o remetente e os destinatários antes de enviar. Nenhum dado processual foi incluído.'}).toString().replace(/\+/g,'%20');
      // Abertura local do cliente de e-mail; não afirma entrega.
      const anchor=document.createElement('a');anchor.href=url;document.body.append(anchor);anchor.click();anchor.remove();
      show('Rascunho solicitado ao aplicativo de e-mail. Confira o programa e clique em Enviar nele.');
    }catch(error){show(error?.message||'Falha ao preparar o rascunho.',true);}
  });
  Promise.all([chrome.storage.local.get(KEY),chrome.runtime.sendMessage({type:'MTPREV_MAIL_OAUTH_STATUS'}).catch(()=>null)])
    .then(([data,result])=>{
      const c=data[KEY]||{};
      $('watch-mail-mode-manual').checked=c.deliveryMode==='manual';
      $('watch-mail-mode-oauth').checked=c.deliveryMode!=='manual';
      sender.value=c.sender||'';
      const count=parseEmails(c.defaults||[]).length;
      $('watch-mail-defaults-count').textContent=`${count} destinatário(s) padrão no Acompanhamento Especial. Edite essa lista naquela tela.`;
      $('watch-mail-extension-id').textContent=chrome.runtime.id||'Indisponível';
      consent.checked=c.consent===true;
      enabled.checked=c.enabled===true;
      $('watch-mail-client-id-state').textContent=result?.clientReady
        ? 'Client ID OAuth presente no manifesto.'
        : 'Client ID OAuth ausente/inválido. Necessário apenas para Gmail API.';
      renderMode();
      show(c.deliveryMode==='manual'?'Modo manual configurado. Nenhum envio automático está ativo.':result?.message||'Configure o Gmail institucional.');
    }).catch(error=>show('Falha ao carregar preferências: '+error.message,true));
})();
