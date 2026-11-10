"use strict";

// Configuração MCP/PJe: uma única origem HTTPS autorizada, consentimento explícito
// e teste que consulta as ferramentas disponíveis sem consultar qualquer processo.
(() => {
  const KEY = "MTPREV_SERVICE_SETTINGS";
  const $ = id => document.getElementById(id);
  const endpoint = $("endpoint");
  const consent = $("consent");
  const status = $("status");
  const indicator = $("mcp-connection-state");
  const form = $("service-form");
  const transfer = globalThis.MTPrevMcpSettings;
  const importFile = $("import-service-file");
  const BASE = "https://pje-mcp-worker-tjmt.joaooliveira.workers.dev/";

  function show(message, error = false) {
    status.dataset.error = String(error);
    status.textContent = message;
  }
  function state(message, connected) {
    indicator.textContent = message;
    indicator.dataset.connected = String(connected);
  }
  async function save(value) {
    const buttons = [...form.querySelectorAll("button")];
    buttons.forEach(button => { button.disabled = true; });
    try {
      await chrome.storage.local.set({[KEY]: value || {consent:false,endpoint:""}});
      if (!value) {
        endpoint.value = "";
        consent.checked = false;
        state("Desativado", false);
        show("MCP desativado e endereço apagado neste navegador.");
      } else {
        state("Salvo · não testado", true);
        show("Configuração salva. Clique em Testar conexão para confirmar o serviço MCP.");
      }
      return true;
    } catch (_) {
      show("Não foi possível salvar o MCP no armazenamento da extensão.", true);
      return false;
    } finally {
      buttons.forEach(button => { button.disabled = false; });
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const url = transfer.normalizeEndpoint(endpoint.value);
      if (!consent.checked) throw new Error("Marque a autorização antes de ativar a consulta.");
      await save({endpoint:url,consent:true,consentVersion:1,authorizedAt:new Date().toISOString()});
    } catch (error) {
      show(error?.message || "Confira o endereço HTTPS e a autorização.", true);
    }
  });
  $("default-service").addEventListener("click", () => {
    endpoint.value = BASE;
    consent.checked = false;
    show("Endereço-base preenchido. Confirme com o administrador se esse serviço aceita sua conexão; autorize e salve para testar.");
    state("Não autorizado", false);
    endpoint.focus();
  });
  $("reveal-service").addEventListener("click", event => {
    const visible = endpoint.type === "text";
    endpoint.type = visible ? "password" : "text";
    event.currentTarget.textContent = visible ? "Mostrar" : "Ocultar";
    event.currentTarget.setAttribute("aria-pressed", String(!visible));
  });
  $("disable-service").addEventListener("click", async () => {
    if (window.confirm("Desativar a integração MCP/PJe e apagar seu endereço neste computador?")) await save(null);
  });
  $("test-service").addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    state("Testando…", false);
    show("Conferindo a conexão MCP sem consultar processos…");
    try {
      const result = await chrome.runtime.sendMessage({type:"MTPREV_SERVICE_TEST"});
      if (result?.ok) {state("Conexão aprovada", true);show(result.message || "Servidor MCP respondeu corretamente.");}
      else {state("Falha no teste", false);show(result?.error || "Serviço indisponível; confira o endereço salvo.", true);}
    } catch (_) {
      state("Falha no teste", false);
      show("Falha na comunicação com a extensão. Recarregue a página de Configurações.", true);
    } finally { button.disabled = false; }
  });
  $("export-service").addEventListener("click", async () => {
    let downloadUrl;
    try {
      await ready;
      const saved = (await chrome.storage.local.get(KEY))[KEY];
      if (!saved?.endpoint || saved.consent !== true) throw new Error("Salve e autorize o MCP antes de exportar.");
      const contents = JSON.stringify(transfer.createBackup(saved.endpoint), null, 2) + "\n";
      downloadUrl = URL.createObjectURL(new Blob([contents],{type:"application/json"}));
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "mtprev-mcp-settings.json";
      document.body.append(link);
      link.click();link.remove();
      show("Configuração MCP exportada. O arquivo pode conter dados de acesso; guarde-o em local seguro.");
    } catch (error) {show(error?.message || "Falha ao exportar o MCP.", true);}
    finally {if (downloadUrl) setTimeout(() => URL.revokeObjectURL(downloadUrl),1000);}
  });
  $("import-service").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    try {
      await ready;
      if (file.size > 16384) throw new Error("Arquivo muito grande. Selecione um arquivo de configuração MCP.");
      const url = transfer.parseBackup(await file.text());
      endpoint.value = url;
      consent.checked = false;
      state("Importado · não autorizado", false);
      show("Importado. Revise o endereço, marque a autorização e clique em Salvar e autorizar MCP.");
    } catch (error) {show(error?.message || "Arquivo de importação inválido.", true);}
    finally {importFile.value="";}
  });
  // Conexão individual PJe/MCP: recurso alternativo da CDSP, independente de Gmail.
  const individualStatus=$('pje-individual-status');
  const connectButton=$('pje-individual-connect');
  const disconnectButton=$('pje-individual-disconnect');
  const updateIndividualStatus=async()=>{
    try {
      const response=await chrome.runtime.sendMessage({type:'MTPREV_PJE_INDIVIDUAL_STATUS'});
      if (!response?.ok) throw new Error(response?.error||'Sem resposta da extensão.');
      const active=response.mode==='individual' && response.connected;
      individualStatus.textContent=active
        ? 'Conta individual conectada. Consultas PJe usam a sessão autorizada.'
        : response.mode==='individual'
          ? 'A sessão individual expirou. Conecte novamente.'
          : 'Conexão individual não ativada. Permanece a configuração MCP tradicional.';
      connectButton.disabled=active;
      disconnectButton.disabled=response.mode!=='individual' && !response.connected;
    } catch (error) {individualStatus.textContent=error?.message||'Não foi possível verificar a sessão.';}
  };
  connectButton.addEventListener('click',async()=>{
    connectButton.disabled=true;
    individualStatus.textContent='Abrindo autorização individual no navegador…';
    try {
      const result=await chrome.runtime.sendMessage({type:'MTPREV_PJE_INDIVIDUAL_CONNECT'});
      if(!result?.ok) throw new Error(result?.error||'Não foi possível conectar.');
      individualStatus.textContent='Conta autorizada no servidor MCP. Use Testar conexão para confirmar o acesso ao PJe.';
    } catch (error) {individualStatus.textContent=error?.message||'Autorização não concluída.';}
    finally {await updateIndividualStatus();}
  });
  disconnectButton.addEventListener('click',async()=>{
    if(!window.confirm('Desconectar sua sessão individual do PJe neste navegador?')) return;
    const result=await chrome.runtime.sendMessage({type:'MTPREV_PJE_INDIVIDUAL_DISCONNECT'});
    individualStatus.textContent=result?.ok?'Sessão individual encerrada neste computador.':result?.error||'Não foi possível encerrar a sessão.';
    await updateIndividualStatus();
  });
  void updateIndividualStatus();
  const ready = chrome.storage.local.get(KEY).then(data => {
    const saved = data[KEY] || {};
    endpoint.value = saved.endpoint || "";
    consent.checked = saved.consent === true;
    if (saved.endpoint && saved.consent === true) {
      state("Autorizado · não testado", true);
      show("Endereço salvo. Use Testar conexão para confirmar a disponibilidade.");
    } else {
      state("Desativado", false);
      show("MCP opcional desativado. O SPA continua disponível sem esta integração.");
    }
  }).catch(() => {state("Falha de leitura", false);show("Não foi possível carregar as configurações MCP.", true);});
})();
