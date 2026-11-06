'use strict';
// OAuth individual do MCP/PJe (derivado da implementação CDSP 3.0.34).
// Sem senhas privadas embutidas. Ativado somente após autorização explícita em Configurações.
const mtprevPjeOrigin='https://pje-mcp-worker-tjmt.joaooliveira.workers.dev';
const mtprevPjeResource=`${mtprevPjeOrigin}/mcp/individual`;
const mtprevPjeIssuer=`${mtprevPjeOrigin}/oauth/individual`;
let mtprevPjeAuthPending;
function mtprevPjeBase64Url(bytes){
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function mtprevPjeRandom(size=32){const bytes=new Uint8Array(size);crypto.getRandomValues(bytes);return mtprevPjeBase64Url(bytes);}
function mtprevPjeAuthDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('mtprev-pje-individual-oauth',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('sessions');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('Não foi possível acessar a sessão do PJe neste navegador.'));
  });
}
async function mtprevPjeAuthStorage(mode,value){
  const db=await mtprevPjeAuthDb();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('sessions',mode==='get'?'readonly':'readwrite');
    const request=mode==='get'?tx.objectStore('sessions').get('individual'):
      mode==='delete'?tx.objectStore('sessions').delete('individual'):
        tx.objectStore('sessions').put(value,'individual');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('Não foi possível guardar a sessão do PJe.'));
    tx.onerror=()=>reject(new Error('Não foi possível guardar a sessão do PJe.'));
  });}finally{db.close();}
}
async function mtprevPjeAuthRequest(path,body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  let response;
  try{response=await fetch(`${mtprevPjeIssuer}/${path}`,{method:'POST',redirect:'error',signal:controller.signal,headers:{
    'Content-Type':body instanceof URLSearchParams?'application/x-www-form-urlencoded':'application/json',
    Accept:'application/json'},body:body instanceof URLSearchParams?body.toString():JSON.stringify(body)});}
  catch(error){throw new Error(error.name==='AbortError'?'O MCP demorou para responder à autenticação. Tente novamente.':
    'Não foi possível conectar ao MCP para autenticar. Confira sua rede e tente novamente.');}
  finally{clearTimeout(timer);}
  let data;try{data=await response.json();}catch{data={};}
  if(!response.ok){
    const error=new Error(path==='register'&&response.status===400?
      'O acesso ao PJe ainda não foi habilitado para esta extensão. Avise o responsável pela extensão.':
      data.message||data.error_description||`O MCP recusou a autenticação (HTTP ${response.status}).`);
    error.status=response.status;error.code=data.error||data.code||'';throw error;
  }
  return data;
}
function mtprevPjeAuthSaveToken(previous,token){
  if(token.token_type!=='Bearer'||typeof token.access_token!=='string'||!token.access_token||
    !Number.isFinite(Number(token.expires_in))||Number(token.expires_in)<=0)throw new Error('O MCP não devolveu um token OAuth válido.');
  return {...previous,accessToken:token.access_token,
    refreshToken:token.refresh_token||previous.refreshToken||'',
    expiresAt:Date.now()+Number(token.expires_in)*1000};
}
async function mtprevPjeAuthRefresh(saved){
  const form=new URLSearchParams({grant_type:'refresh_token',refresh_token:saved.refreshToken,
    client_id:saved.clientId,resource:mtprevPjeResource});
  const token=await mtprevPjeAuthRequest('token',form);
  if(!token.refresh_token)throw new Error('O MCP não devolveu a renovação da sessão individual.');
  const next=mtprevPjeAuthSaveToken(saved,token);await mtprevPjeAuthStorage('put',next);return next;
}
async function mtprevPjeAuthLogin(saved){
  if(!chrome.identity?.launchWebAuthFlow)throw new Error('Este Chrome não disponibilizou a janela de autenticação da extensão.');
  const redirectUri=chrome.identity.getRedirectURL('mni-pje');
  if(!/^https:\/\/[a-p]{32}\.chromiumapp\.org\/mni-pje$/.test(redirectUri))throw new Error('Retorno OAuth da extensão inválido.');
  let clientId=saved?.clientId;
  if(!clientId){
    const client=await mtprevPjeAuthRequest('register',{redirect_uris:[redirectUri],
      token_endpoint_auth_method:'none'});
    if(!/^client_[A-Za-z0-9_-]+$/.test(client.client_id||''))throw new Error('O MCP não cadastrou a extensão como cliente OAuth.');
    clientId=client.client_id;
    saved={...saved,clientId};await mtprevPjeAuthStorage('put',saved);
  }
  const verifier=mtprevPjeRandom(32),state=mtprevPjeRandom(32);
  const challenge=mtprevPjeBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  const authorize=new URL(`${mtprevPjeIssuer}/authorize`);
  for(const[key,value]of Object.entries({response_type:'code',client_id:clientId,redirect_uri:redirectUri,
    scope:'pje:read offline_access',resource:mtprevPjeResource,code_challenge:challenge,
    code_challenge_method:'S256',state}))authorize.searchParams.set(key,value);
  let finalUrl;
  try{finalUrl=await chrome.identity.launchWebAuthFlow({url:authorize.href,interactive:true});}
  catch(error){throw new Error(/cancel|closed|fechad|abort/i.test(String(error?.message))?
    'A autenticação do PJe foi cancelada. Tente novamente na aba em que iniciou a consulta.':
    `Não foi possível concluir a janela de autenticação: ${error.message}`);}
  if(!finalUrl)throw new Error('A janela de autenticação foi fechada antes da autorização.');
  const callback=new URL(finalUrl);
  if(callback.origin!==new URL(redirectUri).origin||callback.pathname!==new URL(redirectUri).pathname||
    callback.searchParams.get('state')!==state||callback.searchParams.get('iss')!==mtprevPjeIssuer)
    throw new Error('O retorno OAuth do PJe não passou na conferência de segurança.');
  if(callback.searchParams.has('error'))throw new Error('O acesso ao PJe não foi autorizado. Confira seu cadastro no portal.');
  const code=callback.searchParams.get('code');
  if(!code)throw new Error('O MCP não devolveu o código de autorização.');
  const form=new URLSearchParams({grant_type:'authorization_code',code,client_id:clientId,
    redirect_uri:redirectUri,code_verifier:verifier,resource:mtprevPjeResource});
  const token=await mtprevPjeAuthRequest('token',form);
  const next=mtprevPjeAuthSaveToken(saved,token);await mtprevPjeAuthStorage('put',next);return next;
}
async function mtprevPjeAuthAccess({forceRefresh=false}={}){
  if(mtprevPjeAuthPending)return mtprevPjeAuthPending;
  mtprevPjeAuthPending=(async()=>{
    let saved=await mtprevPjeAuthStorage('get');
    if(!forceRefresh&&saved?.accessToken&&saved.expiresAt>Date.now()+60000)return saved.accessToken;
    if(saved?.refreshToken){
      try{return(await mtprevPjeAuthRefresh(saved)).accessToken;}
      catch(error){
        if(error.status!==400&&error.status!==401)throw error;
        saved={clientId:saved.clientId};await mtprevPjeAuthStorage('put',saved);
      }
    }
    return(await mtprevPjeAuthLogin(saved)).accessToken;
  })();
  try{return await mtprevPjeAuthPending;}finally{mtprevPjeAuthPending=null;}
}
async function mtprevPjeAuthInvalidateAccess(){
  const saved=await mtprevPjeAuthStorage('get');
  if(saved){saved.accessToken='';saved.expiresAt=0;await mtprevPjeAuthStorage('put',saved);}
}

// Interface restrita ao service worker da extensão MTPrev.
async function mtprevPjeAuthDisconnect(){ await mtprevPjeAuthStorage('delete'); }
async function mtprevPjeAuthStatus(){
  const saved=await mtprevPjeAuthStorage('get');
  return { connected: Boolean(saved?.refreshToken || (saved?.accessToken && saved.expiresAt>Date.now())),
    expiresAt: saved?.expiresAt || 0 };
}
globalThis.MTPrevPjeIndividualAuth = Object.freeze({
  resource: mtprevPjeResource, access: mtprevPjeAuthAccess,
  invalidate: mtprevPjeAuthInvalidateAccess, disconnect: mtprevPjeAuthDisconnect,
  status: mtprevPjeAuthStatus
});
