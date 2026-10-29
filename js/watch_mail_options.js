/* Configuração Gmail OAuth + remetente único do Acompanhamento Especial. */
(() => {
  'use strict';
  const KEY = 'MTPREV_WATCH_GMAIL_CONFIG_V1';
  const $ = id => document.getElementById(id);
  const sender = $('watch-mail-sender');
  const defaults = $('watch-mail-defaults');
  const consent = $('watch-mail-consent');
  const enabled = $('watch-mail-enabled');
  const status = $('watch-mail-status');
  const show = (message, error = false) => { status.textContent = message; status.dataset.error = String(error); };
  const emailRegex = /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/;
  const parseEmails = raw => {
    const list = [...new Set(String(raw || '').split(/[\s,;]+/).filter(Boolean).map(v => v.toLowerCase()))];
    for (const mail of list) if (!emailRegex.test(mail) || mail.length > 254) throw new Error(`Destinatário inválido: ${mail.slice(0, 80)}`);
    if (list.length > 40) throw new Error('No máximo 40 destinatários padrão.');
    return list;
  };
  const save = async () => {
    const c = {sender:sender.value.trim().toLowerCase(), defaults:parseEmails(defaults.value), enabled:enabled.checked, consent:consent.checked};
    if (!emailRegex.test(c.sender)) throw new Error('Informe o Gmail institucional que será o remetente.');
    if (c.enabled && !c.consent) throw new Error('Autorize o envio de dados processuais antes de ativar os alertas.');
    if (c.enabled && !c.defaults.length) show('Sem destinatários padrão: use as inclusões por processo.', false);
    await chrome.storage.local.set({[KEY]:c});
    return c;
  };
  const action = async type => {
    try {
      show('Processando…');
      const r = await chrome.runtime.sendMessage({type});
      if (!r?.ok) throw new Error(r?.error || 'Operação não concluída.');
      show(r.message || 'Configuração verificada.');
    } catch(e) { show(e?.message || 'Falha de conexão.', true); }
  };
  $('watch-mail-form').addEventListener('submit', async event => {
    event.preventDefault();
    try { await save(); show('Configuração Gmail salva neste navegador.'); }
    catch (e) { show(e.message, true); }
  });
  $('watch-mail-connect').addEventListener('click', async () => {
    try { await save(); await action('MTPREV_MAIL_OAUTH_CONNECT'); }
    catch(e) { show(e.message,true); }
  });
  $('watch-mail-test').addEventListener('click', async () => {
    try {
      await save();
      const emails = parseEmails(defaults.value);
      if (!emails.length) throw new Error('Adicione ao menos um destinatário padrão para testar nas Opções.');
      if (!window.confirm(`Enviar teste pelo Gmail institucional para ${emails.join(', ')}?`)) return;
      await action('MTPREV_MAIL_OAUTH_TEST');
    } catch(e) {show(e.message,true);}
  });
  $('watch-mail-disconnect').addEventListener('click', () => action('MTPREV_MAIL_OAUTH_DISCONNECT'));
  $('watch-mail-check').addEventListener('click', () => action('MTPREV_MAIL_OAUTH_STATUS'));
  Promise.all([chrome.storage.local.get(KEY),chrome.runtime.sendMessage({type:'MTPREV_MAIL_OAUTH_STATUS'})])
    .then(([data,r]) => {
      const c = data[KEY] || {};
      sender.value = c.sender || '';
      defaults.value = Array.isArray(c.defaults) ? c.defaults.join('\n') : '';
      consent.checked = c.consent === true;
      enabled.checked = c.enabled === true;
      $('watch-mail-client-id-state').textContent = r?.clientReady
        ? 'Client ID configurado no manifest.json.'
        : 'Pendente: informe o Client ID OAuth obtido no Google Cloud em manifest.json → oauth2.client_id.';
      show(r?.message || 'Configure o Gmail institucional.');
    }).catch(e => show('Falha ao carregar configurações: ' + e.message,true));
})();
