/* MTPrev — Gmail API para alertas processuais.
 * OAuth da extensão Chrome (chrome.identity): nenhuma senha nem token no SPA.
 * ATENÇÃO: execução apenas no perfil que autorizou o remetente; sem backend 24h.
 */
(() => {
  'use strict';
  const CONFIG_KEY = 'MTPREV_WATCH_GMAIL_CONFIG_V1';
  const SCOPE = 'https://www.googleapis.com/auth/gmail.send';
  const EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
  const EMAIL_RE = /^[^\s@<>;,\r\n]+@[^\s@<>;,\r\n]+\.[^\s@<>;,\r\n]+$/;
  const maxRecipients = 40;
  const cleanEmail = value => String(value || '').trim().toLowerCase();
  function parseEmails(value) {
    const values = Array.isArray(value) ? value : String(value || '').split(/[\n,;]+/);
    const unique = new Set();
    for (const raw of values) {
      const mail = cleanEmail(raw);
      if (!mail) continue;
      if (!EMAIL_RE.test(mail) || mail.length > 254) throw new Error('Endereço de e-mail inválido: ' + mail.slice(0, 100));
      unique.add(mail);
    }
    if (unique.size > maxRecipients) throw new Error(`Limite de ${maxRecipients} destinatários por grupo.`);
    return [...unique];
  }
  async function config() { return (await chrome.storage.local.get(CONFIG_KEY))[CONFIG_KEY] || {}; }
  function clientReady() {
    const clientId = chrome.runtime.getManifest()?.oauth2?.client_id || '';
    return /^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(clientId);
  }
  function requireSender(c) {
    const sender = cleanEmail(c.sender);
    if (!EMAIL_RE.test(sender)) throw new Error('Informe o e-mail institucional remetente nas configurações.');
    if (!clientReady()) throw new Error('Falta inserir o Client ID OAuth do Google Cloud em manifest.json (campo oauth2.client_id).');
    return sender;
  }
  async function getToken(interactive = false) {
    const result = await chrome.identity.getAuthToken({ interactive });
    const token = typeof result === 'string' ? result : result?.token;
    if (!token) throw new Error('O Google não forneceu token. Confira o OAuth e o ID da extensão.');
    return token;
  }
  async function profileEmail(token) {
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {Authorization: `Bearer ${token}`}, cache: 'no-store'
    });
    if (!response.ok) throw new Error('Não foi possível verificar a identidade do remetente Google (HTTP ' + response.status + ').');
    const info = await response.json();
    if (!info.email || info.email_verified !== true) throw new Error('Google não confirmou o endereço do remetente.');
    return cleanEmail(info.email);
  }
  async function authorizedToken(c, interactive = false) {
    const expected = requireSender(c);
    const token = await getToken(interactive);
    const actual = await profileEmail(token);
    if (actual !== expected) {
      await chrome.identity.removeCachedAuthToken({token}).catch(() => {});
      throw new Error(`A conta Google conectada (${actual}) difere do remetente configurado (${expected}).`);
    }
    return token;
  }
  async function connect() {
    const c = await config();
    if (c.deliveryMode === 'manual') throw new Error('Modo manual selecionado: não precisa conectar o Gmail.');
    await authorizedToken(c, true);
    return {ok: true, message: `Google autorizado para envio como ${cleanEmail(c.sender)}. O acesso fica neste perfil do Chrome.`};
  }
  async function disconnect() {
    await chrome.identity.clearAllCachedAuthTokens();
    return {ok:true, message:'Autorização do Google desconectada neste perfil do Chrome.'};
  }
  function recipientsFor(c, record) {
    const defaults = parseEmails(c.defaults || []);
    const extra = parseEmails(record?.mail?.extra || []);
    const excluded = new Set(parseEmails(record?.mail?.excluded || []));
    if (record?.mail?.enabled === false) return [];
    const result = [...new Set([...defaults, ...extra])].filter(address => !excluded.has(address));
    if (result.length > maxRecipients) throw new Error(`No máximo ${maxRecipients} destinatários por processo.`);
    return result;
  }
  function base64url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  function mime64(value) {
    const bytes = new TextEncoder().encode(String(value).slice(0, 75000));
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary).match(/.{1,76}/g)?.join('\r\n') || '';
  }
  function buildRaw(sender, to, subject, payload) {
    const safeSubject = String(subject).replace(/[\r\n]/g, ' ').slice(0, 240);
    // RFC 2047: encoded-words curtas para nomes/assuntos longos com acentos.
    const parts = [];
    let word = '';
    for (const char of safeSubject) {
      const trial = word + char;
      if (new TextEncoder().encode(trial).length > 36 && word) {parts.push(word); word = char;}
      else word = trial;
    }
    if (word) parts.push(word);
    const subj = parts.map(part => '=?UTF-8?B?' + btoa(String.fromCharCode(...new TextEncoder().encode(part))) + '?=').join('\r\n ');
    const text = typeof payload === 'object' ? payload.plain : String(payload);
    const html = typeof payload === 'object' ? payload.html : null;
    const boundary = 'mtprev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
    const message = [
      `To: ${sender}`,
      `Bcc: ${to.join(', ')}`,
      `Subject: ${subj}`,
      'MIME-Version: 1.0',
      ...(html ? [`Content-Type: multipart/alternative; boundary="${boundary}"`, '',
        `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', mime64(text),
        `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', mime64(html),
        `--${boundary}--`, '']
      : ['Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', mime64(text), ''])
    ].join('\r\n');
    return base64url(new TextEncoder().encode(message));
  }
  async function send(c, recipients, subject, payload, {manual = false} = {}) {
    if (c.deliveryMode === 'manual') return {skipped:true, reason:'Modo de e-mail manual: nenhum envio automático é realizado.'};
    if (!manual && !(c.enabled === true && c.consent === true)) return {skipped:true, reason:'Alertas automáticos desativados.'};
    if (c.consent !== true) throw new Error('Confirme a autorização para transmitir informações via Gmail API antes do envio.');
    if (!recipients.length) return {skipped:true, reason:'Nenhum destinatário habilitado para este processo.'};
    const raw = buildRaw(requireSender(c), recipients, subject, payload);
    let token = await authorizedToken(c, false);
    const post = () => fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method:'POST', headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'},
      body:JSON.stringify({raw}), cache:'no-store'
    });
    let response = await post();
    if (response.status === 401) {
      await chrome.identity.removeCachedAuthToken({token});
      token = await authorizedToken(c, false);
      response = await post();
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Gmail API HTTP ${response.status}: ${String(error?.error?.message || 'verifique permissões e conta remetente').slice(0, 180)}`);
    }
    const sent = await response.json().catch(() => ({}));
    if (!sent.id) throw new Error('A Gmail API não confirmou o identificador da mensagem enviada.');
    return {ok:true, accepted:true, provider:'Gmail', messageId:sent.id, count:recipients.length};
  }
  function template(record, items, test = false) {
    const builder = globalThis.MTPrevMailTemplate?.build;
    if (!builder) throw new Error('Modelo HTML de notificações não foi carregado.');
    return builder(record, items, {test});
  }
  async function notify(record, items) {
    const c = await config();
    if (c.deliveryMode === 'manual') return {skipped:true,reason:'Rascunhos manuais não são enviados em segundo plano.'};
    if (!c.enabled || !c.consent || !Array.isArray(items) || !items.length) return {skipped:true};
    const to = recipientsFor(c, record);
    const content = template(record, items);
    return send(c, to, content.subject, content);
  }
  async function preview(record) {
    const c = await config();
    const content = record ? template(record, [], true) : null;
    return {ok:true, recipients:recipientsFor(c, record), sender:cleanEmail(c.sender), deliveryMode:c.deliveryMode === 'manual' ? 'manual' : 'oauth', consent:c.consent === true,
      enabled:c.enabled === true, clientReady:clientReady(), processNumber:record?.number || null,
      movementAvailable:content?.hasMovement || false, subject:content?.subject || ''};
  }
  async function test(record) {
    const c = await config();
    if (c.deliveryMode === 'manual') throw new Error('Modo manual: use Preparar rascunho, não o envio Gmail.');
    const to = recipientsFor(c, record);
    let subject = '[Acompanhamento Especial] Teste de envio Gmail';
    let payload = 'Teste de conexão solicitado manualmente nas configurações da MTPrev. Nenhum dado processual foi incluído.';
    if (record) {
      const content = template(record, [], true);
      if (!content.hasMovement) throw new Error('Este processo ainda não possui movimentação salva. Execute Verificar agora antes de testar.');
      subject = '[TESTE] ' + content.subject;
      payload = content;
    }
    const result = await send(c, to, subject, payload, {manual:true});
    if (result.skipped) throw new Error(result.reason);
    return {ok:true, message:`A Gmail API aceitou o teste para ${result.count} destinatário(s). Isso não garante a entrega.`, recipients:to};
  }
  async function draft(record) {
    const c = await config();
    if (c.deliveryMode !== 'manual') throw new Error('Selecione envio manual nas Configurações antes de preparar um aviso.');
    if (c.consent !== true) throw new Error('Confirme a autorização para compartilhar os dados processuais nas Configurações.');
    if (!record) throw new Error('Nenhum processo em acompanhamento foi selecionado.');
    const recipients = recipientsFor(c, record);
    if (!recipients.length) throw new Error('Cadastre destinatários para este processo.');
    const content = template(record, [], true);
    if (!content.hasMovement) throw new Error('Sem movimentação disponível. Abra o processo no SPA e execute a verificação antes de preparar o aviso.');
    // Rascunho local; nunca retorna senhas, tokens ou cabeçalhos OAuth.
    return {ok:true, deliveryMode:'manual', recipients, subject:String(content.subject||'').slice(0,180),
      body:String(content.plain||'').slice(0,1800), sender:cleanEmail(c.sender),
      message:'O envio depende de revisão e confirmação no aplicativo de e-mail.'};
  }
  async function status() {
    const c = await config();
    const manual = c.deliveryMode === 'manual';
    return {ok:true, deliveryMode:manual?'manual':'oauth',clientReady:clientReady(),sender:cleanEmail(c.sender),
      configured:manual ? c.consent === true : clientReady() && EMAIL_RE.test(cleanEmail(c.sender)),
      enabled:!manual && c.enabled === true,consent:c.consent === true,
      message:manual ? 'Envio manual selecionado. Nenhuma notificação é enviada automaticamente.' :
        clientReady() ? 'OAuth presente no manifesto. Conecte o Gmail para autorizar.' :
        'Informe o Client ID OAuth no manifest.json antes de conectar.'};
  }
  const settingsUrl = chrome.runtime.getURL('options.html');
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (!message?.type?.startsWith('MTPREV_MAIL_OAUTH_')) return false;
    if (sender.id !== chrome.runtime.id || sender.url !== settingsUrl) {
      respond({ok:false,error:'Acesso permitido somente na página de opções da extensão.'});return false;
    }
    const op = async () => {
      if (message.type === 'MTPREV_MAIL_OAUTH_CONNECT') return connect();
      if (message.type === 'MTPREV_MAIL_OAUTH_DISCONNECT') return disconnect();
      if (message.type === 'MTPREV_MAIL_OAUTH_STATUS') return status();
      if (message.type === 'MTPREV_MAIL_OAUTH_TEST') return test(null);
      throw new Error('Ação OAuth desconhecida.');
    };
    op().then(respond, err => respond({ok:false,error:err?.message || 'Falha na conexão Google.'}));
    return true;
  });
  globalThis.MTPrevWatchMail = {notify, test, preview, draft, status, parseEmails, recipientsFor, CONFIG_KEY, SCOPE, EMAIL_SCOPE};
})();
