/* Contatos visíveis no SPA para seleção voluntária de destinatários.
 * Não consulta endpoints, não supõe e-mails com base em nomes e não envia dados.
 */
(() => {
  'use strict';
  const EMAIL_RE = /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/;
  const USER_FIELD_RE = /(?:usu[aá]ri[oa]s?|users?|assessor(?:a|es)?|respons[aá]ve(?:l|is)|servidor(?:a|es)?|colaborador(?:a|es)?|destinat[aá]ri[oa]s?|assignee)/i;
  const EMAIL_MATCH = /[^\s@<>;,()]+@[^\s@<>;,()]+\.[^\s@<>;,()]+/;
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
  const emailFrom = value => {
    const match = normalize(value).match(EMAIL_MATCH);
    const candidate = match?.[0]?.toLowerCase() || '';
    return candidate.length <= 254 && EMAIL_RE.test(candidate) ? candidate : '';
  };
  const outsideExtension = node => !node.closest?.('#cdsp-process-watch, #cdsp-general-shell, [data-mtprev-radial-root]');
  function list(root = document) {
    const contacts = new Map();
    const add = (rawName, rawEmail) => {
      const email = emailFrom(rawEmail);
      const name = normalize(rawName).replace(/\s*\([^)]*@[^)]*\)\s*$/, '').slice(0, 120);
      if (!name || name.length > 120 || /^(?:selecione|escolha|todos|nenhum|buscar|carregando|pesquise|—|-)\b/i.test(name)) return;
      const identity = `${name.toLocaleLowerCase('pt-BR')}|${email}`;
      if (!contacts.has(identity)) contacts.set(identity, {name, email});
    };
    // Selects/Select2 existentes no SPA, não em nossas próprias interfaces.
    for (const select of root.querySelectorAll('select')) {
      if (!outsideExtension(select)) continue;
      const descriptor = [select.name, select.id, select.getAttribute('aria-label'), select.getAttribute('data-placeholder'),
        select.closest('label')?.textContent, select.labels?.[0]?.textContent].filter(Boolean).join(' ');
      if (!USER_FIELD_RE.test(descriptor)) continue;
      for (const option of select.querySelectorAll('option')) {
        if (option.disabled || !option.value || option.value === '0') continue;
        const title = normalize(option.textContent);
        if (!title || title.length > 160) continue;
        add(title, option.getAttribute('data-email') || option.dataset?.email || title);
      }
    }
    // Contatos com e-mail declarado explicitamente pelo próprio DOM do SPA.
    for (const node of root.querySelectorAll('[data-user-email], [data-email]')) {
      if (!outsideExtension(node)) continue;
      const address = node.getAttribute('data-user-email') || node.getAttribute('data-email') || '';
      if (!emailFrom(address)) continue;
      add(node.getAttribute('data-user-name') || node.getAttribute('data-name') || node.textContent || address, address);
    }
    return [...contacts.values()].sort((a,b) => a.name.localeCompare(b.name, 'pt-BR')).slice(0, 250);
  }
  globalThis.MTPrevSpaMailContacts = {list, emailFrom};
})();
