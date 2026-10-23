(function () {
  "use strict";

  if (window.SPA_CDSP_TEAM_DATABASE) return;

  const PAGE_SOURCE = "SPA_CDSP_TEAM_DATABASE_PANEL";
  const BRIDGE_SOURCE = "SPA_CDSP_TEAM_DATABASE_BRIDGE";
  let activeNamesPromise = null;

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKey(value) {
    return normalizeText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cellText(cell) {
    if (!cell) return "";
    if (typeof cell.text === "string" && cell.text) return cell.text.trim();

    const value = cell.value;
    if (value == null) return "";
    if (typeof value !== "object") return String(value).trim();
    if (typeof value.text === "string") return value.text.trim();
    if (typeof value.result !== "undefined") return String(value.result == null ? "" : value.result).trim();
    if (Array.isArray(value.richText)) return value.richText.map((item) => String((item && item.text) || "")).join("").trim();
    return String(value).trim();
  }

  function requestDescriptor() {
    return new Promise((resolve, reject) => {
      const requestId = "active-team-" + Date.now() + "-" + Math.random().toString(16).slice(2);
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("Tempo excedido carregando a lista da equipe."));
      }, 30000);

      function onMessage(event) {
        if (event.source !== window) return;
        const data = event.data || {};
        if (data.source !== BRIDGE_SOURCE || data.type !== "FETCH_TEAM_DB_RESPONSE" || data.requestId !== requestId) return;
        window.clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        const response = data.response || {};
        if (!response.ok) {
          reject(new Error(response.error || "Nao foi possivel carregar a lista da equipe."));
          return;
        }
        resolve(response);
      }

      window.addEventListener("message", onMessage);
      window.postMessage({ source: PAGE_SOURCE, type: "FETCH_TEAM_DB", requestId }, "*");
    });
  }

  async function loadActiveNames() {
    if (activeNamesPromise) return activeNamesPromise;

    activeNamesPromise = (async () => {
      const descriptor = await requestDescriptor();
      if (!descriptor.xlsxUrl) throw new Error("URL da base interna da equipe nao informada.");
      if (!window.ExcelJS) throw new Error("Leitor da base interna da equipe nao foi carregado.");

      const response = await fetch(descriptor.xlsxUrl, { method: "GET", cache: "no-store" });
      if (!response.ok) throw new Error("Base interna da equipe nao carregou (" + response.status + ").");

      const workbook = new window.ExcelJS.Workbook();
      await workbook.xlsx.load(await response.arrayBuffer());
      const worksheet = workbook.getWorksheet("Equipe") || workbook.worksheets[0];
      if (!worksheet) throw new Error("Aba da equipe nao encontrada na base interna.");

      const headerRow = worksheet.getRow(1);
      const columnCount = Math.max(1, headerRow.cellCount || 0);
      const headers = [];
      for (let column = 1; column <= columnCount; column += 1) headers.push(normalizeKey(cellText(headerRow.getCell(column))));

      const nameColumn = headers.findIndex((header) => header === "nome do servidor" || header === "nome servidor") + 1;
      const departureColumn = headers.findIndex((header) => header === "saiu da equipe") + 1;
      if (!nameColumn || !departureColumn) {
        throw new Error("A base interna precisa conter as colunas 'Nome do servidor' e 'Saiu da Equipe'.");
      }

      const names = [];
      for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
        const row = worksheet.getRow(rowIndex);
        const name = normalizeText(cellText(row.getCell(nameColumn)));
        const departure = normalizeKey(cellText(row.getCell(departureColumn)));
        if (name && departure === "nao saiu da equipe") names.push(name);
      }

      return Array.from(new Set(names)).sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
    })().catch((error) => {
      activeNamesPromise = null;
      throw error;
    });

    return activeNamesPromise;
  }

  window.SPA_CDSP_TEAM_DATABASE = { loadActiveNames };
})();
