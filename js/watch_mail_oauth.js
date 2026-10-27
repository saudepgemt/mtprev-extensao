/* MTPrev - alertas do acompanhamento por Microsoft Graph (OAuth 2.0 PKCE).
 * Opcional. Sem client secret. Token em chrome.storage.session, nunca em pagina SPA.
 * Registro do aplicativo Microsoft Entra e consentimento Mail.Send obrigatorios.
 */
(() => {
  'use strict';
  const CONFIG_KEY = 'MTPREV_WATCH_MAIL_OAUTH_CONFIG_V1';
  const SESSION_KEY = 'MTPREV_WATCH_MAIL_OAUTH_SESSION_V1';
  const scopes = 'openid offline_access Mail.Send';
  const settingsUrl = chrome.runtime.getURL('options.html');
  const authRedirect = () => chrome.identity.getRedirectURL('mtprev-mail');
  const enc64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
  const safeId = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value||''));
  const emailValid = value => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(value||'')) && String(value).length < 255;
  async function config() {
    return (await chrome.storage.local.get(CONFIG_KEY))[CONFIG_KEY] || {};
  }
  async function session() {
    return (await chrome.storage.session.get(SESSION_KEY))[SESSION_KEY] || {};
  }
  async function setSession(data) {await chrome.storage.session.set({[SESSION_KEY]: data});}
  function requireConfig(c) {
    if(!safeId(c.clientId) || !(safeId(c.tenant) || c.tenant === 'organizations')) throw new Error('Informe o Client ID e o Tenant ID do registro Microsoft Entra.');
    if(!emailValid(c.recipient)) throw new Error('Informe um destinatário de e-mail válido.');
    return c;
  }
  async function requestToken(tenant, data) {
    const response=await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams(data),cache:'no-store'
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok || !result.access_token) throw new Error('Autenticação Microsoft não concluída: '+String(result.error_description||result.error||response.status).slice(0,260));
    return result;
  }
  async function connect() {
    const c=requireConfig(await config());
    const verifier=enc64url(crypto.getRandomValues(new Uint8Array(32)));
    const challenge=enc64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
    const state=enc64url(crypto.getRandomValues(new Uint8Array(20)));
    const redirect=authRedirect();
    const authorization=new URL(`https://login.microsoftonline.com/${encodeURIComponent(c.tenant)}/oauth2/v2.0/authorize`);
    for(const [key,value] of Object.entries({client_id:c.clientId,response_type:'code',redirect_uri:redirect,response_mode:'query',scope:scopes,state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'})) authorization.searchParams.set(key,value);
    const result=await chrome.identity.launchWebAuthFlow({url:authorization.toString(),interactive:true});
    if(!result) throw new Error('Autorização cancelada.');
    const url=new URL(result);
    if(url.origin!==new URL(redirect).origin || url.pathname!==new URL(redirect).pathname || url.searchParams.get('state')!==state) throw new Error('Redirecionamento OAuth ou estado inválido.');
    const code=url.searchParams.get('code');
    if(!code) throw new Error('A Microsoft não autorizou a conexão: '+String(url.searchParams.get('error_description')||'sem código').slice(0,260));
    const token=await requestToken(c.tenant,{client_id:c.clientId,scope:scopes,code,redirect_uri:redirect,grant_type:'authorization_code',code_verifier:verifier});
    await setSession({accessToken:token.access_token,refreshToken:token.refresh_token||'',expiresAt:Date.now()+Math.max(0,(Number(token.expires_in)||3600)-90)*1000,clientId:c.clientId,tenant:c.tenant});
    return {ok:true,message:'Conta Microsoft conectada. Os tokens são mantidos somente na sessão deste navegador.'};
  }
  async function tokenFor(c) {
    const s=await session();
    if(s.clientId!==c.clientId || s.tenant!==c.tenant) throw new Error('Conecte novamente a conta Microsoft nas opções.');
    if(s.accessToken && Number(s.expiresAt)>Date.now()+30000) return s.accessToken;
    if(!s.refreshToken) throw new Error('Sessão Microsoft expirada. Reconecte nas opções.');
    const token=await requestToken(c.tenant,{client_id:c.clientId,scope:scopes,refresh_token:s.refreshToken,grant_type:'refresh_token'});
    await setSession({accessToken:token.access_token,refreshToken:token.refresh_token||s.refreshToken,expiresAt:Date.now()+Math.max(0,(Number(token.expires_in)||3600)-90)*1000,clientId:c.clientId,tenant:c.tenant});
    return token.access_token;
  }
  async function sendMail(subject,body,{manual=false}={}) {
    const c=requireConfig(await config());
    if(!manual && !(c.enabled===true && c.consent===true)) return {skipped:true,reason:'Alertas automáticos desativados.'};
    const bearer=await tokenFor(c);
    const response=await fetch('https://graph.microsoft.com/v1.0/me/sendMail',{
      method:'POST',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},
      body:JSON.stringify({message:{subject:String(subject).slice(0,200),body:{contentType:'Text',content:String(body).slice(0,10000)},toRecipients:[{emailAddress:{address:c.recipient}}]},saveToSentItems:true}),
      cache:'no-store'
    });
    if(response.status!==202) {
      const error=await response.text().catch(()=> '');
      throw new Error(`Microsoft Graph HTTP ${response.status}: `+error.replace(/Bearer\s+\S+/ig,'[oculto]').slice(0,260));
    }
    return {ok:true,accepted:true}; // HTTP 202 = aceito para envio, não entrega confirmada.
  }
  async function notify(record,items) {
    const c=await config();
    if(!c.enabled || !c.consent || !Array.isArray(items) || !items.length) return {skipped:true};
    const content=[`Processo judicial: ${String(record.number||'').replace(/\D/g,'')}`,`Verificação: ${new Date().toLocaleString('pt-BR')}`,'',...items.slice(0,20).map(item=>String(item).slice(0,500)),'','Notificação automática MTPrev. Verifique os autos oficiais antes de qualquer providência.'].join('\n');
    return sendMail(`MTPrev | ${items.length} nova(s) movimentação(ões) no processo ${String(record.number||'')}`,content);
  }
  async function status() {
    const c=await config(),s=await session();
    return {ok:true,configured:safeId(c.clientId)&&!!c.recipient,connected:s.clientId===c.clientId&&s.tenant===c.tenant&&!!(s.accessToken||s.refreshToken),enabled:c.enabled===true,redirect:authRedirect()};
  }
  chrome.runtime.onMessage.addListener((message,sender,respond)=>{
    if(!message?.type?.startsWith('MTPREV_MAIL_OAUTH_')) return false;
    if(sender.id!==chrome.runtime.id || sender.url!==settingsUrl) {respond({ok:false,error:'Acesso restrito às opções da extensão.'});return false;}
    const op=async()=>{
      if(message.type==='MTPREV_MAIL_OAUTH_CONNECT') return connect();
      if(message.type==='MTPREV_MAIL_OAUTH_STATUS') return status();
      if(message.type==='MTPREV_MAIL_OAUTH_DISCONNECT') {await chrome.storage.session.remove(SESSION_KEY);return {ok:true,message:'Sessão de e-mail desconectada.'};}
      if(message.type==='MTPREV_MAIL_OAUTH_TEST') {await sendMail('MTPrev | teste de notificação','Esta mensagem foi enviada por solicitação explícita nas opções do MTPrev.',{manual:true});return{ok:true,message:'Microsoft Graph aceitou a mensagem (HTTP 202). Confira a caixa de destino.'};}
      throw new Error('Ação desconhecida.');
    };
    op().then(respond,e=>respond({ok:false,error:e?.message||'Falha na autenticação OAuth.'}));return true;
  });
  globalThis.MTPrevWatchMail={notify,CONFIG_KEY};
})();
