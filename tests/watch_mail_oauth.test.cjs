const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const script=fs.readFileSync(path.resolve(__dirname,'../js/watch_mail_oauth.js'),'utf8');
test('OAuth prepara PKCE, guarda somente tokens de sessão e só envia mediante opt-in',async()=>{
  const CONFIG='MTPREV_WATCH_MAIL_OAUTH_CONFIG_V1';
  let urlCalled='', graphCalls=0, local={}, inSession={};
  let listener;
  const chrome={runtime:{id:'abcde',getURL:file=>`chrome-extension://abcde/${file}`,onMessage:{addListener:fn=>listener=fn}},
    identity:{getRedirectURL:path=>`https://abcde.chromiumapp.org/${path}`,launchWebAuthFlow:async({url})=>{urlCalled=url;const request=new URL(url);assert.equal(request.searchParams.get('code_challenge_method'),'S256');return `https://abcde.chromiumapp.org/mtprev-mail?code=fake-code&state=${request.searchParams.get('state')}`;}},
    storage:{local:{get:async key=>({[key]:local[key]}),set:async value=>Object.assign(local,value)},session:{get:async key=>({[key]:inSession[key]}),set:async value=>Object.assign(inSession,value),remove:async key=>delete inSession[key]}}
  };
  const fetch=async url=>{
    if(String(url).includes('/token'))return {ok:true,json:async()=>({access_token:'FAKE_TOKEN',refresh_token:'FAKE_REFRESH',expires_in:3600})};
    if(String(url).includes('/sendMail')){graphCalls++;return {status:202};}
    throw new Error('Unexpected URL '+url);
  };
  const context=vm.createContext({chrome,crypto:webcrypto,URL,URLSearchParams,Uint8Array,TextEncoder,fetch,btoa,Date,console});
  vm.runInContext(script,context);
  local[CONFIG]={clientId:'00000000-1111-2222-3333-444444444444',tenant:'00000000-1111-2222-3333-444444444444',recipient:'alerta@example.org',enabled:false,consent:false};
  const message=(type)=>new Promise(resolve=>listener({type},{id:'abcde',url:'chrome-extension://abcde/options.html'},resolve));
  const connected=await message('MTPREV_MAIL_OAUTH_CONNECT');
  assert.equal(connected.ok,true);
  assert.match(urlCalled,/code_challenge=/);
  assert.equal(!!inSession.MTPREV_WATCH_MAIL_OAUTH_SESSION_V1.accessToken,true);
  assert.equal(JSON.stringify(local).includes('FAKE_TOKEN'),false);
  const skipped=await context.MTPrevWatchMail.notify({number:'12345678901234567890'},['Novo andamento']);
  assert.equal(skipped.skipped,true);
  assert.equal(graphCalls,0);
  local[CONFIG].enabled=true;local[CONFIG].consent=true;
  const sent=await context.MTPrevWatchMail.notify({number:'12345678901234567890'},['Novo andamento']);
  assert.equal(sent.accepted,true);
  assert.equal(graphCalls,1);
});
