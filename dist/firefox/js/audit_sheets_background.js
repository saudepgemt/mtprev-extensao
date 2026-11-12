/* Google Sheets: fila durável, autorização individual e gravação somente em RAW. */
(() => {
  'use strict';
  if(globalThis.MTPrevAuditService)return;
  const C=globalThis.MTPrevAuditCore;
  const CONFIG='MTPREV_AUDIT_CONFIG_V1',DATA='MTPREV_AUDIT_QUEUE_V1';
  const SCOPE='https://www.googleapis.com/auth/spreadsheets';
  let writing=Promise.resolve(),syncing=null;
  const serial=fn=>{const next=writing.then(fn,fn);writing=next.catch(()=>{});return next;};
  const config=async()=>({enabled:false,event:'Minuta enviada ao(à) procurador(a)',...(await chrome.storage.local.get(CONFIG))[CONFIG]});
  const state=async()=>({pending:[],lastSync:'',lastError:'',...(await chrome.storage.local.get(DATA))[DATA]});
  async function token(interactive=false){
    if(typeof chrome.identity?.getAuthToken!=='function')throw Error('Conexão Google disponível no Chrome/Edge com OAuth configurado.');
    const result=await chrome.identity.getAuthToken({interactive,scopes:[SCOPE,'https://www.googleapis.com/auth/userinfo.email']});
    const value=typeof result==='string'?result:result?.token;if(!value)throw Error('Google não forneceu autorização para a planilha.');return value;
  }
  async function api(path,{method='GET',body,interactive=false}={}){
    const access=await token(interactive);
    const response=await fetch('https://sheets.googleapis.com/v4/spreadsheets/'+C.SPREADSHEET_ID+path,{method,headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000),cache:'no-store'});
    if(!response.ok){
      if(response.status===401)await chrome.identity.removeCachedAuthToken({token:access}).catch(()=>{});
      throw Error(`Google Sheets HTTP ${response.status}. ${response.status===403?'Confira o acesso à planilha, a Sheets API e a autorização OAuth.':response.status===401?'Reconecte a conta Google.':'A fila local foi preservada.'}`);
    }
    return response.json();
  }
  const column=n=>{let result='';for(;n;n=Math.floor((n-1)/26))result=String.fromCharCode(65+(n-1)%26)+result;return result;};
  async function read(sheet){
    const result=[],width=C.HEADERS[sheet].length;
    const meta=await api('?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))');
    const properties=meta.sheets?.find(s=>s.properties.title===sheet)?.properties;
    if(!properties)throw Error('Aba não encontrada: '+sheet);
    const count=properties.gridProperties.rowCount;
    if(count>100000)throw Error('A planilha excede o limite de leitura de 100 mil linhas por aba. É necessário arquivar o histórico.');
    for(let start=1;start<=count;start+=500){
      const range=`'${sheet}'!A${start}:${column(width)}${Math.min(start+499,count)}`;
      const page=await api('/values/'+encodeURIComponent(range)+'?valueRenderOption=UNFORMATTED_VALUE');
      result.push(...(page.values||[]));
    }
    if(!result.length||C.HEADERS[sheet].some((key,i)=>result[0][i]!==key))throw Error('Cabeçalhos incompatíveis na aba '+sheet+'. Não foram alterados.');
    return C.fromValues(sheet,result.slice(1));
  }
  async function capture(sheet,rows){
    if(!(await config()).enabled)return {skipped:true,pending:0};
    if(!Array.isArray(rows)||rows.length>100)throw Error('Envie até 100 registros por lote de sincronização.');
    const c=await config();
    const normalized=rows.map(row=>{
      const valid=C.normalizeEvent(sheet,row);
      if(sheet==='Produtividade'){
        if(C.eventKey(valid.evento)!==C.eventKey(c.event))throw Error('Evento diferente da regra configurada.');
        valid.usuario_registro=c.account||'';
      }else if(!valid.operador)valid.operador=c.account?c.account+' (conta Google)':'';
      return valid;
    });
    return serial(async()=>{
      const data=await state(),keys=new Set(data.pending.map(item=>item.sheet+'|'+item.row.event_id));
      for(const row of normalized)if(!keys.has(sheet+'|'+row.event_id)){data.pending.push({sheet,row});keys.add(sheet+'|'+row.event_id);}
      if(data.pending.length>20000)throw Error('Fila local cheia. Sincronize antes de importar novos registros.');
      await chrome.storage.local.set({[DATA]:data});
      chrome.alarms.create('mtprev-audit-sync',{delayInMinutes:1,periodInMinutes:5});
      return {pending:data.pending.length};
    });
  }
  async function sync(){
    if(syncing)return syncing;
    syncing=(async()=>{
      const c=await config();if(!c.enabled)throw Error('Habilite a integração nas configurações.');
      try{
        for(const sheet of Object.keys(C.HEADERS)){
          const pending=(await state()).pending.filter(item=>item.sheet===sheet);
          if(!pending.length)continue;
          const remote=new Set((await read(sheet)).map(row=>row.event_id));
          for(let offset=0;offset<pending.length;offset+=100){
            const chunk=pending.slice(offset,offset+100),newRows=chunk.filter(item=>!remote.has(item.row.event_id));
            if(newRows.length){
              const values=newRows.map(item=>C.HEADERS[sheet].map(key=>item.row[key]??''));
              await api('/values/'+encodeURIComponent(`'${sheet}'!A:${column(C.HEADERS[sheet].length)}`)+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',{method:'POST',body:{majorDimension:'ROWS',values}});
              newRows.forEach(item=>remote.add(item.row.event_id));
            }
            const sent=new Set(chunk.map(item=>item.row.event_id));
            await serial(async()=>{const data=await state();data.pending=data.pending.filter(item=>item.sheet!==sheet||!sent.has(item.row.event_id));data.lastError='';data.lastSync=new Date().toISOString();await chrome.storage.local.set({[DATA]:data});});
          }
        }
        return {ok:true,...await status()};
      }catch(error){await serial(async()=>{const data=await state();data.lastError=String(error.message);await chrome.storage.local.set({[DATA]:data});});throw error;}
    })();
    try{return await syncing;}finally{syncing=null;}
  }
  async function status(){const c=await config(),s=await state();return {config:c,pending:s.pending.length,lastSync:s.lastSync,lastError:s.lastError};}
  async function connect(){
    const access=await token(true);
    const response=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+access},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('Google não confirmou a identidade da conta.');
    const profile=await response.json();if(!profile.email||profile.email_verified!==true)throw Error('E-mail Google não verificado.');
    await read('Produtividade');await read('Protocolos');
    await chrome.storage.local.set({[CONFIG]:{...await config(),account:profile.email}});
    return {ok:true,...await status()};
  }
  async function data(){
    const c=await config();if(!c.enabled)throw Error('Habilite a integração com a planilha nas configurações.');
    return {ok:true,config:c,Produtividade:await read('Produtividade'),Protocolos:await read('Protocolos'),...await status()};
  }
  globalThis.MTPrevAuditService=Object.freeze({capture,sync,status,config});
  chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='mtprev-audit-sync')void sync().catch(()=>{});});
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(!message?.type?.startsWith('MTPREV_AUDIT_'))return false;
    const own=sender.url===chrome.runtime.getURL('options.html');
    let spa=false;try{const url=new URL(sender.url||'');spa=url.protocol==='https:'&&['spa.pge.mt.gov.br','pge.mt.spa.coreplan.com.br'].includes(url.hostname);}catch(_){}
    if(!own&&!spa){reply({ok:false,error:'Origem não autorizada.'});return false;}
    (async()=>{
      switch(message.type){
        case 'MTPREV_AUDIT_STATUS':return {ok:true,...await status()};
        case 'MTPREV_AUDIT_DATA':return data();
        case 'MTPREV_AUDIT_SYNC':await sync();return {ok:true,...await status()};
        case 'MTPREV_AUDIT_CAPTURE':{
          if(!spa)throw Error('Registros devem vir de uma página SPA.');
          const rows=Array.isArray(message.rows)?message.rows:[];
          for(const row of rows)if(new URL(row.origem_spa).origin!==new URL(sender.url).origin)throw Error('Origem do registro difere da página.');
          return {ok:true,...await capture(message.sheet,rows)};
        }
        case 'MTPREV_AUDIT_CONNECT':if(!own)throw Error('Conecte pelas configurações.');return connect();
        case 'MTPREV_AUDIT_SAVE':{
          if(!own)throw Error('Altere as preferências pelas configurações.');
          const c=await config();if(message.enabled&&!c.account)throw Error('Conecte a conta Google antes de habilitar.');
          if(message.event&&!C.EVENTS.includes(message.event))throw Error('Evento não reconhecido.');
          await chrome.storage.local.set({[CONFIG]:{...c,enabled:message.enabled===true,event:message.event||''}});
          return {ok:true,...await status()};
        }
        default:throw Error('Comando de auditoria não reconhecido.');
      }
    })().then(reply,error=>reply({ok:false,error:error.message}));return true;
  });
})();
