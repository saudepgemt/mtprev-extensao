/* MTPrev — cache da leitura completa do SPA2 entre Gerencial, Triagem e Duplicados.
 * Guarda somente dados da mesa e filtros atuais no armazenamento privado da extensao.
 * Nao guarda cookies/tokens nem cria requisicoes em segundo plano.
 */
(() => {
  'use strict';
  if (globalThis.MTPrevWorkspaceCache) return;
  const SOURCE='SPA_CDSP_PAGE', REPLY='SPA_CDSP_EXTENSION_BRIDGE';
  const TTL_MS=10*60*1000;
  let active=null, nextId=0;
  const excluded = key => /(?:authenticity|csrf|token|password|secret|session|cookie|nonce)/i.test(key) || /^(?:page|per_page|offset|cursor|utf8|_token|_timestamp)$/i.test(key) || /^utm_/i.test(key);
  const params = items => items.filter(([key])=>!excluded(key)).map(([k,v])=>[String(k),String(v)]).sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1]));
  function scope(){
    if(!/^\/workspace\/?$/.test(location.pathname))return '';
    const url=new URL(location.href), form=document.querySelector('form.workspace-search');
    return JSON.stringify({version:1,origin:url.origin,path:url.pathname.replace(/\/$/,'')||'/workspace',userId:url.searchParams.get('user_id')||'',query:params([...url.searchParams.entries()]),filters:form?params([...new FormData(form).entries()]):[],endpoint:form?.getAttribute('data-partial-url')||''});
  }
  function request(type,payload,timeout=12000){
    return new Promise(resolve=>{
      const requestId='mtprev-workspace-cache-'+Date.now()+'-'+(++nextId);
      const listener=event=>{
        if(event.source!==window||event.origin!==location.origin)return;
        const data=event.data;
        if(data?.source!==REPLY||data.requestId!==requestId)return;
        clearTimeout(timer);window.removeEventListener('message',listener);
        resolve(data.response||{ok:false,error:data.error||'Resposta indisponivel'});
      };
      const timer=setTimeout(()=>{window.removeEventListener('message',listener);resolve({ok:false,error:'Cache indisponivel'});},timeout);
      window.addEventListener('message',listener);
      window.postMessage({source:SOURCE,type,requestId,...payload},location.origin);
    });
  }
  // Guardar somente metadados usados pelos relatórios; nunca textos de PDFs.
  const recordFields=new Set([
    'id','rowKey','processNumber','expedienteId','procedureId','assunto','actionClass',
    'origin','manifestationSuggested','distributionDate','jurisdiction','assessor',
    'party','processParties','judgingBody','tribunal','receivedText','knowledgeDateText',
    'deadlineDetails','observation','lastProgress','status','pjeDeadline','labels',
    'pendencyUrl','expedienteUrls','expedienteCount','tasks','metadataSource','readingScope',
    'recipient','recipientName','recipientId','partyId','relevantDate','deadlineStatus'
  ]);
  const scrubUrl=value=>{
    try{
      const url=new URL(String(value||''),location.href);
      if(url.protocol!=='https:'||url.origin!==location.origin)return '';
      for(const key of [...url.searchParams.keys()])if(excluded(key))url.searchParams.delete(key);
      url.hash='';return url.href;
    } catch(_){return '';}
  };
  function compactRecord(record){
    const result={};
    for(const [key,value] of Object.entries(record||{})){
      if(!recordFields.has(key))continue;
      if(key==='pendencyUrl')result[key]=scrubUrl(value);
      else if(key==='expedienteUrls')result[key]=Array.isArray(value)?value.map(scrubUrl).filter(Boolean):[];
      else if(key==='tasks')result[key]=Array.isArray(value)?value.map(t=>({kind:String(t.kind||''),url:scrubUrl(t.url),label:String(t.label||'')})).filter(t=>t.url):[];
      else if(Array.isArray(value))result[key]=value.filter(item=>typeof item==='string'||typeof item==='number').slice(0,60);
      else if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')result[key]=value;
    }
    return result;
  }
  function valid(entry,expectedScope){
    const total=globalThis.SpaAdapter?.workspaceCounts?.()?.total;
    return !!(entry?.version===1&&entry.scope===expectedScope&&entry.coverage?.reason==='complete'&&Array.isArray(entry.records)&&
      Number.isSafeInteger(entry.coverage.total)&&entry.coverage.total>0&&entry.records.length===entry.coverage.total&&
      Number.isSafeInteger(total)&&total===entry.coverage.total&&
      Number.isFinite(entry.savedAt)&&Date.now()-entry.savedAt>=0&&Date.now()-entry.savedAt<TTL_MS);
  }
  async function read(){
    const key=scope(); if(!key)return null;
    const response=await request('SPA_CDSP_WORKSPACE_CACHE_GET',{scope:key});
    return response?.ok&&valid(response.collection,key)?response.collection:null;
  }
  async function collect({signal,onProgress=()=>{},force=false}={}){
    const key=scope();
    if(!key) throw new Error('Cache compartilhado disponivel apenas na mesa do SPA2.');
    if(signal?.aborted) throw new DOMException('Leitura interrompida','AbortError');
    if(!force){
      const cached=await read().catch(()=>null);
      if(cached&&scope()===key){
        onProgress({count:cached.coverage.total,total:cached.coverage.total,rounds:cached.coverage.pages||0,pages:cached.coverage.pages||0,stage:'cache',fromCache:true});
        return {records:cached.records,reason:'complete',count:cached.coverage.total,total:cached.coverage.total,fromCache:true,cacheAgeMs:Date.now()-cached.savedAt,generatedAt:cached.savedAt,apiMetrics:cached.apiMetrics||null};
      }
    }
    if(active && active.scope===key && !force) return active.promise;
    const adapter=globalThis.SpaAdapter;
    if(!adapter?.collectWorkspaceRecords) throw new Error('Leitor SPA2 indisponivel. Recarregue a extensao.');
    const job={scope:key,promise:null};active=job;
    job.promise=(async()=>{
      const startedAt=Date.now();
      const result=await adapter.collectWorkspaceRecords({signal,onProgress});
      if(result?.reason==='complete'&&result.records?.length===result.total&&scope()===key){
        const collection={version:1,scope:key,savedAt:Date.now(),coverage:{reason:'complete',total:result.total,count:result.records.length,pages:result.pages||0},apiMetrics:result.apiMetrics||null,records:result.records.map(compactRecord)};
        const response=await request('SPA_CDSP_WORKSPACE_CACHE_SAVE',{scope:key,payload:collection},15000).catch(()=>null);
        result.cacheSaved=response?.ok===true;
      }
      result.collectionDurationMs=Date.now()-startedAt;
      return result;
    })();
    try{return await job.promise;}finally{if(active===job)active=null;}
  }
  globalThis.MTPrevWorkspaceCache=Object.freeze({scope,read,collect,TTL_MS});
})();
