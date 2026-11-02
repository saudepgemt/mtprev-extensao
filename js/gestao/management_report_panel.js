(function () {
  "use strict";

  if (window.SPA_CDSP_MANAGEMENT_REPORT_PANEL_INITIALIZED) return;
  window.SPA_CDSP_MANAGEMENT_REPORT_PANEL_INITIALIZED = true;

  const CONFIG = Object.assign(
    {
      pageLength: 100,
      delayPageMs: 900,
      processingTimeoutMs: 600000,
      screenRowLimit: 300,
      criticalScreenLimit: 150,
      panelId: "spa-cdsp-management-panel",
      modalId: "spa-cdsp-management-report-modal",
      headerImageUrl: (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL("images/logo-mtprev.png") : ""),
      iconImageUrl: "",
      teamDatabase: {
        file: "data/equipe.xlsx",
        mode: "base interna"
      },
      teamRequestTimeoutMs: 60000,
      version: "0.2.12"
    },
    window.SPA_CDSP_MANAGEMENT_REPORT_CONFIG || {}
  );

  const REPORT_TYPES = {
    recursos: { label: "Recursos", order: 1 },
    contestacao: { label: "Contestacao", order: 2 },
    demais: { label: "Demais Prazos", order: 3 }
  };

  const CATEGORY_ORDER = ["recursos", "contestacao", "demais"];
  const INBOX_TYPES = {
    novos: { label: "Novos" },
    analisados: { label: "Analisados" },
    triador: { label: "Caixa Geral do Triador" },
    redator: { label: "Caixa Geral do Redator" },
    minuta_iniciada: { label: "Minuta iniciada" },
    revisor: { label: "Caixa Geral do Revisor" },
    retificar: { label: "Pecas a Retificar" },
    sugestao_encerramento: { label: "Sugestao de Encerramento" },
    finalizadas: { label: "Minutas Finalizadas" },
    oficio_ses: { label: "Oficio da SES" },
    avocada: { label: "Tarefa avocada" },
    identificar: { label: "Caixa a identificar" },
    campo_vazio: { label: "Campo vazio" }
  };
  const INBOX_TYPE_ORDER = [
    "novos",
    "analisados",
    "triador",
    "redator",
    "minuta_iniciada",
    "revisor",
    "retificar",
    "sugestao_encerramento",
    "finalizadas",
    "oficio_ses",
    "avocada",
    "identificar",
    "campo_vazio"
  ];
  const INBOX_STATUS_MAP = [
    { key: "novos", statuses: ["Documentos avulsos inseridos"] },
    {
      key: "analisados",
      statuses: ["Classificacao do processo complementada", "Classificação do processo complementada"]
    },
    {
      key: "triador",
      statuses: [
        "Distribuir processo para Assessor(a)",
        "Distribuir processo para Assessor",
        "Processo distribuido para Assessor(a)",
        "Processo distribuído para Assessor(a)",
        "Processo distribuido para Assessor",
        "Processo classificado (IA)",
        "Processo classificado IA"
      ]
    },
    {
      key: "redator",
      statuses: [
        "Designado ao(à) assessor(a)",
        "Designado ao(a) assessor(a)",
        "Designado ao assessor(a)",
        "Designado ao assessor",
        "Designado(a) ao assessor(a)",
        "Designado(a) ao assessor",
        "Designado a assessora",
        "Observacao",
        "Observacao do Assessor(a)",
        "Observacao do Assessor",
        "Observacao da Assessora"
      ]
    },
    { key: "minuta_iniciada", statuses: ["Minuta elaborada"] },
    {
      key: "revisor",
      statuses: [
        "Minuta de Dispensa de Defesa Elaborada",
        "Processo distribuido para o Revisor(a)",
        "Processo distribuído para o Revisor(a)",
        "Processo distribuido para o Revisor",
        "Processo distribuido para Revisor(a)",
        "Processo distribuido para Revisor",
        "Distribuir processo para Revisor(a)",
        "Distribuir processo para Revisor"
      ]
    },
    { key: "retificar", statuses: ["Devolvido ao assessor"] },
    {
      key: "sugestao_encerramento",
      statuses: [
        "Encerramento sugerido pelo assessor(a)",
        "Encerramento sugerido pelo assessor",
        "Encerramento de tarefa sugerida pela assessoria"
      ]
    },
    {
      key: "oficio_ses",
      statuses: ["Minutac da SES enviada ao(a) Procurador(a)", "Minutac da SES enviada ao Procurador"]
    },
    {
      key: "finalizadas",
      statuses: [
        "Minuta enviada ao(à) procurador(a)",
        "Minuta enviada ao(a) procurador(a)",
        "Minuta enviada ao procurador",
        "Minuta enviada a procuradora",
        "Enviar minuta ao procurador(a)",
        "Enviar minuta ao procurador"
      ]
    },
    {
      key: "avocada",
      contains: true,
      statuses: ["Tarefa Avocada"]
    }
  ];
  const DEFAULT_INTERNAL_DEADLINE_BUSINESS_DAYS = 5;
  const BOX_CRITICAL_BUSINESS_DAYS = 2;
  const TRIAGE_BILLING_RECEIVED_BUSINESS_DAYS = 3;
  const REVIEWER_BILLING_RECEIVED_BUSINESS_DAYS = 2;
  const CORRECTION_BILLING_BUSINESS_DAYS = 3;
  const EMAIL_ALERT_TYPES = Object.freeze({
    triagem: {
      label: "Triagem",
      button: "Cobrar Triagem",
      role: "triador",
      recipientLabel: "triador(a)",
      subjectPrefix: "Cobrança de triagem",
      fallbackSector: "Triagem sem setor identificado"
    },
    correcao: {
      label: "Correção",
      button: "Cobrar Correção",
      role: "corretor",
      recipientLabel: "corretor(a)",
      subjectPrefix: "Cobrança de correção",
      fallbackSector: "Correção sem setor identificado"
    },
    peca: {
      label: "Peça",
      button: "Cobrar Peça",
      role: "redator",
      recipientLabel: "redator(a)",
      subjectPrefix: "Cobrança de peça",
      fallbackSector: "Peça sem setor identificado"
    }
  });
  const PROD_GESTORES = Object.freeze({
    "Terapias": {
      nome: "Yasmim",
      emails: ["yasmimalves@pge.mt.gov.br"]
    },
    "Home Care e/ou TFD": {
      nome: "Yasmim",
      emails: ["yasmimalves@pge.mt.gov.br"]
    },
    "Fora do SUS e/ou Internação Compulsória": {
      nome: "Bruno",
      emails: ["brunomazetto@pge.mt.gov.br"]
    },
    "Medicamentos": {
      nome: "Mônica, Igor e Marina",
      emails: ["monicasouza@pge.mt.gov.br", "igorcampos@pge.mt.gov.br", "marinanogueira@pge.mt.gov.br"]
    },
    "Procedimentos": {
      nome: "Maria Letícia, Franquislaine e Janaína",
      emails: ["mariasilva@pge.mt.gov.br", "fransquislaineanicezio@pge.mt.gov.br", "janainacosta@pge.mt.gov.br"]
    }
  });
  const PROD_GESTORES_TRIAGEM = Object.freeze({
    "Terapias": {
      nome: "Yasmin",
      emails: ["yasmimalves@pge.mt.gov.br"]
    },
    "Home Care e/ou TFD": {
      nome: "Yasmin",
      emails: ["yasmimalves@pge.mt.gov.br"]
    },
    "Fora do SUS e/ou Internação Compulsória": {
      nome: "Bruno",
      emails: ["brunomazetto@pge.mt.gov.br"]
    },
    "Medicamentos": {
      nome: "Marina ou Igor",
      emails: ["marinanogueira@pge.mt.gov.br", "igorcampos@pge.mt.gov.br"]
    },
    "Procedimentos": {
      nome: "Fransquislaine",
      emails: ["fransquislaineanicezio@pge.mt.gov.br"]
    }
  });
  const INTERNAL_DEADLINE_LIMITS = {
    embargos_de_declaracao: { label: "Embargos de Declaracao", recurso: 2, contrarrazao: 4 },
    recurso_inominado: { label: "Recurso Inominado", recurso: 4, contrarrazao: 6 },
    apelacao: { label: "Apelacao", recurso: 8, contrarrazao: 16 },
    agravo_interno: { label: "Agravo Interno", recurso: 8, contrarrazao: 16 },
    recurso_especial: { label: "Recurso Especial", recurso: 10, contrarrazao: 20 },
    recurso_extraordinario: { label: "Recurso Extraordinario", recurso: 10, contrarrazao: 20 },
    contestacao: { label: "Contestacao", recurso: 6, contrarrazao: null },
    agravo_de_instrumento: { label: "Agravo de Instrumento", recurso: 6, contrarrazao: 16 },
    manifestacao: { label: "Manifestacao", recurso: 4, contrarrazao: null }
  };

  const FIXED_HOLIDAYS = [
    { day: 1, month: 1 },
    { day: 8, month: 4 },
    { day: 21, month: 4 },
    { day: 1, month: 5 },
    { day: 10, month: 8 },
    { day: 7, month: 9 },
    { day: 12, month: 10 },
    { day: 2, month: 11 },
    { day: 15, month: 11 },
    { day: 20, month: 11 },
    { day: 8, month: 12 },
    { day: 24, month: 12 },
    { day: 25, month: 12 },
    { day: 31, month: 12 }
  ];

  const DEADLINE_STYLE_PRESETS = {
    long: {
      label: "Azul",
      fillColor: [0, 123, 255],
      textColor: [255, 255, 255],
      borderColor: [0, 98, 204],
      screenBackground: "#007bff",
      screenText: "#ffffff",
      screenBorder: "#0062cc"
    },
    short: {
      label: "Amarelo",
      fillColor: [255, 193, 7],
      textColor: [33, 37, 41],
      borderColor: [224, 168, 0],
      screenBackground: "#ffc107",
      screenText: "#212529",
      screenBorder: "#e0a800"
    },
    late: {
      label: "Vermelho",
      fillColor: [220, 53, 69],
      textColor: [255, 255, 255],
      borderColor: [189, 33, 48],
      screenBackground: "#dc3545",
      screenText: "#ffffff",
      screenBorder: "#bd2130"
    },
    none: {
      label: "Sem prazo",
      fillColor: [233, 236, 239],
      textColor: [73, 80, 87],
      borderColor: [206, 212, 218],
      screenBackground: "#e9ecef",
      screenText: "#495057",
      screenBorder: "#ced4da"
    },
    default: {
      label: "",
      fillColor: null,
      textColor: [28, 43, 57],
      borderColor: [210, 218, 232],
      screenBackground: "",
      screenText: "#1c2b39",
      screenBorder: "#d2dae8"
    }
  };

  const state = {
    running: false,
    stopped: false,
    logs: [],
    lastRecords: [],
    lastReportDate: null,
    teamDatabase: {
      loaded: false,
      loading: false,
      entries: [],
      sectors: [],
      fetchedAt: "",
      error: ""
    },
    modal: {
      activeTab: "visao",
      selectedSectors: [],
      selectedAssessor: "todos",
      selectedAssessors: [],
      selectedCategory: "todos",
      selectedCategories: [],
      selectedInboxType: "todos",
      selectedInboxTypes: [],
      selectedRiskReasons: [],
      onlyCritical: false,
      detailAssessor: "",
      assessorSort: { key: "", direction: "asc" },
      recordSort: { key: "", direction: "asc" }
    }
  };

  function repairMojibake(text) {
    const value = String(text || "");
    if (!/[ÃÂ]/.test(value)) return value;

    try {
      const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 255);
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      return decoded && decoded.length >= value.length * 0.7 ? decoded : value;
    } catch (_error) {
      return value;
    }
  }

  function normalizeText(text) {
    return repairMojibake(text)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[º°]/g, "o")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeKey(text) {
    return normalizeText(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizePersonName(text) {
    const stopWords = new Set(["de", "da", "do", "das", "dos", "e"]);
    const normalized = normalizeKey(text)
      .split(" ")
      .filter((piece) => piece && piece.length > 1 && !stopWords.has(piece))
      .join(" ");
    const aliases = {
      "fransquislaine jesus anicezio": "fransquislaine jesus ancezio"
    };
    return aliases[normalized] || normalized;
  }

  function isUnassignedAssessor(assessor) {
    const key = normalizeKey(assessor);
    return !key || key === "sem assessor" || key === "sem assessora" || key === "sem assessor a";
  }

  function isSectorPlaceholder(sector) {
    const key = normalizeKey(sector);
    return !key || key === "sem assessor" || key === "sem assessora" || key === "sem assessor a" || key === "setor nao identificado" || key === "setor nao carregado";
  }

  function isTeamUnmatched(record) {
    return record && record.teamMatchStatus && record.teamMatchStatus !== "OK" && record.teamMatchStatus !== "Sem assessor(a)";
  }

  function nameTokens(text) {
    return normalizePersonName(text).split(" ").filter(Boolean);
  }

  function resolveSpaUrl(url) {
    const value = String(url || "").trim();
    if (!value || value === "#") return "";

    try {
      return new URL(value, window.location.origin).href;
    } catch (_error) {
      return "";
    }
  }

  function elementUrl(element) {
    if (!element) return "";
    return resolveSpaUrl(element.href || element.getAttribute("href") || "");
  }

  function procedurePageUrl(procedureId) {
    return procedureId ? resolveSpaUrl("/procedures/" + procedureId) : "";
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    const source = String(text || "");

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      const next = source[index + 1];

      if (quoted) {
        if (char === '"' && next === '"') {
          value += '"';
          index += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          value += char;
        }
        continue;
      }

      if (char === '"') {
        quoted = true;
      } else if (char === ",") {
        row.push(value);
        value = "";
      } else if (char === "\n") {
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
      } else if (char !== "\r") {
        value += char;
      }
    }

    row.push(value);
    if (row.some((cell) => String(cell || "").trim())) rows.push(row);
    return rows;
  }

  function parseTeamDatabaseCsv(csv, fetchedAt) {
    const rows = parseCsv(csv);
    if (!rows.length) throw new Error("A base de setores esta vazia.");
    const headers = rows[0].map(normalizeKey);
    const nameIndex = headers.findIndex((header) => header === "nome do servidor" || header === "nome servidor");
    const sectorIndex = headers.findIndex((header) => header === "setor");
    const statusIndex = headers.findIndex((header) => header.indexOf("status") >= 0);
    const linkIndex = headers.findIndex((header) => header === "tipo de vinculo" || header === "tipo vinculo");
    const emailIndex = headers.findIndex((header) => header === "e mail" || header === "email" || header.indexOf("mail") >= 0);
    const corretorIndex = headers.findIndex((header) => header === "corretor" || header === "correcao" || header === "correção");
    const triadorIndex = headers.findIndex((header) => header === "triador" || header === "triagem");
    const redatorIndex = headers.findIndex((header) => header === "redator" || header === "peca" || header === "peça");

    if (nameIndex < 0) throw new Error("Coluna 'Nome do servidor' nao encontrada na base interna.");
    if (sectorIndex < 0) throw new Error("Coluna 'Setor' nao encontrada na base interna.");

    const entries = rows
      .slice(1)
      .map((row) => {
        const name = normalizeText(row[nameIndex]);
        const sector = normalizeText(row[sectorIndex]);
        if (!name || !sector) return null;
        return {
          name,
          sector,
          normalizedName: normalizePersonName(name),
          tokens: nameTokens(name),
          status: statusIndex >= 0 ? normalizeText(row[statusIndex]) : "",
          bond: linkIndex >= 0 ? normalizeText(row[linkIndex]) : "",
          email: emailIndex >= 0 ? normalizeText(row[emailIndex]) : "",
          roles: {
            corretor: corretorIndex >= 0 ? normalizeText(row[corretorIndex]) : "",
            triador: triadorIndex >= 0 ? normalizeText(row[triadorIndex]) : "",
            redator: redatorIndex >= 0 ? normalizeText(row[redatorIndex]) : ""
          }
        };
      })
      .filter(Boolean);

    const sectors = Array.from(new Set(entries.map((entry) => entry.sector))).sort((a, b) =>
      normalizeKey(a).localeCompare(normalizeKey(b), "pt-BR")
    );

    return { entries, sectors, fetchedAt: fetchedAt || "" };
  }

  function teamDatabaseCsvCell(value) {
    const text = String(value == null ? "" : value);
    return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function teamDatabaseExcelCellText(cell) {
    if (!cell) return "";
    if (typeof cell.text === "string" && cell.text) return cell.text.trim();

    const value = cell.value;
    if (value == null) return "";
    if (value instanceof Date) return value.toISOString();
    if (typeof value !== "object") return String(value).trim();
    if (typeof value.text === "string") return value.text.trim();
    if (typeof value.result !== "undefined") return String(value.result == null ? "" : value.result).trim();
    if (Array.isArray(value.richText)) {
      return value.richText.map((item) => String(item && item.text ? item.text : "")).join("").trim();
    }
    return String(value).trim();
  }

  async function teamDatabaseWorkbookToCsv(xlsxUrl) {
    if (!xlsxUrl) throw new Error("URL da base interna de setores nao informada.");

    const response = await fetch(xlsxUrl, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Base interna de setores nao carregou (" + response.status + ").");
    }

    const ExcelJS = excelLib();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());

    const worksheet = workbook.getWorksheet("Equipe") || workbook.worksheets[0];
    if (!worksheet) throw new Error("Aba da base interna de setores nao encontrada.");

    const headerRow = worksheet.getRow(1);
    const columnCount = Math.max(1, headerRow.cellCount || 0);
    const rows = [];

    for (let rowIndex = 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
      const row = worksheet.getRow(rowIndex);
      const cells = [];

      for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
        cells.push(teamDatabaseExcelCellText(row.getCell(columnIndex)));
      }

      if (rowIndex === 1 || cells.some((cell) => cell.trim())) rows.push(cells);
    }

    const csv = rows.map((row) => row.map(teamDatabaseCsvCell).join(",")).join("\n");
    if (!csv || csv.indexOf("Nome do servidor") < 0 || csv.indexOf("Setor") < 0) {
      throw new Error("Base interna de setores sem colunas esperadas.");
    }
    return csv;
  }

  function teamDatabaseRequest() {
    return new Promise((resolve, reject) => {
      const requestId = "team-db-" + Date.now() + "-" + Math.random().toString(16).slice(2);
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        window.removeEventListener("message", onMessage);
        reject(new Error("Tempo excedido carregando a base de setores."));
      }, CONFIG.teamRequestTimeoutMs || 25000);

      function onMessage(event) {
        if (event.source !== window) return;
        const data = event.data || {};
        if (data.source !== "SPA_CDSP_MANAGEMENT_BRIDGE" || data.type !== "FETCH_TEAM_DB_RESPONSE") return;
        if (data.requestId !== requestId) return;
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        const response = data.response || {};
        if (!response.ok) {
          reject(new Error(response.error || "Nao foi possivel carregar a base de setores."));
          return;
        }
        resolve(response);
      }

      window.addEventListener("message", onMessage);
      window.postMessage(
        {
          source: "SPA_CDSP_MANAGEMENT_PANEL",
          type: "FETCH_TEAM_DB",
          requestId
        },
        "*"
      );
    });
  }

  async function loadTeamDatabase() {
    if (state.teamDatabase.loaded && state.teamDatabase.entries.length) return state.teamDatabase;
    if (state.teamDatabase.loading) return state.teamDatabase;

    state.teamDatabase.loading = true;
    try {
      const response = await teamDatabaseRequest();
      const csv = response.csv || (await teamDatabaseWorkbookToCsv(response.xlsxUrl));
      const parsed = parseTeamDatabaseCsv(csv, response.fetchedAt);
      state.teamDatabase.loaded = true;
      state.teamDatabase.entries = parsed.entries;
      state.teamDatabase.sectors = parsed.sectors;
      state.teamDatabase.fetchedAt = parsed.fetchedAt;
      state.teamDatabase.error = "";
      log("Base de setores carregada com " + parsed.entries.length + " servidor(es).", "ok");
      return state.teamDatabase;
    } catch (error) {
      state.teamDatabase.loaded = false;
      state.teamDatabase.entries = [];
      state.teamDatabase.sectors = [];
      state.teamDatabase.fetchedAt = "";
      state.teamDatabase.error = error && error.message ? error.message : String(error);
      log("Base de setores nao carregou: " + state.teamDatabase.error, "error");
      return state.teamDatabase;
    } finally {
      state.teamDatabase.loading = false;
    }
  }

  function intersectionCount(left, right) {
    const used = new Set();
    return left.reduce((count, item) => {
      const index = right.findIndex((candidate, candidateIndex) => !used.has(candidateIndex) && tokenLooksSame(item, candidate));
      if (index < 0) return count;
      used.add(index);
      return count + 1;
    }, 0);
  }

  function tokenLooksSame(left, right) {
    const a = String(left || "");
    const b = String(right || "");
    if (!a || !b) return false;
    if (a === b) return true;

    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;

    if (shorter.length >= 4 && longer.indexOf(shorter) === 0) return true;
    if (shorter.length >= 3 && longer.slice(-shorter.length) === shorter) return true;
    return false;
  }

  function nameMatchScore(spaName, entry) {
    const spaNormalized = normalizePersonName(spaName);
    const dbNormalized = entry.normalizedName;
    if (!spaNormalized || !dbNormalized) return 0;
    if (spaNormalized === dbNormalized) return 100;

    const spaTokens = spaNormalized.split(" ").filter(Boolean);
    const dbTokens = entry.tokens || [];
    if (!spaTokens.length || !dbTokens.length) return 0;
    const overlap = intersectionCount(spaTokens, dbTokens);
    if (!overlap) return 0;

    const shorter = Math.min(spaTokens.length, dbTokens.length);
    const longer = Math.max(spaTokens.length, dbTokens.length);
    const allShorterContained = overlap === shorter && shorter >= 2;
    const sameEdges =
      tokenLooksSame(spaTokens[0], dbTokens[0]) &&
      tokenLooksSame(spaTokens[spaTokens.length - 1], dbTokens[dbTokens.length - 1]);

    if (allShorterContained && sameEdges) return 96;
    if (allShorterContained) return 92;

    const containment = overlap / shorter;
    const coverage = overlap / longer;
    let score = coverage * 72 + containment * 18;
    if (tokenLooksSame(spaTokens[0], dbTokens[0])) score += 5;
    if (tokenLooksSame(spaTokens[spaTokens.length - 1], dbTokens[dbTokens.length - 1])) score += 5;
    return Math.round(score);
  }

  function matchTeamEntry(assessor, entries) {
    const name = normalizeText(assessor);
    if (!name || !entries || !entries.length) {
      return { entry: null, method: "sem base", score: 0, status: "Base nao carregada" };
    }

    const normalized = normalizePersonName(name);
    const exact = entries.filter((entry) => entry.normalizedName === normalized);
    if (exact.length === 1) return { entry: exact[0], method: "exata", score: 100, status: "OK" };
    if (exact.length > 1) {
      const sectors = Array.from(new Set(exact.map((entry) => entry.sector)));
      if (sectors.length === 1) return { entry: exact[0], method: "exata mesmo setor", score: 100, status: "OK" };
      return { entry: null, method: "exata ambigua", score: 100, status: "Nome duplicado na base" };
    }

    const ranked = entries
      .map((entry) => ({ entry, score: nameMatchScore(name, entry) }))
      .filter((candidate) => candidate.score >= 88)
      .sort((a, b) => b.score - a.score || normalizeKey(a.entry.name).localeCompare(normalizeKey(b.entry.name), "pt-BR"));

    if (!ranked.length) return { entry: null, method: "nao localizada", score: 0, status: "Setor nao identificado" };
    if (ranked.length > 1 && ranked[0].score - ranked[1].score < 8) {
      const tied = ranked.filter((candidate) => ranked[0].score - candidate.score < 8);
      const sectors = Array.from(new Set(tied.map((candidate) => candidate.entry.sector)));
      if (sectors.length === 1) {
        return { entry: ranked[0].entry, method: "aproximada mesmo setor", score: ranked[0].score, status: "OK" };
      }
      return { entry: null, method: "aproximada ambigua", score: ranked[0].score, status: "Nome ambiguo" };
    }

    return { entry: ranked[0].entry, method: "aproximada", score: ranked[0].score, status: "OK" };
  }

  function applyTeamData(records, teamDatabase) {
    const entries = teamDatabase && teamDatabase.entries ? teamDatabase.entries : [];
    return records.map((record) => {
      if (isUnassignedAssessor(record.assessor)) {
        return Object.assign(record, {
          sector: "Sem assessor(a)",
          teamMatchedName: "",
          teamMatchMethod: "Nao se aplica",
          teamMatchScore: "",
          teamMatchStatus: "Sem assessor(a)",
          teamStatus: "",
          teamBond: ""
        });
      }

      const match = matchTeamEntry(record.assessor, entries);
      const entry = match.entry;
      return Object.assign(record, {
        sector: entry ? entry.sector : teamDatabase && teamDatabase.error ? "Setor nao carregado" : "Setor nao identificado",
        teamMatchedName: entry ? entry.name : "",
        teamMatchMethod: match.method,
        teamMatchScore: match.score,
        teamMatchStatus: match.status,
        teamStatus: entry ? entry.status : "",
        teamBond: entry ? entry.bond : ""
      });
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function findSectorInText(text, teamDatabase) {
    const source = normalizeKey(text);
    if (!source) return "";

    const sectors = (teamDatabase && teamDatabase.sectors ? teamDatabase.sectors : [])
      .filter((sector) => sector && !isSectorPlaceholder(sector))
      .sort((a, b) => normalizeKey(b).length - normalizeKey(a).length);

    const exact = sectors.find((sector) => source.indexOf(normalizeKey(sector)) >= 0);
    return exact || "";
  }

  function resolveRecordSectorForAlert(record, teamDatabase) {
    if (!record) return "";

    const movementSector = findSectorInText(record.lastMovement, teamDatabase);
    if (movementSector) return movementSector;

    const typeSector = findSectorInText(record.type, teamDatabase);
    if (typeSector) return typeSector;

    if (record.sector && !isSectorPlaceholder(record.sector)) return record.sector;

    const match = matchTeamEntry(record.assessor, teamDatabase && teamDatabase.entries ? teamDatabase.entries : []);
    if (match.entry && match.entry.sector) return match.entry.sector;

    return "";
  }

  function recordQualifiesForBillingAlert(record, alertType, reportDate) {
    if (!record) return false;

    if (alertType === "triagem") {
      return record.inboxType === "triador" &&
        receivedColumnBusinessDaysValue(record, reportDate) >= TRIAGE_BILLING_RECEIVED_BUSINESS_DAYS;
    }

    if (alertType === "correcao") {
      return record.inboxType === "revisor" &&
        receivedColumnBusinessDaysValue(record, reportDate) >= REVIEWER_BILLING_RECEIVED_BUSINESS_DAYS;
    }

    if (alertType === "peca") {
      return (record.inboxType === "redator" && record.riskStatus === "Critico") ||
        (record.inboxType === "retificar" &&
          receivedBusinessDaysValue(record, reportDate) >= CORRECTION_BILLING_BUSINESS_DAYS);
    }

    return false;
  }

  function billingAlertReason(record, alertType, reportDate) {
    if (alertType === "peca" && record && record.inboxType === "retificar") {
      return "Peca a retificar ha " + billingBusinessDaysValue(record, alertType, reportDate) + " dias uteis na caixa";
    }
    if (alertType === "peca") {
      return recordRiskReasons(record);
    }
    return billingBusinessDaysValue(record, alertType, reportDate) + " dias uteis na caixa" +
      (usesReceivedColumnForBilling(record, alertType) ? " (Recebido)" : "");
  }

  function compactRecordForBilling(record, alertType, reportDate, sector) {
    return {
      processNumber: record.processNumber,
      procedureUrl: record.procedureUrl,
      assessor: record.assessor,
      sector: sector || "Setor nao identificado",
      inboxTypeLabel: record.inboxTypeLabel,
      type: record.type,
      receivedText: record.receivedText,
      businessDays: billingBusinessDaysValue(record, alertType, reportDate),
      internalDueDateText: record.internalDueDateText,
      pjeDeadlineText: record.pjeDeadlineText,
      riskStatus: record.riskStatus,
      chargeGroup: billingChargeGroup(record, alertType),
      reason: billingAlertReason(record, alertType, reportDate)
    };
  }

  function managerForSector(sector, alertType) {
    const sectorKey = normalizeKey(sector);
    if (!sectorKey) return null;

    const managerMap = alertType === "triagem" ? PROD_GESTORES_TRIAGEM : PROD_GESTORES;
    const entry = Object.keys(managerMap).find((name) => normalizeKey(name) === sectorKey);
    if (!entry) return null;

    return Object.assign({ sector: entry }, managerMap[entry]);
  }

  function managerGroupKey(manager) {
    return normalizeKey(manager.nome) + "|" + (manager.emails || []).map(normalizeKey).join(",");
  }

  function billingTextBody(message) {
    const lines = [
      "Ola, " + message.recipientName + ".",
      "",
      "Segue cobranca dos processos que precisam de acompanhamento em " + message.roleLabel + ".",
      "Criterio: " + message.criteria + ".",
      "Setor(es): " + message.sector + ".",
      "",
      "Processos:"
    ];

    message.sectorGroups.forEach((sectorGroup) => {
      lines.push("", "SETOR: " + sectorGroup.sector);
      sectorGroup.assessorGroups.forEach((assessorGroup) => {
        lines.push("", "Responsavel: " + assessorGroup.assessor);
        assessorGroup.chargeGroups.forEach((chargeGroup) => {
          lines.push("", "Tipo de cobranca: " + chargeGroup.label);
          lines.push("N | Processo | Recebido | Dias uteis | Motivo | Link");
          chargeGroup.records.forEach((record, index) => {
            lines.push(
              (index + 1) + " | " + record.processNumber +
                " | " + (record.receivedText || "-") +
                " | " + record.businessDays +
                " | " + record.reason +
                " | " + (record.procedureUrl || "-")
            );
          });
        });
      });
    });

    lines.push(
      "",
      "Peço, por gentileza, verificar com a equipe e orientar a regularização desses processos.",
      "",
      "Atenciosamente,",
      "CDSP - Coordenação"
    );
    return lines.join("\n");
  }

  function buildBillingAlertMessages(alertType, records, teamDatabase, reportDate) {
    const config = EMAIL_ALERT_TYPES[alertType];
    if (!config) throw new Error("Tipo de alerta desconhecido.");

    const groups = new Map();
    const unresolved = [];
    const selected = records.filter((record) => recordQualifiesForBillingAlert(record, alertType, reportDate));

    selected.forEach((record) => {
      const sector = resolveRecordSectorForAlert(record, teamDatabase) || config.fallbackSector;
      const manager = managerForSector(sector, alertType);

      if (!manager) {
        unresolved.push({ record, sector });
        return;
      }

      const key = managerGroupKey(manager) + "|" + alertType;
      if (!groups.has(key)) {
        groups.set(key, {
          to: (manager.emails || []).join(", "),
          emails: manager.emails || [],
          recipientName: manager.nome,
          role: config.role,
          roleLabel: config.label,
          recipientLabel: config.recipientLabel,
          sectors: new Set(),
          sectorRecords: new Map(),
          criteria: billingCriteriaText(alertType),
          records: []
        });
      }

      const group = groups.get(key);
      group.sectors.add(sector);
      if (!group.sectorRecords.has(sector)) group.sectorRecords.set(sector, []);
      const compact = compactRecordForBilling(record, alertType, reportDate, sector);
      group.records.push(compact);
      group.sectorRecords.get(sector).push(compact);
    });

    const messages = Array.from(groups.values()).map((message) => {
      const sectorNames = Array.from(message.sectors).sort((a, b) => a.localeCompare(b, "pt-BR"));
      const sectorGroups = sectorNames.map((sector) => {
        const byAssessor = new Map();
        (message.sectorRecords.get(sector) || []).forEach((record) => {
          const assessor = record.assessor || "Sem assessor(a)";
          if (!byAssessor.has(assessor)) byAssessor.set(assessor, []);
          byAssessor.get(assessor).push(record);
        });

        const assessorGroups = Array.from(byAssessor.entries())
          .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
          .map(([assessor, assessorRecords]) => {
            const byChargeGroup = new Map();
            assessorRecords.forEach((record) => {
              const chargeGroup = record.chargeGroup || billingChargeGroup(record, alertType);
              if (!byChargeGroup.has(chargeGroup.key)) {
                byChargeGroup.set(chargeGroup.key, { label: chargeGroup.label, order: chargeGroup.order, records: [] });
              }
              byChargeGroup.get(chargeGroup.key).records.push(record);
            });

            const chargeGroups = Array.from(byChargeGroup.values())
              .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "pt-BR"))
              .map((chargeGroup) => ({
                label: chargeGroup.label,
                records: chargeGroup.records.sort((a, b) =>
                  String(a.processNumber || "").localeCompare(String(b.processNumber || ""), "pt-BR")
                )
              }));

            return { assessor, chargeGroups };
          });

        return { sector, assessorGroups };
      });

      message.sector = sectorNames.join("; ");
      message.subject = "[CDSP] " + config.subjectPrefix + " - " + message.sector;
      message.sectorGroups = sectorGroups;
      message.text = billingTextBody(message);
      delete message.sectors;
      delete message.sectorRecords;
      return message;
    });

    return {
      alertType,
      label: config.label,
      totalRecords: selected.length,
      messages,
      unresolved: unresolved.map((item) => ({
        processNumber: item.record.processNumber,
        assessor: item.record.assessor,
        sector: item.sector,
        inboxTypeLabel: item.record.inboxTypeLabel,
        businessDays: billingBusinessDaysValue(item.record, alertType, reportDate)
      }))
    };
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  function startOfDate(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  function addDays(date, days) {
    const next = new Date(date.getTime());
    next.setDate(next.getDate() + days);
    return next;
  }

  function isFixedHoliday(date) {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    return FIXED_HOLIDAYS.some((holiday) => holiday.day === day && holiday.month === month);
  }

  function isBusinessDay(date) {
    const day = date.getDay();
    return day !== 0 && day !== 6 && !isFixedHoliday(date);
  }

  function addBusinessDays(date, days) {
    const total = Math.max(0, Number(days) || 0);
    let cursor = startOfDate(date);
    let counted = 0;
    while (counted < total) {
      cursor = addDays(cursor, 1);
      if (isBusinessDay(cursor)) counted += 1;
    }
    return cursor;
  }

  function daysBetweenDates(fromDate, toDate) {
    const from = startOfDate(fromDate);
    const to = startOfDate(toDate);
    return Math.ceil((to.getTime() - from.getTime()) / 86400000);
  }

  function businessDaysBetweenDates(fromDate, toDate) {
    if (!(fromDate instanceof Date) || Number.isNaN(fromDate.getTime())) return 0;
    if (!(toDate instanceof Date) || Number.isNaN(toDate.getTime())) return 0;

    const from = startOfDate(fromDate);
    const to = startOfDate(toDate);
    if (from.getTime() >= to.getTime()) return 0;

    let cursor = from;
    let counted = 0;
    while (cursor.getTime() < to.getTime()) {
      cursor = addDays(cursor, 1);
      if (isBusinessDay(cursor)) counted += 1;
    }
    return counted;
  }

  function formatDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "-";
    return pad2(date.getDate()) + "/" + pad2(date.getMonth() + 1) + "/" + date.getFullYear();
  }

  function formatDateTime(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "-";
    return formatDate(date) + " " + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
  }

  function decimalText(value, digits) {
    return (Number(value) || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits == null ? 1 : digits
    });
  }

  function dateSortValue(date) {
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : Number.MAX_SAFE_INTEGER;
  }

  function setStatus(message) {
    const status = document.querySelector("#spa-cdsp-management-status");
    if (status) status.textContent = message || "";
  }

  function log(message, kind) {
    state.logs.push({
      message: String(message || ""),
      kind: kind || "info",
      time: new Date()
    });
    if (state.logs.length > 120) state.logs.shift();
    renderLogs();
  }

  function renderLogs() {
    const box = document.querySelector("#spa-cdsp-management-log");
    if (!box) return;
    box.innerHTML = "";
    state.logs.forEach((item) => {
      const line = document.createElement("div");
      line.textContent = "[" + pad2(item.time.getHours()) + ":" + pad2(item.time.getMinutes()) + "] " + item.message;
      line.style.cssText =
        "font-size:11px;line-height:1.35;font-weight:700;margin:0 0 2px 0;color:" +
        (item.kind === "error" ? "#ffb4b4" : item.kind === "ok" ? "#b9f6ca" : "#d5e5f2") +
        ";";
      box.appendChild(line);
    });
    box.scrollTop = box.scrollHeight;
  }

  function getDataTable() {
    const $ = window.jQuery || window.$;
    if (window.dtProceduresBox) return window.dtProceduresBox;
    if ($ && $.fn && $.fn.DataTable && $("#procedures-box").length) return $("#procedures-box").DataTable();
    throw new Error("Tabela #procedures-box nao encontrada. Abra a caixa de processos do SPA.");
  }

  async function waitProcessingDone(context, timeoutMs) {
    const started = Date.now();
    const timeout = timeoutMs || CONFIG.processingTimeoutMs;
    let slowLoadLogged = false;

    while (Date.now() - started < timeout) {
      const processing = document.querySelector("#procedures-box_processing");
      const visible =
        processing &&
        window.getComputedStyle(processing).display !== "none" &&
        window.getComputedStyle(processing).visibility !== "hidden";
      if (!visible) return;

      if (!slowLoadLogged && Date.now() - started > 12000) {
        slowLoadLogged = true;
        setStatus("SPA ainda carregando...");
        log(
          "Aguardando o SPA concluir o carregamento" +
            (context ? " (" + context + ")" : "") +
            ". Em caixas gerenciais extensas isso pode levar alguns minutos."
        );
      }

      await sleep(250);
    }

    throw new Error(
      "Tempo excedido aguardando o carregamento da tabela do SPA" +
        (context ? " (" + context + ")" : "") +
        ". A extensao aguardou ate " +
        Math.round(timeout / 60000) +
        " minuto(s). A caixa pode estar muito extensa ou a consulta do SPA pode ter travado. " +
        "Tente novamente ou aplique um filtro temporario no SPA."
    );
  }

  function tableHeaders() {
    return Array.from(document.querySelectorAll("#procedures-box thead tr.dt-header th"));
  }

  function headerLabel(header) {
    const clone = header.cloneNode(true);
    clone.querySelectorAll(".filter-icon-wrapper, .group-toggle-icon, script, style").forEach((node) => node.remove());
    return normalizeText(clone.textContent || header.getAttribute("aria-label") || "");
  }

  function headerCandidates(header) {
    const aria = String(header.getAttribute("aria-label") || "").split(":")[0];
    return [
      header.getAttribute("data-name") || "",
      header.getAttribute("data-column-name") || "",
      headerLabel(header),
      aria
    ].map(normalizeKey);
  }

  function findColumnIndex(names) {
    const wanted = names.map(normalizeKey).filter(Boolean);
    const headers = tableHeaders();

    for (let position = 0; position < headers.length; position += 1) {
      const header = headers[position];
      const candidates = headerCandidates(header);
      if (!candidates.some((candidate) => wanted.indexOf(candidate) >= 0)) continue;
      const dataIndex = parseInt(header.getAttribute("data-index"), 10);
      return Number.isFinite(dataIndex) ? dataIndex : position;
    }

    for (let position = 0; position < headers.length; position += 1) {
      const header = headers[position];
      const candidates = headerCandidates(header);
      if (!candidates.some((candidate) => wanted.some((name) => candidate.indexOf(name) >= 0))) continue;
      const dataIndex = parseInt(header.getAttribute("data-index"), 10);
      return Number.isFinite(dataIndex) ? dataIndex : position;
    }

    return -1;
  }

  function elementFullText(element) {
    const pieces = [];
    const seen = new Set();
    if (!element) return "";

    function addPiece(value) {
      const text = String(value || "").replace(/\s+/g, " ").trim();
      const key = normalizeKey(text);
      const duplicate = Array.from(seen).some((existing) => {
        if (!existing || existing.length < 4 || !key) return false;
        return existing === key || existing.indexOf(key) >= 0 || key.indexOf(existing) >= 0;
      });
      if (!text || duplicate) return;
      seen.add(key);
      pieces.push(text);
    }

    element.querySelectorAll("[data-full-text]").forEach((child) => {
      addPiece(child.getAttribute("data-full-text") || child.textContent || "");
    });
    addPiece(element.getAttribute("data-full-text") || element.textContent || "");
    return pieces.join(" ").replace(/\s+/g, " ").trim();
  }

  function cellText(row, index) {
    if (index < 0 || !row.children[index]) return "";
    return elementFullText(row.children[index]);
  }

  function fallbackReceivedText(row) {
    const cells = Array.from(row.children).reverse();
    const found = cells.find((cell) => {
      const text = normalizeKey(elementFullText(cell));
      return /(dia|hora|minuto|mes|semana|ano)/.test(text);
    });
    return found ? elementFullText(found) : "";
  }

  function parseRgbColor(value) {
    const match = String(value || "").match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\s*\)/i);
    if (!match) return null;
    const alpha = match[4] == null ? 1 : Number(match[4]);
    if (!alpha) return null;
    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
  }

  function rgbArrayToCss(color) {
    return Array.isArray(color) ? "rgb(" + color.join(", ") + ")" : "";
  }

  function deadlineCell(row, index) {
    return index >= 0 && row.children[index] ? row.children[index] : null;
  }

  function deadlineVisualElement(row, deadlineIndex) {
    const cell = deadlineCell(row, deadlineIndex);
    if (!cell) return null;
    return (
      cell.querySelector("a.badge[href*='/calendars/']") ||
      cell.querySelector(".badge-danger, .badge-warning, .badge-primary") ||
      cell.querySelector(".deadline-late, .deadline-short, .deadline-long, .deadline-none") ||
      cell.querySelector("a.badge, .badge") ||
      cell
    );
  }

  function elementClassSnapshot(element) {
    if (!element) return "";
    const nodes = [element].concat(Array.from(element.querySelectorAll ? element.querySelectorAll("*") : []));
    return normalizeKey(nodes.map((node) => String(node.className || node.getAttribute("class") || "")).join(" "));
  }

  function deadlineKindFromClasses(classes) {
    if (/\b(deadline late|badge danger|text danger)\b/.test(classes)) return "late";
    if (/\b(deadline short|badge warning|text warning|bg warning)\b/.test(classes)) return "short";
    if (/\b(deadline long|badge primary|text info|text primary)\b/.test(classes)) return "long";
    if (/\b(deadline none|badge secondary|badge light)\b/.test(classes)) return "none";
    return "";
  }

  function deadlineKindFromColor(fillColor) {
    if (!Array.isArray(fillColor)) return "";
    const red = fillColor[0];
    const green = fillColor[1];
    const blue = fillColor[2];
    if (red >= 180 && green <= 100 && blue <= 110) return "late";
    if (red >= 190 && green >= 140 && blue <= 90) return "short";
    if (blue >= 140 && red <= 110) return "long";
    return "";
  }

  function deadlineComputedColors(element) {
    if (!element || !window.getComputedStyle) return {};
    try {
      const style = window.getComputedStyle(element);
      return {
        fillColor: parseRgbColor(style.backgroundColor),
        textColor: parseRgbColor(style.color),
        borderColor: parseRgbColor(style.borderColor)
      };
    } catch (_error) {
      return {};
    }
  }

  function deadlineStyle(row, deadlineIndex) {
    const cell = deadlineCell(row, deadlineIndex);
    const visualElement = deadlineVisualElement(row, deadlineIndex);
    const classes = elementClassSnapshot(cell);
    const computed = deadlineComputedColors(visualElement);
    const kind = deadlineKindFromClasses(classes) || deadlineKindFromColor(computed.fillColor) || "default";
    const preset = DEADLINE_STYLE_PRESETS[kind] || DEADLINE_STYLE_PRESETS.default;
    const fillColor = computed.fillColor || preset.fillColor;
    const textColor = computed.textColor || preset.textColor;
    const borderColor = computed.borderColor || preset.borderColor;
    return {
      kind,
      label: preset.label,
      fillColor,
      textColor,
      borderColor,
      screenBackground: rgbArrayToCss(fillColor) || preset.screenBackground,
      screenText: rgbArrayToCss(textColor) || preset.screenText,
      screenBorder: rgbArrayToCss(borderColor) || preset.screenBorder
    };
  }

  function parseNumericWord(text) {
    const normalized = normalizeKey(text);
    const number = normalized.match(/\d+/);
    if (number) return parseInt(number[0], 10);
    if (/\b(um|uma)\b/.test(normalized)) return 1;
    return 0;
  }

  function receivedDurationInfo(text) {
    const normalized = normalizeKey(text);
    const amount = parseNumericWord(normalized);
    if (!amount) return { amount: 0, unit: "dias", days: 0, display: "0 dias" };

    if (normalized.indexOf("hora") >= 0) {
      return { amount, unit: "horas", days: 0, display: amount + " " + (amount === 1 ? "hora" : "horas") };
    }
    if (normalized.indexOf("minuto") >= 0 || normalized.indexOf("segundo") >= 0) {
      return { amount: 0, unit: "horas", days: 0, display: "0 horas" };
    }

    let days = 0;
    if (normalized.indexOf("semana") >= 0) days = amount * 7;
    else if (normalized.indexOf("mes") >= 0) days = amount * 30;
    else if (normalized.indexOf("ano") >= 0) days = amount * 365;
    else if (normalized.indexOf("dia") >= 0) days = amount;

    return { amount: days, unit: "dias", days, display: days + " " + (days === 1 ? "dia" : "dias") };
  }

  function parseReceivedDays(text) {
    return receivedDurationInfo(text).days;
  }

  function formatReceivedText(text) {
    return receivedDurationInfo(text).display;
  }

  function parseDeadlineDate(text) {
    const value = String(text || "").replace(/\s+/g, " ");
    const match = value.match(/\b(\d{2})\/(\d{2})\/(\d{4})(?:\s*-\s*(\d{2}):(\d{2}))?/);
    if (!match) return null;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const hour = match[4] ? parseInt(match[4], 10) : 23;
    const minute = match[5] ? parseInt(match[5], 10) : 59;
    const date = new Date(year, month, day, hour, minute, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
    return date;
  }

  function textFromHtmlSnippet(value) {
    const raw = String(value || "");
    if (!raw) return "";
    try {
      const template = document.createElement("template");
      template.innerHTML = raw;
      return String(template.content.textContent || raw).replace(/\s+/g, " ").trim();
    } catch (_error) {
      return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  function deadlineDetailText(row, deadlineIndex) {
    const cell = deadlineIndex >= 0 && row.children[deadlineIndex] ? row.children[deadlineIndex] : null;
    if (!cell) return "";
    const pieces = [];
    const attributes = ["data-content", "data-original-title", "title", "aria-label"];
    const candidates = [cell].concat(
      Array.from(cell.querySelectorAll("[data-content], [data-original-title], [title], [aria-label]"))
    );
    candidates.forEach((element) => {
      attributes.forEach((attribute) => {
        const value = textFromHtmlSnippet(element.getAttribute(attribute));
        if (value) pieces.push(value);
      });
    });
    return pieces.join(" ").replace(/\s+/g, " ").trim();
  }

  function parseKnowledgeDate(text) {
    const value = normalizeText(text);
    const match = value.match(/ciencia\s+registrada\s+em\s+(\d{2}\/\d{2}\/\d{4}(?:\s*-\s*\d{2}:\d{2})?)/i);
    if (match) return parseDeadlineDate(match[1]);
    const fallback = value.match(/ciencia[^0-9]{0,50}(\d{2}\/\d{2}\/\d{4}(?:\s*-\s*\d{2}:\d{2})?)/i);
    return fallback ? parseDeadlineDate(fallback[1]) : null;
  }

  function receivedBaseDate(reportDate, receivedDays) {
    const days = Math.max(0, Number(receivedDays) || 0);
    return addDays(startOfDate(reportDate), -days);
  }

  function rowSearchText(row) {
    const pieces = [];
    row.querySelectorAll("[data-full-text], td").forEach((element) => {
      pieces.push(element.getAttribute("data-full-text") || element.textContent || "");
    });
    return pieces.join(" ");
  }

  function rowProcedureId(row) {
    const checkbox = row.querySelector("input.procedure-inbox-checkbox[value], input[name^='procedure_inbox_']");
    const fromCheckbox = checkbox ? checkbox.value : "";
    const procedureLink = row.querySelector("a[href*='/procedures/']");
    const procedureMatch = procedureLink
      ? String(procedureLink.href || procedureLink.getAttribute("href") || "").match(/\/procedures\/(\d+)/)
      : null;
    return row.getAttribute("data-procedure-id") || fromCheckbox || (procedureMatch ? procedureMatch[1] : "");
  }

  function extractProcessNumber(text) {
    const match = normalizeText(text).match(/\d{7}-\d{2}\.\d{4}\.\d{1,2}\.\d{2}\.\d{4}/);
    return match ? match[0] : "";
  }

  function columnsForManagement() {
    const assessorIndex = findColumnIndex(["Assessor(a)", "Assessor", "Assessora", "Assessor Responsavel"]);
    const manifestationIndex = findColumnIndex([
      "Manisfestacao Sugerida",
      "Manifestacao Sugerida",
      "Manifestacao",
      "manifestation"
    ]);
    const processIndex = findColumnIndex(["Numero do Processo", "Processo"]);
    const receivedIndex = findColumnIndex(["received_at", "Recebido"]);
    const deadlineIndex = findColumnIndex(["deadline", "Prazo"]);
    const lastMovementIndex = findColumnIndex([
      "Ultimo andamento",
      "Último andamento",
      "Ultima movimentacao",
      "Última movimentação",
      "Andamento"
    ]);

    if (assessorIndex < 0) throw new Error("Coluna 'Assessor(a)' nao encontrada ou nao habilitada no SPA.");
    if (manifestationIndex < 0) throw new Error("Coluna 'Manifestacao Sugerida' nao encontrada ou nao habilitada.");
    if (processIndex < 0) throw new Error("Coluna 'Numero do Processo' nao encontrada ou nao habilitada.");
    if (deadlineIndex < 0) throw new Error("Coluna 'Prazo' nao encontrada ou nao habilitada.");
    if (lastMovementIndex < 0) throw new Error("Coluna 'Ultimo andamento' nao encontrada ou nao habilitada no SPA.");

    return { assessorIndex, manifestationIndex, processIndex, receivedIndex, deadlineIndex, lastMovementIndex };
  }

  function movementKind(type) {
    const value = normalizeKey(type);
    return value.indexOf("contrarra") >= 0 || value.indexOf("contra raz") >= 0 ? "contrarrazao" : "recurso";
  }

  function deadlineRuleKey(type) {
    const value = normalizeKey(type);
    if (value.indexOf("embarg") >= 0 && value.indexOf("declar") >= 0) return "embargos_de_declaracao";
    if (value.indexOf("inominad") >= 0) return "recurso_inominado";
    if (value.indexOf("apel") >= 0) return "apelacao";
    if (value.indexOf("agravo") >= 0 && value.indexOf("intern") >= 0) return "agravo_interno";
    if (value.indexOf("agravo") >= 0 && value.indexOf("instrument") >= 0) return "agravo_de_instrumento";
    if (value.indexOf("especial") >= 0) return "recurso_especial";
    if (value.indexOf("extraordin") >= 0) return "recurso_extraordinario";
    if (value.indexOf("contest") >= 0) return "contestacao";
    if (value.indexOf("manifest") >= 0) return "manifestacao";
    return "";
  }

  function internalDeadlineForType(type) {
    const kind = movementKind(type);
    const key = deadlineRuleKey(type);
    const rule = key ? INTERNAL_DEADLINE_LIMITS[key] : null;
    const ruleLimit = rule ? rule[kind] : null;
    const limit =
      Number.isFinite(ruleLimit) && ruleLimit > 0 ? ruleLimit : DEFAULT_INTERNAL_DEADLINE_BUSINESS_DAYS;
    return {
      key: key || "padrao",
      label: rule ? rule.label : "Padrao",
      movementKind: kind,
      days: limit,
      isDefault: !rule || !(Number.isFinite(ruleLimit) && ruleLimit > 0)
    };
  }

  function resourcePriority(type) {
    const value = normalizeKey(type);
    const isCounter = value.indexOf("contrarra") >= 0 || value.indexOf("contra raz") >= 0;
    if (isCounter && value.indexOf("embarg") >= 0) return { priority: 5, label: "Contrarrazoes de Embargos" };
    if (!isCounter && value.indexOf("embarg") >= 0 && value.indexOf("declar") >= 0) {
      return { priority: 1, label: "Embargos de Declaracao" };
    }
    if (!isCounter && value.indexOf("inominad") >= 0) return { priority: 2, label: "Recurso Inominado" };
    if (!isCounter && (value.indexOf("especial") >= 0 || value.indexOf("extraordin") >= 0)) {
      return { priority: 2, label: "Recurso Especial/Extraordinario" };
    }
    if (!isCounter && value.indexOf("apel") >= 0) return { priority: 3, label: "Recurso de Apelacao" };
    if (!isCounter && value.indexOf("agravo") >= 0 && value.indexOf("intern") >= 0) {
      return { priority: 4, label: "Agravo Interno" };
    }
    if (!isCounter && value.indexOf("agravo") >= 0 && value.indexOf("instrument") >= 0) {
      return { priority: 4, label: "Agravo de Instrumento" };
    }
    return null;
  }

  function classifyManifestation(type) {
    const priority = resourcePriority(type);
    const value = normalizeKey(type);
    if (priority) return { group: "recursos", priority: priority.priority, priorityLabel: priority.label };
    if (value.indexOf("contest") >= 0) return { group: "contestacao", priority: null, priorityLabel: "" };
    return { group: "demais", priority: null, priorityLabel: "" };
  }

  function statusMatches(value, expected) {
    const current = normalizeKey(value);
    const target = normalizeKey(expected);
    if (!current || !target) return false;
    return current === target || current.indexOf(target + " ") === 0 || (" " + current + " ").indexOf(" " + target + " ") >= 0;
  }

  function statusMatchesExact(value, expected) {
    return normalizeKey(value) === normalizeKey(expected);
  }

  function statusContains(value, expected) {
    const current = normalizeKey(value);
    const target = normalizeKey(expected);
    return Boolean(current && target && current.indexOf(target) >= 0);
  }

  function classifyInboxType(lastMovement) {
    const text = normalizeText(lastMovement);
    if (!text) return { key: "campo_vazio", label: INBOX_TYPES.campo_vazio.label };

    for (const item of INBOX_STATUS_MAP) {
      const matcher = item.contains ? statusContains : item.exact ? statusMatchesExact : statusMatches;
      if (item.statuses.some((status) => matcher(text, status))) {
        return { key: item.key, label: INBOX_TYPES[item.key].label };
      }
    }

    return { key: "identificar", label: INBOX_TYPES.identificar.label };
  }

  function receivedDaysValue(record) {
    return Math.max(0, Number(record && record.receivedDays) || 0);
  }

  function receivedBusinessDaysValue(record, reportDate) {
    const baseDate = record && record.calculationBaseDate instanceof Date ? record.calculationBaseDate : null;
    return baseDate ? businessDaysBetweenDates(baseDate, reportDate || startOfToday()) : receivedDaysValue(record);
  }

  function receivedColumnBusinessDaysValue(record, reportDate) {
    const receivedDays = receivedDaysValue(record);
    const baseDate = receivedBaseDate(reportDate || startOfToday(), receivedDays);
    return businessDaysBetweenDates(baseDate, reportDate || startOfToday());
  }

  function usesReceivedColumnForBilling(record, alertType) {
    return alertType === "triagem" || (alertType === "correcao" && record && record.inboxType === "revisor");
  }

  function billingBusinessDaysValue(record, alertType, reportDate) {
    return usesReceivedColumnForBilling(record, alertType)
      ? receivedColumnBusinessDaysValue(record, reportDate)
      : receivedBusinessDaysValue(record, reportDate);
  }

  function billingChargeGroup(record, alertType) {
    if (alertType === "peca" && record && record.inboxType === "retificar") {
      return {
        key: "peca_retificar",
        label: "Pecas a retificar: 3 ou mais dias uteis na caixa",
        order: 2
      };
    }
    if (alertType === "peca") {
      return {
        key: "peca_critica",
        label: "Processos criticos na Caixa Geral do Redator",
        order: 1
      };
    }
    if (alertType === "correcao") {
      return {
        key: "revisor",
        label: "Caixa Geral do Revisor: 2 ou mais dias uteis por Recebido",
        order: 1
      };
    }
    return {
      key: "triagem",
      label: "Caixa Geral do Triador: 3 ou mais dias uteis por Recebido",
      order: 1
    };
  }

  function billingCriteriaText(alertType) {
    if (alertType === "triagem") {
      return "Caixa Geral do Triador com " + TRIAGE_BILLING_RECEIVED_BUSINESS_DAYS +
        " ou mais dias uteis, calculados pela coluna Recebido";
    }
    if (alertType === "correcao") {
      return "Caixa Geral do Revisor com " + REVIEWER_BILLING_RECEIVED_BUSINESS_DAYS +
        " ou mais dias uteis, calculados pela coluna Recebido";
    }
    if (alertType === "peca") {
      return "Caixa Geral do Redator com situacao Critico no relatorio gerencial; ou Pecas a Retificar com " +
        CORRECTION_BILLING_BUSINESS_DAYS + " ou mais dias uteis na caixa";
    }
    return "Criterio nao identificado";
  }

  function isTriageUnassignedAfterBusinessLimit(record, reportDate) {
    return Boolean(
      record &&
        record.inboxType === "triador" &&
        isUnassignedAssessor(record.assessor) &&
        receivedBusinessDaysValue(record, reportDate) >= BOX_CRITICAL_BUSINESS_DAYS
    );
  }

  function isCorrectionBoxAfterBusinessLimit(record, reportDate) {
    return Boolean(
      record &&
        record.inboxType === "retificar" &&
        receivedBusinessDaysValue(record, reportDate) >= BOX_CRITICAL_BUSINESS_DAYS
    );
  }

  function isReviewerBoxAfterBusinessLimit(record, reportDate) {
    return Boolean(
      record &&
        record.inboxType === "revisor" &&
        receivedBusinessDaysValue(record, reportDate) >= BOX_CRITICAL_BUSINESS_DAYS
    );
  }

  function isProcuratorBoxAfterBusinessLimit(record, reportDate) {
    return Boolean(
      record &&
        record.inboxType === "finalizadas" &&
        receivedBusinessDaysValue(record, reportDate) >= BOX_CRITICAL_BUSINESS_DAYS
    );
  }

  function riskScore(record, reportDate) {
    const today = reportDate || startOfToday();
    let score = 0;
    const internalDays = Number(record.internalDaysRemaining);
    const pjeDays = record.pjeDeadlineDate ? daysBetweenDates(today, record.pjeDeadlineDate) : null;

    if (record.group === "recursos") score += 22;
    else if (record.group === "contestacao") score += 14;
    else score += 7;

    if (record.priority) score += Math.max(0, 6 - record.priority) * 5;
    if (internalDays <= 0) score += 65 + Math.min(60, Math.abs(internalDays) * 5);
    else if (internalDays <= 2) score += 34;
    else if (internalDays <= 5) score += 16;

    if (pjeDays != null) {
      if (pjeDays <= 0) score += 85 + Math.min(70, Math.abs(pjeDays) * 6);
      else if (pjeDays <= 2) score += 65;
      else if (pjeDays <= 5) score += 38;
      else if (pjeDays <= 8) score += 22;
    }

    if (record.receivedDays > 20) score += 35 + Math.min(60, record.receivedDays - 20);
    if (isTriageUnassignedAfterBusinessLimit(record, today)) {
      score += 58 + Math.min(45, receivedBusinessDaysValue(record, today) - BOX_CRITICAL_BUSINESS_DAYS);
    }
    if (isCorrectionBoxAfterBusinessLimit(record, today)) {
      score += 44 + Math.min(40, receivedBusinessDaysValue(record, today) - BOX_CRITICAL_BUSINESS_DAYS);
    }
    if (isReviewerBoxAfterBusinessLimit(record, today)) {
      score += 44 + Math.min(40, receivedBusinessDaysValue(record, today) - BOX_CRITICAL_BUSINESS_DAYS);
    }
    if (isProcuratorBoxAfterBusinessLimit(record, today)) {
      score += 44 + Math.min(40, receivedBusinessDaysValue(record, today) - BOX_CRITICAL_BUSINESS_DAYS);
    }

    return Math.round(score);
  }

  function riskStatus(record, reportDate) {
    const today = reportDate || startOfToday();
    const pjeDays = record.pjeDeadlineDate ? daysBetweenDates(today, record.pjeDeadlineDate) : null;
    if (
      record.internalDaysRemaining <= 0 ||
      record.receivedDays > 20 ||
      (pjeDays != null && pjeDays <= 3) ||
      isTriageUnassignedAfterBusinessLimit(record, today) ||
      isCorrectionBoxAfterBusinessLimit(record, today) ||
      isReviewerBoxAfterBusinessLimit(record, today) ||
      isProcuratorBoxAfterBusinessLimit(record, today)
    ) {
      return "Critico";
    }
    if (record.internalDaysRemaining <= 2 || (pjeDays != null && pjeDays <= 8)) {
      return "Atencao";
    }
    return "Regular";
  }

  function isCriticalRecord(record) {
    return record && record.riskStatus === "Critico";
  }

  function isAttentionRecord(record) {
    return record && record.riskStatus === "Atencao";
  }

  function recordRiskReasons(record) {
    const reasons = [];
    if (!record) return "-";

    if (record.internalDaysRemaining <= 0) reasons.push("Prazo interno atingido/vencido");
    if (record.receivedDays > 20) reasons.push("Mais de 20 dias na caixa");
    if (record.pjeDaysRemaining != null && record.pjeDaysRemaining <= 3) {
      reasons.push("Prazo SPA (PJE) em ate 3 dias/vencido");
    }
    if (isTriageUnassignedAfterBusinessLimit(record)) reasons.push("Triagem sem assessor >=2du");
    if (isCorrectionBoxAfterBusinessLimit(record)) reasons.push("Correcao >=2du");
    if (isReviewerBoxAfterBusinessLimit(record)) reasons.push("Revisor >=2du");
    if (isProcuratorBoxAfterBusinessLimit(record)) reasons.push("Procurador >=2du");

    if (!reasons.length && record.internalDaysRemaining <= 2) reasons.push("Prazo interno em ate 2 dias");
    if (!reasons.length && record.pjeDaysRemaining != null && record.pjeDaysRemaining <= 8) {
      reasons.push("Prazo SPA (PJE) em ate 8 dias");
    }

    return reasons.length ? reasons.join("; ") : "Sem alerta";
  }

  function criticalLoadInfo(summary) {
    const critical = Math.max(0, Number(summary && summary.critical) || 0);
    const attention = Math.max(0, Number(summary && summary.attention) || 0);
    const over20 = Math.max(0, Number(summary && summary.over20) || 0);
    const pjeNear = Math.max(0, Number(summary && summary.pjeNear) || 0);

    if (critical >= 6 || attention >= 11 || over20 >= 6 || pjeNear >= 12) {
      return { label: "Muito Alta", rank: 4, color: "#b42318" };
    }
    if (critical >= 3 || attention >= 6 || over20 >= 3 || pjeNear >= 7) {
      return { label: "Alta", rank: 3, color: "#dc3545" };
    }
    if (critical >= 1 || attention >= 3 || over20 >= 1 || pjeNear >= 3) {
      return { label: "Media", rank: 2, color: "#b7791f" };
    }
    return { label: "Baixa", rank: 1, color: "#166534" };
  }

  function criticalRulesText() {
    return [
      "Processo Critico: aparece quando tem prazo interno atingido/vencido, mais de 20 dias na caixa, Prazo SPA (PJE) em ate 3 dias/vencido, triagem sem assessor com 2 dias uteis ou mais, revisor com 2 dias uteis ou mais, correcao com 2 dias uteis ou mais ou procurador com 2 dias uteis ou mais.",
      "Processo em Atencao: aparece quando tem prazo interno em ate 2 dias ou Prazo SPA (PJE) em ate 8 dias.",
      "Carga Baixa: sem processos criticos e ate 2 processos em atencao.",
      "Carga Media: 1 a 2 processos criticos, ou 3 a 5 em atencao, ou ao menos 1 processo com mais de 20 dias.",
      "Carga Alta: 3 a 5 processos criticos, ou 6 a 10 em atencao, ou 3 a 5 processos com mais de 20 dias.",
      "Carga Muito Alta: 6 ou mais processos criticos, ou 11 ou mais em atencao, ou 6 ou mais processos com mais de 20 dias."
    ];
  }

  function buildRecord(row, columns, reportDate) {
    const workspace = row.readingScope === "workspace-list";
    const rawAssessor = (workspace ? row.assessor : cellText(row, columns.assessorIndex)) || "Sem assessor(a)";
    const rawType = (workspace ? row.manifestationSuggested : cellText(row, columns.manifestationIndex)) || "Sem manifestacao sugerida";
    const processNumber = workspace ? row.processNumber : cellText(row, columns.processIndex) || extractProcessNumber(rowSearchText(row));
    const procedureId = workspace ? row.procedureId : rowProcedureId(row);
    const rawReceivedText = workspace ? row.receivedText || "" : cellText(row, columns.receivedIndex) || fallbackReceivedText(row) || "0 dia(s)";
    const rawDeadlineText = workspace ? row.pjeDeadline : cellText(row, columns.deadlineIndex);
    const rawLastMovement = workspace ? row.lastProgress : cellText(row, columns.lastMovementIndex);
    const pjeDeadlineDate = parseDeadlineDate(rawDeadlineText);
    const pjeDeadlineStyle = workspace ? DEADLINE_STYLE_PRESETS.default : deadlineStyle(row, columns.deadlineIndex);
    const knowledgeDate = workspace ? parseDeadlineDate(row.knowledgeDateText) || parseKnowledgeDate(row.deadlineDetails) : parseKnowledgeDate(deadlineDetailText(row, columns.deadlineIndex));
    const receivedDays = workspace && !/(?:dia|hora|minuto|segundo|semana|mes|ano|hoje)/i.test(normalizeKey(rawReceivedText)) ? NaN : parseReceivedDays(rawReceivedText);
    const classification = classifyManifestation(rawType);
    const inboxClassification = classifyInboxType(rawLastMovement);
    const internalDeadline = internalDeadlineForType(rawType);
    const calculationBaseDate = knowledgeDate || (Number.isFinite(receivedDays) ? receivedBaseDate(reportDate, receivedDays) : null);
    const internalDueDate = calculationBaseDate ? addBusinessDays(calculationBaseDate, internalDeadline.days) : null;
    const internalDaysRemaining = internalDueDate ? daysBetweenDates(reportDate, internalDueDate) : NaN;
    const pjeDaysRemaining = pjeDeadlineDate ? daysBetweenDates(reportDate, pjeDeadlineDate) : null;

    const record = {
      assessor: normalizeText(rawAssessor) || "Sem assessor(a)",
      type: rawType,
      processNumber: processNumber || "Processo nao identificado",
      procedureId,
      procedureUrl: workspace ? row.pendencyUrl : procedurePageUrl(procedureId),
      knowledgeDate,
      knowledgeDateText: knowledgeDate ? formatDateTime(knowledgeDate) : "Nao localizada",
      pjeDeadlineDate,
      pjeDeadlineText: pjeDeadlineDate ? formatDateTime(pjeDeadlineDate) : "-",
      pjeDeadlineStyle,
      pjeDaysRemaining,
      receivedText: rawReceivedText ? formatReceivedText(rawReceivedText) : "Não informado",
      receivedDays,
      internalDeadline,
      internalDeadlineText:
        internalDeadline.days + " " + (internalDeadline.days === 1 ? "dia util" : "dias uteis"),
      calculationBaseDate,
      calculationBaseSource: !calculationBaseDate ? "não informada" : knowledgeDate ? "ciencia" : "recebido",
      internalDueDate,
      internalDueDateText: internalDueDate ? formatDate(internalDueDate) : "Não informado",
      internalDaysRemaining,
      group: classification.group,
      categoryLabel: REPORT_TYPES[classification.group].label,
      lastMovement: normalizeText(rawLastMovement),
      inboxType: inboxClassification.key,
      inboxTypeLabel: inboxClassification.label,
      priority: classification.priority,
      priorityLabel: classification.priorityLabel
    };

    record.riskScore = riskScore(record, reportDate);
    record.riskStatus = riskStatus(record, reportDate);
    return record;
  }

  function currentRows() {
    return Array.from(document.querySelectorAll("#procedures-box tbody tr.group-item"));
  }

  async function setDataTablePage(dt, pageNumber, timeoutMs) {
    dt.page(pageNumber).draw("page");
    await sleep(CONFIG.delayPageMs);
    await waitProcessingDone("pagina " + (pageNumber + 1), timeoutMs);
  }

  async function setDataTablePageLength(dt, length, timeoutMs) {
    if (dt.page.len() === length) return;
    dt.page.len(length).draw(false);
    await sleep(CONFIG.delayPageMs);
    await waitProcessingDone(length + " processos por pagina", timeoutMs);
  }

  async function collectAllRecords() {
    state.workspaceCoverage = null;
    // A rota /workspace do SPA2 nao possui as colunas DataTables do SPA1.
    // Reconhecer pela URL primeiro, mesmo quando a SPA apresenta no DOM
    // uma tabela legada oculta. Nunca recorrer a columnsForManagement aqui.
    if (/^\/workspace\/?$/.test(window.location.pathname)) {
      const adapter = window.SpaAdapter;
      if (!adapter || typeof adapter.collectWorkspaceRecords !== 'function') {
        throw new Error('Leitor do SPA2 nao carregado. Recarregue o SPA e a extensao para habilitar o adaptador de workspace.');
      }
      const reportDate = startOfToday();
      const onProgress = ({count, total, rounds, pages, concurrency, batchSize, lastCompletedPage, lastCompletedMs}) => {
        document.getElementById('mtprev-management-launcher')?.mtprevProgress?.update({count,total,rounds,pages,concurrency,batchSize,lastCompletedPage,lastCompletedMs},state.collectionStartedAt || Date.now());
        if (state.stopped) throw new DOMException('Carregamento interrompido', 'AbortError');
        setStatus(`Lendo SPA2: ${count} de ${total ?? '?'} expediente(s)…`);
      };
      const coverage = globalThis.MTPrevWorkspaceCache?.collect
        ? await globalThis.MTPrevWorkspaceCache.collect({onProgress,force:Boolean(state.managementForceRefresh)})
        : typeof adapter.collectWorkspaceReport === 'function'
          ? await adapter.collectWorkspaceReport({isStopped: () => state.stopped, onProgress})
          : await adapter.collectWorkspaceRecords({onProgress});
      if (coverage?.fromCache) setStatus('Dados da mesa reutilizados do cache completo (até 10 minutos).');
      if (!coverage || !Array.isArray(coverage.records)) {
        throw new Error('A consulta do SPA2 nao devolveu registros validos para o painel gerencial.');
      }
      if (state.stopped) throw new DOMException('Carregamento interrompido', 'AbortError');
      if (coverage.reason !== 'complete') {
        throw new Error('Leitura da mesa incompleta: ' + coverage.records.length +
          ' de ' + (coverage.total ?? '?') + ' expedientes. Nao foi gerado um painel parcial.');
      }
      state.workspaceCoverage = coverage;
      log(typeof adapter.collectionSummary === 'function'
        ? adapter.collectionSummary(coverage)
        : `Leitura completa do SPA2: ${coverage.records.length} expediente(s).`);
      const withoutAssessor = coverage.records.filter(item => !String(item.assessor || '').trim()).length;
      if (withoutAssessor) {
        log(`${withoutAssessor} expediente(s) sem Assessor(a) disponivel no card do SPA2; classificados como sem assessor(a), sem inferir responsavel.`, 'error');
      }
      return { records: coverage.records.map(item => buildRecord(item, {}, reportDate)), reportDate, coverage };
    }
    const dt = getDataTable();
    const columns = columnsForManagement();
    const reportDate = startOfToday();
    const originalLength = dt.page.len();
    const originalInfo = dt.page.info();
    const originalPage = originalInfo && Number.isFinite(originalInfo.page) ? originalInfo.page : 0;
    const collected = [];
    const seen = new Set();

    try {
      await setDataTablePageLength(dt, CONFIG.pageLength);
      await setDataTablePage(dt, 0);

      const info = dt.page.info();
      const pages = Math.max(1, info && Number.isFinite(info.pages) ? info.pages : 1);
      for (let page = 0; page < pages; page += 1) {
        if (state.stopped) break;
        if (page > 0) await setDataTablePage(dt, page);
        setStatus("Lendo pagina " + (page + 1) + "/" + pages + "... " + collected.length + " processo(s) coletado(s)");
        document.getElementById('mtprev-management-launcher')?.mtprevProgress?.update({count:page+1,total:pages,units:'páginas'},state.collectionStartedAt || Date.now());

        const rows = currentRows();
        rows.forEach((row) => {
          const record = buildRecord(row, columns, reportDate);
          const key = [record.assessor, record.processNumber, normalizeKey(record.type), record.receivedText].join("|");
          if (seen.has(key)) return;
          seen.add(key);
          collected.push(record);
        });

        if (pages > 8 && ((page + 1) % 5 === 0 || page + 1 === pages)) {
          log(
            "Leitura gerencial: " +
              (page + 1) +
              "/" +
              pages +
              " paginas, " +
              collected.length +
              " processo(s) coletado(s)."
          );
        }
      }
    } finally {
      try {
        await setDataTablePageLength(dt, originalLength, 30000);
        const restoredInfo = dt.page.info();
        const maxPage = Math.max(0, (restoredInfo.pages || 1) - 1);
        await setDataTablePage(dt, Math.min(originalPage, maxPage), 30000);
      } catch (error) {
        log("Nao foi possivel restaurar a paginacao original: " + error.message, "error");
      }
    }

    return { records: collected, reportDate };
  }

  function categoryCounts(records) {
    const counts = { recursos: 0, contestacao: 0, demais: 0 };
    records.forEach((record) => {
      if (counts[record.group] != null) counts[record.group] += 1;
    });
    return counts;
  }

  function isUrgent(record) {
    return record.internalDaysRemaining <= 0;
  }

  function isPjeNear(record) {
    return record.pjeDaysRemaining != null && record.pjeDaysRemaining <= 8;
  }

  function yesNo(value) {
    return value ? "Sim" : "Nao";
  }

  function receivedAgeRange(days) {
    const value = Math.max(0, Number(days) || 0);
    if (value <= 5) return "0-5 dias";
    if (value <= 10) return "6-10 dias";
    if (value <= 20) return "11-20 dias";
    return "+20 dias";
  }

  function movementKindLabel(kind) {
    return kind === "contrarrazao" ? "Contrarrazao" : "Recurso/Manifestacao";
  }

  function recordsAverageReceived(records) {
    if (!records.length) return 0;
    return records.reduce((sum, record) => sum + Math.max(0, Number(record.receivedDays) || 0), 0) / records.length;
  }

  function oldestBaseDate(records, reportDate) {
    if (!records.length) return null;
    const maxDays = Math.max.apply(
      null,
      records.map((record) => Math.max(0, Number(record.receivedDays) || 0))
    );
    return receivedBaseDate(reportDate, maxDays);
  }

  function nearestPjeDate(records) {
    const dates = records
      .map((record) => record.pjeDeadlineDate)
      .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    return dates[0] || null;
  }

  function buildAssessorSummaries(records, reportDate) {
    const grouped = new Map();
    records.forEach((record) => {
      const key = record.assessor || "Sem assessor(a)";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(record);
    });

    return Array.from(grouped.keys())
      .sort((a, b) => normalizeKey(a).localeCompare(normalizeKey(b), "pt-BR"))
      .map((assessor) => {
        const items = grouped.get(assessor);
        const counts = categoryCounts(items);
        const urgent = items.filter(isUrgent).length;
        const critical = items.filter(isCriticalRecord).length;
        const attention = items.filter(isAttentionRecord).length;
        const regular = items.length - critical - attention;
        const pjeNear = items.filter(isPjeNear).length;
        const over20 = items.filter((record) => record.receivedDays > 20).length;
        const averageReceived = recordsAverageReceived(items);
        const oldest = oldestBaseDate(items, reportDate);
        const nearest = nearestPjeDate(items);
        const sectorCounts = new Map();
        items.forEach((record) => {
          const sector = record.sector || "Setor nao identificado";
          sectorCounts.set(sector, (sectorCounts.get(sector) || 0) + 1);
        });
        const sector = Array.from(sectorCounts.entries())
          .sort((a, b) => b[1] - a[1] || normalizeKey(a[0]).localeCompare(normalizeKey(b[0]), "pt-BR"))
          .map((item) => item[0])[0] || "Setor nao identificado";
        const criticalScore = items.reduce((sum, record) => sum + record.riskScore, 0);
        const maxRisk = items.reduce((max, record) => Math.max(max, record.riskScore), 0);
        const summary = {
          assessor,
          sector,
          records: items,
          total: items.length,
          recursos: counts.recursos,
          contestacao: counts.contestacao,
          demais: counts.demais,
          urgent,
          critical,
          attention,
          regular,
          pjeNear,
          over20,
          averageReceived,
          averageReceivedText: decimalText(averageReceived, 1) + " dias",
          oldestBaseDate: oldest,
          oldestBaseDateText: oldest ? formatDate(oldest) : "-",
          nearestPjeDate: nearest,
          nearestPjeDateText: nearest ? formatDateTime(nearest) : "-",
          criticalScore,
          maxRisk
        };
        const load = criticalLoadInfo(summary);
        summary.criticalLoad = load.label;
        summary.criticalLoadRank = load.rank;
        summary.criticalLoadColor = load.color;
        return {
          ...summary
        };
      })
      .sort(
        (a, b) =>
          b.criticalLoadRank - a.criticalLoadRank ||
          b.critical - a.critical ||
          b.attention - a.attention ||
          b.urgent - a.urgent ||
          b.pjeNear - a.pjeNear ||
          b.over20 - a.over20 ||
          b.criticalScore - a.criticalScore ||
          b.total - a.total ||
          normalizeKey(a.assessor).localeCompare(normalizeKey(b.assessor), "pt-BR")
      );
  }

  function generalMetrics(records, reportDate) {
    const counts = categoryCounts(records);
    const summaries = buildAssessorSummaries(records, reportDate);
    const urgent = records.filter(isUrgent).length;
    const critical = records.filter(isCriticalRecord).length;
    const attention = records.filter(isAttentionRecord).length;
    const pjeNear = records.filter(isPjeNear).length;
    const over20 = records.filter((record) => record.receivedDays > 20).length;
    const sectors = Array.from(new Set(records.map((record) => record.sector || "Setor nao identificado"))).filter(
      (sector) => sector && !isSectorPlaceholder(sector)
    ).length;
    const unmatchedTeam = records.filter(isTeamUnmatched).length;
    const averageReceived = recordsAverageReceived(records);
    const oldest = oldestBaseDate(records, reportDate);
    const nearest = nearestPjeDate(records);
    return {
      total: records.length,
      assessors: summaries.length,
      sectors,
      unmatchedTeam,
      recursos: counts.recursos,
      contestacao: counts.contestacao,
      demais: counts.demais,
      urgent,
      critical,
      attention,
      pjeNear,
      over20,
      averageReceived,
      averageReceivedText: decimalText(averageReceived, 1) + " dias",
      oldestBaseDate: oldest,
      oldestBaseDateText: oldest ? formatDate(oldest) : "-",
      nearestPjeDate: nearest,
      nearestPjeDateText: nearest ? formatDateTime(nearest) : "-"
    };
  }

  function filteredRecords(records) {
    const selectedSectors = selectedSectorValues(records);
    const selectedSectorSet = new Set(selectedSectors);
    const selectedAssessors = selectedAssessorValues(records);
    const selectedAssessorSet = new Set(selectedAssessors);
    const selectedCategories = selectedCategoryValues();
    const selectedCategorySet = new Set(selectedCategories);
    const selectedInboxTypes = selectedInboxTypeValues();
    const selectedInboxTypeSet = new Set(selectedInboxTypes);
    const selectedRiskReasons = selectedRiskReasonValues(records);
    const selectedRiskReasonSet = new Set(selectedRiskReasons);
    return records.filter((record) => {
      if (!selectedSectorSet.has(record.sector || "Setor nao identificado")) return false;
      if (!selectedAssessorSet.has(record.assessor || "Sem assessor(a)")) return false;
      if (!selectedCategorySet.has(record.group)) return false;
      if (!selectedInboxTypeSet.has(record.inboxType || "campo_vazio")) return false;
      if (!riskReasonParts(record).some((reason) => selectedRiskReasonSet.has(reason))) return false;
      if (state.modal.onlyCritical && record.riskStatus !== "Critico") return false;
      return true;
    });
  }

  function criticalCompare(a, b) {
    return (
      b.riskScore - a.riskScore ||
      dateSortValue(a.pjeDeadlineDate) - dateSortValue(b.pjeDeadlineDate) ||
      dateSortValue(a.internalDueDate) - dateSortValue(b.internalDueDate) ||
      b.receivedDays - a.receivedDays ||
      normalizeKey(a.assessor).localeCompare(normalizeKey(b.assessor), "pt-BR")
    );
  }

  function sortCritical(records) {
    return records.slice().sort(criticalCompare);
  }

  function createElement(tag, text, cssText) {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    if (cssText) element.style.cssText = cssText;
    return element;
  }

  // Estilos isolados: nao alteram o SPA nem dependem de CSS externo.
  function ensureManagementDashboardStyles() {
    if (document.getElementById('mtprev-management-dashboard-css')) return;
    const style = document.createElement('style');
    style.id = 'mtprev-management-dashboard-css';
    style.textContent = `
      #${CONFIG.modalId}.mtprev-mgmt-overlay {position:fixed;inset:0;z-index:2147483630;display:flex;align-items:center;justify-content:center;background:rgba(13,28,48,.68);padding:12px;box-sizing:border-box;font:13px/1.45 system-ui,'Segoe UI',Arial,sans-serif;color:#223d5b;}
      #${CONFIG.modalId} .mtprev-mgmt-dialog {width:min(1600px,100%);max-height:calc(100dvh - 24px);overflow:auto;overscroll-behavior:contain;background:#f7faff;border-radius:15px;border:1px solid #9eb7cf;box-shadow:0 24px 80px rgba(8,27,47,.4);}
      #${CONFIG.modalId} .mtprev-mgmt-head {position:sticky;top:0;z-index:6;display:flex;align-items:center;gap:18px;flex-wrap:wrap;background:linear-gradient(110deg,#18364b 0%,#20536e 58%,#247d9b 100%);color:#fff;padding:17px 20px;border-bottom:3px solid #2a8ba4;}
      #${CONFIG.modalId} .mtprev-mgmt-brand {display:flex;align-items:center;justify-content:center;width:154px;min-height:52px;padding:6px 10px;box-sizing:border-box;background:#112d43;border:1px solid #3d7790;border-radius:11px;}
      #${CONFIG.modalId} .mtprev-mgmt-brand img {max-width:100%;max-height:46px;object-fit:contain;}
      #${CONFIG.modalId} .mtprev-mgmt-headline {flex:1;min-width:230px;}
      #${CONFIG.modalId} .mtprev-mgmt-headline h2 {font-size:20px;color:#fff;font-weight:800;line-height:1.2;margin:0 0 5px;}
      #${CONFIG.modalId} .mtprev-mgmt-headline small {font-size:11px;color:#c9e1ee;}
      #${CONFIG.modalId} .mtprev-mgmt-actions {display:flex;flex-wrap:wrap;align-items:center;gap:7px;}
      #${CONFIG.modalId} .mtprev-mgmt-actions button {border:1px solid #8cb0cb;border-radius:8px;background:#eaf4ff;color:#153952;font-weight:750;padding:8px 11px;font-size:12px;cursor:pointer;white-space:nowrap;}
      #${CONFIG.modalId} .mtprev-mgmt-actions button:hover {background:#fff;}
      #${CONFIG.modalId} .mtprev-mgmt-actions .mtprev-mgmt-close {background:#254c69;color:#fff;border-color:#93b9d1;}
      #${CONFIG.modalId} .mtprev-mgmt-body {padding:14px 17px 22px;}
      #${CONFIG.modalId} .mtprev-mgmt-filters {margin:0 0 13px;background:#fff;border:1px solid #d5e3f1;border-radius:11px;padding:13px 13px 10px;}
      #${CONFIG.modalId} .mtprev-mgmt-filtertitle {font-size:13px;font-weight:850;color:#153f5d;margin-bottom:8px;display:flex;align-items:center;gap:8px;}
      #${CONFIG.modalId} .mtprev-mgmt-filtertitle svg {width:18px;height:18px;flex:none;}
      #${CONFIG.modalId} .mtprev-mgmt-filtergrid {display:grid;grid-template-columns:repeat(5,minmax(175px,1fr)) auto;gap:9px;align-items:end;}
      #${CONFIG.modalId} .mtprev-mgmt-field {display:flex;flex-direction:column;gap:4px;min-width:0;}
      #${CONFIG.modalId} .mtprev-mgmt-field > span {font-weight:750;font-size:11px;color:#4a6884;}
      #${CONFIG.modalId} .mtprev-mgmt-field details {max-width:100%!important;min-width:0!important;width:100%!important;}
      #${CONFIG.modalId} .mtprev-mgmt-field details > summary {min-height:37px!important;border-radius:7px!important;border-color:#cbdcef!important;color:#294662!important;padding:9px 27px 7px 9px!important;}
      #${CONFIG.modalId} .mtprev-mgmt-field details > div {z-index:100!important;}
      #${CONFIG.modalId} .mtprev-mgmt-critical-label {min-height:37px;display:flex;align-items:center;gap:7px;font-size:11px;font-weight:750;color:#2e4b68;}
      #${CONFIG.modalId} .mtprev-mgmt-tabs {display:flex;gap:5px;flex-wrap:wrap;border-bottom:1px solid #cbddeb;margin:0 0 13px;}
      #${CONFIG.modalId} .mtprev-mgmt-tabs button {border:1px solid transparent!important;border-radius:8px 8px 0 0!important;background:#e6edf6!important;color:#34516a!important;padding:10px 15px!important;font-size:12px!important;font-weight:750!important;}
      #${CONFIG.modalId} .mtprev-mgmt-tabs button[aria-selected="true"] {background:#176cb8!important;color:white!important;box-shadow:inset 0 -3px #51b7ec;}
      #${CONFIG.modalId} .mtprev-mgmt-kpis {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px;}
      #${CONFIG.modalId} .mtprev-mgmt-kpi {background:#fff;border:1px solid #d6e4f0;border-radius:11px;min-width:0;min-height:92px;padding:13px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 6px rgba(21,51,78,.04);}
      #${CONFIG.modalId} .mtprev-mgmt-kpiicon,.mtprev-mgmt-charticon {width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none;background:var(--icon-soft,#e4f1ff);color:var(--icon-color,#2173ca);}
      #${CONFIG.modalId} .mtprev-mgmt-kpiicon svg,#${CONFIG.modalId} .mtprev-mgmt-charticon svg {width:21px;height:21px;}
      #${CONFIG.modalId} .mtprev-mgmt-kpibody {min-width:0;}
      #${CONFIG.modalId} .mtprev-mgmt-kpilabel {font-size:11px;color:#607994;font-weight:700;line-height:1.2;}
      #${CONFIG.modalId} .mtprev-mgmt-kpivalue {font-size:25px;color:var(--value-color,#153e62);font-weight:850;letter-spacing:-.025em;line-height:1.2;margin-top:5px;}
      #${CONFIG.modalId} .mtprev-mgmt-kpidetail {font-size:10px;color:#859ab0;margin-top:3px;}
      #${CONFIG.modalId} .mtprev-mgmt-charts {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:12px;}
      #${CONFIG.modalId} .mtprev-mgmt-chart {background:#fff;border:1px solid #d8e5f1;border-radius:11px;padding:14px;min-width:0;}
      #${CONFIG.modalId} .mtprev-mgmt-charthead {display:flex;align-items:center;gap:9px;margin-bottom:12px;}
      #${CONFIG.modalId} .mtprev-mgmt-charttitle {font-size:13px;font-weight:850;color:#153e61;}
      #${CONFIG.modalId} .mtprev-mgmt-chartsub {font-size:10px;color:#7a8fa4;}
      #${CONFIG.modalId} .mtprev-mgmt-charthead button {margin-left:auto;background:transparent;border:0;color:#1971b4;font-size:11px;font-weight:700;text-decoration:underline;cursor:pointer;}
      #${CONFIG.modalId} .mtprev-mgmt-barrow {display:grid;grid-template-columns:minmax(80px,35%) 1fr 34px;gap:9px;align-items:center;margin:9px 0;font-size:10px;}
      #${CONFIG.modalId} .mtprev-mgmt-barlabel {overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#46617d;font-weight:650;}
      #${CONFIG.modalId} .mtprev-mgmt-bartrack {background:#eaf0f7;border-radius:999px;height:11px;overflow:hidden;display:flex;}
      #${CONFIG.modalId} .mtprev-mgmt-barfill {height:100%;border-radius:999px;min-width:2px;}
      #${CONFIG.modalId} .mtprev-mgmt-barvalue {text-align:right;font-size:11px;font-weight:800;color:#223f5f;}
      #${CONFIG.modalId} .mtprev-mgmt-legend {display:flex;flex-wrap:wrap;gap:11px;font-size:10px;color:#657f99;margin-top:10px;}
      #${CONFIG.modalId} .mtprev-mgmt-dot {display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;vertical-align:middle;background:var(--dot);}
      #${CONFIG.modalId} .mtprev-mgmt-donutwrap {display:flex;gap:12px;align-items:center;justify-content:center;min-height:200px;}
      #${CONFIG.modalId} .mtprev-mgmt-donut {width:min(170px,44%);aspect-ratio:1;border-radius:50%;display:grid;place-items:center;flex:none;}
      #${CONFIG.modalId} .mtprev-mgmt-donutcenter {height:60%;width:60%;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#224764;font-weight:850;font-size:22px;}
      #${CONFIG.modalId} .mtprev-mgmt-donutcenter small {font-size:10px;color:#7992a7;font-weight:500;}
      #${CONFIG.modalId} .mtprev-mgmt-donutlegend {flex:1;min-width:95px;font-size:10px;display:grid;gap:7px;}
      #${CONFIG.modalId} .mtprev-mgmt-donutlegend>div {display:flex;gap:5px;align-items:center;color:#536d84;}
      #${CONFIG.modalId} .mtprev-mgmt-donutlegend strong {margin-left:auto;color:#193e60;}
      #${CONFIG.modalId} .mtprev-mgmt-tablewrap {background:#fff;border:1px solid #d8e5f1;border-radius:11px;overflow:auto;}
      #${CONFIG.modalId} .mtprev-mgmt-tablehead {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:13px 14px;border-bottom:1px solid #e1eaf3;}
      #${CONFIG.modalId} .mtprev-mgmt-tablehead strong {font-size:13px;color:#20465f;}
      #${CONFIG.modalId} .mtprev-mgmt-tablehead input {max-width:245px;width:100%;border:1px solid #d2e0ed;border-radius:7px;padding:8px 10px;font-size:12px;color:#284764;}
      #${CONFIG.modalId} .mtprev-mgmt-table {border-collapse:collapse;width:100%;min-width:860px;font-size:11px;}
      #${CONFIG.modalId} .mtprev-mgmt-table th {background:#e8f1f7;color:#254965;text-align:left;font-size:11px;font-weight:800;padding:12px;border-bottom:1px solid #c8dce9;white-space:normal;}
      #${CONFIG.modalId} .mtprev-mgmt-table td {padding:10px 11px;border-bottom:1px solid #edf2f8;color:#35506c;}
      #${CONFIG.modalId} .mtprev-mgmt-table tbody tr:hover {background:#f0f7fd;}
      #${CONFIG.modalId} .mtprev-mgmt-table .mtprev-mgmt-num {text-align:center;font-weight:800;}
      #${CONFIG.modalId} .mtprev-mgmt-badge {padding:4px 7px;border-radius:6px;font-size:10px;font-weight:850;background:var(--badge-bg,#dff0ff);color:var(--badge-color,#1d629b);}
      #${CONFIG.modalId} .mtprev-mgmt-note {font-size:11px;color:#73879e;margin:9px 2px 13px;}
      #${CONFIG.modalId} button:focus-visible,#${CONFIG.modalId} input:focus-visible,#${CONFIG.modalId} summary:focus-visible {outline:3px solid #43a8e0!important;outline-offset:2px;}
      #mtprev-management-launcher {position:fixed;inset:0;z-index:2147483630;background:rgba(12,27,46,.68);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;font:13px system-ui,Arial,sans-serif;}
      #mtprev-management-launcher .mtprev-launch-dialog {width:min(480px,100%);background:#fff;border-radius:15px;box-shadow:0 20px 70px #061a345c;overflow:hidden;}
      #mtprev-management-launcher .mtprev-launch-head {background:linear-gradient(110deg,#18364b 0%,#20536e 58%,#247d9b 100%);color:white;padding:18px 21px;font-size:17px;font-weight:800;}
      #mtprev-management-launcher .mtprev-launch-head {display:flex;align-items:center;gap:12px;}
      #mtprev-management-launcher .mtprev-launch-head img {width:46px;height:46px;object-fit:contain;background:#ffffffed;padding:5px;border-radius:12px;box-sizing:border-box;}
      #mtprev-management-launcher .mtprev-launch-force {display:flex;align-items:center;gap:8px;margin:14px 0 2px;color:#4b6680;font-size:11px;cursor:pointer}
      #mtprev-management-launcher .mtprev-launch-force input {width:15px;height:15px;accent-color:#207eaa}
      #mtprev-management-launcher .mtprev-launch-progress {margin:14px 0 2px;padding:12px;border:1px solid #d4e3ec;border-radius:10px;background:#f2f7fa;}
      #mtprev-management-launcher .mtprev-launch-progress-track {height:10px;border-radius:10px;background:#d8e6ed;overflow:hidden;margin:8px 0;}
      #mtprev-management-launcher .mtprev-launch-progress-fill {height:100%;width:0;background:linear-gradient(90deg,#1784a1,#29b4c2);transition:width .25s ease;}
      #mtprev-management-launcher .mtprev-launch-progress-label {font-weight:750;color:#23465c;}
      #mtprev-management-launcher .mtprev-launch-progress-meta{font-size:11px;color:#526f85;line-height:1.6;}
      #mtprev-management-launcher .mtprev-launch-progress-track{height:12px;border:1px solid #a8ccda;}
      #mtprev-management-launcher .mtprev-launch-progress-fill{background:linear-gradient(90deg,#15759f,#31b1bf);}
      #mtprev-management-launcher .mtprev-launch-body {padding:18px 21px;line-height:1.5;color:#46617b;}
      #mtprev-management-launcher .mtprev-launch-actions {display:flex;justify-content:flex-end;gap:9px;margin-top:17px;}
      #mtprev-management-launcher button {padding:10px 13px;border:1px solid #c8d8e6;border-radius:8px;background:#eef4fa;color:#284962;font-weight:750;cursor:pointer;}
      #mtprev-management-launcher .mtprev-launch-primary {background:#126fae;color:white;border-color:#126fae;}

      /* Moldura em duas colunas, sem iframe real: mantém o contexto autenticado SPA. */
      #${CONFIG.modalId} .mtprev-mgmt-dialog{display:flex;flex-direction:column;overflow:hidden!important;}
      #${CONFIG.modalId} .mtprev-mgmt-head{position:relative;flex-shrink:0;background:linear-gradient(110deg,#173c54 0%,#205d78 60%,#247e9b 100%)!important;}
      #${CONFIG.modalId} .mtprev-mgmt-body{display:flex;flex:1;min-height:0;overflow:hidden;padding:0!important;background:#f1f6fb;}
      #${CONFIG.modalId} .mtprev-mgmt-sidebar{flex:0 0 222px;min-width:190px;background:#16364b;color:#eaf5fb;padding:19px 12px;overflow:auto;border-right:1px solid #39768c;}
      #${CONFIG.modalId} .mtprev-mgmt-side-eyebrow{margin:0 9px 6px;font-weight:850;letter-spacing:.12em;font-size:11px;color:#7fcee5;}
      #${CONFIG.modalId} .mtprev-mgmt-side-desc{margin:0 9px 15px;font-size:12px;color:#c1d6e3;line-height:1.5;}
      #${CONFIG.modalId} .mtprev-mgmt-side-hint{margin:14px 9px;padding:10px;border:1px solid #365d72;border-radius:8px;background:#1b425a;font-size:11px;color:#b7d3e0;line-height:1.5;}
      #${CONFIG.modalId} .mtprev-mgmt-side-link{width:100%;padding:11px 12px;border:1px solid #416c82;background:#24526b;color:#e6f5fc;border-radius:9px;cursor:pointer;text-align:left;font-weight:750;}
      #${CONFIG.modalId} .mtprev-mgmt-side-link:hover{background:#326c84;}
      #${CONFIG.modalId} .mtprev-mgmt-content{flex:1;min-width:0;overflow:auto;padding:17px 18px 24px;overscroll-behavior:contain;}
      #${CONFIG.modalId} .mtprev-mgmt-tabs{display:flex!important;flex-direction:column!important;gap:6px!important;margin:0!important;border:0!important;}
      #${CONFIG.modalId} .mtprev-mgmt-tabs button{border:1px solid transparent!important;border-radius:9px!important;background:#234a63!important;color:#deedf5!important;text-align:left!important;padding:12px!important;}
      #${CONFIG.modalId} .mtprev-mgmt-tabs button:hover{background:#31647e!important;}
      #${CONFIG.modalId} .mtprev-mgmt-tabs button[aria-selected="true"]{background:#e9f6fc!important;color:#173a51!important;border-color:#94cbdc!important;box-shadow:inset 4px 0 #2ca4c5!important;}
      #${CONFIG.modalId} .mtprev-assessor-avatar{width:28px;height:28px;flex:none;display:inline-flex;align-items:center;justify-content:center;position:relative;overflow:hidden;border-radius:50%;background:#d7e9f3;color:#255575;font-size:10px;font-weight:850;border:1px solid #aecbdb;}
      #${CONFIG.modalId} .mtprev-assessor-avatar img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#edf5fb;}
      #${CONFIG.modalId} .mtprev-assessor-label{display:inline-flex;align-items:center;gap:8px;max-width:100%;min-width:0;vertical-align:middle;}
      #${CONFIG.modalId} .mtprev-assessor-label>span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;}
      #${CONFIG.modalId} .mtprev-mgmt-barrow{grid-template-columns:minmax(125px,41%) 1fr 40px;}
      #${CONFIG.modalId} .mtprev-mgmt-barlabel{display:flex;align-items:center;gap:6px;min-width:0;}
      #${CONFIG.modalId} .mtprev-mgmt-barlabel .mtprev-assessor-avatar{height:22px;width:22px;font-size:9px;}
      #${CONFIG.modalId} .mtprev-mgmt-barlabel .mtprev-assessor-label{max-width:100%;min-width:0;}
      #${CONFIG.modalId} .mtprev-mgmt-barlabel .mtprev-assessor-label>span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      @media(max-width:820px){#${CONFIG.modalId} .mtprev-mgmt-body{flex-direction:column!important;}#${CONFIG.modalId} .mtprev-mgmt-sidebar{flex:0 0 auto;min-width:0;max-height:none;padding:8px 12px;}#${CONFIG.modalId} .mtprev-mgmt-side-desc,#${CONFIG.modalId} .mtprev-mgmt-side-hint{display:none;}#${CONFIG.modalId} .mtprev-mgmt-tabs{flex-direction:row!important;overflow:auto;}#${CONFIG.modalId} .mtprev-mgmt-tabs button{white-space:nowrap;}#${CONFIG.modalId} .mtprev-mgmt-content{padding:12px;}}
      @media print{#${CONFIG.modalId} .mtprev-mgmt-sidebar{display:none!important;}#${CONFIG.modalId} .mtprev-mgmt-body{overflow:visible!important;}#${CONFIG.modalId} .mtprev-mgmt-content{overflow:visible!important;}}
      @media(max-width:1200px) {#${CONFIG.modalId} .mtprev-mgmt-filtergrid {grid-template-columns:repeat(3,minmax(170px,1fr));} #${CONFIG.modalId} .mtprev-mgmt-charts {grid-template-columns:repeat(2,minmax(0,1fr));}}
      @media(max-width:800px) {#${CONFIG.modalId} .mtprev-mgmt-dialog {max-height:calc(100dvh - 12px);} #${CONFIG.modalId} .mtprev-mgmt-overlay {padding:5px;} #${CONFIG.modalId} .mtprev-mgmt-charts {grid-template-columns:1fr;} #${CONFIG.modalId} .mtprev-mgmt-kpis {grid-template-columns:repeat(2,minmax(0,1fr));} #${CONFIG.modalId} .mtprev-mgmt-filtergrid {grid-template-columns:repeat(2,minmax(0,1fr));} #${CONFIG.modalId} .mtprev-mgmt-head {position:relative;} }
      @media(max-width:480px) {#${CONFIG.modalId} .mtprev-mgmt-kpis,#${CONFIG.modalId} .mtprev-mgmt-filtergrid {grid-template-columns:1fr;} }
      @media print {body > :not(#${CONFIG.modalId}){display:none!important;}#${CONFIG.modalId} {position:static!important;padding:0!important;background:#fff!important;}#${CONFIG.modalId} .mtprev-mgmt-dialog {max-height:none!important;box-shadow:none!important;overflow:visible!important;}#${CONFIG.modalId} .mtprev-mgmt-actions {display:none!important;}}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  const DASHBOARD_ICONS = {
    file:'M7 2h7l5 5v15H7z M14 2v5h5 M10 12h6 M10 16h6',
    users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    alert:'M12 3L2 21h20L12 3z M12 9v4 M12 17h.01',
    clock:'M12 22a10 10 0 1 0 0-20a10 10 0 0 0 0 20 M12 6v6l4 2',
    calendar:'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16',
    building:'M4 21V3h16v18 M2 21h20 M8 7h2 M14 7h2 M8 12h2 M14 12h2 M8 17h2 M14 17h2',
    bars:'M5 20V12 M11 20V5 M17 20V9 M2 21h20',
    layers:'M12 2l9 5-9 5-9-5 9-5z M3 12l9 5 9-5 M3 17l9 5 9-5',
    chart:'M3 3v18h18 M6 16l5-6 4 3 5-8',
    filter:'M3 5h18l-7 8v6l-4 2v-8z'
  };
  function dashIcon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');
    svg.setAttribute('stroke-width','1.9');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', DASHBOARD_ICONS[name] || DASHBOARD_ICONS.file);svg.appendChild(path);return svg;
  }

  function card(title, value, detail, accent) {
    const item = createElement(
      "div",
      "",
      "border:1px solid #d2dae8;border-radius:7px;background:#f8fafd;padding:12px 14px;min-height:74px;"
    );
    item.appendChild(createElement("div", title, "font-size:12px;color:#5b6b7e;margin-bottom:6px;"));
    item.appendChild(
      createElement("div", value, "font-size:24px;line-height:1.05;font-weight:900;color:" + (accent || "#10264f") + ";")
    );
    if (detail) item.appendChild(createElement("div", detail, "font-size:11px;color:#697789;margin-top:6px;"));
    return item;
  }

  function grid(cssText) {
    return createElement(
      "div",
      "",
      "display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;" + (cssText || "")
    );
  }

  function assessorOptions(records) {
    return Array.from(new Set(records.map((record) => record.assessor || "Sem assessor(a)"))).sort((a, b) =>
      normalizeKey(a).localeCompare(normalizeKey(b), "pt-BR")
    );
  }

  function sectorOptions(records) {
    return Array.from(new Set(records.map((record) => record.sector || "Setor nao identificado"))).sort((a, b) =>
      normalizeKey(a).localeCompare(normalizeKey(b), "pt-BR")
    );
  }

  function selectedSectorValues(records) {
    const allowed = records ? new Set(sectorOptions(records)) : null;
    const values = Array.isArray(state.modal.selectedSectors) ? state.modal.selectedSectors : [];
    const unique = [];
    values.forEach((name) => {
      const value = String(name || "").trim();
      if (!value || unique.includes(value)) return;
      if (allowed && !allowed.has(value)) return;
      unique.push(value);
    });
    return unique.sort((a, b) => normalizeKey(a).localeCompare(normalizeKey(b), "pt-BR"));
  }

  function setSelectedSectors(values, records) {
    const allowed = sectorOptions(records);
    const allowedSet = new Set(allowed);
    const unique = [];
    (Array.isArray(values) ? values : []).forEach((name) => {
      const value = String(name || "").trim();
      if (!value || !allowedSet.has(value) || unique.includes(value)) return;
      unique.push(value);
    });
    unique.sort((a, b) => normalizeKey(a).localeCompare(normalizeKey(b), "pt-BR"));
    state.modal.selectedSectors = unique;
  }

  function selectedSectorSummary(records) {
    const options = sectorOptions(records);
    const selected = selectedSectorValues(records);
    if (!selected.length) return "Nenhum setor";
    if (selected.length === options.length) return "Todos os setores";
    if (selected.length === 1) return selected[0];
    return selected.length + " setores selecionados";
  }

  function selectedAssessorValues(records) {
    const allowed = records ? new Set(assessorOptions(records)) : null;
    const values = Array.isArray(state.modal.selectedAssessors) ? state.modal.selectedAssessors : [];
    const unique = [];
    values.forEach((name) => {
      const value = String(name || "").trim();
      if (!value || unique.includes(value)) return;
      if (allowed && !allowed.has(value)) return;
      unique.push(value);
    });
    return unique.sort((a, b) => normalizeKey(a).localeCompare(normalizeKey(b), "pt-BR"));
  }

  function setSelectedAssessors(values, records) {
    const allowed = assessorOptions(records);
    const allowedSet = new Set(allowed);
    const unique = [];
    (Array.isArray(values) ? values : []).forEach((name) => {
      const value = String(name || "").trim();
      if (!value || !allowedSet.has(value) || unique.includes(value)) return;
      unique.push(value);
    });
    unique.sort((a, b) => normalizeKey(a).localeCompare(normalizeKey(b), "pt-BR"));
    state.modal.selectedAssessors = unique;
    state.modal.selectedAssessor = unique.length === allowed.length ? "todos" : unique.length === 1 ? unique[0] : "multiplos";
    state.modal.detailAssessor = unique.length === 1 ? unique[0] : unique[0] || "";
  }

  function selectedAssessorSummary(records) {
    const options = assessorOptions(records);
    const selected = selectedAssessorValues(records);
    if (!selected.length) return "Nenhum assessor selecionado";
    if (selected.length === options.length) return "Todos os assessores";
    if (selected.length === 1) return selected[0];
    return selected.length + " assessores selecionados";
  }

  function categoryOptions() {
    return CATEGORY_ORDER.map((key) => ({ value: key, label: REPORT_TYPES[key].label }));
  }

  function selectedCategoryValues() {
    const allowed = new Set(CATEGORY_ORDER);
    const values = Array.isArray(state.modal.selectedCategories) ? state.modal.selectedCategories : [];
    const unique = [];
    values.forEach((key) => {
      const value = String(key || "").trim();
      if (!value || !allowed.has(value) || unique.includes(value)) return;
      unique.push(value);
    });
    return CATEGORY_ORDER.filter((key) => unique.includes(key));
  }

  function setSelectedCategories(values) {
    const allowed = new Set(CATEGORY_ORDER);
    const unique = [];
    (Array.isArray(values) ? values : []).forEach((key) => {
      const value = String(key || "").trim();
      if (!value || !allowed.has(value) || unique.includes(value)) return;
      unique.push(value);
    });
    state.modal.selectedCategories = CATEGORY_ORDER.filter((key) => unique.includes(key));
    state.modal.selectedCategory =
      state.modal.selectedCategories.length === CATEGORY_ORDER.length
        ? "todos"
        : state.modal.selectedCategories.length === 1
          ? state.modal.selectedCategories[0]
          : "multiplas";
  }

  function selectedCategorySummary() {
    const selected = selectedCategoryValues();
    if (!selected.length) return "Nenhuma categoria";
    if (selected.length === CATEGORY_ORDER.length) return "Todas as categorias";
    if (selected.length === 1) return REPORT_TYPES[selected[0]].label;
    return selected.length + " categorias selecionadas";
  }

  function inboxTypeOptions() {
    return INBOX_TYPE_ORDER.map((key) => ({ value: key, label: INBOX_TYPES[key].label }));
  }

  function selectedInboxTypeValues() {
    const allowed = new Set(INBOX_TYPE_ORDER);
    const values = Array.isArray(state.modal.selectedInboxTypes) ? state.modal.selectedInboxTypes : [];
    const unique = [];
    values.forEach((key) => {
      const value = String(key || "").trim();
      if (!value || !allowed.has(value) || unique.includes(value)) return;
      unique.push(value);
    });
    return INBOX_TYPE_ORDER.filter((key) => unique.includes(key));
  }

  function setSelectedInboxTypes(values) {
    const allowed = new Set(INBOX_TYPE_ORDER);
    const unique = [];
    (Array.isArray(values) ? values : []).forEach((key) => {
      const value = String(key || "").trim();
      if (!value || !allowed.has(value) || unique.includes(value)) return;
      unique.push(value);
    });
    state.modal.selectedInboxTypes = INBOX_TYPE_ORDER.filter((key) => unique.includes(key));
    state.modal.selectedInboxType =
      state.modal.selectedInboxTypes.length === INBOX_TYPE_ORDER.length
        ? "todos"
        : state.modal.selectedInboxTypes.length === 1
          ? state.modal.selectedInboxTypes[0]
          : "multiplas";
  }

  function selectedInboxTypeSummary() {
    const selected = selectedInboxTypeValues();
    if (!selected.length) return "Nenhum tipo";
    if (selected.length === INBOX_TYPE_ORDER.length) return "Todos os tipos";
    if (selected.length === 1) return INBOX_TYPES[selected[0]].label;
    return selected.length + " tipos selecionados";
  }

  function riskReasonParts(record) {
    return String(recordRiskReasons(record) || "Sem alerta")
      .split(";")
      .map((reason) => reason.trim())
      .filter(Boolean);
  }

  function riskReasonOptions(records) {
    const unique = new Set();
    (records || []).forEach((record) => {
      riskReasonParts(record).forEach((reason) => unique.add(reason));
    });
    return Array.from(unique)
      .sort((a, b) => normalizeKey(a).localeCompare(normalizeKey(b), "pt-BR"))
      .map((reason) => ({ value: reason, label: reason }));
  }

  function selectedRiskReasonValues(records) {
    const allowed = new Set(riskReasonOptions(records).map((item) => item.value));
    const values = Array.isArray(state.modal.selectedRiskReasons) ? state.modal.selectedRiskReasons : [];
    const unique = [];
    values.forEach((reason) => {
      const value = String(reason || "").trim();
      if (!value || !allowed.has(value) || unique.includes(value)) return;
      unique.push(value);
    });
    return unique.sort((a, b) => normalizeKey(a).localeCompare(normalizeKey(b), "pt-BR"));
  }

  function setSelectedRiskReasons(values, records) {
    const allowed = new Set(riskReasonOptions(records).map((item) => item.value));
    const unique = [];
    (Array.isArray(values) ? values : []).forEach((reason) => {
      const value = String(reason || "").trim();
      if (!value || !allowed.has(value) || unique.includes(value)) return;
      unique.push(value);
    });
    state.modal.selectedRiskReasons = unique.sort((a, b) => normalizeKey(a).localeCompare(normalizeKey(b), "pt-BR"));
  }

  function selectedRiskReasonSummary(records) {
    const options = riskReasonOptions(records);
    const selected = selectedRiskReasonValues(records);
    if (!selected.length) return "Nenhum motivo";
    if (selected.length === options.length) return "Todos os motivos";
    if (selected.length === 1) return selected[0];
    return selected.length + " motivos selecionados";
  }

  function createSelect(options, selected, onChange) {
    const select = createElement(
      "select",
      "",
      "height:34px;border:1px solid #c8d2e2;border-radius:5px;background:#fff;color:#1c2b39;padding:4px 8px;font-size:12px;"
    );
    options.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      if (item.value === selected) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener("change", () => onChange(select.value));
    return select;
  }

  function createSectorMultiSelect(records, rerender) {
    const options = sectorOptions(records);
    const selected = new Set(selectedSectorValues(records));
    const details = createElement("details", "", "position:relative;min-width:240px;max-width:330px;");
    const summary = createElement(
      "summary",
      selectedSectorSummary(records),
      "height:34px;box-sizing:border-box;border:1px solid #c8d2e2;border-radius:5px;background:#fff;color:#1c2b39;" +
        "padding:8px 30px 6px 10px;font-size:12px;font-weight:800;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
    );
    details.appendChild(summary);

    const menu = createElement(
      "div",
      "",
      "position:absolute;top:38px;left:0;z-index:1000001;width:320px;max-width:calc(100vw - 48px);" +
        "border:1px solid #c8d2e2;border-radius:7px;background:#fff;box-shadow:0 12px 32px rgba(15,23,42,.22);" +
        "padding:9px;box-sizing:border-box;"
    );

    const actions = createElement("div", "", "display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;");
    const selectAll = createElement("button", "Todos", buttonCss("#272f7e") + "padding:7px 9px;font-size:11px;");
    const clearAll = createElement("button", "Limpar", buttonCss("#64748b") + "padding:7px 9px;font-size:11px;");
    const apply = createElement("button", "Aplicar", buttonCss("#107c41") + "padding:7px 9px;font-size:11px;margin-left:auto;");
    selectAll.type = "button";
    clearAll.type = "button";
    apply.type = "button";
    actions.appendChild(selectAll);
    actions.appendChild(clearAll);
    actions.appendChild(apply);
    menu.appendChild(actions);

    const list = createElement(
      "div",
      "",
      "max-height:220px;overflow:auto;border:1px solid #e1e7f0;border-radius:6px;background:#f8fafd;padding:5px;"
    );
    const checkboxes = [];
    options.forEach((name) => {
      const label = createElement(
        "label",
        "",
        "display:flex;align-items:flex-start;gap:7px;padding:6px 7px;border-radius:5px;cursor:pointer;" +
          "font-size:12px;color:#26364a;line-height:1.25;"
      );
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = name;
      checkbox.checked = selected.has(name);
      checkbox.style.marginTop = "1px";
      checkboxes.push(checkbox);
      label.appendChild(checkbox);
      label.appendChild(createElement("span", name, "overflow:hidden;text-overflow:ellipsis;"));
      list.appendChild(label);
    });
    menu.appendChild(list);
    menu.appendChild(
      createElement(
        "div",
        "Marque um ou mais setores para filtrar a caixa gerencial.",
        "margin-top:7px;font-size:11px;color:#687789;line-height:1.25;text-align:center;"
      )
    );

    selectAll.addEventListener("click", () => {
      checkboxes.forEach((checkbox) => {
        checkbox.checked = true;
      });
    });
    clearAll.addEventListener("click", () => {
      checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
    });
    apply.addEventListener("click", () => {
      setSelectedSectors(
        checkboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value),
        records
      );
      details.open = false;
      rerender();
    });

    details.appendChild(menu);
    return details;
  }

  function createAssessorMultiSelect(records, rerender) {
    const options = assessorOptions(records);
    const selected = new Set(selectedAssessorValues(records));
    const details = createElement("details", "", "position:relative;min-width:280px;max-width:360px;");
    const summary = createElement(
      "summary",
      selectedAssessorSummary(records),
      "height:34px;box-sizing:border-box;border:1px solid #c8d2e2;border-radius:5px;background:#fff;color:#1c2b39;" +
        "padding:8px 30px 6px 10px;font-size:12px;font-weight:800;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
    );
    details.appendChild(summary);

    const menu = createElement(
      "div",
      "",
      "position:absolute;top:38px;left:0;z-index:1000001;width:340px;max-width:calc(100vw - 48px);" +
        "border:1px solid #c8d2e2;border-radius:7px;background:#fff;box-shadow:0 12px 32px rgba(15,23,42,.22);" +
        "padding:9px;box-sizing:border-box;"
    );

    const actions = createElement("div", "", "display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;");
    const selectAll = createElement("button", "Todos", buttonCss("#272f7e") + "padding:7px 9px;font-size:11px;");
    const clearAll = createElement("button", "Limpar", buttonCss("#64748b") + "padding:7px 9px;font-size:11px;");
    const apply = createElement("button", "Aplicar", buttonCss("#107c41") + "padding:7px 9px;font-size:11px;margin-left:auto;");
    selectAll.type = "button";
    clearAll.type = "button";
    apply.type = "button";
    actions.appendChild(selectAll);
    actions.appendChild(clearAll);
    actions.appendChild(apply);
    menu.appendChild(actions);

    const list = createElement(
      "div",
      "",
      "max-height:230px;overflow:auto;border:1px solid #e1e7f0;border-radius:6px;background:#f8fafd;padding:5px;"
    );
    const checkboxes = [];
    options.forEach((name) => {
      const label = createElement(
        "label",
        "",
        "display:flex;align-items:flex-start;gap:7px;padding:6px 7px;border-radius:5px;cursor:pointer;" +
          "font-size:12px;color:#26364a;line-height:1.25;"
      );
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = name;
      checkbox.checked = selected.has(name);
      checkbox.style.marginTop = "1px";
      checkboxes.push(checkbox);
      label.appendChild(checkbox);
      label.appendChild(createElement("span", name, "overflow:hidden;text-overflow:ellipsis;"));
      list.appendChild(label);
    });
    menu.appendChild(list);
    menu.appendChild(
      createElement(
        "div",
        "Marque um ou mais assessores para visualizar os dados somados.",
        "margin-top:7px;font-size:11px;color:#687789;line-height:1.25;text-align:center;"
      )
    );

    selectAll.addEventListener("click", () => {
      checkboxes.forEach((checkbox) => {
        checkbox.checked = true;
      });
    });
    clearAll.addEventListener("click", () => {
      checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
    });
    apply.addEventListener("click", () => {
      setSelectedAssessors(
        checkboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value),
        records
      );
      details.open = false;
      rerender();
    });

    details.appendChild(menu);
    return details;
  }

  function createCategoryMultiSelect(rerender) {
    const options = categoryOptions();
    const selected = new Set(selectedCategoryValues());
    const details = createElement("details", "", "position:relative;min-width:220px;max-width:300px;");
    const summary = createElement(
      "summary",
      selectedCategorySummary(),
      "height:34px;box-sizing:border-box;border:1px solid #c8d2e2;border-radius:5px;background:#fff;color:#1c2b39;" +
        "padding:8px 30px 6px 10px;font-size:12px;font-weight:800;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
    );
    details.appendChild(summary);

    const menu = createElement(
      "div",
      "",
      "position:absolute;top:38px;left:0;z-index:1000001;width:280px;max-width:calc(100vw - 48px);" +
        "border:1px solid #c8d2e2;border-radius:7px;background:#fff;box-shadow:0 12px 32px rgba(15,23,42,.22);" +
        "padding:9px;box-sizing:border-box;"
    );

    const actions = createElement("div", "", "display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;");
    const selectAll = createElement("button", "Todas", buttonCss("#272f7e") + "padding:7px 9px;font-size:11px;");
    const clearAll = createElement("button", "Limpar", buttonCss("#64748b") + "padding:7px 9px;font-size:11px;");
    const apply = createElement("button", "Aplicar", buttonCss("#107c41") + "padding:7px 9px;font-size:11px;margin-left:auto;");
    selectAll.type = "button";
    clearAll.type = "button";
    apply.type = "button";
    actions.appendChild(selectAll);
    actions.appendChild(clearAll);
    actions.appendChild(apply);
    menu.appendChild(actions);

    const list = createElement(
      "div",
      "",
      "max-height:190px;overflow:auto;border:1px solid #e1e7f0;border-radius:6px;background:#f8fafd;padding:5px;"
    );
    const checkboxes = [];
    options.forEach((item) => {
      const label = createElement(
        "label",
        "",
        "display:flex;align-items:flex-start;gap:7px;padding:6px 7px;border-radius:5px;cursor:pointer;" +
          "font-size:12px;color:#26364a;line-height:1.25;"
      );
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = item.value;
      checkbox.checked = selected.has(item.value);
      checkbox.style.marginTop = "1px";
      checkboxes.push(checkbox);
      label.appendChild(checkbox);
      label.appendChild(createElement("span", item.label, "overflow:hidden;text-overflow:ellipsis;"));
      list.appendChild(label);
    });
    menu.appendChild(list);
    menu.appendChild(
      createElement(
        "div",
        "Marque uma ou mais categorias para combinar os dados.",
        "margin-top:7px;font-size:11px;color:#687789;line-height:1.25;text-align:center;"
      )
    );

    selectAll.addEventListener("click", () => {
      checkboxes.forEach((checkbox) => {
        checkbox.checked = true;
      });
    });
    clearAll.addEventListener("click", () => {
      checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
    });
    apply.addEventListener("click", () => {
      setSelectedCategories(checkboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value));
      details.open = false;
      rerender();
    });

    details.appendChild(menu);
    return details;
  }

  function createInboxTypeMultiSelect(rerender) {
    const options = inboxTypeOptions();
    const selected = new Set(selectedInboxTypeValues());
    const details = createElement("details", "", "position:relative;min-width:240px;max-width:330px;");
    const summary = createElement(
      "summary",
      selectedInboxTypeSummary(),
      "height:34px;box-sizing:border-box;border:1px solid #c8d2e2;border-radius:5px;background:#fff;color:#1c2b39;" +
        "padding:8px 30px 6px 10px;font-size:12px;font-weight:800;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
    );
    details.appendChild(summary);

    const menu = createElement(
      "div",
      "",
      "position:absolute;top:38px;left:0;z-index:1000001;width:330px;max-width:calc(100vw - 48px);" +
        "border:1px solid #c8d2e2;border-radius:7px;background:#fff;box-shadow:0 12px 32px rgba(15,23,42,.22);" +
        "padding:9px;box-sizing:border-box;"
    );

    const actions = createElement("div", "", "display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;");
    const selectAll = createElement("button", "Todos", buttonCss("#272f7e") + "padding:7px 9px;font-size:11px;");
    const clearAll = createElement("button", "Limpar", buttonCss("#64748b") + "padding:7px 9px;font-size:11px;");
    const apply = createElement("button", "Aplicar", buttonCss("#107c41") + "padding:7px 9px;font-size:11px;margin-left:auto;");
    selectAll.type = "button";
    clearAll.type = "button";
    apply.type = "button";
    actions.appendChild(selectAll);
    actions.appendChild(clearAll);
    actions.appendChild(apply);
    menu.appendChild(actions);

    const list = createElement(
      "div",
      "",
      "max-height:230px;overflow:auto;border:1px solid #e1e7f0;border-radius:6px;background:#f8fafd;padding:5px;"
    );
    const checkboxes = [];
    options.forEach((item) => {
      const label = createElement(
        "label",
        "",
        "display:flex;align-items:flex-start;gap:7px;padding:6px 7px;border-radius:5px;cursor:pointer;" +
          "font-size:12px;color:#26364a;line-height:1.25;"
      );
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = item.value;
      checkbox.checked = selected.has(item.value);
      checkbox.style.marginTop = "1px";
      checkboxes.push(checkbox);
      label.appendChild(checkbox);
      label.appendChild(createElement("span", item.label, "overflow:hidden;text-overflow:ellipsis;"));
      list.appendChild(label);
    });
    menu.appendChild(list);
    menu.appendChild(
      createElement(
        "div",
        "Marque um ou mais tipos de caixa baseados no Ultimo andamento.",
        "margin-top:7px;font-size:11px;color:#687789;line-height:1.25;text-align:center;"
      )
    );

    selectAll.addEventListener("click", () => {
      checkboxes.forEach((checkbox) => {
        checkbox.checked = true;
      });
    });
    clearAll.addEventListener("click", () => {
      checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
    });
    apply.addEventListener("click", () => {
      setSelectedInboxTypes(checkboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value));
      details.open = false;
      rerender();
    });

    details.appendChild(menu);
    return details;
  }

  function createRiskReasonMultiSelect(records, rerender) {
    const options = riskReasonOptions(records);
    const selected = new Set(selectedRiskReasonValues(records));
    const details = createElement("details", "", "position:relative;min-width:250px;max-width:350px;");
    const summary = createElement(
      "summary",
      selectedRiskReasonSummary(records),
      "height:34px;box-sizing:border-box;border:1px solid #c8d2e2;border-radius:5px;background:#fff;color:#1c2b39;" +
        "padding:8px 30px 6px 10px;font-size:12px;font-weight:800;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
    );
    details.appendChild(summary);

    const menu = createElement(
      "div",
      "",
      "position:absolute;top:38px;left:0;z-index:1000001;width:350px;max-width:calc(100vw - 48px);" +
        "border:1px solid #c8d2e2;border-radius:7px;background:#fff;box-shadow:0 12px 32px rgba(15,23,42,.22);" +
        "padding:9px;box-sizing:border-box;"
    );

    const actions = createElement("div", "", "display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;");
    const selectAll = createElement("button", "Todos", buttonCss("#272f7e") + "padding:7px 9px;font-size:11px;");
    const clearAll = createElement("button", "Limpar", buttonCss("#64748b") + "padding:7px 9px;font-size:11px;");
    const apply = createElement("button", "Aplicar", buttonCss("#107c41") + "padding:7px 9px;font-size:11px;margin-left:auto;");
    selectAll.type = "button";
    clearAll.type = "button";
    apply.type = "button";
    actions.appendChild(selectAll);
    actions.appendChild(clearAll);
    actions.appendChild(apply);
    menu.appendChild(actions);

    const list = createElement(
      "div",
      "",
      "max-height:230px;overflow:auto;border:1px solid #e1e7f0;border-radius:6px;background:#f8fafd;padding:5px;"
    );
    const checkboxes = [];
    options.forEach((item) => {
      const label = createElement(
        "label",
        "",
        "display:flex;align-items:flex-start;gap:7px;padding:6px 7px;border-radius:5px;cursor:pointer;" +
          "font-size:12px;color:#26364a;line-height:1.25;"
      );
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = item.value;
      checkbox.checked = selected.has(item.value);
      checkbox.style.marginTop = "1px";
      checkboxes.push(checkbox);
      label.appendChild(checkbox);
      label.appendChild(createElement("span", item.label, "overflow:hidden;text-overflow:ellipsis;"));
      list.appendChild(label);
    });
    menu.appendChild(list);
    menu.appendChild(
      createElement(
        "div",
        "Marque um ou mais motivos para isolar os processos por criterio de alerta.",
        "margin-top:7px;font-size:11px;color:#687789;line-height:1.25;text-align:center;"
      )
    );

    selectAll.addEventListener("click", () => {
      checkboxes.forEach((checkbox) => {
        checkbox.checked = true;
      });
    });
    clearAll.addEventListener("click", () => {
      checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
      });
    });
    apply.addEventListener("click", () => {
      setSelectedRiskReasons(
        checkboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value),
        records
      );
      details.open = false;
      rerender();
    });

    details.appendChild(menu);
    return details;
  }

  function renderControls(container, records, rerender) {
    const controls=createElement('section','');controls.className='mtprev-mgmt-filters';
    const title=createElement('div','Filtros · Escolha os recortes para atualizar os indicadores');
    title.className='mtprev-mgmt-filtertitle';title.prepend(dashIcon('filter'));controls.appendChild(title);
    const grid=createElement('div','');grid.className='mtprev-mgmt-filtergrid';
    [
      ['Setor',createSectorMultiSelect(records,rerender)],
      ['Assessor(a)',createAssessorMultiSelect(records,rerender)],
      ['Categoria',createCategoryMultiSelect(rerender)],
      ['Tipo da caixa',createInboxTypeMultiSelect(rerender)],
      ['Motivo',createRiskReasonMultiSelect(records,rerender)]
    ].forEach(([label,widget])=>{
      const field=createElement('div','');field.className='mtprev-mgmt-field';
      field.appendChild(createElement('span',label));field.appendChild(widget);grid.appendChild(field);
    });
    const criticalLabel=createElement('label','');criticalLabel.className='mtprev-mgmt-critical-label';
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=state.modal.onlyCritical;
    checkbox.addEventListener('change',()=>{state.modal.onlyCritical=checkbox.checked;rerender();});
    criticalLabel.append(checkbox,createElement('span','Somente críticos'));grid.appendChild(criticalLabel);
    controls.appendChild(grid);container.appendChild(controls);
  }


  // Fotografias são reutilizadas somente quando já estão disponíveis no SPA.
  // Não faz requisições a endpoints de perfis nem infere a identidade pela foto.
  function assessorPhotoUrl(personName, records = []) {
    const clean = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const name = clean(personName);
    if (!name || name.startsWith('sem assessor') || name.startsWith('revisao necessaria')) return '';
    const safe = raw => {
      try {
        const url = new URL(raw, location.href);
        if (url.protocol !== 'https:' || url.origin !== location.origin) return '';
        return url.href;
      } catch (_) { return ''; }
    };
    const record = records.find(item => clean(item?.assessor || item?.name) === name && (item.assessorPhotoUrl || item.avatarUrl || item.photoUrl));
    const supplied = safe(record?.assessorPhotoUrl || record?.avatarUrl || record?.photoUrl);
    if (supplied) return supplied;
    const images = [...document.querySelectorAll('img[src]')].filter(img =>
      !img.closest('.mtprev-triage-modal,#spa-cdsp-management-report-modal,#mtprev-management-launcher'));
    for (const img of images.slice(0, 250)) {
      const caption = clean([img.alt,img.title,img.dataset?.name,img.dataset?.assessor].filter(Boolean).join(' '));
      const holder = img.closest('[data-user-name],[data-assessor-name],.user-card,.person-card,.team-member,li,article');
      const context = clean(holder?.getAttribute('data-user-name') || holder?.getAttribute('data-assessor-name') || holder?.textContent?.slice(0,220));
      if (caption !== name && !(context && context.includes(name) && context.length <= name.length + 90)) continue;
      const url = safe(img.currentSrc || img.getAttribute('src'));
      if (url) return url;
    }
    return '';
  }

  function assessorAvatar(personName, extraRecords = []) {
    const node = document.createElement('span');
    node.className = 'mtprev-assessor-avatar';
    node.setAttribute('aria-hidden','true');
    const tokens = String(personName || '?').trim().split(/\s+/).filter(Boolean);
    const initials = tokens.length > 1 ? (tokens[0][0]+tokens[tokens.length-1][0]).toUpperCase() : (tokens[0]?.slice(0,2) || '?').toUpperCase();
    node.textContent = initials;
    const url = assessorPhotoUrl(personName, extraRecords);
    if (url) {
      const img = document.createElement('img');img.alt='';img.loading='lazy';img.src=url;
      img.addEventListener('error',()=>img.remove(),{once:true});node.appendChild(img);
    }
    return node;
  }
  function assessorLabel(personName, records = []) {
    const wrap = document.createElement('span');wrap.className='mtprev-assessor-label';
    wrap.append(assessorAvatar(personName,records));
    const name = document.createElement('span');name.textContent=personName || 'Não identificado';name.title=personName || '';
    wrap.append(name);return wrap;
  }

  function renderTabs(container, rerender) {
    const tabs = [
      { key: "visao", label: "Visao Geral" },
      { key: "assessores", label: "Assessores" },
      { key: "criticos", label: "Processos Criticos" },
      { key: "detalhe", label: "Detalhamento" }
    ];
    const nav = createElement("nav", "");
    nav.setAttribute("aria-label", "Tipos de relatório gerencial");
    nav.className='mtprev-mgmt-tabs';
    tabs.forEach((tab) => {
      const active = state.modal.activeTab === tab.key;
      const button = createElement(
        "button",
        tab.label,
        "border:1px solid #c9d2e4;border-bottom:0;border-radius:6px 6px 0 0;padding:9px 12px;cursor:pointer;" +
          "font-size:12px;font-weight:900;background:" +
          (active ? "#272f7e" : "#f4f6fb") +
          ";color:" +
          (active ? "#fff" : "#192452") +
          ";"
      );
      button.type = 'button';button.setAttribute('aria-selected',String(active));
      button.setAttribute('aria-current',active?'page':'false');
      const symbol={visao:'▦',assessores:'♙',criticos:'!',detalhe:'≡'}[tab.key] || '•';
      button.prepend(document.createTextNode(symbol+'  '));
      button.addEventListener("click", () => {
        state.modal.activeTab = tab.key;
        rerender();
      });
      nav.appendChild(button);
    });
    container.appendChild(nav);
  }

  function chartBox(title) {
    const box = createElement(
      "section",
      "",
      "border:1px solid #d2dae8;border-radius:7px;background:#fff;padding:12px;min-height:220px;max-height:520px;overflow:auto;"
    );
    box.appendChild(createElement("h3", title, "margin:0 0 10px;color:#192452;font-size:15px;line-height:1.2;"));
    return box;
  }

  function renderHorizontalBars(container, data, options) {
    const max = Math.max(1, ...data.map((item) => Number(item.value) || 0));
    const limit = options && options.limit ? options.limit : data.length;
    const items = data.slice(0, limit);
    items.forEach((item) => {
      const value = Number(item.value) || 0;
      const row = createElement("div", "", "display:grid;grid-template-columns:minmax(135px,1fr) 3fr 58px;gap:8px;align-items:center;margin:7px 0;");
      row.appendChild(createElement("div", item.label, "font-size:11px;color:#26364a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"));
      const track = createElement("div", "", "height:12px;border-radius:999px;background:#edf1f7;overflow:hidden;");
      const bar = createElement(
        "div",
        "",
        "height:100%;width:" + Math.max(2, (value / max) * 100) + "%;background:" + (item.color || "#272f7e") + ";border-radius:999px;"
      );
      track.appendChild(bar);
      row.appendChild(track);
      row.appendChild(
        createElement(
          "div",
          item.displayValue == null ? String(value) : String(item.displayValue),
          "font-size:11px;font-weight:900;color:#192452;text-align:right;"
        )
      );
      container.appendChild(row);
    });
    if (data.length > items.length) {
      container.appendChild(
        createElement(
          "div",
          "Exibindo " + items.length + " de " + data.length + " item(ns).",
          "font-size:11px;color:#687789;text-align:center;margin-top:8px;"
        )
      );
    }
  }

  function renderStackedBars(container, summaries) {
    const max = Math.max(1, ...summaries.map((item) => item.total));
    summaries.forEach((summary) => {
      const row = createElement("div", "", "margin:8px 0;");
      row.appendChild(
        createElement(
          "div",
          summary.assessor + " (" + summary.total + ")",
          "font-size:11px;color:#26364a;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
        )
      );
      const track = createElement("div", "", "height:17px;border-radius:4px;background:#edf1f7;overflow:hidden;display:flex;width:" + ((summary.total / max) * 100) + "%;min-width:36px;");
      [
        { value: summary.recursos, color: "#272f7e" },
        { value: summary.contestacao, color: "#0f766e" },
        { value: summary.demais, color: "#64748b" }
      ].forEach((piece) => {
        if (!piece.value) return;
        track.appendChild(createElement("div", "", "height:100%;width:" + (piece.value / summary.total) * 100 + "%;background:" + piece.color + ";"));
      });
      row.appendChild(track);
      container.appendChild(row);
    });
    const legend = createElement("div", "", "display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:#5b6878;");
    [
      ["#272f7e", "Recursos"],
      ["#0f766e", "Contestacao"],
      ["#64748b", "Demais"]
    ].forEach((item) => {
      const piece = createElement("span", "", "display:inline-flex;align-items:center;gap:5px;");
      piece.appendChild(createElement("i", "", "display:inline-block;width:10px;height:10px;border-radius:2px;background:" + item[0] + ";"));
      piece.appendChild(createElement("span", item[1]));
      legend.appendChild(piece);
    });
    container.appendChild(legend);
  }

  function sectorCounts(records) {
    const grouped = new Map();
    records.forEach((record) => {
      const key = record.sector || "Setor nao identificado";
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });
    return Array.from(grouped.entries())
      .map((entry) => ({ label: entry[0], value: entry[1], color: entry[0].indexOf("identificado") >= 0 ? "#b7791f" : "#0f766e" }))
      .sort((a, b) => b.value - a.value || normalizeKey(a.label).localeCompare(normalizeKey(b.label), "pt-BR"));
  }

  function assessorAgeCounts(records) {
    const grouped = new Map();
    records.forEach((record) => {
      const key = record.assessor || "Sem assessor(a)";
      if (!grouped.has(key)) {
        grouped.set(key, { assessor: key, total: 0, faixa1: 0, faixa2: 0, faixa3: 0, faixa4: 0 });
      }
      const item = grouped.get(key);
      const days = Math.max(0, Number(record.receivedDays) || 0);
      item.total += 1;
      if (days <= 5) item.faixa1 += 1;
      else if (days <= 10) item.faixa2 += 1;
      else if (days <= 20) item.faixa3 += 1;
      else item.faixa4 += 1;
    });
    return Array.from(grouped.values()).sort(
      (a, b) =>
        b.faixa4 - a.faixa4 ||
        b.faixa3 - a.faixa3 ||
        b.total - a.total ||
        normalizeKey(a.assessor).localeCompare(normalizeKey(b.assessor), "pt-BR")
    );
  }

  function renderAssessorAgeBars(container, records) {
    const data = assessorAgeCounts(records);
    if (!data.length) {
      container.appendChild(createElement("div", "Nenhum dado para exibir.", "font-size:12px;color:#687789;text-align:center;"));
      return;
    }

    const max = Math.max(1, ...data.map((item) => item.total));
    data.forEach((item) => {
      const row = createElement("div", "", "margin:8px 0;");
      row.appendChild(
        createElement(
          "div",
          item.assessor + " (" + item.total + ")",
          "font-size:11px;color:#26364a;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
        )
      );
      const track = createElement(
        "div",
        "",
        "height:18px;border-radius:4px;background:#edf1f7;overflow:hidden;display:flex;width:" +
          Math.max(4, (item.total / max) * 100) +
          "%;min-width:42px;"
      );
      [
        { value: item.faixa1, color: "#2f7d43" },
        { value: item.faixa2, color: "#4784c7" },
        { value: item.faixa3, color: "#f59e0b" },
        { value: item.faixa4, color: "#dc3545" }
      ].forEach((piece) => {
        if (!piece.value) return;
        track.appendChild(
          createElement("div", "", "height:100%;width:" + (piece.value / item.total) * 100 + "%;background:" + piece.color + ";")
        );
      });
      row.appendChild(track);
      container.appendChild(row);
    });

    const legend = createElement("div", "", "display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:#5b6878;");
    [
      ["#2f7d43", "0-5 dias"],
      ["#4784c7", "6-10 dias"],
      ["#f59e0b", "11-20 dias"],
      ["#dc3545", "+20 dias"]
    ].forEach((item) => {
      const piece = createElement("span", "", "display:inline-flex;align-items:center;gap:5px;");
      piece.appendChild(createElement("i", "", "display:inline-block;width:10px;height:10px;border-radius:2px;background:" + item[0] + ";"));
      piece.appendChild(createElement("span", item[1]));
      legend.appendChild(piece);
    });
    container.appendChild(legend);
  }

  function ageBins(records) {
    const bins = [
      { label: "0-5 dias", min: 0, max: 5, value: 0, color: "#2f7d43" },
      { label: "6-10 dias", min: 6, max: 10, value: 0, color: "#4784c7" },
      { label: "11-20 dias", min: 11, max: 20, value: 0, color: "#f59e0b" },
      { label: "+20 dias", min: 21, max: Infinity, value: 0, color: "#dc3545" }
    ];
    records.forEach((record) => {
      const days = Math.max(0, Number(record.receivedDays) || 0);
      const bin = bins.find((item) => days >= item.min && days <= item.max);
      if (bin) bin.value += 1;
    });
    return bins;
  }

  function renderCriticalExplanation(container) {
    const section = createElement(
      "section",
      "",
      "margin:0 0 12px 0;border:1px solid #d2dae8;border-radius:7px;background:#f8fafd;padding:12px 14px;"
    );
    section.appendChild(
      createElement(
        "h3",
        "Como a carga critica e definida",
        "margin:0 0 8px;color:#192452;font-size:15px;text-align:center;"
      )
    );

    const list = createElement(
      "div",
      "",
      "display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px;"
    );
    criticalRulesText().forEach((text) => {
      list.appendChild(
        createElement(
          "div",
          text,
          "border:1px solid #e0e6f1;border-radius:6px;background:#fff;padding:8px 10px;" +
            "font-size:12px;line-height:1.35;color:#344252;"
        )
      );
    });
    section.appendChild(list);
    container.appendChild(section);
  }

  function dashKpi(title, value, note, icon, color, soft) {
    const el=createElement('div','');el.className='mtprev-mgmt-kpi';
    const mark=createElement('div','');mark.className='mtprev-mgmt-kpiicon';
    mark.style.setProperty('--icon-color',color);mark.style.setProperty('--icon-soft',soft);
    mark.appendChild(dashIcon(icon));el.appendChild(mark);
    const info=createElement('div','');info.className='mtprev-mgmt-kpibody';
    const titleEl=createElement('div',title);titleEl.className='mtprev-mgmt-kpilabel';
    const number=createElement('div',value);number.className='mtprev-mgmt-kpivalue';number.style.setProperty('--value-color',color);
    const noteEl=createElement('div',note);noteEl.className='mtprev-mgmt-kpidetail';
    info.append(titleEl,number,noteEl);el.appendChild(info);return el;
  }
  function dashChart(title,subtitle,icon,action) {
    const box=createElement('section','');box.className='mtprev-mgmt-chart';
    const head=createElement('div','');head.className='mtprev-mgmt-charthead';
    const mark=createElement('div','');mark.className='mtprev-mgmt-charticon';mark.appendChild(dashIcon(icon));head.appendChild(mark);
    const titlewrap=createElement('div','');
    const titleNode=createElement('div',title);titleNode.className='mtprev-mgmt-charttitle';
    const subNode=createElement('div',subtitle);subNode.className='mtprev-mgmt-chartsub';titlewrap.append(titleNode,subNode);head.appendChild(titlewrap);
    if(action){const btn=createElement('button','Ver todos');btn.type='button';btn.addEventListener('click',action);head.appendChild(btn);}
    box.appendChild(head);return box;
  }
  function dashBarRow(box,label,value,max,color,display) {
    const row=createElement('div','');row.className='mtprev-mgmt-barrow';
    const name=createElement('span','');name.className='mtprev-mgmt-barlabel';name.title=label;
    name.appendChild((state.lastRecords||[]).some(item=>item.assessor===label) ? assessorLabel(label,state.lastRecords) : document.createTextNode(label));
    const track=createElement('div','');track.className='mtprev-mgmt-bartrack';
    const fill=createElement('div','');fill.className='mtprev-mgmt-barfill';fill.style.background=color;
    fill.style.width=(max ? Math.max(0,(value/max)*100):0)+'%';track.appendChild(fill);
    const number=createElement('strong',display ?? String(value));number.className='mtprev-mgmt-barvalue';
    row.append(name,track,number);box.appendChild(row);
  }
  function dashStackedRow(box,label,values,max,display) {
    const row=createElement('div','');row.className='mtprev-mgmt-barrow';
    const name=createElement('span','');name.className='mtprev-mgmt-barlabel';name.title=label;
    name.appendChild((state.lastRecords||[]).some(item=>item.assessor===label) ? assessorLabel(label,state.lastRecords) : document.createTextNode(label));
    const track=createElement('div','');track.className='mtprev-mgmt-bartrack';
    values.forEach(([count,color])=>{
      const part=createElement('div','');part.style.height='100%';part.style.flex='0 0 '+(max ? Math.max(0,count/max*100) : 0)+'%';part.style.background=color;track.appendChild(part);
    });
    const number=createElement('strong',display);number.className='mtprev-mgmt-barvalue';
    row.append(name,track,number);box.appendChild(row);
  }
  function dashLegend(box,parts) {
    const legend=createElement('div','');legend.className='mtprev-mgmt-legend';
    parts.forEach(([label,color])=>{
      const span=createElement('span','');const dot=createElement('i','');dot.className='mtprev-mgmt-dot';dot.style.setProperty('--dot',color);
      span.append(dot,createElement('span',label));legend.appendChild(span);
    });box.appendChild(legend);
  }
  function dashDonut(box,records) {
    const sectors=sectorCounts(records);const total=records.length;
    const colors=['#176596','#3095b5','#3c93a2','#7b79b7','#c2a3d8','#e4ad53','#789db8'];
    let current=0;const arcs=[];
    const other={value:0};
    sectors.forEach((item,index)=>{
      const value=item.value;const next=current+(total ? value/total*100:0);
      arcs.push(`${colors[index%colors.length]} ${current.toFixed(3)}% ${next.toFixed(3)}%`);current=next;
    });
    const wrap=createElement('div','');wrap.className='mtprev-mgmt-donutwrap';
    const circle=createElement('div','');circle.className='mtprev-mgmt-donut';
    circle.style.background=arcs.length ? `conic-gradient(${arcs.join(',')})` : '#e2eaf2';
    const inside=createElement('div','');inside.className='mtprev-mgmt-donutcenter';inside.append(createElement('span',String(total)),createElement('small','processos'));
    circle.appendChild(inside);wrap.appendChild(circle);
    const legend=createElement('div','');legend.className='mtprev-mgmt-donutlegend';
    sectors.slice(0,6).forEach((item,index)=>{
      const row=createElement('div','');const dot=createElement('i','');dot.className='mtprev-mgmt-dot';dot.style.setProperty('--dot',colors[index%colors.length]);
      const label=createElement('span',item.label);label.title=item.label;label.style.cssText='overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:145px;';
      row.append(dot,label,createElement('strong',String(item.value)));legend.appendChild(row);
    });
    if(sectors.length>6) legend.appendChild(createElement('small',`+ ${sectors.length-6} outros setores`));
    wrap.appendChild(legend);box.appendChild(wrap);
  }
  function dashSummaryTable(container,summaries) {
    const wrap=createElement('section','');wrap.className='mtprev-mgmt-tablewrap';
    const head=createElement('div','');head.className='mtprev-mgmt-tablehead';
    const title=createElement('strong','Resumo por assessor(a)');head.appendChild(title);
    const search=createElement('input','');search.type='search';search.placeholder='Buscar assessor(a)…';search.setAttribute('aria-label','Buscar assessor(a)');head.appendChild(search);wrap.appendChild(head);
    const table=createElement('table','');table.className='mtprev-mgmt-table';
    const thead=document.createElement('thead');const tr=document.createElement('tr');
    ['Assessor(a)','Setor','Total','Críticos','Em atenção','SPA até 8 dias','Média na caixa','Carga crítica'].forEach(label=>tr.appendChild(createElement('th',label)));
    thead.appendChild(tr);table.appendChild(thead);
    const tbody=document.createElement('tbody');table.appendChild(tbody);
    const redraw=()=>{
      tbody.replaceChildren();
      const query=normalizeKey(search.value || '');
      const selected=summaries.filter(item=>!query||normalizeKey(item.assessor).includes(query));
      selected.slice(0,25).forEach(item=>{
        const row=document.createElement('tr');
        const values=[item.assessor,item.sector,item.total,item.critical,item.attention,item.pjeNear,item.averageReceivedText,item.criticalLoad];
        values.forEach((value,index)=>{
          const cell=createElement('td','');if(index===0) cell.style.fontWeight='800';
          if([3,4,7].includes(index)){
            const badge=createElement('span',String(value));badge.className='mtprev-mgmt-badge';
            badge.style.setProperty('--badge-bg',index===3?'#ffebec':index===4?'#fff0d7':'#e0edf9');
            badge.style.setProperty('--badge-color',index===3?'#ae2931':index===4?'#a26d1b':'#276b99');cell.appendChild(badge);
          }else if(index===0){cell.appendChild(assessorLabel(String(value),state.lastRecords||[]));}
          else{cell.textContent=String(value);}if(index>=2&&index<=5) cell.classList.add('mtprev-mgmt-num');row.appendChild(cell);
        });
        row.title='Clique duas vezes para abrir o detalhamento deste assessor';
        row.addEventListener('dblclick',()=>{
          state.modal.detailAssessor=item.assessor;state.modal.selectedAssessor=item.assessor;
          setSelectedAssessors([item.assessor],state.lastRecords||[]);state.modal.activeTab='detalhe';renderModalContent();
        });tbody.appendChild(row);
      });
      if(!selected.length){const row=document.createElement('tr');const td=createElement('td','Nenhum assessor encontrado');td.colSpan=8;row.appendChild(td);tbody.appendChild(row);}
    };
    search.addEventListener('input',redraw);redraw();wrap.appendChild(table);container.appendChild(wrap);
    container.appendChild(createElement('div','Até 25 assessores por vez. Para consulta completa, use a aba Assessores ou a exportação Excel.','font-size:11px;color:#7a90a5;margin:7px 2px 12px;'));
  }
  function renderOverview(container,records,reportDate) {
    const metrics=generalMetrics(records,reportDate);
    const summaries=buildAssessorSummaries(records,reportDate);
    const kpis=createElement('div','');kpis.className='mtprev-mgmt-kpis';
    [
      ['Total de processos',String(metrics.total),'Na visão filtrada','file','#1766a0','#e6f3fe'],
      ['Assessores com processos',String(metrics.assessors),'Com expedientes','users','#315f9d','#e6efff'],
      ['Críticos',String(metrics.critical),'Conforme regras da extensão','alert','#cc3232','#fff0ef'],
      ['Em atenção',String(metrics.attention),'Próximos dos limites','alert','#b87516','#fff1db'],
      ['Prazo SPA até 8 dias',String(metrics.pjeNear),'Prazo próximo','clock','#2472bd','#e8f2ff'],
      ['Mais de 20 dias na caixa',String(metrics.over20),'Processos antigos','calendar','#ba4a60','#ffeef1'],
      ['Média na caixa',metrics.averageReceivedText,'Tempo desde recebimento','clock','#108779','#e0f5f1'],
      ['Sem setor identificado',String(metrics.unmatchedTeam),'Revisar cadastro','building','#58718d','#eaf0f6']
    ].forEach(item=>kpis.appendChild(dashKpi(...item)));container.appendChild(kpis);
    const charts=createElement('div','');charts.className='mtprev-mgmt-charts';
    const showAssessors=()=>{state.modal.activeTab='assessores';renderModalContent();};
    const load=dashChart('Carga por assessor(a)','Quantidade de processos','users',showAssessors);
    const bySize=summaries.slice().sort((a,b)=>b.total-a.total);
    bySize.slice(0,8).forEach(x=>dashBarRow(load,x.assessor,x.total,Math.max(1,bySize[0]?.total||1),'linear-gradient(90deg,#234d8a,#2383ba)'));
    charts.appendChild(load);
    const risk=dashChart('Críticos x atenção por assessor(a)','Classificação dos processos','bars',showAssessors);
    const byCritical=summaries.slice().sort((a,b)=>(b.critical+b.attention)-(a.critical+a.attention));
    const maxRisk=Math.max(1,...byCritical.map(x=>x.critical+x.attention));
    byCritical.slice(0,8).forEach(x=>dashStackedRow(risk,x.assessor,[[x.critical,'#d44440'],[x.attention,'#e9a640']],maxRisk,`${x.critical}C/${x.attention}A`));
    dashLegend(risk,[['Críticos','#d44440'],['Em atenção','#e9a640']]);charts.appendChild(risk);
    const sectors=dashChart('Processos por setor','Distribuição atual da mesa','building');dashDonut(sectors,records);charts.appendChild(sectors);
    const categories=dashChart('Categorias por assessor(a)','Recursos · Contestação · Demais','layers',showAssessors);
    const maxCat=Math.max(1,...bySize.map(x=>x.total));
    bySize.slice(0,8).forEach(x=>dashStackedRow(categories,x.assessor,[[x.recursos,'#257bb3'],[x.contestacao,'#16a5ac'],[x.demais,'#8092a8']],maxCat,String(x.total)));
    dashLegend(categories,[['Recursos','#257bb3'],['Contestação','#16a5ac'],['Demais','#8092a8']]);charts.appendChild(categories);
    const age=dashChart('Permanência na caixa','Tempo desde o recebimento — não é prazo PJe','clock');
    const bins=ageBins(records);const maxAge=Math.max(1,...bins.map(x=>x.value));
    bins.forEach((x,i)=>dashBarRow(age,x.label,x.value,maxAge,['#259d80','#418dd0','#e9a83f','#cc4d4d'][i],`${x.value}`));charts.appendChild(age);
    const pressure=dashChart('Situação da mesa','Críticos, atenção e demais','chart');
    const regular=Math.max(0,metrics.total-metrics.critical-metrics.attention);
    const maxPressure=Math.max(1,metrics.total);
    [['Críticos',metrics.critical,'#d44440'],['Em atenção',metrics.attention,'#e9a640'],['Demais',regular,'#268a90'],['Prazo SPA até 8 dias',metrics.pjeNear,'#3b88d3'],['+20 dias na caixa',metrics.over20,'#b66a7d']]
      .forEach(([label,value,color])=>dashBarRow(pressure,label,value,maxPressure,color,`${value}`));
    charts.appendChild(pressure);
    container.appendChild(charts);
    const note=createElement('p','Indicadores calculados a partir da visão filtrada atual. Não há histórico mensal armazenado; por isso não é exibida uma evolução fictícia.');note.className='mtprev-mgmt-note';container.appendChild(note);
    dashSummaryTable(container,summaries);
  }

  function toggleTableSort(sortName, key) {
    const current = state.modal[sortName] || { key: "", direction: "asc" };
    state.modal[sortName] = {
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    };
  }

  function normalizedSortValue(value, type) {
    if (type === "number") {
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }
    if (type === "date") {
      return value instanceof Date && !Number.isNaN(value.getTime()) ? value.getTime() : null;
    }
    const text = normalizeKey(value);
    return text ? text : null;
  }

  function compareBySortValue(a, b, type, direction) {
    const left = normalizedSortValue(a, type);
    const right = normalizedSortValue(b, type);
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    let result = 0;
    if (type === "text") result = String(left).localeCompare(String(right), "pt-BR");
    else result = left - right;
    return direction === "desc" ? -result : result;
  }

  function sortRowsByHeader(rows, headers, sortState, valueGetter, fallbackCompare) {
    if (!sortState || !sortState.key) return rows;
    const header = headers.find((item) => item && item.key === sortState.key);
    if (!header) return rows;
    return rows.slice().sort((a, b) => {
      const result = compareBySortValue(valueGetter(a, header.key), valueGetter(b, header.key), header.type || "text", sortState.direction);
      return result || (fallbackCompare ? fallbackCompare(a, b) : 0);
    });
  }

  function tableShell(headers, sortState, onSort) {
    const wrap = createElement("div", "", "overflow:auto;border:1px solid #d2dae8;border-radius:7px;background:#fff;");
    // Muitas colunas ficam ilegíveis se comprimidas na largura da tela.
    // O contêiner permite rolagem horizontal, mantendo rótulos e números visíveis.
    const minimumTableWidth = Math.max(980, headers.length * 132);
    const table = createElement("table", "", "width:100%;border-collapse:collapse;table-layout:auto;min-width:" + minimumTableWidth + "px;");
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    headers.forEach((header) => {
      const config = typeof header === "object" ? header : { label: header };
      const th = createElement(
        "th",
        "",
        "border:1px solid #c3d9e7;background:#1d4e6c;color:#fff;padding:10px 9px;text-align:left;font-size:12px;line-height:1.25;"
      );
      if (config.key && onSort) {
        const active = sortState && sortState.key === config.key;
        const button = createElement(
          "button",
          "",
          "width:100%;border:0;background:transparent;color:#fff;display:flex;align-items:center;justify-content:center;" +
            "gap:7px;padding:0;margin:0;cursor:pointer;font-size:12px;font-weight:800;line-height:1.25;"
        );
        button.type = "button";
        button.title = "Ordenar por " + config.label;
        button.appendChild(createElement("span", config.label, "display:inline-block;"));
        button.appendChild(
          createElement(
            "span",
            active ? (sortState.direction === 'asc' ? '↑' : '↓') : '↕',
            "display:inline-block;opacity:.75;font-size:13px;line-height:1.2;"
          )
        );
        button.addEventListener("click", () => onSort(config.key));
        th.appendChild(button);
      } else {
        th.textContent = config.label;
      }
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    table.appendChild(tbody);
    wrap.appendChild(table);
    return { wrap, table, tbody };
  }

  function appendCell(row, text, cssText) {
    const td = createElement(
      "td",
      text,
      "border:1px solid #d2dae8;padding:8px 9px;text-align:center;vertical-align:middle;font-size:12px;color:#1c2b39;" +
        (cssText || "")
    );
    row.appendChild(td);
    return td;
  }

  function openUrlInNewTab(url) {
    const href = resolveSpaUrl(url);
    if (!href) return false;

    try {
      const opened = window.open(href, "_blank");
      if (opened) {
        try {
          opened.blur();
        } catch (_error) {
          // Algumas politicas do navegador impedem controle de foco da nova aba.
        }
        try {
          window.focus();
        } catch (_error) {
          // A aba atual pode nao aceitar foco programatico.
        }
        return true;
      }
    } catch (_error) {
      // Se window.open for bloqueado, tenta o clique em um link temporario.
    }

    if (!document.body) return false;
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;";
    document.body.appendChild(link);

    try {
      link.click();
      return true;
    } catch (_error) {
      return false;
    } finally {
      link.remove();
    }
  }

  function verifyProcessPendency(record) {
    const url = record && (record.procedureUrl || procedurePageUrl(record.procedureId));
    if (!url) {
      window.alert(
        "Nao foi possivel identificar a pendencia deste processo no SPA.\n\nProcesso: " +
          (record && record.processNumber ? record.processNumber : "nao identificado")
      );
      return;
    }

    if (!openUrlInNewTab(url)) {
      window.alert(
        "Nao foi possivel abrir a pendencia do processo " +
          (record && record.processNumber ? record.processNumber : "") +
          ".\n\nVerifique se o navegador bloqueou pop-ups para o SPA."
      );
      return;
    }

    log("Pendencia aberta para verificacao do processo " + record.processNumber + ".", "ok");
  }

  function createVerifyButton(record) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Verificar";
    button.title = "Abrir a pendencia do processo " + (record.processNumber || "");
    button.style.cssText =
      "border:1px solid #bfd2f3;border-radius:5px;background:#e7f0ff;color:#163b73;padding:6px 9px;" +
      "font-size:12px;font-weight:900;cursor:pointer;min-width:86px;";
    button.addEventListener("click", () => verifyProcessPendency(record));
    return button;
  }

  function assessorSummaryDefaultCompare(a, b) {
    return (
      b.criticalLoadRank - a.criticalLoadRank ||
      b.critical - a.critical ||
      b.attention - a.attention ||
      b.urgent - a.urgent ||
      b.pjeNear - a.pjeNear ||
      b.over20 - a.over20 ||
      b.total - a.total ||
      normalizeKey(a.assessor).localeCompare(normalizeKey(b.assessor), "pt-BR")
    );
  }

  function assessorSortValue(summary, key) {
    const values = {
      assessor: summary.assessor,
      sector: summary.sector,
      total: summary.total,
      recursos: summary.recursos,
      contestacao: summary.contestacao,
      demais: summary.demais,
      critical: summary.critical,
      attention: summary.attention,
      pjeNear: summary.pjeNear,
      over20: summary.over20,
      averageReceived: summary.averageReceived,
      oldestBaseDate: summary.oldestBaseDate,
      nearestPjeDate: summary.nearestPjeDate,
      criticalLoadRank: summary.criticalLoadRank
    };
    return values[key];
  }

  function assessorTableHeaders() {
    return [
      { label: "Assessor(a)", key: "assessor", type: "text" },
      { label: "Setor", key: "sector", type: "text" },
      { label: "Total", key: "total", type: "number" },
      { label: "Recursos", key: "recursos", type: "number" },
      { label: "Contestação", key: "contestacao", type: "number" },
      { label: "Demais", key: "demais", type: "number" },
      { label: "Críticos", key: "critical", type: "number" },
      { label: "Em atenção", key: "attention", type: "number" },
      { label: "SPA <= 8 dias", key: "pjeNear", type: "number" },
      { label: "+20 dias", key: "over20", type: "number" },
      { label: "Média na caixa", key: "averageReceived", type: "number" },
      { label: "Pendência mais antiga", key: "oldestBaseDate", type: "date" },
      { label: "Prazo SPA mais próximo", key: "nearestPjeDate", type: "date" },
      { label: "Carga crítica", key: "criticalLoadRank", type: "number" }
    ];
  }

  function recordSortValue(record, key) {
    const values = {
      assessor: record.assessor,
      sector: record.sector,
      inboxTypeLabel: record.inboxTypeLabel,
      lastMovement: record.lastMovement,
      riskStatus: record.riskStatus,
      categoryLabel: record.categoryLabel,
      type: record.type,
      processNumber: record.processNumber,
      knowledgeDate: record.knowledgeDate,
      receivedDays: record.receivedDays,
      pjeDeadlineDate: record.pjeDeadlineDate,
      internalDueDate: record.internalDueDate,
      riskReason: recordRiskReasons(record)
    };
    return values[key];
  }

  function recordTableHeaders() {
    return [
      { label: "Assessor(a)", key: "assessor", type: "text" },
      { label: "Setor", key: "sector", type: "text" },
      { label: "Tipo da caixa", key: "inboxTypeLabel", type: "text" },
      { label: "Ultimo andamento", key: "lastMovement", type: "text" },
      { label: "Situacao", key: "riskStatus", type: "text" },
      { label: "Categoria", key: "categoryLabel", type: "text" },
      { label: "Tipo", key: "type", type: "text" },
      { label: "Processo", key: "processNumber", type: "text" },
      { label: "Acao" },
      { label: "Data da Ciencia", key: "knowledgeDate", type: "date" },
      { label: "Recebido", key: "receivedDays", type: "number" },
      { label: "Prazo SPA (PJE)", key: "pjeDeadlineDate", type: "date" },
      { label: "Prazo Interno", key: "internalDueDate", type: "date" },
      { label: "Motivo", key: "riskReason", type: "text" }
    ];
  }

  function renderAssessorTable(container, records, reportDate) {
    const headers = assessorTableHeaders();
    const summaries = sortedAssessorSummariesForTable(records, reportDate);
    const shell = tableShell(headers, state.modal.assessorSort, (key) => {
      toggleTableSort("assessorSort", key);
      renderModalContent();
    });
    const fragment = document.createDocumentFragment();
    summaries.forEach((summary, index) => {
      const row = document.createElement("tr");
      row.style.cssText = index % 2 ? "background:#fff;" : "background:#f7f9fc;";
      const assessorCell=appendCell(row, '', 'text-align:left;font-weight:800;color:#192452;');
      assessorCell.appendChild(assessorLabel(summary.assessor,records));
      appendCell(row, summary.sector || "Setor nao identificado", "text-align:left;");
      appendCell(row, String(summary.total));
      appendCell(row, String(summary.recursos));
      appendCell(row, String(summary.contestacao));
      appendCell(row, String(summary.demais));
      appendCell(row, String(summary.critical), summary.critical ? "font-weight:900;color:#b42318;" : "");
      appendCell(row, String(summary.attention), summary.attention ? "font-weight:900;color:#b7791f;" : "");
      appendCell(row, String(summary.pjeNear), summary.pjeNear ? "font-weight:900;color:#b7791f;" : "");
      appendCell(row, String(summary.over20), summary.over20 ? "font-weight:900;color:#9f1239;" : "");
      appendCell(row, summary.averageReceivedText);
      appendCell(row, summary.oldestBaseDateText);
      appendCell(row, summary.nearestPjeDateText);
      appendCell(row, summary.criticalLoad, "font-weight:900;color:" + summary.criticalLoadColor + ";");
      row.addEventListener("dblclick", () => {
        state.modal.detailAssessor = summary.assessor;
        state.modal.selectedAssessor = summary.assessor;
        setSelectedAssessors([summary.assessor], records);
        state.modal.activeTab = "detalhe";
        renderModalContent();
      });
      fragment.appendChild(row);
    });
    shell.tbody.appendChild(fragment);
    container.appendChild(shell.wrap);
    container.appendChild(
      createElement(
        "div",
        "Dica: clique duas vezes em uma linha para focar em um assessor. Use o filtro para combinar varios assessores.",
        "font-size:11px;color:#687789;margin-top:7px;text-align:center;"
      )
    );
  }

  function sortedAssessorSummariesForTable(records, reportDate) {
    const headers = assessorTableHeaders();
    return sortRowsByHeader(
      buildAssessorSummaries(records, reportDate),
      headers,
      state.modal.assessorSort,
      assessorSortValue,
      assessorSummaryDefaultCompare
    );
  }

  function deadlineBadge(record) {
    const style = record.pjeDeadlineStyle || DEADLINE_STYLE_PRESETS.default;
    const span = createElement("span", record.pjeDeadlineText || "-", "display:inline-block;min-width:105px;padding:4px 7px;border-radius:4px;font-size:11px;line-height:1.2;");
    if (style.kind && style.kind !== "default") {
      span.style.background = style.screenBackground || DEADLINE_STYLE_PRESETS.none.screenBackground;
      span.style.color = style.screenText || DEADLINE_STYLE_PRESETS.none.screenText;
      span.style.border = "1px solid " + (style.screenBorder || DEADLINE_STYLE_PRESETS.none.screenBorder);
    }
    return span;
  }

  function appendDeadlineCell(row, record) {
    const td = appendCell(row, "");
    td.appendChild(deadlineBadge(record));
    return td;
  }

  function sortedRecordsForTable(records) {
    const headers = recordTableHeaders();
    return state.modal.recordSort.key
      ? sortRowsByHeader(records, headers, state.modal.recordSort, recordSortValue, criticalCompare)
      : sortCritical(records);
  }

  function renderRecordTable(container, records, limit) {
    const headers = recordTableHeaders();
    const sorted = sortedRecordsForTable(records);
    const rowLimit = Math.max(1, Number(limit) || CONFIG.screenRowLimit);
    const items = sorted.slice(0, rowLimit);
    const shell = tableShell(headers, state.modal.recordSort, (key) => {
      toggleTableSort("recordSort", key);
      renderModalContent();
    });
    if (sorted.length > items.length) {
      container.appendChild(
        createElement(
          "div",
          "Exibindo " +
            items.length +
            " de " +
            sorted.length +
            " processo(s), priorizados por carga critica. A exportacao em Excel leva a base completa.",
          "margin:0 0 8px 0;padding:8px 10px;border:1px solid #f3d28b;border-radius:6px;background:#fff8e5;" +
            "color:#6a4600;text-align:center;font-size:12px;font-weight:800;"
        )
      );
    }
    if (!items.length) {
      const row = document.createElement("tr");
      const cell = appendCell(row, "Nenhum processo encontrado para os filtros atuais.", "font-style:italic;color:#687789;");
      cell.colSpan = 14;
      shell.tbody.appendChild(row);
    }
    const fragment = document.createDocumentFragment();
    items.forEach((record, index) => {
      const row = document.createElement("tr");
      row.style.cssText = index % 2 ? "background:#fff;" : "background:#f7f9fc;";
      const assessorCell=appendCell(row, '', 'text-align:left;font-weight:800;color:#192452;');
      assessorCell.appendChild(assessorLabel(record.assessor,state.lastRecords||[]));
      appendCell(row, record.sector || "Setor nao identificado", "text-align:left;");
      appendCell(row, record.inboxTypeLabel || INBOX_TYPES.campo_vazio.label, "text-align:left;");
      appendCell(row, record.lastMovement || "-", "text-align:left;min-width:190px;");
      appendCell(
        row,
        record.riskStatus,
        "font-weight:900;color:" +
          (record.riskStatus === "Critico" ? "#b42318" : record.riskStatus === "Atencao" ? "#b7791f" : "#166534") +
          ";"
      );
      appendCell(row, record.categoryLabel);
      appendCell(row, record.type, "text-align:left;min-width:190px;");
      appendCell(row, record.processNumber);
      const actionCell = appendCell(row, "");
      actionCell.appendChild(createVerifyButton(record));
      appendCell(row, record.knowledgeDateText);
      appendCell(row, record.receivedText + " (" + record.receivedDays + " dias)");
      appendDeadlineCell(row, record);
      appendCell(row, record.internalDueDateText);
      appendCell(row, recordRiskReasons(record), "text-align:left;min-width:220px;");
      fragment.appendChild(row);
    });
    shell.tbody.appendChild(fragment);
    container.appendChild(shell.wrap);
  }

  function renderCritical(container, records) {
    const items = filteredRecords(records).filter((record) => record.riskStatus === "Critico" || record.riskStatus === "Atencao");
    renderRecordTable(container, items, CONFIG.criticalScreenLimit);
  }

  function renderDetail(container, records, reportDate) {
    const selected = filteredRecords(records);
    container.appendChild(
      createElement(
        "div",
        "Detalhamento: " +
          selectedSectorSummary(records) +
          " | " +
          selectedAssessorSummary(records) +
          " | " +
          selectedInboxTypeSummary() +
          " | " +
          selectedRiskReasonSummary(records),
        "margin:0 0 12px;padding:9px 12px;border:1px solid #d2dae8;border-radius:7px;background:#f8fafd;" +
          "text-align:center;font-size:13px;font-weight:900;color:#192452;"
      )
    );
    const metrics = generalMetrics(selected, reportDate);
    const cards = grid("margin-bottom:12px;");
    cards.appendChild(card("Total", String(metrics.total), "", "#10264f"));
    cards.appendChild(card("Criticos", String(metrics.critical), "", "#b42318"));
    cards.appendChild(card("Em atencao", String(metrics.attention), "", "#b7791f"));
    cards.appendChild(card("SPA <= 8 dias", String(metrics.pjeNear), "", "#b7791f"));
    cards.appendChild(card("+20 dias", String(metrics.over20), "", "#9f1239"));
    cards.appendChild(card("Media na caixa", metrics.averageReceivedText, "", "#0f766e"));
    container.appendChild(cards);
    renderRecordTable(container, selected, CONFIG.screenRowLimit);
  }

  function renderModalContent() {
    const content = document.querySelector("#spa-cdsp-management-modal-content");
    if (!content) return;
    content.innerHTML = "";
    const records = state.lastRecords || [];
    const reportDate = state.lastReportDate || startOfToday();

    const filtered = filteredRecords(records);
    const sidebar=document.querySelector('#mtprev-mgmt-report-sidebar');
    if (sidebar) {
      sidebar.replaceChildren();
      const eyebrow=createElement('p','RELATÓRIOS');eyebrow.className='mtprev-mgmt-side-eyebrow';sidebar.appendChild(eyebrow);
      const intro=createElement('p','Visualizações da mesa selecionada');intro.className='mtprev-mgmt-side-desc';sidebar.appendChild(intro);
      renderTabs(sidebar,renderModalContent);
      const triagemButton=document.querySelector('.mtprev-triage-entry .mtprev-triage-primary');
      if(triagemButton){
        const group=createElement('p','OUTROS RELATÓRIOS');group.className='mtprev-mgmt-side-eyebrow';group.style.marginTop='20px';sidebar.appendChild(group);
        const openTriage=createElement('button','▤  Triagem e distribuição');openTriage.type='button';openTriage.className='mtprev-mgmt-side-link';
        openTriage.addEventListener('click',()=>{closeModal();triagemButton.click();});sidebar.appendChild(openTriage);
      }
      const hint=createElement('div','As seções usam a mesma leitura da mesa; trocar de relatório não faz novas consultas.');hint.className='mtprev-mgmt-side-hint';sidebar.appendChild(hint);
    }
    renderControls(content, records, renderModalContent);

    if (state.modal.activeTab === "visao") renderOverview(content, filtered, reportDate);
    else if (state.modal.activeTab === "assessores") renderAssessorTable(content, filtered, reportDate);
    else if (state.modal.activeTab === "criticos") renderCritical(content, records);
    else renderDetail(content, records, reportDate);
  }

  function closeModal() {
    const modal = document.querySelector("#" + CONFIG.modalId);
    if (modal) modal.remove();
  }

  function openManagementReport(records, reportDate) {
    closeModal();
    ensureManagementDashboardStyles();
    state.lastRecords=records;state.lastReportDate=reportDate;
    state.modal.activeTab='visao';
    state.modal.selectedSectors=sectorOptions(records);
    state.modal.selectedAssessor='todos';state.modal.selectedAssessors=assessorOptions(records);
    state.modal.selectedCategory='todos';state.modal.selectedCategories=CATEGORY_ORDER.slice();
    state.modal.selectedInboxType='todos';state.modal.selectedInboxTypes=INBOX_TYPE_ORDER.slice();
    state.modal.selectedRiskReasons=riskReasonOptions(records).map(item=>item.value);
    state.modal.onlyCritical=false;state.modal.detailAssessor=assessorOptions(records)[0]||'';
    state.modal.assessorSort={key:'',direction:'asc'};state.modal.recordSort={key:'',direction:'asc'};
    const overlay=createElement('div','');overlay.id=CONFIG.modalId;
    overlay.className='mtprev-mgmt-overlay';overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Painel Gerencial de Processos - CDSP');
    const dialog=createElement('div','');dialog.className='mtprev-mgmt-dialog';
    const header=createElement('header','');header.className='mtprev-mgmt-head';
    const brand=createElement('div','');brand.className='mtprev-mgmt-brand';
    if(CONFIG.headerImageUrl){const img=document.createElement('img');img.src=CONFIG.headerImageUrl;img.alt='MTPrev';brand.appendChild(img);}
    else{brand.textContent='MTPrev';brand.style.fontSize='23px';brand.style.fontWeight='850';}
    header.appendChild(brand);
    const heading=createElement('div','');heading.className='mtprev-mgmt-headline';
    heading.appendChild(createElement('h2','Painel Gerencial de Processos - CDSP'));
    const metrics=generalMetrics(records,reportDate);
    heading.appendChild(createElement('small',
      `Gerado em ${formatDateTime(new Date())} · ${metrics.total} processos · ${metrics.assessors} assessores · ${metrics.critical} críticos · ${metrics.attention} em atenção${state.lastReadingDurationMs?` · Leitura em ${Math.round(state.lastReadingDurationMs/1000)}s`:''}`));
    header.appendChild(heading);
    const actions=createElement('div','');actions.className='mtprev-mgmt-actions';
    const billing=createElement('div','');billing.style.cssText='display:flex;gap:6px;flex-wrap:wrap;';
    Object.keys(EMAIL_ALERT_TYPES).forEach(key=>{
      const btn=createElement('button',EMAIL_ALERT_TYPES[key].button);btn.type='button';
      btn.title='Preparar cobranças a partir do relatório; não envia automaticamente.';
      btn.addEventListener('click',()=>generateBillingAlerts(key));billing.appendChild(btn);
    });actions.appendChild(billing);
    const pdfButton=createElement('button','Imprimir / salvar PDF');pdfButton.type='button';
    pdfButton.addEventListener('click',()=>{setStatus('Abrindo impressão...');window.print();});
    actions.appendChild(pdfButton);
    const excelButton=createElement('button','Exportar Excel');excelButton.type='button';
    excelButton.addEventListener('click',()=>{
      excelButton.disabled=true;excelButton.textContent='Exportando…';
      generateExcel(filteredRecords(state.lastRecords||[]),state.lastReportDate||startOfToday())
        .then(()=>{setStatus('Excel gerado');log('Excel gerencial gerado.','ok');})
        .catch(error=>{log(error?.message||String(error),'error');window.alert('Erro ao exportar Excel: '+(error?.message||String(error)));})
        .finally(()=>{excelButton.disabled=false;excelButton.textContent='Exportar Excel';});
    });actions.appendChild(excelButton);
    const closeButton=createElement('button','Fechar');closeButton.type='button';closeButton.className='mtprev-mgmt-close';
    closeButton.addEventListener('click',closeModal);actions.appendChild(closeButton);
    header.appendChild(actions);dialog.appendChild(header);
    const body=createElement('div','');body.className='mtprev-mgmt-body';
    const sidebar=createElement('aside','');sidebar.className='mtprev-mgmt-sidebar';sidebar.id='mtprev-mgmt-report-sidebar';
    const content=createElement('div','');content.id='spa-cdsp-management-modal-content';content.className='mtprev-mgmt-content';
    body.append(sidebar,content);dialog.appendChild(body);overlay.appendChild(dialog);document.body.appendChild(overlay);
    overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();closeModal();}});
    renderModalContent();
    closeButton.focus({preventScroll:true});
  }

  // Acao do radial: apresenta uma janela de geracao antes de consultar a mesa.
  // As consultas permanecem sob decisao explicita do usuario.
  function openManagementLauncher() {
    ensureManagementDashboardStyles();
    document.getElementById('mtprev-management-launcher')?.remove();
    const overlay=createElement('div','');overlay.id='mtprev-management-launcher';
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Gerar painel gerencial');
    const dialog=createElement('div','');dialog.className='mtprev-launch-dialog';
    const head=createElement('div','');head.className='mtprev-launch-head';
    if(CONFIG.headerImageUrl){const logo=document.createElement('img');logo.src=CONFIG.headerImageUrl;logo.alt='Logo MTPrev';logo.onerror=()=>logo.remove();head.appendChild(logo);}
    head.appendChild(createElement('span','Painel Gerencial · MTPrev'));dialog.appendChild(head);
    const body=createElement('div','');body.className='mtprev-launch-body';
    body.appendChild(createElement('div','Gerar os indicadores e gráficos usando os processos da visão atual do SPA. A coleta considera os filtros da mesa e pode levar alguns segundos.'));
    const hint=createElement('p','O relatório não altera expedientes. A exportação Excel continua disponível após gerar.');
    hint.style.cssText='font-size:12px;color:#67809a;margin:11px 0 0;';body.appendChild(hint);
    const status=createElement('p','');status.style.cssText='color:#315c7b;font-size:12px;min-height:18px;';
    body.appendChild(status);
    const progress=createElement('div','');progress.className='mtprev-launch-progress';progress.hidden=true;
    const progressLabel=createElement('div','Preparando coleta…');progressLabel.className='mtprev-launch-progress-label';
    const track=createElement('div','');track.className='mtprev-launch-progress-track';track.setAttribute('role','progressbar');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');
    const fill=createElement('div','');fill.className='mtprev-launch-progress-fill';track.appendChild(fill);
    const elapsed=createElement('div','Tempo decorrido: 0s');elapsed.className='mtprev-launch-progress-meta';
    const lots=createElement('div','Lotes da mesa: aguardando total…');lots.className='mtprev-launch-progress-meta';
    const eta=createElement('div','Estimativa: aguardando a primeira resposta…');eta.className='mtprev-launch-progress-meta';
    progress.append(progressLabel,track,lots,elapsed,eta);body.appendChild(progress);
    let timer=null, latest={count:0,total:0};
    const duration=(ms)=>{const seconds=Math.max(0,Math.floor(ms/1000));return seconds<60?`${seconds}s`:`${Math.floor(seconds/60)}min ${String(seconds%60).padStart(2,'0')}s`;};
    const updateClock=()=>{
      const start=state.collectionStartedAt||Date.now(),ms=Math.max(0,Date.now()-start);
      elapsed.textContent=`Tempo decorrido: ${duration(ms)}`;
      eta.textContent=latest.count>0&&latest.total>latest.count
        ?`Tempo restante estimado: ${duration(ms/latest.count*(latest.total-latest.count))} (aproximado)`
        :latest.total>0&&latest.count>=latest.total?'Leitura concluída · preparando indicadores…':'Estimativa: aguardando as primeiras páginas…';
    };
    overlay.mtprevProgress={
      start(){progress.hidden=false; if(timer===null)timer=setInterval(updateClock,1000);updateClock();},
      stop(){if(timer!==null){clearInterval(timer);timer=null;}updateClock();},
      update(meta,started){
        const m=typeof meta==='object'?meta:{count:meta,total:0};latest={count:Number(m.count)||0,total:Number(m.total)||0};
        this.start();const valid=latest.total>0;const percent=valid?Math.max(0,Math.min(100,Math.round(latest.count/latest.total*100))):0;
        fill.style.width=percent+'%';track.setAttribute('aria-valuenow',String(percent));
        progressLabel.textContent=valid?`Lendo workspace: ${latest.count} de ${latest.total} ${m.units||'processos'} · ${percent}%`:`Lendo workspace: ${latest.count} processos`;
        const batches=Number.isFinite(Number(m.pages))&&Number(m.pages)>0
          ?`${m.rounds||0} de ${m.pages} lotes concluídos · até ${m.batchSize||100} processos/lote`
          :valid?`Até ${Math.ceil(latest.total/100)} lotes de 100 processos`:'Aguardando total de processos';
        lots.textContent=batches+(m.lastCompletedPage?` · última página concluída: ${m.lastCompletedPage}`:'');updateClock();
      },
      phase(message){this.start();progressLabel.textContent=message;updateClock();}
    };
    overlay.addEventListener('mtprev:launcher-cleanup',()=>overlay.mtprevProgress.stop());
    const forceLabel=document.createElement('label');forceLabel.className='mtprev-launch-force';
    const forceCheck=document.createElement('input');forceCheck.type='checkbox';
    forceLabel.append(forceCheck,document.createTextNode(' Ler novamente a mesa (ignorar cache de 10 minutos)'));
    body.appendChild(forceLabel);
    const actions=createElement('div','');actions.className='mtprev-launch-actions';
    const cancel=createElement('button','Cancelar');cancel.type='button';cancel.addEventListener('click',()=>{if(state.running){state.stopped=true;status.textContent='Interrompendo leitura…';cancel.disabled=true;}else{overlay.mtprevProgress.stop();overlay.remove();}});actions.appendChild(cancel);
    if(Array.isArray(state.lastRecords)&&state.lastRecords.length){
      const reuse=createElement('button','Reabrir último');reuse.type='button';
      reuse.addEventListener('click',()=>{overlay.mtprevProgress.stop();overlay.remove();openManagementReport(state.lastRecords,state.lastReportDate||startOfToday());});actions.appendChild(reuse);
    }
    const generate=createElement('button','Gerar painel gerencial');generate.type='button';generate.className='mtprev-launch-primary';
    generate.addEventListener('click',async()=>{
      if(state.running) return;
      generate.disabled=true;generate.textContent='Lendo mesa de trabalho…';cancel.textContent='Interromper';cancel.disabled=false;
      status.textContent='Consultando os processos e preparando os indicadores…';progress.hidden=false;progressLabel.textContent='Iniciando leitura…';overlay.mtprevProgress.start();
      try { state.managementForceRefresh=forceCheck.checked;await generateManagementReport(); }
      finally {overlay.mtprevProgress.stop();if(overlay.isConnected){generate.disabled=false;cancel.disabled=false;cancel.textContent='Cancelar';generate.textContent='Gerar painel gerencial';status.textContent=state.stopped?'Leitura interrompida. Nenhum painel parcial foi gerado.':'Consulta encerrada. Se houve erro, confira o aviso da extensão.';}}
    });actions.appendChild(generate);body.appendChild(actions);dialog.appendChild(body);overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    overlay.addEventListener('keydown',event=>{if(event.key==='Escape'&&!state.running){overlay.remove();}});
    generate.focus({preventScroll:true});
  }

  function buttonCss(background) {
    return (
      "border:0;border-radius:5px;background:" +
      background +
      ";color:#fff;padding:8px 12px;font-size:12px;font-weight:900;cursor:pointer;"
    );
  }

  function modalButton(text, background) {
    const button = createElement("button", text, buttonCss(background));
    button.type = "button";
    return button;
  }

  async function copyBillingAlertTexts(payload) {
    const text = payload.messages.map((message) =>
      "Gestor(es): " + message.recipientName +
        "\nE-mails de referência: " + message.to +
        "\nAssunto sugerido: " + message.subject +
        "\n\n" + message.text
    ).join("\n\n------------------------------\n\n");

    await navigator.clipboard.writeText(text || "Nenhuma mensagem montada.");
  }

  function openBillingAlertsModal(payload) {
    const previous = document.getElementById("spa-cdsp-billing-alerts-modal");
    if (previous) previous.remove();

    const overlay = createElement(
      "div",
      "",
      "position:fixed;inset:0;z-index:1000000;background:rgba(10,14,20,.58);display:flex;" +
        "align-items:flex-start;justify-content:center;padding:18px 8px;box-sizing:border-box;overflow:auto;font-family:Arial,sans-serif;"
    );
    overlay.id = "spa-cdsp-billing-alerts-modal";

    const dialog = createElement(
      "div",
      "",
      "width:min(980px,calc(100vw - 16px));background:#fff;color:#172033;border-radius:8px;border:1px solid #d2dae8;" +
        "box-shadow:0 18px 55px rgba(0,0,0,.35);overflow:hidden;"
    );

    if (CONFIG.headerImageUrl) {
      const headerWrap = createElement(
        "div",
        "",
        "display:flex;align-items:center;justify-content:center;width:100%;height:86px;background:#27317d;overflow:hidden;"
      );
      const header = document.createElement("img");
      header.src = CONFIG.headerImageUrl;
      header.alt = "CDSP";
      header.style.cssText = "display:block;width:auto;height:70px;max-width:calc(100% - 20px);object-fit:contain;background:#27317d;";
      headerWrap.appendChild(header);
      dialog.appendChild(headerWrap);
    }

    const body = createElement("div", "", "padding:16px 18px 18px;");
    body.appendChild(createElement("h2", "Mensagens de cobrança - " + payload.label, "margin:0 0 6px;color:#172a65;font-size:20px;"));
    body.appendChild(
      createElement(
        "div",
        payload.totalRecords + " processo(s) selecionado(s), " + payload.messages.length +
          " mensagem(ns) por gestor, " + payload.unresolved.length + " sem gestor mapeado.",
        "font-size:13px;color:#425466;margin-bottom:12px;"
      )
    );

    const table = createElement(
      "table",
      "",
      "width:100%;border-collapse:collapse;font-size:13px;margin:10px 0 14px;"
    );
    table.innerHTML =
      "<thead><tr style=\"background:#172a65;color:white;\">" +
      "<th style=\"padding:8px;border:1px solid #d9e2ef;text-align:left;\">Gestor(es)</th>" +
      "<th style=\"padding:8px;border:1px solid #d9e2ef;text-align:left;\">Setor</th>" +
      "<th style=\"padding:8px;border:1px solid #d9e2ef;text-align:center;\">Processos</th>" +
      "</tr></thead><tbody>" +
      (payload.messages.length
        ? payload.messages.map((message) =>
          "<tr>" +
            "<td style=\"padding:8px;border:1px solid #d9e2ef;\"><strong>" + escapeHtml(message.recipientName) +
              "</strong><br><span style=\"color:#526275;\">" + escapeHtml(message.to) + "</span></td>" +
            "<td style=\"padding:8px;border:1px solid #d9e2ef;\">" + escapeHtml(message.sector) + "</td>" +
            "<td style=\"padding:8px;border:1px solid #d9e2ef;text-align:center;font-weight:900;\">" +
              message.records.length + "</td>" +
          "</tr>"
        ).join("")
        : "<tr><td colspan=\"3\" style=\"padding:10px;border:1px solid #d9e2ef;text-align:center;\">Nenhum gestor encontrado.</td></tr>") +
      "</tbody>";
    body.appendChild(table);

    if (payload.unresolved.length) {
      const unresolved = createElement(
        "div",
        "Sem gestor mapeado: " + payload.unresolved.slice(0, 8).map((item) =>
          item.processNumber + " (" + item.sector + ")"
        ).join("; ") + (payload.unresolved.length > 8 ? "..." : ""),
        "border:1px solid #f5c2c7;background:#fff5f5;color:#842029;border-radius:6px;padding:9px;margin-bottom:12px;font-size:12px;"
      );
      body.appendChild(unresolved);
    }

    const previews = createElement(
      "div",
      "",
      "display:grid;gap:10px;max-height:min(46vh,420px);overflow:auto;padding-right:4px;margin:8px 0 14px;"
    );
    payload.messages.forEach((message) => {
      const card = createElement(
        "section",
        "",
        "border:1px solid #d9e2ef;border-radius:7px;background:#f8fbff;padding:10px;"
      );
      const title = createElement(
        "div",
        message.recipientName + " - " + message.records.length + " processo(s)",
        "font-size:13px;font-weight:900;color:#172a65;margin-bottom:4px;"
      );
      const meta = createElement(
        "div",
        "Setor(es): " + message.sector + " | E-mails de referência: " + message.to,
        "font-size:11px;color:#526275;margin-bottom:8px;line-height:1.35;"
      );
      const textarea = document.createElement("textarea");
      textarea.readOnly = true;
      textarea.value = message.text;
      textarea.style.cssText =
        "width:100%;min-height:150px;resize:vertical;box-sizing:border-box;border:1px solid #ccd8e6;" +
        "border-radius:6px;background:#fff;color:#172033;padding:9px;font:12px/1.45 Consolas,monospace;";

      const copyOne = modalButton("Copiar esta mensagem", "#26317d");
      copyOne.style.marginTop = "8px";
      copyOne.addEventListener("click", () => {
        navigator.clipboard.writeText(message.text)
          .then(() => log("Mensagem de " + message.recipientName + " copiada.", "ok"))
          .catch((error) => window.alert("Nao foi possivel copiar: " + (error.message || String(error))));
      });

      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(textarea);
      card.appendChild(copyOne);
      previews.appendChild(card);
    });
    body.appendChild(previews);

    const actions = createElement("div", "", "display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;");
    const copyButton = modalButton("Copiar todas", "#107c41");
    copyButton.addEventListener("click", () => {
      copyBillingAlertTexts(payload)
        .then(() => log("Mensagens de cobrança copiadas.", "ok"))
        .catch((error) => window.alert("Nao foi possivel copiar: " + (error.message || String(error))));
    });
    const closeButton = modalButton("Fechar", "#6b7280");
    closeButton.addEventListener("click", () => overlay.remove());

    actions.appendChild(copyButton);
    actions.appendChild(closeButton);
    body.appendChild(actions);
    dialog.appendChild(body);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  function generateBillingAlerts(alertType) {
    const config = EMAIL_ALERT_TYPES[alertType];
    if (!config) return;
    if (state.running) {
      window.alert("Aguarde a leitura atual terminar antes de montar as cobranças.");
      return;
    }

    const records = Array.isArray(state.lastRecords) ? state.lastRecords : [];
    const reportDate = state.lastReportDate || startOfToday();
    if (!records.length) {
      window.alert("Gere o painel gerencial antes de montar as cobranças.");
      return;
    }

    setStatus("Montando cobranças...");
    log("Montando cobranças de " + config.label + " a partir do relatório gerado.");

    try {
      const payload = buildBillingAlertMessages(alertType, records, state.teamDatabase, reportDate);
      openBillingAlertsModal(payload);
      setStatus("Cobranças montadas");
      log(
        "Cobranças de " + config.label + " no relatório: " + payload.messages.length +
          " mensagem(ns), " + payload.totalRecords + " processo(s).",
        payload.messages.length ? "ok" : "error"
      );
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      setStatus("Erro nas cobranças");
      log(message, "error");
      window.alert("Nao foi possivel montar as cobranças: " + message);
    }
  }

  async function generateManagementReport() {
    if (state.running) return;
    state.running = true;
    state.stopped = false;
    state.collectionStartedAt=Date.now();
    setStatus("Lendo caixa gerencial...");
    log("Iniciando leitura da caixa atual do SPA.");

    try {
      const result = await collectAllRecords();
      if (!result.records.length) {
        setStatus("Nenhum processo encontrado");
        window.alert("Nenhum processo foi encontrado na caixa atual.");
        return;
      }
      setStatus("Carregando base de setores...");
      document.getElementById('mtprev-management-launcher')?.mtprevProgress?.phase('Leitura concluída · carregando setores…',state.collectionStartedAt);
      const teamDatabase = await loadTeamDatabase();
      const records = applyTeamData(result.records, teamDatabase);
      const unmatched = records.filter(isTeamUnmatched).length;
      if (unmatched) {
        log(unmatched + " assessor(es)/processo(s) sem setor identificado automaticamente.", "error");
      }
      setStatus("Gerando painel...");
      document.getElementById('mtprev-management-launcher')?.mtprevProgress?.phase('Preparando gráficos e indicadores…',state.collectionStartedAt);
      const launcher=document.getElementById('mtprev-management-launcher');
      launcher?.mtprevProgress?.stop();launcher?.remove();
      state.lastReadingDurationMs=Date.now()-state.collectionStartedAt;
      openManagementReport(records, result.reportDate);
      window.SpaAdapter?.showCollectionSummary(document.querySelector("#" + CONFIG.modalId + " > div"), result.coverage);
      setStatus("Painel gerado");
      log("Painel gerencial gerado com " + records.length + " processo(s).", "ok");
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      setStatus(state.stopped?'Interrompido':'Erro');
      document.getElementById('mtprev-management-launcher')?.mtprevProgress?.stop();
      log(message, 'error');
      window.alert("Nao foi possivel gerar o painel gerencial: " + message);
    } finally {
      state.running = false;
    }
  }

  function excelLib() {
    if (!window.ExcelJS) throw new Error("Biblioteca ExcelJS nao carregada. Recarregue a aba do SPA.");
    return window.ExcelJS;
  }

  function validExcelDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }

  function applyExcelBorder(cell, color) {
    const argb = color || "FFD2DAE8";
    cell.border = {
      top: { style: "thin", color: { argb } },
      left: { style: "thin", color: { argb } },
      bottom: { style: "thin", color: { argb } },
      right: { style: "thin", color: { argb } }
    };
  }

  function styleExcelHeader(row) {
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF272F7E" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      applyExcelBorder(cell, "FFBFC8DC");
    });
  }

  function styleExcelRow(row) {
    row.eachCell((cell, columnNumber) => {
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.font = Object.assign({}, cell.font || {}, { color: { argb: "FF1C2B39" } });
      applyExcelBorder(cell);
      if ([1, 22, 25, 28].indexOf(columnNumber) >= 0) cell.numFmt = "dd/mm/yyyy hh:mm";
      if (columnNumber === 31) cell.numFmt = "dd/mm/yyyy";
    });
  }

  function excelColumns() {
    return [
      { header: "Data Relatorio", key: "reportDate", width: 20 },
      { header: "Assessor(a)", key: "assessor", width: 28 },
      { header: "Setor", key: "sector", width: 26 },
      { header: "Servidor Base Setor", key: "teamMatchedName", width: 28 },
      { header: "Correspondencia Setor", key: "teamMatchMethod", width: 22 },
      { header: "Pontuacao Correspondencia", key: "teamMatchScore", width: 24 },
      { header: "Status Setor", key: "teamMatchStatus", width: 22 },
      { header: "Carga Critica Assessor", key: "assessorCriticalLoad", width: 22 },
      { header: "Total Processos Assessor", key: "assessorTotal", width: 22 },
      { header: "Criticos Assessor", key: "assessorCritical", width: 18 },
      { header: "Atencao Assessor", key: "assessorAttention", width: 18 },
      { header: "Processo Critico", key: "isCritical", width: 16 },
      { header: "Processo em Atencao", key: "isAttention", width: 20 },
      { header: "Situacao Processo", key: "riskStatus", width: 18 },
      { header: "Motivo Situacao", key: "riskReason", width: 42 },
      { header: "Categoria", key: "categoryLabel", width: 17 },
      { header: "Tipo Manifestacao", key: "type", width: 34 },
      { header: "Movimento", key: "movementKind", width: 20 },
      { header: "Regra Prazo Interno", key: "internalRule", width: 24 },
      { header: "Prazo Interno Dias Uteis", key: "internalDays", width: 23 },
      { header: "Numero Processo", key: "processNumber", width: 28 },
      { header: "Data Ciencia", key: "knowledgeDate", width: 21 },
      { header: "Ciencia Localizada", key: "knowledgeFound", width: 18 },
      { header: "Base Calculo", key: "calculationBaseSource", width: 18 },
      { header: "Data Base Calculo", key: "calculationBaseDate", width: 21 },
      { header: "Recebido Dias", key: "receivedDays", width: 16 },
      { header: "Faixa Idade Caixa", key: "receivedAgeRange", width: 18 },
      { header: "Prazo no SPA (PJE)", key: "pjeDeadlineDate", width: 21 },
      { header: "Dias Ate Prazo SPA (PJE)", key: "pjeDaysRemaining", width: 24 },
      { header: "Cor Prazo SPA", key: "pjeDeadlineColor", width: 16 },
      { header: "Prazo Interno", key: "internalDueDate", width: 18 },
      { header: "Dias Ate Prazo Interno", key: "internalDaysRemaining", width: 24 },
      { header: "Prazo Interno Vencido", key: "internalOverdue", width: 21 },
      { header: "SPA Ate 8 Dias", key: "pjeNear", width: 17 },
      { header: "Mais de 20 Dias", key: "over20", width: 17 },
      { header: "Prioridade Recurso", key: "priority", width: 18 },
      { header: "Tipo Prioridade Recurso", key: "priorityLabel", width: 28 },
      { header: "Tipo Caixa", key: "inboxTypeLabel", width: 28 },
      { header: "Ultimo Andamento", key: "lastMovement", width: 38 }
    ];
  }

  async function generateExcel(records, reportDate) {
    const ExcelJS = excelLib();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Automacao SPA CDSP - Coordenacao";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.title = "Painel Gerencial CDSP";
    const worksheet = workbook.addWorksheet("Dados", { views: [{ state: "frozen", ySplit: 1 }] });
    const columns = excelColumns();
    worksheet.columns = columns.map((column) => ({ key: column.key, width: column.width }));
    const headerRow = worksheet.getRow(1);
    headerRow.values = columns.map((column) => column.header);
    headerRow.height = 28;
    styleExcelHeader(headerRow);
    const generatedAt = new Date();
    const summariesByAssessor = new Map(
      buildAssessorSummaries(records, reportDate).map((summary) => [summary.assessor, summary])
    );

    sortCritical(records).forEach((record) => {
      const summary = summariesByAssessor.get(record.assessor) || {};
      const row = worksheet.addRow([
        validExcelDate(generatedAt),
        record.assessor,
        record.sector || "Setor nao identificado",
        record.teamMatchedName || "",
        record.teamMatchMethod || "",
        record.teamMatchScore || "",
        record.teamMatchStatus || "",
        summary.criticalLoad || "",
        summary.total || "",
        summary.critical || 0,
        summary.attention || 0,
        yesNo(record.riskStatus === "Critico"),
        yesNo(record.riskStatus === "Atencao"),
        record.riskStatus,
        recordRiskReasons(record),
        record.categoryLabel,
        record.type,
        movementKindLabel(record.internalDeadline.movementKind),
        record.internalDeadline.label,
        record.internalDeadline.days,
        record.processNumber,
        validExcelDate(record.knowledgeDate),
        yesNo(Boolean(record.knowledgeDate)),
        record.calculationBaseSource,
        validExcelDate(record.calculationBaseDate),
        record.receivedDays,
        receivedAgeRange(record.receivedDays),
        validExcelDate(record.pjeDeadlineDate),
        record.pjeDaysRemaining == null ? "" : record.pjeDaysRemaining,
        record.pjeDeadlineStyle && record.pjeDeadlineStyle.label ? record.pjeDeadlineStyle.label : "",
        validExcelDate(record.internalDueDate),
        record.internalDaysRemaining,
        yesNo(record.internalDaysRemaining <= 0),
        yesNo(isPjeNear(record)),
        yesNo(record.receivedDays > 20),
        record.priority || "",
        record.priorityLabel || "",
        record.inboxTypeLabel || INBOX_TYPES.campo_vazio.label,
        record.lastMovement || ""
      ]);
      styleExcelRow(row);
    });

    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, worksheet.rowCount), column: columns.length }
    };
    worksheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    const buffer = await workbook.xlsx.writeBuffer();
    saveBlob(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      "painel_gerencial_cdsp_" + formatDate(reportDate).replace(/\//g, "-") + ".xlsx"
    );
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function createPanel() {
    const old = document.querySelector("#" + CONFIG.panelId);
    if (old) old.remove();

    const embeddedHost = document.querySelector("#cdsp-general-module-gestao");
    const embedded = Boolean(embeddedHost);
    const panel = createElement(
      "div",
      "",
      embedded
        ? "position:relative;width:100%;max-width:none;background:#17212b;color:#fff;" +
          "border:1px solid #344253;border-radius:8px;box-shadow:none;font-family:'Segoe UI',Arial,sans-serif;overflow:hidden;"
        : "position:fixed;left:18px;bottom:18px;z-index:999996;width:468px;max-width:calc(100vw - 36px);background:#fff;color:#1c2b39;" +
          "border:1px solid #b9c6dc;border-radius:10px;box-shadow:0 16px 42px rgba(15,23,42,.26);" +
          "font-family:Arial,sans-serif;overflow:hidden;"
    );
    panel.id = CONFIG.panelId;
    if (embedded) panel.className = "cdsp-general-embedded-module cdsp-general-embedded-gestao";

    let brandHeader = null;
    if (CONFIG.headerImageUrl) {
      brandHeader = createElement(
        "div",
        "",
        embedded
          ? "display:flex;align-items:center;justify-content:center;margin:8px 10px 0 10px;padding:6px;" +
            "border:1px solid #344253;border-radius:6px;background:#1f2d3a;line-height:0;"
          : "background:#272f7e;border-bottom:1px solid #d8e1ef;padding:10px 12px;line-height:0;"
      );
      brandHeader.className = "cdsp-module-brand";
      const brandImage = document.createElement("img");
      brandImage.src = CONFIG.headerImageUrl;
      brandImage.alt = "Coordenadoria de Defesa da Saude Publica - PGE Mato Grosso";
      brandImage.style.cssText = embedded
        ? "display:block;width:100%;height:auto;max-height:58px;object-fit:contain;"
        : "display:block;width:100%;height:72px;object-fit:contain;background:#272f7e;";
      brandHeader.appendChild(brandImage);
    }

    const header = createElement(
      "div",
      "",
      embedded
        ? "background:#1f2d3a;color:#fff;padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.08);" +
          "display:flex;align-items:center;gap:8px;cursor:default;user-select:none;"
        : "background:#fff;color:#192452;padding:10px 12px;border-bottom:1px solid #d8e1ef;" +
          "display:flex;align-items:center;gap:10px;cursor:move;user-select:none;"
    );
    const mark = createElement(
      "div",
      "",
      embedded
        ? "width:34px;height:34px;border-radius:8px;background:#263544;display:flex;align-items:center;" +
          "justify-content:center;flex:0 0 auto;overflow:hidden;border:1px solid #344253;"
        : "width:40px;height:40px;border-radius:10px;background:#eef3ff;display:flex;align-items:center;" +
          "justify-content:center;flex:0 0 auto;overflow:hidden;border:1px solid #c8d7f5;"
    );
    if (CONFIG.iconImageUrl) {
      const markImage = document.createElement("img");
      markImage.src = CONFIG.iconImageUrl;
      markImage.alt = "CDSP";
      markImage.style.cssText = embedded
        ? "display:block;width:28px;height:28px;object-fit:contain;"
        : "display:block;width:34px;height:34px;object-fit:contain;";
      mark.appendChild(markImage);
    } else {
      mark.textContent = "CDSP";
      mark.style.color = embedded ? "#e3f2fd" : "#fff";
      mark.style.fontSize = "10px";
      mark.style.fontWeight = "900";
    }
    if (!embedded) header.appendChild(mark);
    const title = createElement("div", "", "min-width:0;flex:1;");
    title.appendChild(
      createElement(
        "div",
        "Coordenação",
        embedded
          ? "font-weight:850;font-size:13px;line-height:1.15;color:#fff;"
          : "font-weight:900;font-size:14px;line-height:1.15;color:#192452;"
      )
    );
    if (!embedded) {
      title.appendChild(
        createElement(
          "div",
          "Painel gerencial por assessor(a)",
          "font-size:11px;color:#526275;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
        )
      );
    }
    header.appendChild(title);
    const minimizeButton = createElement(
      "button",
      "Minimizar",
      "border:1px solid #c8d2e2;border-radius:6px;background:#f4f7fb;color:#192452;padding:6px 8px;" +
        "font-size:11px;font-weight:900;cursor:pointer;flex:0 0 auto;"
    );
    minimizeButton.type = "button";
    if (embedded) minimizeButton.style.display = "none";
    header.appendChild(minimizeButton);
    panel.appendChild(header);
    if (brandHeader) panel.appendChild(brandHeader);

    const body = createElement("div", "", embedded ? "padding:10px;background:#17212b;" : "padding:12px;background:#f8fafd;");
    const button = createElement(
      "button",
      "Gerar painel gerencial",
      embedded
        ? "width:100%;border:1px solid #4db6ac;border-radius:6px;background:#243a44;color:#e3f2fd;padding:9px 10px;" +
          "font-size:12px;font-weight:850;cursor:pointer;"
        : "width:100%;border:0;border-radius:7px;background:#272f7e;color:#fff;padding:11px 12px;" +
          "font-size:13px;font-weight:900;cursor:pointer;box-shadow:0 2px 0 rgba(0,0,0,.08);"
    );
    button.type = "button";
    button.addEventListener("click", openManagementLauncher);
    body.dataset.mtprevRadialOption = "Gerar painel gerencial";
    body.appendChild(button);
    body.appendChild(
      createElement(
        "div",
        "",
        embedded
          ? "margin-top:8px;font-size:11px;font-weight:800;color:#cfd8dc;min-height:18px;line-height:1.35;"
          : "margin-top:9px;font-size:12px;font-weight:800;color:#26364a;min-height:18px;line-height:1.35;"
      )
    );
    body.lastChild.id = "spa-cdsp-management-status";
    const logBox = createElement(
      "div",
      "",
      embedded
        ? "height:125px;margin-top:8px;overflow:auto;border:1px solid #344253;border-radius:6px;" +
          "background:#0d131a;padding:7px;color:#d5e5f2;font-family:Consolas,monospace;font-size:11px;line-height:1.35;"
        : "margin-top:9px;max-height:108px;overflow:auto;border:1px solid #d8e1ef;border-radius:7px;" +
          "background:#fff;padding:8px;color:#1f2f46;font-size:12px;line-height:1.45;"
    );
    logBox.id = "spa-cdsp-management-log";
    body.appendChild(logBox);
    panel.appendChild(body);
    if (embedded) header.style.cursor = "default";
    (embedded ? embeddedHost : document.body).appendChild(panel);

    let minimized = false;
    minimizeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      minimized = !minimized;
      if (brandHeader) brandHeader.style.display = minimized ? "none" : "block";
      body.style.display = minimized ? "none" : "block";
      minimizeButton.textContent = minimized ? "Expandir" : "Minimizar";
      panel.style.width = minimized ? "330px" : "468px";
    });

    if (!embedded) {
      let dragging = false;
      let dragOffsetX = 0;
      let dragOffsetY = 0;
      header.addEventListener("mousedown", (event) => {
        if (event.target === minimizeButton) return;
        dragging = true;
        const rect = panel.getBoundingClientRect();
        dragOffsetX = event.clientX - rect.left;
        dragOffsetY = event.clientY - rect.top;
        panel.style.left = rect.left + "px";
        panel.style.top = rect.top + "px";
        panel.style.right = "auto";
        panel.style.bottom = "auto";
        event.preventDefault();
      });
      document.addEventListener("mousemove", (event) => {
        if (!dragging) return;
        const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);
        const left = Math.max(0, Math.min(maxLeft, event.clientX - dragOffsetX));
        const top = Math.max(0, Math.min(maxTop, event.clientY - dragOffsetY));
        panel.style.left = left + "px";
        panel.style.top = top + "px";
      });
      document.addEventListener("mouseup", () => {
        dragging = false;
      });
    }

    log("Painel carregado. Versao " + CONFIG.version + ".", "ok");
  }

  document.addEventListener('mtprev:management:open', openManagementLauncher);
  createPanel();
})();
