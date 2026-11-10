/* Lista de referência de triagem da MTPrev — TRIAGEM.pdf (p. 1).
 * Não utiliza a base antiga da CDSP. A disponibilidade efetiva para
 * designação é confirmada pelo seletor autenticado do SPA ao salvar.
 */
(function () {
  'use strict';
  if (window.SPA_CDSP_TEAM_DATABASE) return;
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  function namesFromRules() {
    const people = window.MTPrevTriageRules?.team || [];
    return people.map(item => String(item.name || '').trim()).filter(Boolean);
  }
  function namesFromSpa() {
    // Usa somente o seletor de designação do formulário SPA, quando presente.
    // Não lê pessoas de outros controles, que podem ser partes ou procuradores.
    const select = document.querySelector('#progress_form_data_ATR007588');
    if (!select) return [];
    return [...select.querySelectorAll('option')]
      .filter(item => item.value && !item.disabled)
      .map(item => item.textContent?.trim() || '').filter(item => item.length >= 5);
  }
  async function loadActiveNames() {
    const values = [...namesFromRules(), ...namesFromSpa()];
    const unique = new Map();
    for (const value of values) if (!unique.has(norm(value))) unique.set(norm(value), value);
    return [...unique.values()].sort((a,b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }
  window.SPA_CDSP_TEAM_DATABASE = Object.freeze({ loadActiveNames, source: 'TRIAGEM.pdf (MTPrev) + opções do SPA' });
})();
