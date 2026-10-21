"use strict";

// Firefox loads these dependencies in order through background.scripts.
if (typeof importScripts === "function") {
  importScripts("shared/mtprev_triage_rules.js");
}

// Imported after initialization below so the watcher can reuse the PJe query.

let pdfJsLoadError = "";

try {
  if (typeof importScripts === "function") {
    importScripts("vendor/pdf.min.js");
  }

  if (
    globalThis.pdfjsLib &&
    globalThis.pdfjsLib.GlobalWorkerOptions &&
    typeof chrome !== "undefined" &&
    chrome.runtime
  ) {
    globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("js/vendor/pdf.worker.min.js");
  }
} catch (error) {
  pdfJsLoadError = error && error.message ? error.message : String(error);
}

const ALLOWED_HOSTS = new Set(["spa.pge.mt.gov.br", "pge.mt.spa.coreplan.com.br"]);
const DEFAULT_DELAY_MS = 180;
const MAX_TABS_PER_REQUEST = 100;
const PDF_SCAN_TIMEOUT_MS = 45000;
const PDF_RENDER_TEXT_TIMEOUT_MS = 9000;
const PDF_RENDER_TEXT_POLL_MS = 600;
const MNI_MOVEMENTS_TIMEOUT_MS = 60000;
const MNI_MCP_ENDPOINT_URL = "https://pje-mcp-worker-tjmt.joaooliveira.workers.dev/mcp/dfa12739f3154104961d99e9a8758710de6d78f2934240e1998bd6d590707f5c";
const MNI_MCP_CONSULT_PROCESS_TOOL = "tjmt_mni_consultar_processo";
const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
const AUTOS_SEARCH_CACHE_MAX = 250;
const DUPLICATE_PDF_FINGERPRINT_CACHE_MAX = 180;
const DUPLICATE_PDF_FINGERPRINT_CONCURRENCY = 2;
const PIECE_CLASSIFICATION_STEP_ID = "618";
const SCHEDULE_STORAGE_KEY = "SPA_CDSP_SCHEDULE_CONFIG";
const SCHEDULE_PROTOCOL_PASSWORD_KEY = "SPA_CDSP_PROTOCOL_PASSWORD";
const SCHEDULE_ALARM_NAME = "spa-cdsp-scheduled-routine";
const SCHEDULE_MIN_INTERVAL_MINUTES = 1;
const CDSP_GENERAL_SHARED_REPORT_LIB_FILES = [
  "js/libs/exceljs.min.js"
];
const CDSP_GENERAL_PDF_LIB_FILE = "js/libs/pdf-lib.min.js";
const CDSP_GENERAL_MANAGEMENT_PANEL_FILE = "js/gestao/management_report_panel.js";
const CDSP_GENERAL_DEADLINE_PANEL_FILE = "js/prazos/deadline_report_panel.js";
const CDSP_GENERAL_TRIAGEM_PANEL_FILE = "js/triagem/spa_extension_panel.js";
const CDSP_GENERAL_ACTIVE_TEAM_DATABASE_FILE = "js/shared/active_team_database.js";
const CDSP_GENERAL_TEAM_DATABASE_FILE = "data/equipe.xlsx";
const SIMPLE_CLOSURE_GOOGLE_DOCS_ORIGIN = "https://docs.google.com/*";
const SIMPLE_CLOSURE_PLACEHOLDER = "INSERIR O TEXTO DO SIMPLES ENCERRAMENTO";
const SCHEDULE_DEFAULT_INBOX_URL = "https://pge.mt.spa.coreplan.com.br/procedures";
const MNI_PJE_INSTANCES = {
  pje1: {
    id: "pje1",
    label: "TJMT PJe 1o grau"
  },
  pje2: {
    id: "pje2",
    label: "TJMT PJe 2o grau"
  }
};
const SCHEDULE_STEP_LABELS = {
  science: "Dar ciencia",
  refresh: "Atualizar lista",
  close_assessoria: "Encerrar tarefa sugerida pela assessoria",
  protocol_petition: "Protocolar peticao em massa",
  protocol_ses_joins: "Protocolar juntadas da SES",
  protocol_agravo_instrumento: "Protocolar agravo de instrumento"
};
const CDSP_OFICIOS_DB_NAME = "cdspExtratorSigadoc";
const CDSP_OFICIOS_DB_VERSION = 1;
const CDSP_OFICIOS_STORE_PDFS = "oficiosAssinados";
const CDSP_OFICIOS_REMOTE_EXTRACT_TIMEOUT_MS = 45000;
const PIECE_INTERNS = {
  beatriz: {
    name: "Beatriz Vitoria Miranda Silva Cerqueira",
    value: "gid://spa/User/1379"
  },
  tacita: {
    name: "Tácita Vitória Pereira Gomes",
    value: "gid://spa/User/1307"
  },
  matheus: {
    name: "Matheus Augusto Ferreira Brandão",
    value: "gid://spa/User/1161"
  },
  enzo: {
    name: "Enzo Luiz Sawiski lamin",
    value: "gid://spa/User/1293"
  },
  gabrielle: {
    name: "Gabrielle Rodrigues Silva Espindola",
    value: "gid://spa/User/953"
  }
};

function cdspOficiosAbrirBanco() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CDSP_OFICIOS_DB_NAME, CDSP_OFICIOS_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CDSP_OFICIOS_STORE_PDFS)) {
        db.createObjectStore(CDSP_OFICIOS_STORE_PDFS, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Falha ao abrir o armazenamento interno."));
  });
}

async function cdspOficiosTransacao(storeName, mode, callback) {
  const db = await cdspOficiosAbrirBanco();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = callback(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Falha no armazenamento interno."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Falha na transacao do armazenamento interno."));
    };
  });
}

async function cdspOficiosSalvarPdfInterno(dados) {
  await cdspOficiosTransacao(CDSP_OFICIOS_STORE_PDFS, "readwrite", (store) => store.put(dados));
  return dados.id;
}

async function cdspOficiosObterPdfInterno(id) {
  return cdspOficiosTransacao(CDSP_OFICIOS_STORE_PDFS, "readonly", (store) => store.get(id));
}

async function cdspOficiosApagarPdfInterno(id) {
  return cdspOficiosTransacao(CDSP_OFICIOS_STORE_PDFS, "readwrite", (store) => store.delete(id));
}

function cdspOficiosBaixarArquivo(url, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url,
        filename,
        saveAs: false,
        conflictAction: "uniquify"
      },
      (downloadId) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(downloadId);
      }
    );
  });
}

async function cdspOficiosHandleMessage(message) {
  if (message.type === "cdspOficioSalvarPdf") {
    const id = await cdspOficiosSalvarPdfInterno(message.payload);
    return { ok: true, id };
  }

  if (message.type === "cdspOficioObterPdf") {
    const pdf = await cdspOficiosObterPdfInterno(message.id);
    if (!pdf) return { ok: false, error: "PDF interno nao encontrado." };
    return { ok: true, pdf };
  }

  if (message.type === "cdspOficioApagarPdf") {
    await cdspOficiosApagarPdfInterno(message.id);
    return { ok: true };
  }

  if (message.type === "cdspOficioBaixarArquivo") {
    const downloadId = await cdspOficiosBaixarArquivo(message.url, message.filename);
    return { ok: true, downloadId };
  }

  return { ok: false, error: "Tipo de mensagem de oficio nao reconhecido." };
}
let offscreenRequestSeq = 0;
let scheduledRoutineRunning = false;
let fallbackProtocolPassword = "";
const autosSearchCache = new Map();
const duplicatePdfFingerprintCache = new Map();
const initialPetitionInspectionCache = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAllowedUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value || value === "#" || /^javascript:/i.test(value)) return "";

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) return "";
    return parsed.href;
  } catch (_error) {
    return "";
  }
}

function legacyMassiveFallbackUrl(rawUrl, kind) {
  const url = normalizeAllowedUrl(rawUrl);
  if (!url || new URL(url).hostname !== "spa.pge.mt.gov.br") return "";
  if (kind === "close_assessoria") return new URL("/procedures/massive/2778", url).href;
  if (kind === "protocol_petition" || kind === "protocol_ses_joins") return new URL("/procedures/massive/2760", url).href;
  return "";
}

function normalizeRoutineUrl(rawUrl) {
  const url = normalizeAllowedUrl(rawUrl);
  if (!url) return SCHEDULE_DEFAULT_INBOX_URL;

  try {
    const parsed = new URL(url);
    if (parsed.pathname === "/procedures" || parsed.pathname === "/procedures/") return parsed.href;
    return new URL("/procedures", parsed.origin).href;
  } catch (_error) {
    return SCHEDULE_DEFAULT_INBOX_URL;
  }
}

function routineUserIdFromUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl || "");
    return parsed.searchParams.get("user_id") || "";
  } catch (_error) {
    return "";
  }
}

function normalizeRoutineConfig(rawConfig, sender) {
  const config = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
  const senderUrl = sender && sender.tab && sender.tab.url ? sender.tab.url : "";
  const targetUrl = normalizeRoutineUrl(config.targetUrl || senderUrl || SCHEDULE_DEFAULT_INBOX_URL);
  const seenSteps = new Set();
  const steps = [];
  (Array.isArray(config.steps) ? config.steps : []).forEach((step) => {
    if (!Object.prototype.hasOwnProperty.call(SCHEDULE_STEP_LABELS, step) || seenSteps.has(step)) return;
    seenSteps.add(step);
    steps.push(step);
  });
  const hours = Math.max(0, parseInt(config.hours || "0", 10) || 0);
  const minutes = Math.max(0, parseInt(config.minutes || "0", 10) || 0);
  const intervalMinutes = Math.max(
    SCHEDULE_MIN_INTERVAL_MINUTES,
    parseInt(config.intervalMinutes || String(hours * 60 + minutes || 30), 10) || 30
  );

  return {
    active: Boolean(config.active),
    intervalMinutes,
    hours: Math.floor(intervalMinutes / 60),
    minutes: intervalMinutes % 60,
    steps,
    targetUrl,
    targetUserId: routineUserIdFromUrl(targetUrl),
    targetTabId:
      sender && sender.tab && sender.tab.id
        ? sender.tab.id
        : Number.isFinite(parseInt(config.targetTabId, 10))
        ? parseInt(config.targetTabId, 10)
        : null,
    savedAt: config.savedAt || new Date().toISOString()
  };
}

async function getRoutineConfig() {
  const data = await chrome.storage.local.get(SCHEDULE_STORAGE_KEY);
  return normalizeRoutineConfig(data[SCHEDULE_STORAGE_KEY] || {});
}

async function storeRoutineConfig(config) {
  await chrome.storage.local.set({ [SCHEDULE_STORAGE_KEY]: config });
  await syncRoutineAlarm(config);
  return config;
}

async function setProtocolPassword(password) {
  const value = String(password || "");
  fallbackProtocolPassword = value;

  if (chrome.storage && chrome.storage.local) {
    if (value) {
      await chrome.storage.local.set({ [SCHEDULE_PROTOCOL_PASSWORD_KEY]: value });
    } else {
      await chrome.storage.local.remove(SCHEDULE_PROTOCOL_PASSWORD_KEY);
    }
  }

  if (chrome.storage && chrome.storage.session && !value) {
    await chrome.storage.session.remove(SCHEDULE_PROTOCOL_PASSWORD_KEY);
  }

  return { ok: true, hasPassword: Boolean(value) };
}

async function getProtocolPassword() {
  if (chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get(SCHEDULE_PROTOCOL_PASSWORD_KEY);
    const localValue = String(data[SCHEDULE_PROTOCOL_PASSWORD_KEY] || "");
    if (localValue) return localValue;
  }

  if (chrome.storage && chrome.storage.session) {
    const data = await chrome.storage.session.get(SCHEDULE_PROTOCOL_PASSWORD_KEY);
    const sessionValue = String(data[SCHEDULE_PROTOCOL_PASSWORD_KEY] || "");
    if (sessionValue) {
      fallbackProtocolPassword = sessionValue;
      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ [SCHEDULE_PROTOCOL_PASSWORD_KEY]: sessionValue });
      }
      return sessionValue;
    }
  }

  return fallbackProtocolPassword;
}

function isProtocolScheduleStep(step) {
  return step === "protocol_petition" || step === "protocol_ses_joins" || step === "protocol_agravo_instrumento";
}

function protocolScheduleGroup(step) {
  if (step === "protocol_agravo_instrumento") return "agravo";
  return isProtocolScheduleStep(step) ? "padrao" : "";
}

function protocolStageNamesFromSteps(steps, currentKind) {
  if (currentKind === "protocol_agravo_instrumento") return ["Minuta elaborada"];

  const safeSteps = Array.isArray(steps) ? steps : [];
  const hasProtocolPetition = currentKind === "protocol_petition" || safeSteps.indexOf("protocol_petition") >= 0;
  const hasSesJoins = currentKind === "protocol_ses_joins" || safeSteps.indexOf("protocol_ses_joins") >= 0;
  const names = [];

  if (hasProtocolPetition) names.push("Para assinar");
  if (hasSesJoins) names.push("Juntadas da SES");

  return names.length ? names : ["Para assinar"];
}

function sanitizeMniProcessNumber(value) {
  return String(value || "").replace(/\D+/g, "");
}

function normalizeMniPlainText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function inferMniPjeEndpoint(processNumber, tribunalText) {
  const digits = sanitizeMniProcessNumber(processNumber);
  const tribunal = normalizeMniPlainText(tribunalText);
  const justiceSegment = digits[13] || "";
  const courtSegment = digits.slice(14, 16);
  const originSegment = digits.slice(16, 20);

  if (digits.length !== 20) {
    return {
      error: "Numero do processo invalido para consulta MNI/PJe."
    };
  }

  if (justiceSegment !== "8" || courtSegment !== "11") {
    return {
      error: "Consulta MNI/PJe automatica configurada apenas para processos TJMT nesta versao."
    };
  }

  if (tribunal.indexOf("2") >= 0 && tribunal.indexOf("grau") >= 0) return MNI_PJE_INSTANCES.pje2;
  if (tribunal.indexOf("segundo grau") >= 0) return MNI_PJE_INSTANCES.pje2;
  if (originSegment === "0000") return MNI_PJE_INSTANCES.pje2;
  return MNI_PJE_INSTANCES.pje1;
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([a-f0-9]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function buildMniEnvelope(operation, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://www.cnj.jus.br/servico-intercomunicacao-2.2.2/" xmlns:tip="http://www.cnj.jus.br/tipos-servico-intercomunicacao-2.2.2">
  <soapenv:Header/>
  <soapenv:Body>
    <ser:${operation}>${body}
    </ser:${operation}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function stripXmlPrefix(name) {
  return String(name || "").replace(/^.*:/, "");
}

function readXmlAttributes(text) {
  const attrs = {};
  const regex = /([A-Za-z_][\w:.-]*)\s*=\s*"([^"]*)"/g;
  let match;

  while ((match = regex.exec(String(text || "")))) {
    attrs[stripXmlPrefix(match[1])] = decodeXmlEntities(match[2]);
  }

  return attrs;
}

function getXmlElements(xml, localName) {
  const source = String(xml || "");
  const elements = [];
  const paired = new RegExp("<(?:[A-Za-z_][\\w.-]*:)?(" + localName + ")\\b([^>]*)>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?" + localName + ">", "gi");
  const selfClosing = new RegExp("<(?:[A-Za-z_][\\w.-]*:)?(" + localName + ")\\b([^>]*)\\/>", "gi");
  let match;

  while ((match = paired.exec(source))) {
    elements.push({
      attrs: readXmlAttributes(match[2]),
      inner: match[3] || ""
    });
  }

  while ((match = selfClosing.exec(source))) {
    elements.push({
      attrs: readXmlAttributes(match[2]),
      inner: ""
    });
  }

  return elements;
}

function getFirstXmlAttributes(xml, localName) {
  const elements = getXmlElements(xml, localName);
  return elements.length ? elements[0].attrs : null;
}

function getXmlChildTexts(xml, localName) {
  return getXmlElements(xml, localName)
    .map((item) => decodeXmlEntities(String(item.inner || "").replace(/<[^>]+>/g, " ")))
    .filter(Boolean);
}

function pickValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function parseMniDateTimestamp(value) {
  const text = String(value || "").trim();
  if (!text) return 0;

  const compact = text.match(/^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})?)?/);
  if (compact) {
    return Date.UTC(
      Number(compact[1]),
      Number(compact[2]) - 1,
      Number(compact[3]),
      Number(compact[4] || 0),
      Number(compact[5] || 0),
      Number(compact[6] || 0)
    );
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMniMovements(xml) {
  return getXmlElements(xml, "movimento")
    .map((element) => {
      const attrs = element.attrs || {};
      const nationalAttrs = getFirstXmlAttributes(element.inner, "movimentoNacional") || {};
      const localAttrs = getFirstXmlAttributes(element.inner, "movimentoLocal") || {};
      const complements = getXmlChildTexts(element.inner, "complemento");
      const linkedDocumentIds = getXmlChildTexts(element.inner, "idDocumentoVinculado");
      const rawText = decodeXmlEntities(String(element.inner || "").replace(/<[^>]+>/g, " "));
      const id = pickValue(attrs.identificadorMovimento, attrs.idMovimento, localAttrs.codigoMovimento, nationalAttrs.codigoNacional);
      const code = pickValue(nationalAttrs.codigoNacional, localAttrs.codigoMovimento, attrs.movimentoNacional, attrs.codigoMovimento, attrs.codMovimento);
      const description = pickValue(
        localAttrs.descricao,
        nationalAttrs.descricao,
        attrs.descricao,
        complements.join(" | "),
        rawText,
        "Movimento MNI"
      );

      return {
        id,
        code,
        date: pickValue(attrs.dataHora, attrs.data, attrs.dataMovimento),
        description,
        linkedDocumentIds,
        confidentialityLevel: attrs.nivelSigilo || null
      };
    })
    .sort((a, b) => parseMniDateTimestamp(b.date) - parseMniDateTimestamp(a.date))
    .slice(0, 120);
}

function parseMcpToolPayload(message) {
  if (!message || typeof message !== "object") {
    throw new Error("Resposta MCP vazia ou invalida.");
  }

  if (message.error) {
    throw new Error(message.error.message || "MCP retornou erro na consulta.");
  }

  const result = message.result || {};
  if (result.structuredContent) return result.structuredContent;

  const textContent =
    Array.isArray(result.content) && result.content[0] && typeof result.content[0].text === "string"
      ? result.content[0].text
      : "";

  if (textContent) {
    try {
      return JSON.parse(textContent);
    } catch (_error) {
      return { ok: false, error: textContent.slice(0, 500) };
    }
  }

  return result;
}

function firstMcpProcessResult(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload.results) && payload.results.length) {
    return payload.results.find((item) => item && item.ok !== false) || payload.results[0];
  }
  return payload;
}

function normalizeMcpMovements(payload) {
  const result = firstMcpProcessResult(payload);
  const movements = result && result.case && Array.isArray(result.case.movements) ? result.case.movements : [];

  return movements
    .map((movement, index) => ({
      id: pickValue(movement.id, movement.identificadorMovimento, String(index + 1)),
      code: pickValue(movement.code, movement.codigo, movement.codigoNacional),
      date: pickValue(movement.date, movement.dataHora, movement.data, movement.dataMovimento),
      description: pickValue(movement.description, movement.descricao, movement.name, "Movimento MNI"),
      linkedDocumentIds: Array.isArray(movement.linkedDocumentIds)
        ? movement.linkedDocumentIds.filter(Boolean).map(String)
        : [],
      confidentialityLevel: movement.confidentialityLevel || null
    }))
    .sort((a, b) => parseMniDateTimestamp(b.date) - parseMniDateTimestamp(a.date))
    .slice(0, 200);
}

function normalizeMcpExpedientes(payload) {
  const result = firstMcpProcessResult(payload);
  const expedientes = result && Array.isArray(result.expedientes) ? result.expedientes : [];

  return expedientes
    .map((expediente) => {
      const expedienteInfo = expediente.expediente || {};
      const documentCandidateIds = Array.isArray(expediente.documentCandidateIds)
        ? expediente.documentCandidateIds.filter(Boolean).map(String)
        : [expediente.documentId, expediente.linkedDocumentId, expedienteInfo.documentId, expedienteInfo.linkedDocumentId]
            .filter(Boolean)
            .map(String);

      return {
        id: pickValue(expediente.id, expedienteInfo.id),
        party: typeof expediente.party === "object" && expediente.party ? (expediente.party.name || expediente.party.nome || expediente.party.label || "") : expediente.party || null,
        partyId: expediente.partyId || (expediente.party && typeof expediente.party === "object" ? expediente.party.id || expediente.party.cnpj : null) || null,
        recipientName: expediente.recipientName || (expediente.recipient && typeof expediente.recipient === "object" ? expediente.recipient.name || expediente.recipient.nome : expediente.recipient) || null,
        recipientId: expediente.recipientId || (expediente.recipient && typeof expediente.recipient === "object" ? expediente.recipient.id || expediente.recipient.cnpj : null) || null,
        procuradoria: expediente.procuradoria || null,
        responseId: expediente.responseId || null,
        documentId: pickValue(expediente.documentId, expedienteInfo.documentId),
        linkedDocumentId: pickValue(expediente.linkedDocumentId, expedienteInfo.linkedDocumentId),
        deadlineType: expediente.deadlineType || null,
        legalDeadlineDays: expediente.legalDeadlineDays || null,
        deadlineAt: expediente.deadlineAt || null,
        awareAt: expediente.awareAt || null,
        manuallyClosedAt: expediente.manuallyClosedAt || null,
        awareBy: expediente.awareBy || null,
        manuallyClosedBy: expediente.manuallyClosedBy || null,
        sentToDomicile: expediente.sentToDomicile ?? null,
        returned: expediente.returned ?? null,
        closed: expediente.closed ?? null,
        personalNotice: expediente.personalNotice ?? null,
        lateResponse: expediente.lateResponse ?? null,
        centralMandado: expediente.centralMandado ?? null,
        centralMandadoName: expediente.centralMandadoName || null,
        officerName: expediente.officerName || null,
        documentType: expedienteInfo.documentType || null,
        createdAt: expedienteInfo.createdAt || null,
        deliveryMethod: expedienteInfo.deliveryMethod || null,
        specializationCode: expedienteInfo.specializationCode || null,
        priority: expedienteInfo.priority || null,
        documentCandidateIds,
        communicationCandidateIds: Array.isArray(expediente.communicationCandidateIds)
          ? expediente.communicationCandidateIds.filter(Boolean).map(String)
          : [],
        hasDocumentReference: Boolean(expediente.hasDocumentReference)
      };
    })
    .sort((a, b) => parseMniDateTimestamp(b.createdAt || b.awareAt || b.deadlineAt) - parseMniDateTimestamp(a.createdAt || a.awareAt || a.deadlineAt))
    .slice(0, 160);
}

function summarizeMcpCase(payload) {
  const result = firstMcpProcessResult(payload);
  const caseInfo = result && result.case ? result.case : {};
  return {
    number: caseInfo.number || null,
    formattedNumber: caseInfo.formattedNumber || null,
    classCode: caseInfo.classCode || null,
    filingDate: caseInfo.filingDate || null,
    judgeBody: caseInfo.judgeBody || null,
    judgeBodyCode: caseInfo.judgeBodyCode || null,
    movementCount: caseInfo.movementCount || 0,
    documentCount: caseInfo.documentCount || 0
  };
}

async function fetchMniProcedureMovements(message) {
  const processNumber = sanitizeMniProcessNumber(message && message.processNumber);
  const instance = inferMniPjeEndpoint(processNumber, message && message.tribunal);

  if (instance.error) {
    return {
      ok: false,
      error: instance.error,
      movements: [],
      expedientes: [],
      processNumber
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MNI_MOVEMENTS_TIMEOUT_MS);

  try {
    const requestId = "cdsp-mni-" + Date.now();
    const response = await fetch(MNI_MCP_ENDPOINT_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: requestId,
        method: "tools/call",
        params: {
          name: MNI_MCP_CONSULT_PROCESS_TOOL,
          arguments: {
            numeroProcesso: processNumber,
            instancia: instance.id,
            movimentos: true,
            consultarExpedientes: true,
            consultarAvisos: false,
            incluirCabecalho: true,
            incluirDocumentos: false
          }
        }
      })
    });
    const bodyText = await response.text();
    let rpcPayload = null;

    try {
      rpcPayload = bodyText ? JSON.parse(bodyText) : null;
    } catch (_error) {
      rpcPayload = { error: { message: bodyText.slice(0, 500) || "Resposta MCP nao era JSON." } };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: "Worker MCP retornou HTTP " + response.status + ".",
        details: bodyText.slice(0, 300),
        movements: [],
        expedientes: [],
        processNumber,
        sourceLabel: instance.label + " via MCP"
      };
    }

    const toolPayload = parseMcpToolPayload(rpcPayload);
    const processResult = firstMcpProcessResult(toolPayload);

    if (!processResult || processResult.ok === false || processResult.success === false) {
      return {
        ok: false,
        error:
          (processResult && (processResult.error || processResult.message)) ||
          toolPayload.error ||
          "MCP/PJe retornou erro na consulta.",
        movements: [],
        expedientes: [],
        processNumber,
        sourceLabel: instance.label + " via MCP"
      };
    }

    return {
      ok: true,
      processNumber,
      sourceLabel: instance.label + " via MCP",
      case: summarizeMcpCase(toolPayload),
      movements: normalizeMcpMovements(toolPayload),
      expedientes: normalizeMcpExpedientes(toolPayload),
      expedienteCount: Number(processResult.expedienteCount || (processResult.expedientes || []).length || 0),
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error && error.name === "AbortError"
          ? "Tempo limite excedido ao consultar andamento no MNI/PJe."
          : error && error.message
          ? error.message
          : String(error),
      movements: [],
      expedientes: [],
      processNumber,
      sourceLabel: instance.label + " via MCP"
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function syncRoutineAlarm(config) {
  await chrome.alarms.clear(SCHEDULE_ALARM_NAME);
  if (!config || !config.active || !config.steps.length) return;

  chrome.alarms.create(SCHEDULE_ALARM_NAME, {
    delayInMinutes: config.intervalMinutes,
    periodInMinutes: config.intervalMinutes
  });
}

async function waitForScheduledTabComplete(tabId, timeoutMs = 90000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.status === "complete") return tab;
    await sleep(350);
  }

  throw new Error("Tempo excedido aguardando carregamento da aba do SPA.");
}

async function navigateScheduledTab(tabId, url, timeoutMs) {
  await chrome.tabs.update(tabId, { url });
  return waitForScheduledTabComplete(tabId, timeoutMs || 90000);
}

async function findRoutineTab(config) {
  const targetOrigin = new URL(normalizeRoutineUrl(config && config.targetUrl)).origin;
  const userId = config && config.targetUserId ? String(config.targetUserId) : "";
  const targetTabId = config && config.targetTabId ? parseInt(config.targetTabId, 10) : 0;

  if (targetTabId) {
    try {
      const tab = await chrome.tabs.get(targetTabId);
      const parsed = new URL(tab.url || "");
      if (ALLOWED_HOSTS.has(parsed.hostname) && parsed.origin === targetOrigin && (!userId || parsed.searchParams.get("user_id") === userId)) {
        return tab;
      }
    } catch (_error) {
      // A aba pode ter sido fechada; nesse caso a rotina procura outra aba compativel.
    }
  }

  const tabs = await chrome.tabs.query({ url: Array.from(ALLOWED_HOSTS, (host) => "https://" + host + "/procedures*") });
  const inboxTabs = tabs.filter((tab) => {
    try {
      const parsed = new URL(tab.url || "");
      if (!ALLOWED_HOSTS.has(parsed.hostname) || parsed.origin !== targetOrigin) return false;
      if (parsed.pathname !== "/procedures" && parsed.pathname !== "/procedures/") return false;
      if (userId && parsed.searchParams.get("user_id") !== userId) return false;
      return true;
    } catch (_error) {
      return false;
    }
  });

  return inboxTabs[0] || null;
}

async function ensureScheduledPanel(tabId) {
  await waitForScheduledTabComplete(tabId, 90000);
  await injectPanel({ tab: { id: tabId } });
  await sleep(700);
}

async function executeMainWorld(tabId, func, args) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func,
    args: args || []
  });
  return results && results[0] ? results[0].result : null;
}

async function logScheduled(tabId, message, type) {
  try {
    await ensureScheduledPanel(tabId);
    await executeMainWorld(
      tabId,
      (text, kind) => {
        if (window.SPA_CDSP_AUTOMACAO && typeof window.SPA_CDSP_AUTOMACAO.log === "function") {
          window.SPA_CDSP_AUTOMACAO.log(text, kind);
        }
        if (window.SPA_CDSP_AUTOMACAO && typeof window.SPA_CDSP_AUTOMACAO.setStatus === "function") {
          window.SPA_CDSP_AUTOMACAO.setStatus(text.slice(0, 28));
        }
      },
      [message, type || ""]
    );
  } catch (_error) {
    // O log no painel e auxiliar; a rotina continua mesmo se a aba acabou de recarregar.
  }
}

async function runPanelMethod(tabId, methodName, options) {
  await ensureScheduledPanel(tabId);
  const result = await executeMainWorld(
    tabId,
    async (method, runOptions) => {
      const api = window.SPA_CDSP_AUTOMACAO;
      if (!api || typeof api[method] !== "function") {
        return { ok: false, error: "Painel da automacao nao carregado na pagina." };
      }

      const limitInput = document.querySelector("#spa-cdsp-limit");
      const limit = limitInput ? limitInput.value : "";
      if (runOptions && runOptions.useLimit) {
        await api[method](limit);
      } else {
        await api[method]();
      }
      return { ok: true };
    },
    [methodName, options || {}]
  );

  if (!result || !result.ok) {
    throw new Error((result && result.error) || "Falha ao executar passo no painel.");
  }
}

async function resolveMassiveStepUrl(tabId, kind) {
  const result = await executeMainWorld(
    tabId,
    (stepKind) => {
      function normalize(text) {
        return String(text || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      function absolute(href) {
        try {
          return new URL(href, location.href).href;
        } catch (_error) {
          return "";
        }
      }

      const cards = Array.from(document.querySelectorAll("#massive-steps .alert, .alert"));
      const matches = [];
      cards.forEach((card) => {
        const cardText = normalize(card.textContent);
        const link = card.querySelector("a[href*='/procedures/massive/']");
        if (!link) return;
        const href = absolute(link.getAttribute("href"));
        if (!href) return;

        if (stepKind === "close_assessoria") {
          if (
            cardText.indexOf("encerrar tarefa") >= 0 &&
            cardText.indexOf("processo judicial") >= 0 &&
            cardText.indexOf("agravo de instrumento") < 0
          ) {
            matches.push({ href, score: cardText.indexOf("sugerida pela assessoria") >= 0 ? 2 : 1 });
          }
          return;
        }

        if (
          stepKind === "protocol_agravo_instrumento" &&
          cardText.indexOf("realizar peticionamento") >= 0 &&
          cardText.indexOf("agravo de instrumento") >= 0
        ) {
          matches.push({ href, score: cardText.indexOf("em massa") >= 0 ? 3 : 2 });
          return;
        }

        if (
          (stepKind === "protocol_petition" || stepKind === "protocol_ses_joins") &&
          cardText.indexOf("protocolar peticao") >= 0 &&
          cardText.indexOf("processo judicial") >= 0
        ) {
          matches.push({ href, score: 2 });
        }
      });

      matches.sort((a, b) => b.score - a.score);
      return matches[0] || null;
    },
    [kind]
  );

  if (result && result.href) return result.href;
  return legacyMassiveFallbackUrl((await chrome.tabs.get(tabId)).url, kind);
}

async function massivePageHasStage(tabId, stageName) {
  const result = await executeMainWorld(
    tabId,
    (name) => {
      function normalizeLabel(value) {
        return String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      const wanted = normalizeLabel(name);
      return Array.from(document.querySelectorAll(".stage-checkbox")).some((input) => {
        const attr = normalizeLabel(input.getAttribute("data-stage-name"));
        const label = normalizeLabel(input.closest("label") ? input.closest("label").textContent : "");
        return attr === wanted || label.indexOf(wanted) >= 0;
      });
    },
    [stageName]
  );
  return Boolean(result);
}

async function massivePageHasStages(tabId, stageNames) {
  const names = (Array.isArray(stageNames) ? stageNames : [stageNames]).filter(Boolean);
  for (const name of names) {
    if (!(await massivePageHasStage(tabId, name))) return false;
  }
  return true;
}

async function selectMassivePageAndFinish(tabId, stageNames, mode, protocolPassword) {
  const result = await executeMainWorld(
    tabId,
    async (expectedStageNames, actionMode, signerPassword) => {
      function sleepInPage(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }

      function isVisible(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      }

      function clickInput(input) {
        if (!input) return false;
        if (!input.checked) input.click();
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }

      function normalizeLabel(value) {
        return String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      }

      function findStageCheckbox(name) {
        const wanted = normalizeLabel(name);
        const inputs = Array.from(document.querySelectorAll(".stage-checkbox"));
        return inputs.find((input) => {
          const attr = normalizeLabel(input.getAttribute("data-stage-name"));
          const label = normalizeLabel(input.closest("label") ? input.closest("label").textContent : "");
          return attr === wanted || label.indexOf(wanted) >= 0;
        });
      }

      function clickElement(element) {
        if (!element) return false;
        element.scrollIntoView({ block: "center", inline: "nearest" });
        element.focus();
        ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
          element.dispatchEvent(
            new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              view: window,
              button: 0,
              buttons: type.indexOf("down") >= 0 ? 1 : 0,
            })
          );
        });
        if (typeof element.click === "function") element.click();
        return true;
      }

      const names = (Array.isArray(expectedStageNames) ? expectedStageNames : [expectedStageNames]).filter(Boolean);
      const selectedStageNames = [];
      for (const stageName of names) {
        const stage = findStageCheckbox(stageName);
        if (!stage) return { ok: false, error: "Fase nao encontrada: " + stageName };
        clickInput(stage);
        selectedStageNames.push(stageName);
        await sleepInPage(650);
      }
      await sleepInPage(1800);

      const pageSelection = document.querySelector(".check-all-procedures-table");
      if (!pageSelection) return { ok: false, error: "Checkbox de selecao por pagina nao encontrado." };
      clickInput(pageSelection);
      await sleepInPage(1600);

      const selectedMarker = document.querySelector("#procedures-marker");
      const selectedText = selectedMarker ? String(selectedMarker.textContent || "").trim() : "";
      const selectedCount = parseInt(selectedText || "0", 10) || 0;
      const checkedRows = document.querySelectorAll(".check-procedures-table:checked").length;
      if (!selectedCount && !checkedRows) {
        return { ok: false, error: "Nenhum processo foi selecionado na pagina." };
      }

      if (actionMode === "close_assessoria") {
        const submit = document.querySelector("#submit-massive-steps");
        if (!submit) return { ok: false, error: "Botao Executar nao encontrado." };
        submit.click();
        return { ok: true, submitted: true, selectedCount: selectedCount || checkedRows };
      }

      if (
        actionMode === "protocol_petition" ||
        actionMode === "protocol_ses_joins" ||
        actionMode === "protocol_agravo_instrumento"
      ) {
        const pendingNotices = document.querySelector("#check-all-pending-notices");
        if (pendingNotices) clickInput(pendingNotices);

        const documentCheckboxes = Array.from(document.querySelectorAll(".checkbox-coresigner"));
        documentCheckboxes.forEach(clickInput);
        const selectedDocumentKeys = documentCheckboxes
          .filter((input) => input.checked)
          .map((input) => String(input.value || "").trim())
          .filter(Boolean);

        function documentSignatureStatus() {
          if (!selectedDocumentKeys.length) {
            return { total: 0, signed: 0, texts: [] };
          }

          const texts = [];
          let signed = 0;
          selectedDocumentKeys.forEach((key) => {
            const span = document.getElementById(key + "-signed-document-coresigner");
            const text = span ? String(span.textContent || "").trim() : "";
            const className = span ? String(span.className || "") : "";
            if (text) texts.push(text);
            if (/assinad|sucesso|conclu/i.test(text) || /success/i.test(className)) signed += 1;
          });

          return { total: selectedDocumentKeys.length, signed: signed, texts: texts };
        }

        function submitMassiveForm() {
          const submit = document.querySelector("#submit-massive-steps");
          const form = document.querySelector("#massive-form") || (submit ? submit.closest("form") : null);
          if (!submit && !form) return false;
          if (submit) submit.disabled = false;

          if (form && typeof form.requestSubmit === "function") {
            form.requestSubmit(submit || undefined);
            return true;
          }

          if (submit) {
            submit.click();
            return true;
          }

          if (form && typeof form.submit === "function") {
            form.submit();
            return true;
          }

          return false;
        }

        function pageLooksSubmitted() {
          const bodyText = String(document.body ? document.body.textContent || "" : "");
          return /progresso|execu[cç][aã]o|iniciad|processando|conclu/i.test(bodyText);
        }

        function isDisabledLike(element) {
          if (!element) return true;
          const ariaDisabled = String(element.getAttribute("aria-disabled") || "").toLowerCase();
          const className = String(element.className || "");
          return Boolean(element.disabled) || element.hasAttribute("disabled") || ariaDisabled === "true" || /\bdisabled\b/i.test(className);
        }

        function revealCoresignerForm() {
          const form = document.querySelector("#form-coresigner");
          if (!form) return null;
          form.removeAttribute("hidden");
          form.setAttribute("aria-hidden", "false");
          if (!isVisible(form)) {
            form.style.display = "block";
            form.style.visibility = "visible";
            form.style.opacity = "1";
          }
          return form;
        }

        function dispatchSimpleEvent(element, type) {
          try {
            element.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
          } catch (_error) {
            element.dispatchEvent(new Event(type, { bubbles: true }));
          }
        }

        function dispatchKeyboardPulse(element) {
          ["keydown", "keypress", "keyup"].forEach((type) => {
            try {
              element.dispatchEvent(
                new KeyboardEvent(type, {
                  bubbles: true,
                  cancelable: true,
                  key: "Unidentified",
                  code: "",
                })
              );
            } catch (_error) {
              dispatchSimpleEvent(element, type);
            }
          });
        }

        function setNativeInputValue(input, value) {
          try {
            const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
            if (descriptor && descriptor.set) descriptor.set.call(input, value);
            else input.value = value;
          } catch (_error) {
            input.value = value;
          }
        }

        function refreshNativeInputValue(input) {
          setNativeInputValue(input, input.value || "");
        }

        function applySignerPassword(pin) {
          const value = String(signerPassword || "");
          if (!value) {
            refreshNativeInputValue(pin);
            return false;
          }

          setNativeInputValue(pin, value);
          return true;
        }

        function triggerJqueryRecognition(pin, signer) {
          if (!window.jQuery) return;
          try {
            const $ = window.jQuery;
            $(pin)
              .trigger("focus")
              .trigger("click")
              .trigger("input")
              .trigger("change")
              .trigger("keyup")
              .trigger("blur")
              .trigger("focusout")
              .trigger("focus");
            if (signer) $(signer).trigger("mouseenter").trigger("mouseover");
          } catch (_error) {
            // O SPA pode nao estar usando jQuery nesta tela.
          }
        }

        function triggerPinRecognition(pin, signer) {
          revealCoresignerForm();
          if (!pin) return { pinHasValue: false, formVisible: false };

          clickElement(pin);
          try {
            pin.focus({ preventScroll: false });
          } catch (_error) {
            pin.focus();
          }

          applySignerPassword(pin);

          if (typeof pin.setSelectionRange === "function") {
            try {
              const length = String(pin.value || "").length;
              pin.setSelectionRange(length, length);
            } catch (_error) {
              // Alguns campos de senha bloqueiam selecao programatica.
            }
          }

          ["focus", "focusin", "beforeinput", "input", "change"].forEach((type) => dispatchSimpleEvent(pin, type));
          dispatchKeyboardPulse(pin);
          ["blur", "focusout", "focus", "input", "change"].forEach((type) => dispatchSimpleEvent(pin, type));
          triggerJqueryRecognition(pin, signer);

          return {
            pinHasValue: String(pin.value || "").length > 0,
            formVisible: isVisible(document.querySelector("#form-coresigner")),
            pinVisible: isVisible(pin),
            signerVisible: isVisible(signer),
          };
        }

        async function waitForSignerElements(timeoutMs) {
          const started = Date.now();
          let signer = null;
          let pin = null;
          let form = null;

          while (Date.now() - started < timeoutMs) {
            form = revealCoresignerForm();
            signer = document.querySelector("#btn-coresigner");
            pin = document.querySelector("#pin-coresigner");
            if (signer && pin) {
              return {
                signer,
                pin,
                formVisible: isVisible(form),
                signerVisible: isVisible(signer),
                pinVisible: isVisible(pin),
              };
            }
            await sleepInPage(250);
          }

          return {
            signer,
            pin,
            formVisible: isVisible(form),
            signerVisible: isVisible(signer),
            pinVisible: isVisible(pin),
          };
        }

        async function startSignature(signer, pin) {
          let lastInfo = { pinHasValue: false, signerDisabled: isDisabledLike(signer), clicked: false };

          for (let attempt = 0; attempt < 8; attempt += 1) {
            const pinInfo = triggerPinRecognition(pin, signer);
            const signerDisabled = isDisabledLike(signer);

            if (pinInfo.pinHasValue) {
              signer.disabled = false;
              signer.removeAttribute("disabled");
              signer.setAttribute("aria-disabled", "false");
              if (signer.classList) signer.classList.remove("disabled");
            }

            if (pinInfo.pinHasValue || !signerDisabled || attempt >= 3) {
              clickElement(signer);
              if (window.jQuery) {
                try {
                  window.jQuery(signer).trigger("click");
                } catch (_error) {
                  // O clique nativo acima ja cobre o caso principal.
                }
              }

              await sleepInPage(900);
              const response = document.querySelector("#response-coresigner");
              const responseText = response ? String(response.textContent || "").trim() : "";
              const signatureStatus = documentSignatureStatus();
              lastInfo = {
                pinHasValue: pinInfo.pinHasValue,
                signerDisabled,
                clicked: true,
                responseText,
                signedDocuments: signatureStatus.signed,
                totalDocuments: signatureStatus.total,
                formVisible: pinInfo.formVisible,
                pinVisible: pinInfo.pinVisible,
                signerVisible: pinInfo.signerVisible,
              };

              if (responseText || signatureStatus.signed > 0 || attempt >= 5) break;
            } else {
              lastInfo = {
                pinHasValue: pinInfo.pinHasValue,
                signerDisabled,
                clicked: false,
                formVisible: pinInfo.formVisible,
                pinVisible: pinInfo.pinVisible,
                signerVisible: pinInfo.signerVisible,
              };
            }

            await sleepInPage(650);
          }

          return lastInfo;
        }

        if (!selectedDocumentKeys.length) {
          return { ok: false, error: "Nenhum documento foi selecionado para assinatura." };
        }

        const signerElements = await waitForSignerElements(12000);
        if (!signerElements.signer) return { ok: false, error: "Botao Assinar documento(s) nao encontrado." };
        if (!signerElements.pin) return { ok: false, error: "Campo de senha da assinatura nao encontrado." };

        const startInfo = await startSignature(signerElements.signer, signerElements.pin);
        return {
          ok: true,
          signingStarted: true,
          submitted: false,
          signed: false,
          selectedCount: selectedCount || checkedRows,
          selectedStageNames,
          totalDocuments: selectedDocumentKeys.length,
          signerClicked: Boolean(startInfo.clicked),
          pinHasValue: Boolean(startInfo.pinHasValue),
          signerDisabled: Boolean(startInfo.signerDisabled),
          signerResponseText: startInfo.responseText || "",
        };
      }

      return { ok: false, error: "Modo de acao em massa desconhecido." };
    },
    [stageNames, mode, protocolPassword || ""]
  );

  if (!result || !result.ok) {
    throw new Error((result && result.error) || "Falha na pagina de execucao em massa.");
  }
  return result;
}

async function protocolSignatureSnapshot(tabId, forceSubmit) {
  return executeMainWorld(
    tabId,
    (shouldSubmit) => {
      function isVisible(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      }

      function submitMassiveForm() {
        const submit = document.querySelector("#submit-massive-steps");
        const form = document.querySelector("#massive-form") || (submit ? submit.closest("form") : null);
        if (!submit && !form) return false;
        if (submit) submit.disabled = false;

        if (form && typeof form.requestSubmit === "function") {
          form.requestSubmit(submit || undefined);
          return true;
        }

        if (submit) {
          submit.click();
          return true;
        }

        if (form && typeof form.submit === "function") {
          form.submit();
          return true;
        }

        return false;
      }

      const checkedDocuments = Array.from(document.querySelectorAll(".checkbox-coresigner")).filter(
        (input) => input.checked
      );
      const keys = checkedDocuments.map((input) => String(input.value || "").trim()).filter(Boolean);
      const signedTexts = [];
      let signedDocuments = 0;

      keys.forEach((key) => {
        const span = document.getElementById(key + "-signed-document-coresigner");
        const text = span ? String(span.textContent || "").trim() : "";
        const className = span ? String(span.className || "") : "";
        if (text) signedTexts.push(text);
        if (/assinad|sucesso|conclu/i.test(text) || /success/i.test(className)) signedDocuments += 1;
      });

      const response = document.querySelector("#response-coresigner");
      const responseText = response ? String(response.textContent || "").trim() : "";
      const submit = document.querySelector("#submit-massive-steps");
      const form = document.querySelector("#massive-form") || (submit ? submit.closest("form") : null);
      const bodyText = String(document.body ? document.body.textContent || "" : "");
      const responseLooksSigned = /assinad|sucesso|conclu/i.test(responseText);
      const allDocumentsSigned = keys.length > 0 && signedDocuments >= keys.length;
      const errorText = /erro|falha|senha invalida|senha inv[aá]lida|inv[aá]lid|cancelad/i.test(responseText)
        ? responseText
        : "";

      if (shouldSubmit && (submit || form)) {
        return {
          ok: true,
          submitted: submitMassiveForm(),
          totalDocuments: keys.length,
          signedDocuments,
          responseText,
          signedTexts,
          forced: true,
        };
      }

      return {
        ok: true,
        totalDocuments: keys.length,
        signedDocuments,
        responseText,
        signedTexts,
        responseLooksSigned,
        allDocumentsSigned,
        errorText,
        formAvailable: Boolean(submit || form),
        submitVisible: Boolean(submit && isVisible(submit) && !submit.disabled),
        pageLooksSubmitted: /progresso|execu[cç][aã]o|iniciad|processando|conclu/i.test(bodyText),
      };
    },
    [Boolean(forceSubmit)]
  );
}

async function protocolRetrySignatureClick(tabId, protocolPassword) {
  return executeMainWorld(
    tabId,
    (signerPassword) => {
      function isVisible(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      }

      function clickElement(element) {
        if (!element) return false;
        element.scrollIntoView({ block: "center", inline: "nearest" });
        try {
          element.focus({ preventScroll: false });
        } catch (_error) {
          element.focus();
        }
        ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
          element.dispatchEvent(
            new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              view: window,
              button: 0,
              buttons: type.indexOf("down") >= 0 ? 1 : 0,
            })
          );
        });
        if (typeof element.click === "function") element.click();
        return true;
      }

      function revealCoresignerForm() {
        const form = document.querySelector("#form-coresigner");
        if (!form) return null;
        form.removeAttribute("hidden");
        form.setAttribute("aria-hidden", "false");
        if (!isVisible(form)) {
          form.style.display = "block";
          form.style.visibility = "visible";
          form.style.opacity = "1";
        }
        return form;
      }

      function dispatchSimpleEvent(element, type) {
        try {
          element.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
        } catch (_error) {
          element.dispatchEvent(new Event(type, { bubbles: true }));
        }
      }

      function setNativeInputValue(input, value) {
        try {
          const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
          if (descriptor && descriptor.set) descriptor.set.call(input, value);
          else input.value = value;
        } catch (_error) {
          input.value = value;
        }
      }

      function refreshNativeInputValue(input) {
        setNativeInputValue(input, input.value || "");
      }

      function applySignerPassword(pin) {
        const value = String(signerPassword || "");
        if (!value) {
          refreshNativeInputValue(pin);
          return false;
        }

        setNativeInputValue(pin, value);
        return true;
      }

      function triggerJqueryRecognition(pin, signer) {
        if (!window.jQuery) return;
        try {
          const $ = window.jQuery;
          $(pin)
            .trigger("focus")
            .trigger("click")
            .trigger("input")
            .trigger("change")
            .trigger("keyup")
            .trigger("blur")
            .trigger("focusout")
            .trigger("focus");
          if (signer) $(signer).trigger("mouseenter").trigger("mouseover").trigger("click");
        } catch (_error) {
          // jQuery pode nao estar disponivel nesta tela.
        }
      }

      revealCoresignerForm();
      const signer = document.querySelector("#btn-coresigner");
      const pin = document.querySelector("#pin-coresigner");
      const response = document.querySelector("#response-coresigner");
      const responseText = response ? String(response.textContent || "").trim() : "";
      if (!signer || !pin) {
        return {
          ok: false,
          error: !signer ? "Botao Assinar documento(s) nao encontrado." : "Campo de senha nao encontrado.",
          responseText,
        };
      }

      clickElement(pin);
      applySignerPassword(pin);
      if (typeof pin.setSelectionRange === "function") {
        try {
          const length = String(pin.value || "").length;
          pin.setSelectionRange(length, length);
        } catch (_error) {
          // Alguns campos de senha bloqueiam selecao programatica.
        }
      }

      ["focus", "focusin", "beforeinput", "input", "change", "keydown", "keypress", "keyup", "blur", "focusout", "focus"].forEach(
        (type) => dispatchSimpleEvent(pin, type)
      );
      triggerJqueryRecognition(pin, signer);

      const pinHasValue = String(pin.value || "").length > 0;
      if (pinHasValue) {
        signer.disabled = false;
        signer.removeAttribute("disabled");
        signer.setAttribute("aria-disabled", "false");
        if (signer.classList) signer.classList.remove("disabled");
      }

      clickElement(signer);
      if (window.jQuery) {
        try {
          window.jQuery(signer).trigger("click");
        } catch (_error) {
          // O clique nativo acima ja cobre o caso principal.
        }
      }

      return {
        ok: true,
        pinHasValue,
        signerVisible: isVisible(signer),
        pinVisible: isVisible(pin),
        responseText,
      };
    },
    [protocolPassword || ""]
  );
}

async function waitForProtocolSignatureAndSubmit(tabId, initialResult, protocolPassword) {
  const expectedDocuments = Math.max(1, parseInt(initialResult && initialResult.totalDocuments, 10) || 1);
  const timeoutMs = Math.max(150000, Math.min(600000, expectedDocuments * 25000));
  const started = Date.now();
  let lastSnapshot = null;
  let lastProgressLog = 0;
  let lastSignerRetry = 0;
  let warnedEmptyPin = false;

  await sleep(3500);

  while (Date.now() - started < timeoutMs) {
    const elapsed = Date.now() - started;

    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.status !== "complete") {
        await sleep(1000);
        continue;
      }

      lastSnapshot = await protocolSignatureSnapshot(tabId, false);

      if (lastSnapshot && lastSnapshot.errorText) {
        throw new Error("Assinatura retornou erro: " + lastSnapshot.errorText);
      }

      const signatureHasNoProgress =
        lastSnapshot &&
        !lastSnapshot.allDocumentsSigned &&
        !lastSnapshot.responseLooksSigned &&
        !lastSnapshot.responseText &&
        !lastSnapshot.signedDocuments;

      if (signatureHasNoProgress && elapsed > 5000 && elapsed - lastSignerRetry > 7000) {
        lastSignerRetry = elapsed;
        const retryResult = await protocolRetrySignatureClick(tabId, protocolPassword).catch((error) => ({
          ok: false,
          error: error && error.message ? error.message : String(error),
        }));

        if (retryResult && retryResult.ok && !retryResult.pinHasValue && !warnedEmptyPin) {
          warnedEmptyPin = true;
          await logScheduled(
            tabId,
            "Campo de senha ainda vazio. Se o Chrome nao preencher a senha salva automaticamente, a assinatura nao consegue iniciar sem esse preenchimento.",
            "error"
          );
        }
      }

      if (lastSnapshot && lastSnapshot.pageLooksSubmitted && !lastSnapshot.formAvailable) {
        return {
          ok: true,
          submitted: true,
          signed: true,
          selectedCount: initialResult.selectedCount || 0,
          signedDocuments: lastSnapshot.signedDocuments,
          totalDocuments: lastSnapshot.totalDocuments || expectedDocuments,
          responseText: lastSnapshot.responseText,
        };
      }

      if (
        lastSnapshot &&
        lastSnapshot.formAvailable &&
        (lastSnapshot.allDocumentsSigned || lastSnapshot.responseLooksSigned || lastSnapshot.submitVisible)
      ) {
        const submitted = await protocolSignatureSnapshot(tabId, true);
        if (submitted && submitted.submitted) {
          return {
            ok: true,
            submitted: true,
            signed: true,
            selectedCount: initialResult.selectedCount || 0,
            signedDocuments: submitted.signedDocuments,
            totalDocuments: submitted.totalDocuments || expectedDocuments,
            responseText: submitted.responseText,
          };
        }
      }

      if (elapsed - lastProgressLog > 30000) {
        lastProgressLog = elapsed;
        await logScheduled(
          tabId,
          "Aguardando assinatura: " +
            (lastSnapshot ? lastSnapshot.signedDocuments : 0) +
            "/" +
            (lastSnapshot && lastSnapshot.totalDocuments ? lastSnapshot.totalDocuments : expectedDocuments) +
            " documento(s)."
        );
      }
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      if (/Assinatura retornou erro/i.test(message)) throw error;
      await sleep(1200);
      continue;
    }

    await sleep(1300);
  }

  await logScheduled(tabId, "Tempo de assinatura atingido. Tentando enviar o formulario de protocolo.", "error");
  const fallback = await protocolSignatureSnapshot(tabId, true).catch((error) => ({
    ok: false,
    submitted: false,
    error: error && error.message ? error.message : String(error),
  }));

  if (fallback && fallback.submitted) {
    return {
      ok: true,
      submitted: true,
      signed: true,
      selectedCount: initialResult.selectedCount || 0,
      signedDocuments: fallback.signedDocuments || (lastSnapshot && lastSnapshot.signedDocuments) || 0,
      totalDocuments: fallback.totalDocuments || expectedDocuments,
      responseText: fallback.responseText || (lastSnapshot && lastSnapshot.responseText) || "",
      warning: "Envio feito por fallback apos aguardar a assinatura.",
    };
  }

  throw new Error(
    "Assinatura acionada, mas nao foi possivel confirmar nem enviar o protocolo. Documentos assinados detectados: " +
      ((lastSnapshot && lastSnapshot.signedDocuments) || 0) +
      "/" +
      ((lastSnapshot && lastSnapshot.totalDocuments) || expectedDocuments) +
      (lastSnapshot && lastSnapshot.responseText ? ". Retorno: " + lastSnapshot.responseText : "")
  );
}

async function runMassiveWorkflow(tabId, config, kind) {
  const inboxUrl = normalizeRoutineUrl(config && config.targetUrl);
  const isProtocol = isProtocolScheduleStep(kind);
  const protocolGroup = protocolScheduleGroup(kind);
  const groupedProtocolSteps =
    isProtocol && Array.isArray(config && config.steps)
      ? config.steps.filter((step) => protocolScheduleGroup(step) === protocolGroup)
      : [kind];
  const stageNames = isProtocol
    ? protocolStageNamesFromSteps(groupedProtocolSteps, kind)
    : ["Sugestão de encerramento"];
  const workflowLabel = isProtocol
    ? groupedProtocolSteps
        .map((step) => SCHEDULE_STEP_LABELS[step])
        .join(" + ") || SCHEDULE_STEP_LABELS[kind]
    : SCHEDULE_STEP_LABELS[kind];
  const fallbackUrl = legacyMassiveFallbackUrl(inboxUrl, kind);

  await logScheduled(tabId, "Abrindo caixa para localizar passo em massa: " + workflowLabel + ".");
  await navigateScheduledTab(tabId, inboxUrl);
  await ensureScheduledPanel(tabId);
  const resolvedUrl = await resolveMassiveStepUrl(tabId, kind);
  if (!resolvedUrl && !fallbackUrl) {
    throw new Error("Botao do passo em massa nao encontrado: " + workflowLabel + ".");
  }

  await logScheduled(tabId, "Abrindo pagina do passo em massa.");
  await navigateScheduledTab(tabId, resolvedUrl || fallbackUrl);
  await ensureScheduledPanel(tabId);

  if (fallbackUrl && !(await massivePageHasStages(tabId, stageNames)) && resolvedUrl !== fallbackUrl) {
    await logScheduled(tabId, "Pagina localizada nao tinha a fase esperada. Tentando passo padrao.");
    await navigateScheduledTab(tabId, fallbackUrl);
    await ensureScheduledPanel(tabId);
  }

  if (!(await massivePageHasStages(tabId, stageNames))) {
    throw new Error("A(s) fase(s) '" + stageNames.join(", ") + "' nao foram encontradas na pagina do passo em massa.");
  }

  const protocolPassword = isProtocol ? await getProtocolPassword() : "";
  if (isProtocol && !protocolPassword) {
    throw new Error("Informe a senha na aba Programada antes de executar o protocolo.");
  }

  await logScheduled(tabId, "Selecionando fase(s): " + stageNames.join(" + ") + ".");
  let result = await selectMassivePageAndFinish(tabId, stageNames, kind, protocolPassword);
  if (isProtocol && result.signingStarted) {
    await logScheduled(
      tabId,
      "Assinatura iniciada. Aguardando conclusao de " + (result.totalDocuments || 0) + " documento(s)."
    );
    result = await waitForProtocolSignatureAndSubmit(tabId, result, protocolPassword);
  }
  if (result.warning) await logScheduled(tabId, result.warning, "error");
  if (result.submitted) await waitForScheduledTabComplete(tabId, 90000).catch(() => null);
  await logScheduled(
    tabId,
    workflowLabel + " concluido para " + (result.selectedCount || 0) + " processo(s).",
    "ok"
  );
}

async function runScheduledRoutine(trigger, overrideConfig) {
  const config = normalizeRoutineConfig(overrideConfig || (await getRoutineConfig()));
  if (!config.steps.length) return { ok: false, error: "Nenhum passo programado." };
  if (scheduledRoutineRunning) return { ok: false, error: "Rotina programada ja esta em execucao." };

  const tab = await findRoutineTab(config);
  if (!tab || !tab.id) {
    return { ok: false, error: "Nenhuma aba da caixa do SPA foi encontrada para a rotina programada." };
  }

  scheduledRoutineRunning = true;
  try {
    await logScheduled(tab.id, "Rotina programada iniciada (" + trigger + ").", "ok");

    const consumedSteps = new Set();
    for (const step of config.steps) {
      if (consumedSteps.has(step)) continue;

      const stepProtocolGroup = protocolScheduleGroup(step);
      const protocolSteps = stepProtocolGroup
        ? config.steps.filter((candidate) => protocolScheduleGroup(candidate) === stepProtocolGroup)
        : [];
      const label = protocolSteps.length
        ? protocolSteps.map((candidate) => SCHEDULE_STEP_LABELS[candidate]).join(" + ")
        : SCHEDULE_STEP_LABELS[step];

      await logScheduled(tab.id, "Iniciando passo programado: " + label + ".");
      if (step === "science") {
        await navigateScheduledTab(tab.id, normalizeRoutineUrl(config.targetUrl));
        await runPanelMethod(tab.id, "takeScienceAllPages", { useLimit: true });
      } else if (step === "refresh") {
        await navigateScheduledTab(tab.id, normalizeRoutineUrl(config.targetUrl));
        await runPanelMethod(tab.id, "refreshProceduresTable");
      } else if (step === "close_assessoria") {
        await runMassiveWorkflow(tab.id, config, step);
      } else if (isProtocolScheduleStep(step)) {
        protocolSteps.forEach((candidate) => consumedSteps.add(candidate));
        await runMassiveWorkflow(tab.id, config, step);
      }
      await sleep(1200);
    }

    await navigateScheduledTab(tab.id, normalizeRoutineUrl(config.targetUrl)).catch(() => null);
    await ensureScheduledPanel(tab.id).catch(() => null);
    await logScheduled(tab.id, "Rotina programada concluida.", "ok");
    return { ok: true };
  } catch (error) {
    await logScheduled(tab.id, "Erro na rotina programada: " + (error && error.message ? error.message : String(error)), "error");
    return { ok: false, error: error && error.message ? error.message : String(error) };
  } finally {
    scheduledRoutineRunning = false;
  }
}

async function saveRoutineFromMessage(message, sender) {
  const config = normalizeRoutineConfig(message.config || {}, sender);
  if (config.active && !config.steps.length) {
    return { ok: false, error: "Selecione pelo menos um passo para ativar a rotina." };
  }
  const stored = await storeRoutineConfig(config);
  return { ok: true, config: stored };
}

async function restoreRoutineAlarm() {
  try {
    const config = await getRoutineConfig();
    await syncRoutineAlarm(config);
  } catch (_error) {
    // A restauracao e feita silenciosamente para nao bloquear a extensao.
  }
}

if (chrome.alarms && chrome.alarms.onAlarm) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (!alarm || alarm.name !== SCHEDULE_ALARM_NAME) return;
    getRoutineConfig()
      .then((config) => {
        if (config && config.active) return runScheduledRoutine("alarme", config);
        return null;
      })
      .catch(() => null);
  });
}

if (chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(restoreRoutineAlarm);
}

if (chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(restoreRoutineAlarm);
}

restoreRoutineAlarm();

async function openBackgroundTabs(message) {
  const urls = (Array.isArray(message.urls) ? message.urls : [message.url]).slice(0, MAX_TABS_PER_REQUEST);
  const delayMs = Number.isFinite(message.delayMs)
    ? Math.max(0, Math.min(2000, message.delayMs))
    : DEFAULT_DELAY_MS;
  const results = [];

  for (const rawUrl of urls) {
    const url = normalizeAllowedUrl(rawUrl);

    if (!url) {
      results.push({
        url: String(rawUrl || ""),
        opened: false,
        error: "URL fora do dominio permitido do SPA."
      });
      continue;
    }

    try {
      const tab = await chrome.tabs.create({ url, active: false });
      results.push({ url, opened: true, tabId: tab.id });
    } catch (error) {
      results.push({
        url,
        opened: false,
        error: error && error.message ? error.message : String(error)
      });
    }

    if (delayMs) await sleep(delayMs);
  }

  return {
    ok: true,
    opened: results.filter((item) => item.opened).length,
    results
  };
}

function normalizeSearchText(text) {
  return repairMojibakeText(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compactSearchText(text) {
  return normalizeSearchText(text).replace(/[^a-z0-9]+/g, "");
}

function parseSearchTerms(query, exact) {
  const seen = new Set();
  const terms = [];

  if (exact) {
    const term = String(query || "").trim();
    return term ? [term] : [];
  }

  String(query || "")
    .split(";")
    .map((term) => term.trim())
    .filter(Boolean)
    .forEach((term) => {
      const key = compactSearchText(term);
      if (!key || seen.has(key)) return;
      seen.add(key);
      terms.push(term);
    });

  return terms;
}

function findMatchingSearchTerm(text, query, exact) {
  const normalizedText = normalizeSearchText(text);
  const compactText = compactSearchText(text);
  const terms = parseSearchTerms(query, exact);

  for (const term of terms) {
    const normalizedQuery = normalizeSearchText(term);
    if (exact) {
      if (normalizedQuery && normalizedText.indexOf(normalizedQuery) >= 0) return term;
      continue;
    }
    const compactQuery = compactSearchText(term);
    if (normalizedQuery && normalizedText.indexOf(normalizedQuery) >= 0) return term;
    if (compactQuery.length >= 4 && compactText.indexOf(compactQuery) >= 0) return term;
  }

  return "";
}

function repairMojibakeText(text) {
  return String(text || "")
    .replace(/\u00c3\u00a7/g, "\u00e7")
    .replace(/\u00c3\u2021/g, "\u00c7")
    .replace(/\u00c3\u00a3/g, "\u00e3")
    .replace(/\u00c3\u00a1/g, "\u00e1")
    .replace(/\u00c3\u00a9/g, "\u00e9")
    .replace(/\u00c3\u00ad/g, "\u00ed")
    .replace(/\u00c3\u00b3/g, "\u00f3")
    .replace(/\u00c3\u00ba/g, "\u00fa")
    .replace(/\u00c3\u00a2/g, "\u00e2")
    .replace(/\u00c3\u00aa/g, "\u00ea")
    .replace(/\u00c3\u00b4/g, "\u00f4")
    .replace(/\u00c3\u0020/g, "\u00e0");
}

function bytesToBinary(bytes) {
  let output = "";
  const chunkSize = 8192;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    output += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return output;
}

function bytesToBase64(bytes) {
  return btoa(bytesToBinary(bytes));
}

function binaryToBytes(binary) {
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function decodeBytes(bytes) {
  const chunks = [];
  try {
    chunks.push(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
  } catch (_error) {
    // Continua com outros decodificadores.
  }

  try {
    chunks.push(new TextDecoder("windows-1252", { fatal: false }).decode(bytes));
  } catch (_error) {
    chunks.push(bytesToBinary(bytes));
  }

  return chunks.join("\n");
}

async function inflatePdfStream(bytes) {
  if (typeof DecompressionStream !== "function") return bytes;

  for (const format of ["deflate", "deflate-raw"]) {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (_error) {
      // Tenta o proximo formato.
    }
  }

  return bytes;
}

function decodePdfLiteralString(value) {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== "\\") {
      output += char;
      continue;
    }

    const next = value[index + 1] || "";
    if (next === "n") output += "\n";
    else if (next === "r") output += "\r";
    else if (next === "t") output += "\t";
    else if (next === "b") output += "\b";
    else if (next === "f") output += "\f";
    else if (next === "(" || next === ")" || next === "\\") output += next;
    else if (/[0-7]/.test(next)) {
      const octal = value.slice(index + 1).match(/^[0-7]{1,3}/);
      if (octal) {
        output += String.fromCharCode(parseInt(octal[0], 8));
        index += octal[0].length;
        continue;
      }
    } else {
      output += next;
    }
    index += 1;
  }
  return output;
}

function decodePdfHexString(value) {
  const clean = String(value || "").replace(/[^0-9a-f]/gi, "");
  if (!clean) return "";

  const bytes = [];
  for (let index = 0; index < clean.length; index += 2) {
    bytes.push(parseInt(clean.slice(index, index + 2).padEnd(2, "0"), 16));
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let output = "";
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      output += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
    }
    return output;
  }

  if (bytes.length >= 4) {
    let evenZeros = 0;
    let oddZeros = 0;
    for (let index = 0; index < bytes.length; index += 2) {
      if (bytes[index] === 0) evenZeros += 1;
      if (bytes[index + 1] === 0) oddZeros += 1;
    }

    const pairs = Math.floor(bytes.length / 2);
    if (pairs && evenZeros / pairs >= 0.6) {
      let output = "";
      for (let index = 0; index + 1 < bytes.length; index += 2) {
        output += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
      }
      return output;
    }

    if (pairs && oddZeros / pairs >= 0.6) {
      let output = "";
      for (let index = 0; index + 1 < bytes.length; index += 2) {
        output += String.fromCharCode((bytes[index + 1] << 8) | bytes[index]);
      }
      return output;
    }
  }

  return decodeBytes(new Uint8Array(bytes));
}

function extractPdfStrings(text) {
  const pieces = [text];
  const literalRegex = /\((?:\\.|[^\\)])*\)/g;
  let literal;
  while ((literal = literalRegex.exec(text))) {
    pieces.push(decodePdfLiteralString(literal[0].slice(1, -1)));
  }

  const hexRegex = /<([0-9a-fA-F\s]{4,})>/g;
  let hex;
  while ((hex = hexRegex.exec(text))) {
    pieces.push(decodePdfHexString(hex[1]));
  }

  return pieces.join(" ");
}

function pdfJsLibrary() {
  return typeof globalThis !== "undefined" && globalThis.pdfjsLib
    ? globalThis.pdfjsLib
    : null;
}

async function hasOffscreenDocument() {
  if (!chrome.offscreen) return false;

  if (typeof chrome.offscreen.hasDocument === "function") {
    return await chrome.offscreen.hasDocument();
  }

  if (typeof chrome.runtime.getContexts === "function") {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
    });
    return contexts.length > 0;
  }

  return false;
}

async function ensureOffscreenDocument() {
  if (!chrome.offscreen || typeof chrome.offscreen.createDocument !== "function") {
    throw new Error("API offscreen indisponivel neste Chrome.");
  }

  if (await hasOffscreenDocument()) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ["DOM_PARSER"],
    justification: "Extrair texto de expedientes PDF do SPA para filtro de triagem."
  });
}

async function extractPdfTextWithOffscreen(buffer) {
  if (!chrome.offscreen && globalThis.MTPrevPdfReader) {
    // PDF.js transfers its input to a worker; keep the original for other readers.
    return globalThis.MTPrevPdfReader.extractPdfText(buffer.slice(0));
  }
  await ensureOffscreenDocument();

  offscreenRequestSeq += 1;
  const requestId = "spa-cdsp-pdf-" + Date.now() + "-" + offscreenRequestSeq;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await sendPdfToOffscreen(buffer, requestId);
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      const canRetry =
        attempt < 5 &&
        (/receiving end/i.test(message) ||
          /message port closed/i.test(message) ||
          /leitor interno nao respondeu/i.test(message));

      if (!canRetry) throw error;
      await sleep(250 * attempt);
    }
  }

  return "";
}

function sendPdfToOffscreen(buffer, requestId) {
  const base64 = bytesToBase64(new Uint8Array(buffer));

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "SPA_CDSP_OFFSCREEN_EXTRACT_PDF_TEXT",
        requestId,
        base64
      },
      (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }

        if (!response || !response.ok) {
          reject(new Error(response && response.error ? response.error : "Leitor interno nao respondeu."));
          return;
        }

        resolve(response.text || "");
      }
    );
  });
}

async function searchPdfWithOffscreen(buffer, query, exact) {
  if (!chrome.offscreen && globalThis.MTPrevPdfReader) {
    return globalThis.MTPrevPdfReader.searchPdfText(buffer.slice(0), query, exact);
  }
  await ensureOffscreenDocument();

  offscreenRequestSeq += 1;
  const requestId = "spa-cdsp-pdf-search-" + Date.now() + "-" + offscreenRequestSeq;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await sendPdfSearchToOffscreen(buffer, requestId, query, exact);
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      const canRetry =
        attempt < 3 &&
        (/receiving end/i.test(message) ||
          /message port closed/i.test(message) ||
          /leitor interno nao respondeu/i.test(message));

      if (!canRetry) throw error;
      await sleep(200 * attempt);
    }
  }

  return { found: false, snippet: "", textLength: 0, pagesRead: 0, totalPages: 0 };
}

function sendPdfSearchToOffscreen(buffer, requestId, query, exact) {
  const base64 = bytesToBase64(new Uint8Array(buffer));

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "SPA_CDSP_OFFSCREEN_SEARCH_PDF_TEXT",
        requestId,
        base64,
        query: String(query || ""),
        exact: exact === true
      },
      (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }

        if (!response || !response.ok) {
          reject(new Error(response && response.error ? response.error : "Leitor interno nao respondeu."));
          return;
        }

        resolve(response);
      }
    );
  });
}

function combinePdfTextItems(items) {
  const output = [];
  let lastY = null;

  (items || []).forEach((item) => {
    const value = String((item && item.str) || "");
    if (!value.trim()) return;

    const transform = item && Array.isArray(item.transform) ? item.transform : [];
    const y = Number(transform[5]);
    if (Number.isFinite(y) && lastY !== null && Math.abs(y - lastY) > 5) {
      output.push("\n");
    } else if (output.length) {
      output.push(" ");
    }

    output.push(value);
    if (Number.isFinite(y)) lastY = y;
  });

  return output.join("");
}

async function extractPdfTextWithPdfJs(buffer) {
  const library = pdfJsLibrary();
  if (!library || typeof library.getDocument !== "function") {
    return "";
  }

  const loadingTask = library.getDocument({
    data: new Uint8Array(buffer.slice(0)),
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
    useWorkerFetch: false
  });

  const pdf = await loadingTask.promise;
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false
      });
      pages.push(combinePdfTextItems(content.items));

      if (typeof page.cleanup === "function") {
        page.cleanup();
      }
    }
  } finally {
    if (typeof pdf.destroy === "function") {
      await pdf.destroy();
    }
  }

  return pages.join("\n");
}

async function extractPdfTextFromBytes(buffer) {
  const bytes = new Uint8Array(buffer);
  const binary = bytesToBinary(bytes);
  const pieces = [extractPdfStrings(decodeBytes(bytes))];
  const streamRegex = /(<<[\s\S]*?>>)\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  let match;

  while ((match = streamRegex.exec(binary))) {
    const dictionary = match[1] || "";
    const streamBytes = binaryToBytes(match[2] || "");
    const decodedBytes = dictionary.indexOf("FlateDecode") >= 0
      ? await inflatePdfStream(streamBytes)
      : streamBytes;
    pieces.push(extractPdfStrings(decodeBytes(decodedBytes)));
  }

  return pieces.join(" ");
}

async function fetchExpedienteText(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PDF_SCAN_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      credentials: "include",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error("HTTP " + response.status + " ao baixar expediente.");
    }
    const buffer = await response.arrayBuffer();
    const result = {
      text: "",
      offscreenText: "",
      pdfJsText: "",
      rawText: "",
      offscreenError: "",
      pdfJsError: "",
      rawError: "",
      byteLength: buffer.byteLength || 0
    };

    try {
      result.offscreenText = await extractPdfTextWithOffscreen(buffer);
    } catch (error) {
      result.offscreenError = error && error.message ? error.message : String(error);
    }

    try {
      result.pdfJsText = await extractPdfTextWithPdfJs(buffer);
    } catch (error) {
      result.pdfJsError = error && error.message ? error.message : String(error);
    }

    try {
      result.rawText = await extractPdfTextFromBytes(buffer);
    } catch (error) {
      result.rawError = error && error.message ? error.message : String(error);
    }

    result.text = [result.offscreenText, result.pdfJsText, result.rawText].filter(Boolean).join("\n");
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

function cacheDuplicatePdfFingerprint(key, result) {
  duplicatePdfFingerprintCache.set(key, Object.assign({}, result, { fromCache: false }));

  while (duplicatePdfFingerprintCache.size > DUPLICATE_PDF_FINGERPRINT_CACHE_MAX) {
    const oldest = duplicatePdfFingerprintCache.keys().next().value;
    duplicatePdfFingerprintCache.delete(oldest);
  }
}

function cachedDuplicatePdfFingerprint(key) {
  if (!duplicatePdfFingerprintCache.has(key)) return null;

  const cached = duplicatePdfFingerprintCache.get(key);
  duplicatePdfFingerprintCache.delete(key);
  duplicatePdfFingerprintCache.set(key, cached);
  return Object.assign({}, cached, { fromCache: true });
}

function fallbackTextHash(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
}

async function sha256Text(text) {
  if (globalThis.crypto && globalThis.crypto.subtle && typeof TextEncoder !== "undefined") {
    const buffer = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return "fnv1a-" + fallbackTextHash(text);
}

async function fingerprintExpedientePdf(url) {
  const pdfUrl = normalizePdfDownloadUrl(url);
  if (!pdfUrl) {
    return { ok: false, fingerprint: "", textLength: 0, byteLength: 0, error: "URL de expediente invalida." };
  }

  const cached = cachedDuplicatePdfFingerprint(pdfUrl);
  if (cached) return cached;

  try {
    const downloaded = await fetchExpedienteText(pdfUrl);
    const normalizedText = normalizeSearchText(downloaded && downloaded.text ? downloaded.text : "");
    const result = {
      ok: normalizedText.length >= 80,
      fingerprint: normalizedText.length >= 80 ? await sha256Text(normalizedText) : "",
      textLength: normalizedText.length,
      byteLength: downloaded && downloaded.byteLength ? downloaded.byteLength : 0,
      fromCache: false,
      error: normalizedText.length >= 80 ? "" : "Texto extraido insuficiente para comparar."
    };
    cacheDuplicatePdfFingerprint(pdfUrl, result);
    return result;
  } catch (error) {
    const result = {
      ok: false,
      fingerprint: "",
      textLength: 0,
      byteLength: 0,
      fromCache: false,
      error: error && error.message ? error.message : String(error)
    };
    cacheDuplicatePdfFingerprint(pdfUrl, result);
    return result;
  }
}

async function fingerprintDuplicateReportRecord(record) {
  const urls = [];
  (Array.isArray(record && record.expedienteUrls) ? record.expedienteUrls : []).forEach((url) => {
    const pdfUrl = normalizePdfDownloadUrl(url);
    if (pdfUrl && urls.indexOf(pdfUrl) < 0) urls.push(pdfUrl);
  });

  if (!urls.length) {
    return {
      id: record && record.id ? record.id : "",
      ok: false,
      fingerprint: "",
      textLength: 0,
      byteLength: 0,
      error: "Registro sem URL de expediente."
    };
  }

  const pieces = [];
  const errors = [];
  let textLength = 0;
  let byteLength = 0;

  for (const url of urls) {
    const result = await fingerprintExpedientePdf(url);
    textLength += result.textLength || 0;
    byteLength += result.byteLength || 0;

    if (result.ok && result.fingerprint) {
      pieces.push(result.fingerprint);
    } else if (result.error) {
      errors.push(result.error);
    }
  }

  if (!pieces.length) {
    return {
      id: record && record.id ? record.id : "",
      ok: false,
      fingerprint: "",
      textLength,
      byteLength,
      error: errors[0] || "Texto dos expedientes insuficiente."
    };
  }

  pieces.sort();
  return {
    id: record && record.id ? record.id : "",
    ok: true,
    fingerprint: await sha256Text(pieces.join("|")),
    textLength,
    byteLength,
    expedienteCount: urls.length,
    complete: pieces.length === urls.length,
    readErrors: errors,
    error: ""
  };
}

async function fingerprintDuplicateReportExpedientes(message) {
  const records = Array.isArray(message && message.records) ? message.records : [];
  const results = new Array(records.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < records.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fingerprintDuplicateReportRecord(records[index]);
    }
  }

  const workers = [];
  const workerCount = Math.min(DUPLICATE_PDF_FINGERPRINT_CONCURRENCY, Math.max(1, records.length));
  for (let index = 0; index < workerCount; index += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return {
    ok: true,
    results
  };
}

function normalizePdfDownloadUrl(rawUrl) {
  const safeUrl = normalizeAllowedUrl(rawUrl);
  if (!safeUrl) return "";

  try {
    const parsed = new URL(safeUrl);
    if (parsed.pathname === "/pdfjs/web/viewer.html") {
      const file = parsed.searchParams.get("file");
      if (file) return normalizeAllowedUrl(new URL(file, parsed.origin).href);
    }
  } catch (_error) {
    return "";
  }

  return safeUrl;
}

function buildTextSearchSnippet(text, query, exact) {
  const normalized = normalizeSearchText(text);
  const terms = parseSearchTerms(query, exact);
  if (!normalized || !terms.length) return "";

  for (const term of terms) {
    const normalizedQuery = normalizeSearchText(term);
    if (!normalizedQuery) continue;

    let index = normalized.indexOf(normalizedQuery);
    if (index < 0 && !exact) {
      const compact = compactSearchText(text);
      const compactQuery = compactSearchText(term);
      if (compactQuery.length >= 4 && compact.indexOf(compactQuery) >= 0) {
        index = Math.max(0, normalized.indexOf(compactQuery.slice(0, Math.min(12, compactQuery.length))));
      }
    }

    if (index < 0) continue;

    const start = Math.max(0, index - 180);
    const end = Math.min(normalized.length, index + normalizedQuery.length + 260);
    return normalized.slice(start, end).trim();
  }

  return "";
}

function textContainsSearchQuery(text, query, exact) {
  return Boolean(findMatchingSearchTerm(text, query, exact));
}

function autosSearchCacheKey(pdfUrl, query, exact) {
  const key = parseSearchTerms(query, exact)
    .map((term) => compactSearchText(term))
    .filter(Boolean)
    .sort()
    .join("|");
  return pdfUrl + "::" + (exact ? "exact::" : "terms::") + key;
}

function getAutosSearchCache(pdfUrl, query, exact) {
  const key = autosSearchCacheKey(pdfUrl, query, exact);
  if (!autosSearchCache.has(key)) return null;

  const cached = autosSearchCache.get(key);
  autosSearchCache.delete(key);
  autosSearchCache.set(key, cached);
  return Object.assign({}, cached, { fromCache: true });
}

function setAutosSearchCache(pdfUrl, query, exact, result) {
  const key = autosSearchCacheKey(pdfUrl, query, exact);
  autosSearchCache.set(key, Object.assign({}, result, { fromCache: false }));

  while (autosSearchCache.size > AUTOS_SEARCH_CACHE_MAX) {
    const oldest = autosSearchCache.keys().next().value;
    autosSearchCache.delete(oldest);
  }
}

async function searchPdfUrlForQuery(pdfUrl, query, exact) {
  const cached = getAutosSearchCache(pdfUrl, query, exact);
  if (cached) return cached;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PDF_SCAN_TIMEOUT_MS);
  const result = {
    found: false,
    snippet: "",
    matchedQuery: "",
    inconclusive: false,
    byteLength: 0,
    textLength: 0,
    fromCache: false,
    diagnostics: {
      method: "",
      rawLength: 0,
      offscreenLength: 0,
      offscreenPagesRead: 0,
      offscreenTotalPages: 0,
      rawError: "",
      offscreenError: "",
      pdfUrl
    }
  };

  try {
    const response = await fetch(pdfUrl, {
      credentials: "include",
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error("HTTP " + response.status + " ao baixar documento.");
    }

    const buffer = await response.arrayBuffer();
    result.byteLength = buffer.byteLength || 0;

    try {
      const offscreen = await searchPdfWithOffscreen(buffer, query, exact);
      result.diagnostics.offscreenLength = offscreen && offscreen.textLength ? offscreen.textLength : 0;
      result.diagnostics.offscreenPagesRead = offscreen && offscreen.pagesRead ? offscreen.pagesRead : 0;
      result.diagnostics.offscreenTotalPages = offscreen && offscreen.totalPages ? offscreen.totalPages : 0;
      result.textLength = Math.max(result.textLength, result.diagnostics.offscreenLength);

      if (offscreen && offscreen.found) {
        result.found = true;
        result.snippet = offscreen.snippet || "";
        result.matchedQuery = offscreen.matchedQuery || "";
        result.diagnostics.method = "offscreen";
      }
    } catch (error) {
      result.diagnostics.offscreenError = error && error.message ? error.message : String(error);
    }

    if (!result.found && result.diagnostics.offscreenLength <= 0) {
      try {
        const rawText = await extractPdfTextFromBytes(buffer);
        const rawLength = normalizeSearchText(rawText).length;
        result.diagnostics.rawLength = rawLength;
        result.textLength = Math.max(result.textLength, rawLength);

        const matchedQuery = findMatchingSearchTerm(rawText, query, exact);
        if (matchedQuery) {
          result.found = true;
          result.matchedQuery = matchedQuery;
          result.snippet = buildTextSearchSnippet(rawText, matchedQuery, exact);
          result.diagnostics.method = "raw";
          setAutosSearchCache(pdfUrl, query, exact, result);
          return result;
        }
      } catch (error) {
        result.diagnostics.rawError = error && error.message ? error.message : String(error);
      }
    }

    result.inconclusive = result.textLength <= 0;
    setAutosSearchCache(pdfUrl, query, exact, result);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function searchAutosDocumentContent(message) {
  const record = message && message.record ? message.record : {};
  const query = String((message && message.query) || "").trim();
  const exact = message && message.exact === true;
  const viewerUrl = normalizeAllowedUrl(record.url);
  const pdfUrl = normalizePdfDownloadUrl(record.url);

  if (!query) {
    return { ok: false, found: false, error: "Nenhum texto informado para pesquisa." };
  }

  if (!viewerUrl || !pdfUrl) {
    return {
      ok: false,
      found: false,
      record,
      error: "URL do documento fora do dominio permitido do SPA."
    };
  }

  const result = await searchPdfUrlForQuery(pdfUrl, query, exact);

  return {
    ok: true,
    found: Boolean(result && result.found),
    record: Object.assign({}, record, { url: viewerUrl }),
    query,
    exact,
    matchedQuery: result && result.matchedQuery ? result.matchedQuery : "",
    snippet: result && result.snippet ? result.snippet : "",
    inconclusive: Boolean(result && result.inconclusive),
    byteLength: result && result.byteLength ? result.byteLength : 0,
    textLength: result && result.textLength ? result.textLength : 0,
    fromCache: Boolean(result && result.fromCache),
    diagnostics: result && result.diagnostics ? result.diagnostics : { pdfUrl }
  };
}

async function waitForTabComplete(tabId, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.status === "complete") return true;
    } catch (_error) {
      return false;
    }

    await sleep(PDF_RENDER_TEXT_POLL_MS);
  }

  return false;
}

function collectRenderedTextFromDocument() {
  const chunks = [];
  const visited = new Set();

  function addText(value) {
    const text = String(value || "").trim();
    if (text) chunks.push(text);
  }

  function visitRoot(root) {
    if (!root || visited.has(root)) return;
    visited.add(root);

    if (root.body) {
      addText(root.body.innerText || root.body.textContent);
    } else {
      addText(root.innerText || root.textContent);
    }

    const elements = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (const element of elements) {
      if (element.shadowRoot) visitRoot(element.shadowRoot);

      if (element.getAttribute) {
        addText(element.getAttribute("aria-label"));
        addText(element.getAttribute("title"));
      }
    }
  }

  visitRoot(document);
  return chunks.join("\n").slice(0, 500000);
}

async function readRenderedPdfTabText(tabId) {
  await waitForTabComplete(tabId, Math.min(3500, PDF_RENDER_TEXT_TIMEOUT_MS));

  const startedAt = Date.now();
  let lastText = "";

  while (Date.now() - startedAt < PDF_RENDER_TEXT_TIMEOUT_MS) {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: collectRenderedTextFromDocument
    });

    const text = (results || [])
      .map((result) => result && result.result ? result.result : "")
      .filter(Boolean)
      .join("\n");

    if (text) lastText = text;

    const normalized = normalizeSearchText(text);
    const compact = compactSearchText(normalized);
    if (compact.length >= 80 || /\bintimac(?:ao|oes)?\b/.test(normalized) || /\bpautas?\b/.test(normalized)) {
      return text;
    }

    await sleep(PDF_RENDER_TEXT_POLL_MS);
  }

  return lastText;
}

function isWeakExpedienteTextExtraction(text) {
  const normalized = normalizeSearchText(text);
  const compact = compactSearchText(normalized);
  if (compact.length < 80) return true;

  const anchors = [
    "processo",
    "tribunal",
    "destinatario",
    "intimacao",
    "autos",
    "partes",
    "justica",
    "expediente",
    "data"
  ];

  return !anchors.some((anchor) => normalized.indexOf(anchor) >= 0);
}

function phraseFilterNames(phrases) {
  const names = {};
  (phrases || []).forEach((phrase) => {
    const normalized = normalizeSearchText(phrase);
    if (
      normalized === "pauta_julgamento" ||
      (normalized.indexOf("pauta") >= 0 && normalized.indexOf("julgamento") >= 0)
    ) {
      names.pauta = true;
    }
    if (
      normalized === "negociacao_assincrona" ||
      (normalized.indexOf("negociacao") >= 0 && normalized.indexOf("assincrona") >= 0)
    ) {
      names.negociacao = true;
    }
  });
  return names;
}

function textDiagnostics(renderedText, downloadedResult, renderedError, downloadedError) {
  const result = downloadedResult && typeof downloadedResult === "object"
    ? downloadedResult
    : { text: String(downloadedResult || ""), offscreenText: "", pdfJsText: "", rawText: String(downloadedResult || "") };
  const downloadedText = result.text || "";
  const offscreenText = result.offscreenText || "";
  const pdfJsText = result.pdfJsText || "";
  const rawText = result.rawText || "";
  const searchableText = [renderedText, offscreenText, pdfJsText].filter(Boolean).join("\n");
  const combined = [searchableText, rawText].filter(Boolean).join("\n");
  const normalized = normalizeSearchText(combined);
  const compact = compactSearchText(normalized);
  const searchableNormalized = normalizeSearchText(searchableText);
  const searchableCompact = compactSearchText(searchableNormalized);
  const pdfJsNormalized = normalizeSearchText(pdfJsText);
  const pdfJsCompact = compactSearchText(pdfJsNormalized);
  const rawNormalized = normalizeSearchText(rawText);
  const rawCompact = compactSearchText(rawNormalized);

  return {
    renderedLength: compactSearchText(renderedText).length,
    downloadedLength: compact.length,
    offscreenLength: searchableCompact.length,
    pdfJsLength: pdfJsCompact.length,
    rawLength: rawCompact.length,
    byteLength: result.byteLength || 0,
    hasIntimacao: /intimac(?:ao|oes)?/.test(compact),
    hasPauta: compact.indexOf("pauta") >= 0,
    hasJulgamento: compact.indexOf("julgamento") >= 0,
    hasSessao: compact.indexOf("sessao") >= 0,
    hasSustentacaoOral: compact.indexOf("sustentacaooral") >= 0,
    hasPlenarioVirtual: compact.indexOf("plenariovirtual") >= 0,
    hasNegociacao: compact.indexOf("negociacaoassincrona") >= 0,
    hasMonetaryValue: textHasMonetaryValue(normalized),
    searchableHasAnySignal:
      /intimac(?:ao|oes)?/.test(searchableCompact) ||
      searchableCompact.indexOf("pauta") >= 0 ||
      searchableCompact.indexOf("julgamento") >= 0 ||
      searchableCompact.indexOf("negociacaoassincrona") >= 0,
    weak: isWeakExpedienteTextExtraction(combined),
    offscreenError: result.offscreenError ? String(result.offscreenError).slice(0, 160) : "",
    pdfJsError: result.pdfJsError ? String(result.pdfJsError).slice(0, 160) : "",
    rawError: result.rawError ? String(result.rawError).slice(0, 160) : "",
    renderedError: renderedError || "",
    downloadedError: downloadedError || ""
  };
}

async function removeTabIfOpen(tabId) {
  if (!tabId) return;
  try {
    await chrome.tabs.remove(tabId);
  } catch (_error) {
    // A aba pode ja ter sido fechada pelo usuario.
  }
}

function regexRanges(text, pattern) {
  const flags = pattern.flags.indexOf("g") >= 0 ? pattern.flags : pattern.flags + "g";
  const regex = new RegExp(pattern.source, flags);
  const ranges = [];
  let match;

  while ((match = regex.exec(text))) {
    ranges.push({
      start: match.index,
      end: match.index + match[0].length
    });

    if (!match[0]) regex.lastIndex += 1;
  }

  return ranges;
}

function textHasNearTerms(text, firstPattern, secondPattern, maxDistance) {
  const firstRanges = regexRanges(text, firstPattern);
  const secondRanges = regexRanges(text, secondPattern);

  return firstRanges.some((first) =>
    secondRanges.some((second) => {
      if (first.end < second.start) {
        return second.start - first.end <= maxDistance && !/[.!?;]/.test(text.slice(first.end, second.start));
      }

      if (second.end < first.start) {
        return first.start - second.end <= maxDistance && !/[.!?;]/.test(text.slice(second.end, first.start));
      }

      return true;
    })
  );
}

function textMatchesPautaJulgamento(normalizedText) {
  const compact = compactSearchText(normalizedText);

  if (/\bintimac(?:ao|oes)?\b.{0,120}\bpautas?\b/.test(normalizedText)) {
    return true;
  }

  if (/intimac(?:ao|oes)?.{0,80}pautas?/.test(compact)) {
    return true;
  }

  if (/\bsess(?:ao|oes)\s+de\s+julgamentos?\b/.test(normalizedText)) {
    return true;
  }

  if (/\bjulgamentos?\b.{0,80}\bdesignad[oa]s?\b.{0,80}\bsess(?:ao|oes)\b.{0,80}\bordinarias?\b/.test(normalizedText)) {
    return true;
  }

  if (textHasNearTerms(normalizedText, /\bjulgamentos?\b/, /\bsess(?:ao|oes)\b/, 120)) {
    return true;
  }

  if (textHasNearTerms(normalizedText, /\bjulgamentos?\b/, /\bsustentac(?:ao|oes)\s+or(?:al|ais)\b/, 120)) {
    return true;
  }

  return textHasNearTerms(normalizedText, /\bjulgamentos?\b/, /\bplenarios?\s+virtu(?:al|ais)\b/, 120);
}

function textHasMonetaryValue(normalizedText) {
  const text = normalizeSearchText(normalizedText);

  return (
    /\br\s*\$\s*\d/.test(text) ||
    /\b\d{1,3}(?:\.\d{3})+,\d{2}\b/.test(text) ||
    /\b\d+,\d{2}\s*(?:reais|brl)\b/.test(text) ||
    /\b(?:valor(?:es)?|quantia|montante|bloquei\w*|desbloquei\w*|sisbajud|bacenjud)\b.{0,80}\b(?:real|reais)\b/.test(text) ||
    /\b(?:real|reais)\b.{0,80}\b(?:valor(?:es)?|quantia|montante|bloquei\w*|desbloquei\w*|sisbajud|bacenjud)\b/.test(text)
  );
}

function textMatchesNegociacaoAssincrona(normalizedText) {
  return /\bnegociacao\s+assincrona\b/.test(normalizedText) && !textHasMonetaryValue(normalizedText);
}

function textHasContestacaoCitation(normalizedText) {
  const citationCommand = "(?:c\\s*ite\\s*(?:\\(?m\\)?)?\\s*-?\\s*se|cite\\s*-?\\s*se|citem\\s*-?\\s*se|citam\\s*-?\\s*se)";

  return new RegExp("\\b" + citationCommand + "\\b").test(normalizedText) || /\bcit(?:ar|acao)\b/.test(normalizedText);
}

function textLooksLikeJudgmentOrHistoricalContestacao(normalizedText) {
  const start = normalizedText.slice(0, 1800);
  const judgmentSignals = [
    /\bsentenca\b/,
    /\bjulgo\s+(?:procedente|improcedente|parcialmente\s+procedente)\b/,
    /\bcom\s+fulcro\s+no\s+art(?:igo|\.)?\s*487\b/,
    /\bart(?:igo|\.)?\s*487\b.{0,80}\bcodigo\s+de\s+processo\s+civil\b/,
    /\bpublique-se\b.{0,80}\bregistre-se\b.{0,80}\bintime-se\b/,
    /\btransito\s+em\s+julgado\b/,
  ];

  if (judgmentSignals.some((pattern) => pattern.test(start))) return true;

  return (
    /\bregularmente\s+citad[oa]s?\b.{0,240}\bapresentou(?:ram)?\s+contestacao\b/.test(normalizedText) ||
    /\bcitacao\s+d[oa]s?\s+requerid[oa]s?\b.{0,180}\bcontestacao\b.{0,180}\bem\s+id\b/.test(normalizedText) ||
    /\bfora\s+determinada\s+a\s+citacao\b.{0,220}\bapresentou(?:ram)?\s+contestacao\b/.test(normalizedText) ||
    /\bfoi\s+determinada\s+a\s+citacao\b.{0,220}\bapresentou(?:ram)?\s+contestacao\b/.test(normalizedText)
  );
}

function textHasLiminarComplianceGrant(normalizedText) {
  const compliancePatterns = [
    /\bintim(?:e|em)-se\b.{0,150}\bcumpr\w{0,12}\b.{0,80}\bliminar\b/,
    /\bcumpr\w{0,12}\b.{0,80}\bliminar\b.{0,150}\bintim(?:e|em)-se\b/,
    /\bcumpr\w{0,12}\b.{0,80}\bmedida\s+liminar\b.{0,180}\bdetermino\b.{0,80}\bintimac(?:ao|oes)\b/,
    /\bcumpr(?:am|irem|ir|a)?\b.{0,80}\btutela\s+de\s+urgencia\b/,
    /\btutela\s+de\s+urgencia\b.{0,80}\bcumpr(?:am|irem|ir|a)?\b/,
    /\bpedido\s+liminar\b.{0,80}\b(?:foi\s+)?deferid[oa]\b/,
    /\bdecisao\s+liminar\b.{0,120}\bdetermin\w+\b/,
  ];

  return compliancePatterns.some((pattern) => pattern.test(normalizedText));
}

function textHasTutelaGrant(normalizedText) {
  const tutelaTerms =
    "(?:tutela\\s+de\\s+urgencia|antecipac(?:ao|oes)\\s+(?:dos\\s+efeitos\\s+)?(?:da\\s+)?tutela|pedido\\s+de\\s+tutela(?:\\s+de\\s+urgencia)?|liminar)";
  const grantVerbs = "(?:defiro|defero|concedo|acolho)";
  const direct = new RegExp(
    "\\b" +
      grantVerbs +
      "\\b\\s+(?:parcialmente\\s+|em\\s+parte\\s+)?(?:o\\s+pedido\\s+de\\s+|o\\s+pedido\\s+|a\\s+|o\\s+|os\\s+pedidos?\\s+de\\s+)?\\b" +
      tutelaTerms +
      "\\b"
  );
  const reverse = /\b(?:liminar|tutela\s+de\s+urgencia)\s+(?:foi\s+)?(?:deferida|concedida|acolhida)\b/;

  return direct.test(normalizedText) || reverse.test(normalizedText) || textHasLiminarComplianceGrant(normalizedText);
}

function textHasTutelaDeny(normalizedText) {
  const tutelaTerms =
    "(?:tutela\\s+de\\s+urgencia|antecipac(?:ao|oes)\\s+(?:dos\\s+efeitos\\s+)?(?:da\\s+)?tutela|pedido\\s+de\\s+tutela|liminar|pretensao)";
  const denyTerms = "(?:indefiro|indeferida|indeferimento|nego|negada|denego|rejeito|nao\\s+concedo|nao\\s+defiro)";
  const direct = new RegExp("\\b" + denyTerms + "\\b.{0,160}\\b" + tutelaTerms + "\\b");
  const reverse = new RegExp("\\b" + tutelaTerms + "\\b.{0,160}\\b" + denyTerms + "\\b");

  return direct.test(normalizedText) || reverse.test(normalizedText);
}

function firstPieceMatchSnippet(normalizedText) {
  const terms = [
    "citem-se",
    "citam-se",
    "cite-se",
    "indefiro",
    "defiro",
    "concedo",
    "tutela de urgencia",
    "liminar",
    "negociacao assincrona",
    "pauta",
    "julgamento"
  ];

  for (const term of terms) {
    const index = normalizedText.indexOf(term);
    if (index >= 0) {
      return normalizedText.slice(Math.max(0, index - 180), Math.min(normalizedText.length, index + 420));
    }
  }

  return normalizedText.slice(0, 420);
}

function inferRecordDegreeFromText(text) {
  const normalized = normalizeSearchText(text).replace(/a[º°]/g, "o").replace(/[º°]/g, "o");
  const compact = compactSearchText(normalized);

  if (
    /(?:^|[^0-9])1\s*o?\s*grau(?:\b|$)/.test(normalized) ||
    compact.indexOf("1grau") >= 0 ||
    compact.indexOf("1ograu") >= 0 ||
    compact.indexOf("primeirograu") >= 0
  ) {
    return "1";
  }

  if (
    /(?:^|[^0-9])2\s*o?\s*grau(?:\b|$)/.test(normalized) ||
    compact.indexOf("2grau") >= 0 ||
    compact.indexOf("2ograu") >= 0 ||
    compact.indexOf("segundograu") >= 0
  ) {
    return "2";
  }

  return "";
}

function pieceRecordDegree(record) {
  if (!record) return "";

  return inferRecordDegreeFromText(
    [
      record.grau,
      record.tribunal,
      record.tribunalText,
      record.jurisdiction,
      record.label,
      record.processNumber
    ].join(" ")
  );
}

function pieceRecordHasFirstDegreeTribunal(record) {
  return pieceRecordDegree(record) === "1";
}

function pieceRecordHasSecondDegreeTribunal(record) {
  return pieceRecordDegree(record) === "2";
}

function classifyPieceText(text, expedienteCount, recordContext) {
  const normalized = normalizeSearchText(text);
  const hasSingleExpediente = Number(expedienteCount) === 1;
  const degree = pieceRecordDegree(recordContext);
  const firstDegreeTribunal = pieceRecordHasFirstDegreeTribunal(recordContext);
  const secondDegreeTribunal = pieceRecordHasSecondDegreeTribunal(recordContext);
  const judgmentOrHistorical = textLooksLikeJudgmentOrHistoricalContestacao(normalized);
  const rawContestacaoCitation = hasSingleExpediente && textHasContestacaoCitation(normalized);
  const contestacaoCitation = rawContestacaoCitation && !secondDegreeTribunal;
  const tutelaGrant = contestacaoCitation && textHasTutelaGrant(normalized);
  const tutelaDeny = contestacaoCitation && textHasTutelaDeny(normalized);
  const pautaCandidate = textMatchesPautaJulgamento(normalized);
  const negociacaoCandidate = textMatchesNegociacaoAssincrona(normalized);
  const pauta = pautaCandidate && !firstDegreeTribunal;
  const negociacao = negociacaoCandidate && !secondDegreeTribunal;

  if (contestacaoCitation && judgmentOrHistorical) {
    return {
      key: "peca_identificar",
      label: "Peças a identificar",
      autoFill: false,
      reason: "Documento aparenta ser sentença ou relato histórico de contestação, não ordem atual para contestar.",
      snippet: firstPieceMatchSnippet(normalized)
    };
  }

  if (contestacaoCitation && tutelaGrant && !tutelaDeny) {
    return {
      key: "contestacao_com_agravo",
      label: "Contestação c/ agravo",
      autoFill: true,
      reason: "Citação para defesa com tutela/liminar deferida.",
      snippet: firstPieceMatchSnippet(normalized)
    };
  }

  if (contestacaoCitation && tutelaDeny && !tutelaGrant) {
    return {
      key: "contestacao_sem_agravo",
      label: "Contestação s/ agravo",
      autoFill: true,
      reason: "Citação para defesa com tutela/liminar indeferida.",
      snippet: firstPieceMatchSnippet(normalized)
    };
  }

  if (contestacaoCitation && tutelaGrant && tutelaDeny) {
    return {
      key: "contestacao_possivel_agravo",
      label: "Contestação c/ possível agravo",
      autoFill: true,
      reason: "Citação para contestar encontrada, mas a decisão sobre tutela/liminar ficou ambígua.",
      snippet: firstPieceMatchSnippet(normalized)
    };
  }

  if (pauta) {
    return {
      key: "pauta_julgamento",
      label: "Intimação de Pauta de Julgamento",
      autoFill: false,
      reason: "Padrão de pauta/sessão de julgamento encontrado.",
      snippet: firstPieceMatchSnippet(normalized)
    };
  }

  if (negociacao) {
    return {
      key: "negociacao_assincrona",
      label: "Negociação Assíncrona",
      autoFill: false,
      reason: "Negociação assíncrona sem indicação monetária relevante.",
      snippet: firstPieceMatchSnippet(normalized)
    };
  }

  if (pautaCandidate && degree === "1") {
    return {
      key: "peca_identificar",
      label: "Peças a identificar",
      autoFill: false,
      reason: "Padrão de pauta encontrado, mas o processo é de 1° Grau; pauta de julgamento é aceita somente para 2° Grau.",
      snippet: firstPieceMatchSnippet(normalized)
    };
  }

  if (negociacaoCandidate && degree === "2") {
    return {
      key: "peca_identificar",
      label: "Peças a identificar",
      autoFill: false,
      reason: "Padrão de negociação assíncrona encontrado, mas o processo é de 2° Grau; negociação assíncrona é aceita somente para 1° Grau.",
      snippet: firstPieceMatchSnippet(normalized)
    };
  }

  if (secondDegreeTribunal && rawContestacaoCitation) {
    return {
      key: "peca_identificar",
      label: "Peças a identificar",
      autoFill: false,
      reason: "Tribunal de 2° Grau; processos de 2° Grau não são classificados como contestação.",
      snippet: firstPieceMatchSnippet(normalized)
    };
  }

  if (contestacaoCitation) {
    return {
      key: "contestacao_possivel_agravo",
      label: "Contestação c/ possível agravo",
      autoFill: true,
      reason: "Citação para contestar encontrada, sem conclusão segura sobre deferimento ou indeferimento de tutela/liminar.",
      snippet: firstPieceMatchSnippet(normalized)
    };
  }

  return {
    key: "peca_identificar",
    label: "Peças a identificar",
    autoFill: false,
    reason: hasSingleExpediente
      ? "Nenhum padrão inicial de peça foi identificado."
      : "Mais de um expediente; descartado como contestação.",
    snippet: firstPieceMatchSnippet(normalized)
  };
}

function phraseAllowedByRecordDegree(phrase, recordContext) {
  const normalizedPhrase = normalizeSearchText(phrase);
  const degree = pieceRecordDegree(recordContext);
  const isPauta =
    normalizedPhrase === "pauta_julgamento" ||
    (normalizedPhrase.indexOf("pauta") >= 0 && normalizedPhrase.indexOf("julgamento") >= 0);
  const isNegociacao =
    normalizedPhrase === "negociacao_assincrona" ||
    (normalizedPhrase.indexOf("negociacao") >= 0 && normalizedPhrase.indexOf("assincrona") >= 0);

  if (isPauta && degree === "1") return false;
  if (isNegociacao && degree === "2") return false;

  return true;
}

function textMatchesPhrase(normalizedText, phrase, recordContext) {
  const normalizedPhrase = normalizeSearchText(phrase);

  if (!phraseAllowedByRecordDegree(phrase, recordContext)) return false;

  if (
    normalizedPhrase === "pauta_julgamento" ||
    (normalizedPhrase.indexOf("pauta") >= 0 && normalizedPhrase.indexOf("julgamento") >= 0)
  ) {
    return textMatchesPautaJulgamento(normalizedText);
  }

  if (
    normalizedPhrase === "negociacao_assincrona" ||
    (normalizedPhrase.indexOf("negociacao") >= 0 && normalizedPhrase.indexOf("assincrona") >= 0)
  ) {
    return textMatchesNegociacaoAssincrona(normalizedText);
  }

  return normalizedText.indexOf(normalizedPhrase) >= 0;
}

function textMatchesAnyPhrase(text, phrases, recordContext) {
  const normalized = normalizeSearchText(text);
  return (phrases || []).some((phrase) => textMatchesPhrase(normalized, phrase, recordContext));
}

async function openFilteredExpedienteTabs(message) {
  const group = message && message.group ? message.group : {};
  const phrases = Array.isArray(message.phrases) ? message.phrases.filter(Boolean) : [];
  const pendencyUrl = normalizeAllowedUrl(group.pendencyUrl);
  const expedientes = Array.isArray(group.expedientes) ? group.expedientes : [];
  const delayMs = Number.isFinite(message.delayMs)
    ? Math.max(0, Math.min(2000, message.delayMs))
    : DEFAULT_DELAY_MS;

  if (!phrases.length) {
    return { ok: false, opened: 0, kept: 0, closed: 0, error: "Nenhuma frase de filtro informada." };
  }

  const pendencyTab = pendencyUrl ? await chrome.tabs.create({ url: pendencyUrl, active: false }) : null;
  const results = [];
  let kept = 0;
  let closed = 0;
  let opened = pendencyTab ? 1 : 0;

  for (const expediente of expedientes) {
    const url = normalizeAllowedUrl(expediente && expediente.url);
    if (!url) {
      results.push({
        label: expediente && expediente.label ? expediente.label : "Expediente",
        url: String((expediente && expediente.url) || ""),
        opened: false,
        kept: false,
        error: "URL de expediente invalida."
      });
      continue;
    }

    let tab = null;
    try {
      tab = await chrome.tabs.create({ url, active: false });
      opened += 1;
      if (delayMs) await sleep(delayMs);

      let renderedText = "";
      let downloadedResult = null;
      let renderedError = "";
      let downloadedError = "";

      try {
        renderedText = await readRenderedPdfTabText(tab.id);
      } catch (error) {
        renderedError = error && error.message ? error.message : String(error);
      }

      try {
        downloadedResult = await fetchExpedienteText(url);
      } catch (error) {
        downloadedError = error && error.message ? error.message : String(error);
      }

      const downloadedText = downloadedResult && downloadedResult.text ? downloadedResult.text : "";
      const text = [renderedText, downloadedText].filter(Boolean).join("\n");
      const matched = textMatchesAnyPhrase(text, phrases, group);
      const diagnostics = textDiagnostics(renderedText, downloadedResult, renderedError, downloadedError);
      const reliableText =
        diagnostics.renderedLength >= 80 ||
        diagnostics.offscreenLength >= 80 ||
        (!diagnostics.weak && diagnostics.downloadedLength >= 80);
      const uncertain =
        !matched &&
        !reliableText &&
        (diagnostics.weak ||
          Boolean(renderedError) ||
          Boolean(downloadedError));
      const shouldKeep = matched || uncertain;

      if (shouldKeep) {
        kept += 1;
      } else {
        await removeTabIfOpen(tab.id);
        closed += 1;
      }

      results.push({
        label: expediente.label || "Expediente",
        url,
        opened: true,
        kept: shouldKeep,
        matched,
        uncertain,
        diagnostics,
        error: uncertain
          ? "Leitura do PDF inconclusiva; aba mantida para conferencia."
          : "",
        tabId: shouldKeep ? tab.id : null
      });
    } catch (error) {
      if (tab && tab.id) {
        await removeTabIfOpen(tab.id);
        closed += 1;
      }
      results.push({
        label: expediente && expediente.label ? expediente.label : "Expediente",
        url,
        opened: Boolean(tab),
        kept: false,
        error: error && error.message ? error.message : String(error)
      });
    }
  }

  if (!kept && pendencyTab && pendencyTab.id) {
    await removeTabIfOpen(pendencyTab.id);
    closed += 1;
  }

  return {
    ok: true,
    opened,
    kept,
    closed,
    pendencyKept: Boolean(kept),
    results
  };
}

async function classifyPieceRecords(message) {
  const records = Array.isArray(message && message.records) ? message.records : [];
  const results = [];

  for (const record of records) {
    const expedienteUrls = [];
    if (record && Array.isArray(record.expedientes)) {
      record.expedientes.forEach((expediente) => {
        const url = normalizeAllowedUrl(expediente && expediente.url);
        if (url && expedienteUrls.indexOf(url) < 0) expedienteUrls.push(url);
      });
    }
    const fallbackUrl = normalizeAllowedUrl(record && record.expedienteUrl);
    if (fallbackUrl && expedienteUrls.indexOf(fallbackUrl) < 0) expedienteUrls.push(fallbackUrl);

    if (!expedienteUrls.length) {
      results.push({
        id: record && record.id ? record.id : "",
        ok: false,
        classification: {
          key: "peca_identificar",
          label: "Peças a identificar",
          autoFill: false,
          reason: "Expediente sem URL válida.",
          snippet: ""
        },
        error: "Expediente sem URL válida."
      });
      continue;
    }

    try {
      const pieces = [];
      const diagnosticsItems = [];

      for (const expedienteUrl of expedienteUrls) {
        try {
          const downloadedResult = await fetchExpedienteText(expedienteUrl);
          const diagnostics = textDiagnostics("", downloadedResult, "", "");
          diagnosticsItems.push(diagnostics);
          if (downloadedResult && downloadedResult.text) pieces.push(downloadedResult.text);
        } catch (error) {
          diagnosticsItems.push({
            downloadedLength: 0,
            offscreenLength: 0,
            rawLength: 0,
            byteLength: 0,
            weak: true,
            error: error && error.message ? error.message : String(error)
          });
        }
      }

      const text = pieces.join("\n\n");
      const reliableText = diagnosticsItems.some(
        (diagnostics) => diagnostics.downloadedLength >= 80 && !diagnostics.weak
      );
      const classification = reliableText
        ? classifyPieceText(text, record && record.expedienteCount, record)
        : {
            key: "peca_identificar",
            label: "Peças a identificar",
            autoFill: false,
            reason: "Leitura do PDF inconclusiva.",
            snippet: normalizeSearchText(text).slice(0, 420)
          };

      results.push({
        id: record && record.id ? record.id : "",
        ok: true,
        classification,
        popSupport: record && record.popSupport ? MTPrevTriageRules.diagnose(record, reliableText ? text : "") : undefined,
        popReadReliable: record && record.popSupport ? reliableText : undefined,
        popReadComplete: record && record.popSupport ? diagnosticsItems.length === expedienteUrls.length && diagnosticsItems.every((item) => item.downloadedLength >= 80 && !item.weak) : undefined,
        diagnostics: diagnosticsItems,
        textLength: text.length
      });
    } catch (error) {
      results.push({
        id: record && record.id ? record.id : "",
        ok: false,
        classification: {
          key: "peca_identificar",
          label: "Peças a identificar",
          autoFill: false,
          reason: "Erro ao ler expediente.",
          snippet: ""
        },
        error: error && error.message ? error.message : String(error)
      });
    }
  }

  return {
    ok: true,
    results
  };
}

function pieceClassificationHrefScript() {
  function normalizeLocal(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  if (document.querySelector("#progress-form #progress_form_data_ATR007587")) {
    return { ready: true, href: "" };
  }

  const links = Array.from(document.querySelectorAll("a[href]"));
  const found = links.find((link) => {
    const text = normalizeLocal(
      [
        link.textContent,
        link.getAttribute("data-title"),
        link.getAttribute("title"),
        link.getAttribute("href")
      ].join(" ")
    );
    return (
      text.indexOf("complementar classificacao do processo") >= 0 ||
      String(link.getAttribute("href") || "").indexOf("/new_progress/618") >= 0
    );
  });

  return {
    ready: false,
    href: found ? found.href : ""
  };
}

function pieceClassificationFillScript(payload) {
  function normalizeLocal(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function dispatchChange(element) {
    if (!element) return;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    if (window.jQuery) {
      try {
        window.jQuery(element).trigger("change");
      } catch (_error) {
        // Continua com eventos nativos.
      }
    }
  }

  function setInput(selector, value) {
    const element = document.querySelector(selector);
    if (!element) return false;
    element.value = value || "";
    dispatchChange(element);
    return true;
  }

  function selectByText(selector, wantedText) {
    const select = document.querySelector(selector);
    if (!select) return false;
    const wanted = normalizeLocal(wantedText);
    const option = Array.from(select.options || []).find((item) => normalizeLocal(item.textContent) === wanted);
    if (!option) return false;
    select.value = option.value;
    option.selected = true;
    dispatchChange(select);
    return true;
  }

  function setRemoteUser(selector, user) {
    const select = document.querySelector(selector);
    if (!select || !user || !user.value) return false;
    let option = Array.from(select.options || []).find((item) => item.value === user.value);
    if (!option) {
      option = new Option(user.name || user.value, user.value, true, true);
      select.appendChild(option);
    }
    select.value = user.value;
    option.selected = true;
    dispatchChange(select);
    return true;
  }

  function nextBusinessDate() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() + 1);
    }
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return dd + "/" + mm + "/" + yyyy;
  }

  const result = {
    ok: true,
    filled: [],
    missing: []
  };

  function mark(name, ok) {
    (ok ? result.filled : result.missing).push(name);
    if (!ok) result.ok = false;
  }

  const classificationKey = payload && payload.classificationKey;
  const intern = payload && payload.intern;
  const isAgravo = classificationKey === "contestacao_com_agravo";
  const isSemAgravo = classificationKey === "contestacao_sem_agravo";
  const isPossivelAgravo = classificationKey === "contestacao_possivel_agravo";
  const isContestacao =
    classificationKey === "contestacao_com_agravo" ||
    classificationKey === "contestacao_sem_agravo" ||
    classificationKey === "contestacao_possivel_agravo";

  if (!isContestacao) {
    return { ok: true, skipped: true, reason: "Peça não exige preenchimento automático." };
  }

  mark("Manifestação sugerida", selectByText("#progress_form_data_ATR007587", "Contestação"));
  if (isAgravo) {
    mark(
      "Observação principal",
      setInput(
        "#progress_form_data_ATR007594",
        "Liminar deferida, verificar a necessidade de interpor agravo de instrumento"
      )
    );
  }
  mark("Tipo de tarefa", selectByText("#progress_form_data_Nova-Tarefa_0_ATR007590", "Ofício"));
  mark("Usuário", setRemoteUser("#progress_form_data_Nova-Tarefa_0_ATR007591", intern));
  mark("Vencimento em", setInput("#progress_form_data_Nova-Tarefa_0_ATR007593", nextBusinessDate()));
  if (isAgravo || isSemAgravo) {
    mark(
      "Observação da tarefa",
      setInput("#progress_form_data_Nova-Tarefa_0_ATR007589", isAgravo ? "CUMP" : "SINF")
    );
  }

  if (isPossivelAgravo) {
    result.filled.push("Observações dependentes de agravo deixadas em branco");
  }

  return result;
}

async function preparePieceClassificationTab(tabId, record) {
  await waitForTabComplete(tabId, 15000);

  const hrefResult = await chrome.scripting.executeScript({
    target: { tabId },
    func: pieceClassificationHrefScript,
    world: "MAIN"
  });
  const hrefInfo = hrefResult && hrefResult[0] ? hrefResult[0].result : null;

  if (!hrefInfo || (!hrefInfo.ready && !hrefInfo.href)) {
    return {
      ok: false,
      error: "Botão Complementar classificação do processo não encontrado."
    };
  }

  if (!hrefInfo.ready && hrefInfo.href) {
    await chrome.tabs.update(tabId, { url: hrefInfo.href });
    await waitForTabComplete(tabId, 15000);
  }

  const intern = record && record.internKey ? PIECE_INTERNS[record.internKey] : null;
  const fillResult = await chrome.scripting.executeScript({
    target: { tabId },
    func: pieceClassificationFillScript,
    args: [
      {
        classificationKey: record && record.classificationKey,
        intern
      }
    ],
    world: "MAIN"
  });

  return fillResult && fillResult[0] ? fillResult[0].result : { ok: false, error: "Sem retorno do preenchimento." };
}

async function openPieceReportRecord(message) {
  const record = message && message.record ? message.record : {};
  const pendencyUrl = normalizeAllowedUrl(record.pendencyUrl);
  const expedientes = Array.isArray(record.expedientes) ? record.expedientes : [];
  const delayMs = Number.isFinite(message && message.delayMs)
    ? Math.max(0, Math.min(2000, message.delayMs))
    : DEFAULT_DELAY_MS;

  if (!pendencyUrl) {
    return { ok: false, opened: 0, error: "Registro sem URL de pendência." };
  }

  const openedTabs = [];
  const pendencyTab = await chrome.tabs.create({ url: pendencyUrl, active: false });
  openedTabs.push({ kind: "pendency", tabId: pendencyTab.id, url: pendencyUrl });

  if (delayMs) await sleep(delayMs);

  for (const expediente of expedientes) {
    const url = normalizeAllowedUrl(expediente && expediente.url);
    if (!url) continue;
    const tab = await chrome.tabs.create({ url, active: false });
    openedTabs.push({ kind: "expediente", tabId: tab.id, url });
    if (delayMs) await sleep(delayMs);
  }

  let classification = null;
  const shouldAutoFill =
    record.classificationKey === "contestacao_com_agravo" ||
    record.classificationKey === "contestacao_sem_agravo" ||
    record.classificationKey === "contestacao_possivel_agravo";

  if (shouldAutoFill) {
    if (!record.internKey || !PIECE_INTERNS[record.internKey]) {
      classification = {
        ok: false,
        error: "Selecione um estagiário antes de abrir/preencher contestação."
      };
    } else {
      classification = await preparePieceClassificationTab(pendencyTab.id, record);
    }
  }

  return {
    ok: true,
    opened: openedTabs.length,
    tabs: openedTabs,
    classification
  };
}

function applyConferidoMarkerScript(markerText) {
  const wanted = String(markerText || "Conferido").trim();

  function sleepLocal(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeLocal(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function visibleLocal(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function textHasMarker(element) {
    return normalizeLocal(element && element.textContent).indexOf(normalizeLocal(wanted)) >= 0;
  }

  function markerAlreadyVisible() {
    const area = document.querySelector("#procedure-show-markers");
    return Boolean(area && textHasMarker(area));
  }

  function csrfToken() {
    const token = document.querySelector("meta[name='csrf-token']");
    return token ? String(token.getAttribute("content") || "") : "";
  }

  function markerAreaFromHtml(html) {
    if (!html) return "";
    const parsed = new DOMParser().parseFromString(String(html), "text/html");
    const area = parsed.querySelector("#procedure-show-markers");
    return area ? String(area.textContent || "") : "";
  }

  function findMarkerButton() {
    const candidates = Array.from(
      document.querySelectorAll(
        ".btn-marker-modal, form.marker-modal-form button, form[action*='/marker_procedures/list'] button, [title*='Marcador'], [data-original-title*='Marcador']"
      )
    );
    return candidates.find((element) => visibleLocal(element)) || candidates[0] || null;
  }

  async function waitUntil(test, timeoutMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const value = test();
      if (value) return value;
      await sleepLocal(200);
    }
    return null;
  }

  function dispatchClickLikeUser(element) {
    if (!element) return;
    try {
      element.scrollIntoView({ block: "center", inline: "center" });
    } catch (_) {}
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
      try {
        element.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
          })
        );
      } catch (_) {}
    });
  }

  function nativeClick(element) {
    if (!element) return false;
    try {
      element.scrollIntoView({ block: "center", inline: "center" });
    } catch (_) {}
    try {
      element.focus({ preventScroll: true });
    } catch (_) {
      try {
        element.focus();
      } catch (_) {}
    }
    try {
      element.click();
      return true;
    } catch (_) {
      dispatchClickLikeUser(element);
      return false;
    }
  }

  async function waitForSpaAjaxIdle() {
    await sleepLocal(100);
    await waitUntil(() => {
      try {
        return !(window.jQuery && Number(window.jQuery.active));
      } catch (_) {
        return true;
      }
    }, 5000);
    await sleepLocal(250);
  }

  function triggerJQuery(element, type) {
    try {
      if (!window.jQuery || !element) return false;
      window.jQuery(element).trigger(type);
      return true;
    } catch (_) {
      return false;
    }
  }

  function activeTabScore(element) {
    if (!element) return 0;
    const pane = element.closest(".tab-pane");
    if (pane && /\bactive\b/.test(pane.className)) return 30;
    if (pane && visibleLocal(pane)) return 20;
    return visibleLocal(element) ? 10 : 0;
  }

  function rowScore(row) {
    if (!row) return 0;
    let score = activeTabScore(row);
    if (visibleLocal(row)) score += 30;
    if (row.querySelector(".btn-edit-marker, a[href*='/markers/']")) score += 10;
    if (rawMarkerNameText(row) === wanted) score += 25;
    if (/particular/i.test(String(row.textContent || ""))) score += 15;
    return score;
  }

  function markerNameText(row) {
    if (!row) return "";
    const name = row.querySelector(".text-marker, [id^='marker-item-name-']");
    return normalizeLocal(name ? name.textContent : "");
  }

  function rawMarkerNameText(row) {
    if (!row) return "";
    const name = row.querySelector(".text-marker, [id^='marker-item-name-']");
    return String(name ? name.textContent || "" : "").replace(/\s+/g, " ").trim();
  }

  function findMarkerRow(container) {
    const root = container || document;
    const wantedNormalized = normalizeLocal(wanted);
    const markerNames = Array.from(root.querySelectorAll(".text-marker, [id^='marker-item-name-']"));
    const matches = markerNames
      .map((element) => {
        const text = normalizeLocal(element.textContent);
        const row =
          element.closest(".listview__item") ||
          element.closest("label, tr, li, .checkbox, .form-check, .custom-control, .marker-item, [data-marker-id]");
        return {
          row: row,
          exact: text === wantedNormalized,
          contains: text.indexOf(wantedNormalized) >= 0,
          caseExact: String(element.textContent || "").replace(/\s+/g, " ").trim() === wanted,
        };
      })
      .filter((item) => item.row && (item.exact || item.contains))
      .sort((a, b) => {
        if (a.exact !== b.exact) return a.exact ? -1 : 1;
        if (a.caseExact !== b.caseExact) return a.caseExact ? -1 : 1;
        return rowScore(b.row) - rowScore(a.row);
      });

    if (matches.length) return matches[0].row;

    const roots = Array.from(
      root.querySelectorAll(
        ".listview__item, .marker-item, [data-marker-id]"
      )
    )
      .filter((element) => {
        const markerName = markerNameText(element);
        return markerName ? markerName.indexOf(wantedNormalized) >= 0 : textHasMarker(element);
      })
      .sort((a, b) => rowScore(b) - rowScore(a));
    return roots[0] || null;
  }

  function associatedCheckbox(row) {
    if (!row) return null;
    const direct =
      row.querySelector("input.marker-procedure-check[type='checkbox']") ||
      row.querySelector("input[type='checkbox'][data-marker-id]");
    if (direct) return direct;
    const labelFor = row.tagName === "LABEL" ? row.getAttribute("for") : "";
    return labelFor ? document.getElementById(labelFor) : null;
  }

  function labelForCheckbox(checkbox) {
    if (!checkbox || !checkbox.id) return null;
    try {
      if (window.CSS && typeof window.CSS.escape === "function") {
        return document.querySelector("label[for='" + window.CSS.escape(checkbox.id) + "']");
      }
    } catch (_) {}
    const wantedFor = String(checkbox.id);
    return Array.from(document.querySelectorAll("label[for]")).find((label) => label.getAttribute("for") === wantedFor) || null;
  }

  async function tryClickMarkerTab(modal, label) {
    const normalized = normalizeLocal(label);
    const root = modal || document;
    const tabs = Array.from(root.querySelectorAll("a, button, [role='tab']"));
    const tab = tabs.find((element) => visibleLocal(element) && normalizeLocal(element.textContent).indexOf(normalized) >= 0);
    if (!tab) return false;
    tab.click();
    await sleepLocal(700);
    return true;
  }

  async function waitForMarkerRow(modal, timeoutMs) {
    return waitUntil(() => {
      const row = findMarkerRow(modal);
      const checkbox = associatedCheckbox(row);
      return row && checkbox && visibleLocal(row) && !checkbox.disabled ? row : null;
    }, timeoutMs || 12000);
  }

  async function applyMarkerByRequest(checkbox) {
    if (!checkbox) return { ok: false, error: "Checkbox do marcador nao encontrado." };
    const markerId = checkbox.getAttribute("data-marker-id") || checkbox.value || "";
    const procedureId =
      checkbox.getAttribute("data-procedure-id") ||
      (document.querySelector("#modal-marker") && document.querySelector("#modal-marker").getAttribute("data-procedure-id")) ||
      "";
    const url = checkbox.getAttribute("data-url") || "/marker_procedures";

    if (!markerId || !procedureId) {
      return { ok: false, error: "Dados do marcador incompletos." };
    }

    const body = new URLSearchParams();
    body.set("utf8", "\u2713");
    const token = csrfToken();
    if (token) body.set("authenticity_token", token);
    body.set("marker_procedures[marker_id]", markerId);
    body.set("marker_procedures[procedure_id]", procedureId);

    const headers = {
      "X-Requested-With": "XMLHttpRequest",
      Accept: "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript, */*; q=0.01",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    };
    if (token) headers["X-CSRF-Token"] = token;

    const response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: headers,
      body: body,
    });

    if (!response.ok) {
      return { ok: false, error: "SPA respondeu HTTP " + response.status + " ao aplicar marcador." };
    }

    // A requisicao ja foi persistida. Disparar change aqui pode acionar um
    // segundo POST no SPA e deixar a checkbox em estado divergente.
    checkbox.checked = true;

    return { ok: true, markerId: markerId, procedureId: procedureId, method: "request-fallback" };
  }

  async function applyMarkerBySpaAjax(checkbox) {
    if (!checkbox || !window.jQuery) {
      return { ok: false, error: "Ajax do SPA indisponivel para aplicar marcador." };
    }

    const markerId = checkbox.getAttribute("data-marker-id") || checkbox.value || "";
    const procedureId =
      checkbox.getAttribute("data-procedure-id") ||
      (document.querySelector("#modal-marker") && document.querySelector("#modal-marker").getAttribute("data-procedure-id")) ||
      "";
    const url = checkbox.getAttribute("data-url") || "/marker_procedures";

    if (!markerId || !procedureId) {
      return { ok: false, error: "Dados do marcador incompletos para o Ajax do SPA." };
    }

    const initiallyChecked = Boolean(checkbox.checked);
    checkbox.disabled = true;

    return new Promise((resolve) => {
      try {
        window.jQuery.ajax({
          type: "POST",
          dataType: "script",
          url: url,
          data: {
            marker_procedures: {
              marker_id: markerId,
              procedure_id: procedureId,
            },
          },
          success: function () {
            checkbox.checked = true;
            resolve({
              ok: true,
              markerId: markerId,
              procedureId: procedureId,
              method: "spa-ajax",
            });
          },
          error: function (_xhr, status, error) {
            checkbox.checked = initiallyChecked;
            resolve({
              ok: false,
              markerId: markerId,
              procedureId: procedureId,
              method: "spa-ajax",
              error: error || status || "Ajax do SPA falhou ao aplicar marcador.",
            });
          },
          complete: function () {
            checkbox.disabled = false;
          },
        });
      } catch (error) {
        checkbox.checked = initiallyChecked;
        checkbox.disabled = false;
        resolve({
          ok: false,
          markerId: markerId,
          procedureId: procedureId,
          method: "spa-ajax",
          error: error && error.message ? error.message : String(error),
        });
      }
    });
  }

  async function applyMarkerBySpaChangeHandler(checkbox) {
    if (!checkbox || !window.jQuery) {
      return { ok: false, error: "Handler jQuery do SPA indisponivel." };
    }

    const markerId = checkbox.getAttribute("data-marker-id") || checkbox.value || "";
    try {
      window.jQuery(checkbox).prop("checked", true).trigger("change");
      await waitForSpaAjaxIdle();
      return {
        ok: Boolean(checkbox.checked),
        markerId: markerId,
        method: "spa-change-handler",
        error: checkbox.checked ? "" : "Handler do SPA nao manteve a checkbox selecionada.",
      };
    } catch (error) {
      return {
        ok: false,
        markerId: markerId,
        method: "spa-change-handler",
        error: error && error.message ? error.message : String(error),
      };
    }
  }

  async function applyMarkerByVisualFlow(row, checkbox) {
    const label = labelForCheckbox(checkbox);
    const target = label || checkbox || row;
    if (!target) return { ok: false, error: "Elemento clicavel da linha do marcador nao encontrado." };

    if (row) {
      try {
        row.scrollIntoView({ block: "center", inline: "center" });
      } catch (_) {}
    }

    if (checkbox && checkbox.checked) {
      return {
        ok: true,
        selected: true,
        markerId: checkbox.getAttribute("data-marker-id") || checkbox.value || "",
        method: "already-selected",
      };
    }

    const attempts = [
      { method: "label-click", element: label },
      { method: "checkbox-click", element: checkbox },
      { method: "row-click", element: row },
    ].filter((item) => item.element);

    for (const attempt of attempts) {
      nativeClick(attempt.element);
      await waitForSpaAjaxIdle();
      if (!checkbox || checkbox.checked) {
        return {
          ok: true,
          selected: Boolean(!checkbox || checkbox.checked),
          markerId: checkbox ? checkbox.getAttribute("data-marker-id") || checkbox.value || "" : "",
          method: attempt.method,
        };
      }
    }

    if (checkbox) {
      try {
        checkbox.focus();
      } catch (_) {}
      ["keydown", "keypress", "keyup"].forEach((type) => {
        try {
          checkbox.dispatchEvent(
            new KeyboardEvent(type, {
              key: " ",
              code: "Space",
              bubbles: true,
              cancelable: true,
            })
          );
        } catch (_) {}
      });
      await waitForSpaAjaxIdle();
      if (checkbox.checked) {
        return {
          ok: true,
          selected: true,
          markerId: checkbox.getAttribute("data-marker-id") || checkbox.value || "",
          method: "keyboard-space",
        };
      }

      if (triggerJQuery(label || checkbox, "click") || triggerJQuery(checkbox, "change")) {
        await waitForSpaAjaxIdle();
        if (checkbox.checked) {
          return {
            ok: true,
            selected: true,
            markerId: checkbox.getAttribute("data-marker-id") || checkbox.value || "",
            method: "jquery-trigger",
          };
        }
      }

      const spaHandlerResult = await applyMarkerBySpaChangeHandler(checkbox);
      if (spaHandlerResult.ok) return spaHandlerResult;
    }

    return {
      ok: false,
      error: "A checkbox associada ao marcador Conferido nao foi selecionada pelo fluxo visual.",
      markerId: checkbox ? checkbox.getAttribute("data-marker-id") || checkbox.value || "" : "",
      method: "visual-clicks",
    };
  }

  function findModalCloseControl(modal) {
    const root = modal || document;
    const controls = Array.from(root.querySelectorAll("a, button"));
    const byText = controls.find((element) => visibleLocal(element) && normalizeLocal(element.textContent) === "fechar");
    if (byText) return byText;
    return (
      root.querySelector("a[href*='reload_markers']") ||
      root.querySelector("[data-dismiss='modal']") ||
      root.querySelector(".close") ||
      null
    );
  }

  async function closeMarkerModal(modal) {
    if (!modal) return;
    try {
      const rect = modal.getBoundingClientRect();
      const outsideX = Math.max(8, Math.floor(rect.left / 2));
      const outsideY = Math.max(8, Math.floor(rect.top / 2));
      const outside = document.elementFromPoint(outsideX, outsideY) || document.body;
      dispatchClickLikeUser(outside);
    } catch (_) {
      dispatchClickLikeUser(document.body);
    }

    await sleepLocal(700);
    if (visibleLocal(modal)) {
      const close = findModalCloseControl(modal);
      if (close) dispatchClickLikeUser(close);
    }
    await sleepLocal(900);
  }

  async function verifyMarkerPersisted(timeoutMs) {
    const visible = await waitUntil(() => markerAlreadyVisible(), timeoutMs || 5000);
    if (visible) return { ok: true, source: "page" };

    try {
      const response = await fetch(window.location.href, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      if (response.ok) {
        const html = await response.text();
        const markerText = markerAreaFromHtml(html);
        if (normalizeLocal(markerText).indexOf(normalizeLocal(wanted)) >= 0) {
          const currentArea = document.querySelector("#procedure-show-markers");
          const parsed = new DOMParser().parseFromString(html, "text/html");
          const freshArea = parsed.querySelector("#procedure-show-markers");
          if (currentArea && freshArea) currentArea.innerHTML = freshArea.innerHTML;
          return { ok: true, source: "fresh-page" };
        }
      }
    } catch (error) {
      return {
        ok: false,
        error: error && error.message ? error.message : String(error),
      };
    }

    return { ok: false, error: "Marcador Conferido nao apareceu na pendencia apos a selecao." };
  }

  async function run() {
    if (markerAlreadyVisible()) {
      return { ok: true, already: true, message: "Marcador Conferido ja estava no processo." };
    }

    const button = findMarkerButton();
    if (!button) {
      return { ok: false, error: "Botao Incluir Marcador nao encontrado." };
    }

    button.click();

    const modal = await waitUntil(() => {
      const candidates = Array.from(document.querySelectorAll("#modal-marker, .modal.show, .modal"));
      return candidates.find((element) => visibleLocal(element)) || candidates[0] || null;
    }, 10000);

    if (!modal) {
      return { ok: false, error: "Modal de marcadores nao abriu." };
    }

    // O conteudo do modal e criado antes de a requisicao dos marcadores
    // terminar. Aguarde a linha visivel e a checkbox real, nao apenas texto.
    let row = await waitForMarkerRow(modal, 12000);
    if (!row) {
      await tryClickMarkerTab(modal, "MEUS MARCADORES");
      row = await waitForMarkerRow(modal, 12000);
    }
    if (!row) {
      return { ok: false, error: "O menu de marcadores abriu, mas a linha visivel de Conferido nao ficou pronta a tempo." };
    }

    const checkbox = associatedCheckbox(row);
    // Repete primeiro o fluxo que funciona para o usuario: label da checkbox,
    // fechamento do modal e conferencia da pendencia. Requisicoes sao apenas
    // contingencia, nunca podem impedir o clique visual.
    const visualResult = await applyMarkerByVisualFlow(row, checkbox);
    await closeMarkerModal(modal);

    let verified = await verifyMarkerPersisted(6000);
    let requestResult = null;
    if (!verified.ok && checkbox) {
      requestResult = await applyMarkerBySpaAjax(checkbox);
      if (!requestResult.ok) {
        requestResult = await applyMarkerByRequest(checkbox);
      }
      await closeMarkerModal(document.querySelector("#modal-marker, .modal.show, .modal"));
      verified = await verifyMarkerPersisted(7000);
    }

    if (!verified.ok) {
      return {
        ok: false,
        error: verified.error || "Marcador Conferido nao foi confirmado na pendencia.",
        markerId:
          (requestResult && requestResult.markerId) ||
          (visualResult && visualResult.markerId) ||
          "",
        method: requestResult && requestResult.method ? requestResult.method : visualResult && visualResult.method ? visualResult.method : "visual",
      };
    }

    return {
      ok: true,
      already: false,
      message: "Marcador Conferido aplicado e conferido na pendencia.",
      markerId:
        (requestResult && requestResult.markerId) ||
        (visualResult && visualResult.markerId) ||
        "",
      method: requestResult && requestResult.method ? requestResult.method : visualResult && visualResult.method ? visualResult.method : "visual",
      verifiedBy: verified.source,
    };
  }

  return run();
}

async function validateDuplicateRecords(message) {
  const records = Array.isArray(message && message.records) ? message.records : [];
  const delayMs = Number.isFinite(message && message.delayMs)
    ? Math.max(0, Math.min(2000, message.delayMs))
    : DEFAULT_DELAY_MS;
  const results = [];

  for (const record of records) {
    const pendencyUrl = normalizeAllowedUrl(record && record.pendencyUrl);
    if (!pendencyUrl) {
      results.push({
        ok: false,
        label: record && (record.expedienteId || record.processNumber) ? record.expedienteId || record.processNumber : "",
        error: "Registro sem URL de pendencia."
      });
      continue;
    }

    let tab = null;
    try {
      tab = await chrome.tabs.create({ url: pendencyUrl, active: false });
      await waitForTabComplete(tab.id, 20000);
      await sleep(800);

      const scriptResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: applyConferidoMarkerScript,
        args: ["Conferido"]
      });
      const result = scriptResults && scriptResults[0] ? scriptResults[0].result : null;
      results.push(Object.assign({
        ok: Boolean(result && result.ok),
        label: record && (record.expedienteId || record.processNumber) ? record.expedienteId || record.processNumber : pendencyUrl,
        url: pendencyUrl
      }, result || { error: "Sem retorno da pagina." }));
    } catch (error) {
      results.push({
        ok: false,
        label: record && (record.expedienteId || record.processNumber) ? record.expedienteId || record.processNumber : pendencyUrl,
        url: pendencyUrl,
        error: error && error.message ? error.message : String(error)
      });
    } finally {
      if (tab && tab.id) {
        // A validacao deve permanecer silenciosa para quem esta usando o
        // relatorio. O erro volta ao log da aba original, sem trocar de aba.
        await removeTabIfOpen(tab.id);
      }
    }

    if (delayMs) await sleep(delayMs);
  }

  return {
    ok: true,
    validated: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    results
  };
}

function cdspGeneralTabId(sender) {
  return sender && sender.tab && sender.tab.id ? sender.tab.id : null;
}

function cdspOficiosNormalizarUrlProcesso(rawUrl) {
  const allowed = normalizeAllowedUrl(rawUrl);
  if (!allowed) return "";

  try {
    const parsed = new URL(allowed);
    const match = parsed.pathname.match(/^\/procedures\/(\d+)(?:\/folder)?\/?$/i);
    if (!match) return "";
    return parsed.origin + "/procedures/" + match[1];
  } catch (_error) {
    return "";
  }
}

function cdspOficiosEnviarMensagemAba(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

async function cdspOficiosSolicitarExtracaoAba(tabId) {
  const startedAt = Date.now();
  let lastError = "";

  while (Date.now() - startedAt < CDSP_OFICIOS_REMOTE_EXTRACT_TIMEOUT_MS) {
    try {
      const response = await cdspOficiosEnviarMensagemAba(tabId, {
        type: "CDSP_OFICIOS_EXTRAIR_PROCESSO_ATUAL"
      });

      if (response && response.ok && response.pacote) return response;
      lastError = response && response.error ? response.error : "A aba do processo nao retornou dados.";
    } catch (error) {
      lastError = error && error.message ? error.message : String(error);
    }

    await sleep(500);
  }

  throw new Error(lastError || "Tempo excedido aguardando extracao do processo.");
}

async function cdspOficiosExtrairProcessoEmAba(message) {
  const url = cdspOficiosNormalizarUrlProcesso(message && message.url);
  if (!url) {
    return { ok: false, error: "URL do processo invalida ou fora do SPA." };
  }

  const tab = await chrome.tabs.create({ url, active: false });
  try {
    await waitForTabComplete(tab.id, CDSP_OFICIOS_REMOTE_EXTRACT_TIMEOUT_MS);
    await sleep(700);
    return await cdspOficiosSolicitarExtracaoAba(tab.id);
  } finally {
    if (tab && tab.id) {
      await chrome.tabs.remove(tab.id).catch(() => null);
    }
  }
}

async function cdspGeneralExecuteScript(injection) {
  const results = await chrome.scripting.executeScript(injection);
  // Firefox reports execution failures per frame instead of rejecting the call.
  const failed = (results || []).find((result) => result.error);
  if (failed) throw new Error(failed.error.message || String(failed.error));
  return results;
}

async function cdspGeneralMainWorldResult(tabId, func, args) {
  const results = await cdspGeneralExecuteScript({
    target: { tabId },
    world: "MAIN",
    func,
    args: args || []
  });
  return results && results[0] ? results[0].result : null;
}

async function ensureSharedReportLibraries(tabId) {
  const state =
    (await cdspGeneralMainWorldResult(tabId, () => {
      const excelReady = Boolean(window.ExcelJS);
      return { excelReady };
    })) || {};

  const files = [];
  if (!state.excelReady) files.push(CDSP_GENERAL_SHARED_REPORT_LIB_FILES[0]);

  if (!files.length) return;

  await cdspGeneralExecuteScript({
    target: { tabId },
    files,
    world: "MAIN"
  });
}

async function ensurePdfMergeLibrary(sender) {
  const tabId = cdspGeneralTabId(sender);
  if (!tabId) {
    return {
      ok: false,
      error: "Aba do SPA nao identificada para carregar a biblioteca de PDF."
    };
  }

  try {
    const state =
      (await cdspGeneralMainWorldResult(tabId, () => ({
        pdfLibReady: Boolean(window.PDFLib && window.PDFLib.PDFDocument)
      }))) || {};

    if (!state.pdfLibReady) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [CDSP_GENERAL_PDF_LIB_FILE],
        world: "MAIN"
      });
    }

    const loaded =
      (await cdspGeneralMainWorldResult(tabId, () => Boolean(window.PDFLib && window.PDFLib.PDFDocument))) || false;

    return loaded ? { ok: true, loaded: true } : { ok: false, error: "PDFLib nao ficou disponivel na pagina." };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : String(error)
    };
  }
}

function cdspGeneralTeamDatabaseDescriptor() {
  return {
    ok: true,
    xlsxUrl: chrome.runtime.getURL(CDSP_GENERAL_TEAM_DATABASE_FILE),
    fetchedAt: new Date().toISOString(),
    source: {
      file: CDSP_GENERAL_TEAM_DATABASE_FILE,
      mode: "base interna"
    }
  };
}

async function injectManagementPanel(sender) {
  const tabId = cdspGeneralTabId(sender);
  if (!tabId) {
    return {
      ok: false,
      error: "Aba do SPA nao identificada para injetar o painel gerencial."
    };
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (config) => {
        window.SPA_CDSP_MANAGEMENT_REPORT_CONFIG = config;
      },
      args: [
        {
          version: chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version,
          headerImageUrl: chrome.runtime.getURL("images/logo-mtprev.png"),
          iconImageUrl: chrome.runtime.getURL("images/icon-mtprev128.png"),
          teamDatabase: {
            file: CDSP_GENERAL_TEAM_DATABASE_FILE,
            mode: "base interna"
          }
        }
      ]
    });

    await ensureSharedReportLibraries(tabId);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CDSP_GENERAL_MANAGEMENT_PANEL_FILE],
      world: "MAIN"
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : String(error)
    };
  }
}

async function injectDeadlinePanel(sender) {
  const tabId = cdspGeneralTabId(sender);
  if (!tabId) {
    return {
      ok: false,
      error: "Aba do SPA nao identificada para injetar o painel de prazos."
    };
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: (config) => {
        window.SPA_CDSP_DEADLINE_REPORT_CONFIG = config;
      },
      args: [
        {
          version: chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version,
          headerImageUrl: chrome.runtime.getURL("images/logo-mtprev.png")
        }
      ]
    });

    await ensureSharedReportLibraries(tabId);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [CDSP_GENERAL_ACTIVE_TEAM_DATABASE_FILE, CDSP_GENERAL_DEADLINE_PANEL_FILE],
      world: "MAIN"
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : String(error)
    };
  }
}

async function executarAcaoSigadocNoContextoPrincipal(sender, action, payload) {
  const tabId = sender && sender.tab && sender.tab.id;
  const url = String((sender && sender.url) || (sender && sender.tab && sender.tab.url) || '');
  if (!tabId || !/^https:\/\/(?:www\.)?sigadoc\.mt\.gov\.br\//i.test(url)) {
    throw new Error('Ação do SIGADOC recebida fora de uma aba autorizada.');
  }

  const result = await executeMainWorld(
    tabId,
    (requestedAction, data) => {
      const emit = (element, type) => element && element.dispatchEvent(new Event(type, { bubbles: true }));
      const field = (id, name) => document.getElementById(id) || document.getElementsByName(name || '')[0];
      const safe = (callback) => {
        try { callback(); } catch (_error) { /* O SIGADOC pode omitir callbacks em algumas telas. */ }
      };

      if (requestedAction === 'selecionar-modelo') {
        const value = String(data && data.value || '');
        const item = document.querySelector(`#ulmod .dropdown-item[data-value="${CSS.escape(value)}"]`);
        const hidden = document.getElementsByName('exDocumentoDTO.idMod')[0];
        const label = document.querySelector('#modelos-select .selected-label');
        if (item) {
          ['mousedown', 'mouseup', 'click'].forEach((type) => item.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true })));
          const link = item.querySelector('a');
          if (link) link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          const text = item.querySelector('a')?.childNodes?.[0]?.textContent || item.textContent || '';
          if (label && text) label.textContent = text.trim();
        }
        if (hidden) {
          hidden.value = value;
          emit(hidden, 'input');
          emit(hidden, 'change');
        }
        safe(() => alterouModeloSelect());
        safe(() => window.jQuery && hidden && window.jQuery(hidden).val(value).trigger('input').trigger('change'));
        return { ok: Boolean(item || hidden) };
      }

      if (requestedAction === 'selecionar-texto-padrao') {
        const value = String(data && data.value || '');
        const select = document.getElementById('preenchimento');
        if (!select) return { ok: false };
        for (let index = 0; index < select.options.length; index += 1) {
          const selected = select.options[index].value === value;
          select.options[index].selected = selected;
          if (selected) select.selectedIndex = index;
        }
        select.value = value;
        emit(select, 'input');
        const changeEvent = new Event('change', { bubbles: true });
        select.dispatchEvent(changeEvent);
        safe(() => select.onchange && select.onchange.call(select, changeEvent));
        safe(() => window.jQuery && window.jQuery(select).val(value).trigger('input').trigger('change').trigger('change.select2').trigger('chosen:updated'));
        safe(() => carregaPreench());
        return { ok: true };
      }

      if (requestedAction === 'confirmar-destinatario') {
        const destination = String(data && data.sigla || '');
        const input = field('formulario_exDocumentoDTO.lotacaoDestinatarioSel_sigla', 'exDocumentoDTO.lotacaoDestinatarioSel.sigla');
        if (!input) return { ok: false };
        input.value = destination;
        emit(input, 'input');
        emit(input, 'change');
        safe(() => handleEnter(input, { type: 'keypress', keyCode: 13, which: 13, preventDefault() {}, stopPropagation() {} }));
        safe(() => ajax_lotacaoDestinatario());
        return { ok: true };
      }

      if (requestedAction === 'confirmar-classificacao') {
        const classification = data && data.classificacao || {};
        const input = field('formulario_exDocumentoDTO.classificacaoSel_sigla', 'exDocumentoDTO.classificacaoSel.sigla');
        if (!input) return { ok: false };
        input.value = String(classification.codigo || '');
        emit(input, 'input');
        emit(input, 'change');
        if (!data.usarRetornoDireto && typeof ajax_classificacao === 'function') {
          ajax_classificacao();
        } else {
          safe(() => retorna_classificacao(classification.id, classification.codigo, classification.descricao));
        }
        return { ok: true };
      }

      if (requestedAction === 'validar-arquivo-pdf') {
        const input = document.getElementById(String(data && data.inputId || 'arquivo'));
        safe(() => input && typeof testpdf === 'function' && testpdf(input.form, 26214400));
        return { ok: Boolean(input) };
      }

      if (requestedAction === 'confirmar-responsavel-tramitacao') {
        const destination = String(data && data.sigla || '');
        const input = field('formulario_lotaResponsavelSel_sigla', 'lotaResponsavelSel.sigla');
        if (!input) return { ok: false };
        input.value = destination;
        emit(input, 'input');
        emit(input, 'change');
        safe(() => handleEnter(input, { type: 'keypress', keyCode: 13, which: 13, preventDefault() {}, stopPropagation() {} }));
        safe(() => ajax_lotaResponsavel());
        return { ok: true };
      }

      if (requestedAction === 'repetir-responsavel-tramitacao') {
        safe(() => ajax_lotaResponsavel());
        return { ok: true };
      }

      throw new Error('Ação do SIGADOC não reconhecida.');
    },
    [action, payload || {}]
  );
  return result || { ok: false };
}

async function insertSimpleClosureIntoGoogleDoc(payload) {
  if (location.hostname !== "docs.google.com") return { skipped: true };

  const text = payload && payload.plain ? String(payload.plain) : "";
  const html = payload && payload.html ? String(payload.html) : "";
  const placeholder = String((payload && payload.placeholder) || "INSERIR O TEXTO DO SIMPLES ENCERRAMENTO");
  if (!text || !placeholder) return { ok: false, error: "Texto ou marcador da minuta ausente." };

  const editor = document.querySelector(".kix-appview-editor");
  const inputFrame = document.querySelector("iframe.docs-texteventtarget-iframe");
  let inputTarget = null;
  try {
    const inputDocument = inputFrame && inputFrame.contentDocument;
    inputTarget = inputDocument && (inputDocument.querySelector("textarea") || inputDocument.body);
  } catch (_error) {
    inputTarget = null;
  }

  if (!editor || !inputTarget || typeof window.find !== "function") {
    return { ok: false, error: "Editor do Google Docs ainda nao esta pronto." };
  }

  try {
    editor.focus({ preventScroll: true });
  } catch (_error) {
    // O editor continua utilizavel mesmo quando nao aceita foco programatico.
  }

  const found = window.find(placeholder, false, false, true, false, false, false);
  if (!found) return { ok: false, error: "Marcador do Simples Encerramento nao encontrado na minuta." };

  try {
    inputTarget.focus({ preventScroll: true });
  } catch (_error) {
    // O iframe de eventos pode apenas aceitar o foco padrao.
  }

  let handledPaste = false;
  try {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", text);
    if (html) transfer.setData("text/html", html);
    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: transfer
    });
    handledPaste = !inputTarget.dispatchEvent(pasteEvent);
  } catch (_error) {
    handledPaste = false;
  }

  if (!handledPaste) {
    try {
      document.execCommand("insertText", false, text);
    } catch (_error) {
      return { ok: false, error: "O Google Docs recusou a insercao automatica do texto." };
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 700));
  const placeholderStillExists = window.find(placeholder, false, false, true, false, false, false);
  if (placeholderStillExists) {
    return {
      ok: false,
      attempted: true,
      error: "O Google Docs nao confirmou a substituicao do marcador na minuta."
    };
  }

  return {
    ok: true,
    inserted: true,
    method: handledPaste ? "paste" : "insertText"
  };
}

function classifyInitialPetitionText(text) {
  const normalized = normalizeSearchText(text || "");
  const attachmentMarker = /\bpeticao\s+inicial\s+em\s+anexo\b/.test(normalized);
  const initialMarker = /\bpeticao\s+inicial\b/.test(normalized);
  const substantiveMarkers = [
    /\bexcelentissim[oa]\b/,
    /\bautor(?:a|es)?\b/,
    /\breu(?:s)?\b/,
    /\bdos\s+fatos\b/,
    /\bdos\s+pedidos\b/,
    /\bvem\s+(?:respeitosamente|a\s+presenca)\b/,
    /\bacao\s+(?:de|em)\b/,
  ].reduce((total, matcher) => total + Number(matcher.test(normalized)), 0);
  const initialScore =
    Number(initialMarker) * 4 +
    substantiveMarkers * 2 +
    Number(normalized.length >= 900) +
    Number(normalized.length >= 1800);
  const attachmentOnly = attachmentMarker && substantiveMarkers < 2;
  const isInitialPetition =
    !attachmentOnly &&
    ((initialMarker && substantiveMarkers >= 2) || (!attachmentMarker && substantiveMarkers >= 4 && normalized.length >= 700));

  return {
    isInitialPetition,
    attachmentOnly,
    initialScore,
    substantiveMarkers,
    textLength: normalized.length,
  };
}

async function inspectInitialPetitionDocument(message) {
  const record = message && message.record ? message.record : {};
  const viewerUrl = normalizeAllowedUrl(record.url);
  const pdfUrl = normalizePdfDownloadUrl(record.url);
  if (!viewerUrl || !pdfUrl) {
    return {
      ok: false,
      isInitialPetition: false,
      inconclusive: true,
      record,
      error: "URL do documento fora do dominio permitido do SPA.",
    };
  }

  const cached = initialPetitionInspectionCache.get(pdfUrl);
  if (cached) {
    return Object.assign({}, cached, { record: Object.assign({}, record, { url: viewerUrl }), fromCache: true });
  }

  try {
    const downloaded = await fetchExpedienteText(pdfUrl);
    const classified = classifyInitialPetitionText(downloaded && downloaded.text ? downloaded.text : "");
    const result = {
      ok: true,
      isInitialPetition: classified.isInitialPetition,
      attachmentOnly: classified.attachmentOnly,
      initialScore: classified.initialScore,
      substantiveMarkers: classified.substantiveMarkers,
      textLength: classified.textLength,
      byteLength: downloaded && downloaded.byteLength ? downloaded.byteLength : 0,
      inconclusive: classified.textLength <= 0,
      fromCache: false,
      diagnostics: {
        pdfUrl,
        offscreenError: downloaded && downloaded.offscreenError ? downloaded.offscreenError : "",
        pdfJsError: downloaded && downloaded.pdfJsError ? downloaded.pdfJsError : "",
        rawError: downloaded && downloaded.rawError ? downloaded.rawError : "",
      },
    };
    initialPetitionInspectionCache.set(pdfUrl, result);
    while (initialPetitionInspectionCache.size > AUTOS_SEARCH_CACHE_MAX) {
      initialPetitionInspectionCache.delete(initialPetitionInspectionCache.keys().next().value);
    }
    return Object.assign({}, result, { record: Object.assign({}, record, { url: viewerUrl }) });
  } catch (error) {
    return {
      ok: false,
      isInitialPetition: false,
      inconclusive: true,
      record: Object.assign({}, record, { url: viewerUrl }),
      error: error && error.message ? error.message : String(error),
    };
  }
}

async function insertSimpleClosureIntoCurrentDocument(sender, payload) {
  const tabId = cdspGeneralTabId(sender);
  if (!tabId) return { ok: false, error: "Aba do SPA nao identificada." };

  const permissions = { origins: [SIMPLE_CLOSURE_GOOGLE_DOCS_ORIGIN] };
  if (!(await chrome.permissions.contains(permissions))) {
    return { ok: false, error: "A permissao do Google Docs nao esta ativa. Recarregue a extensao e aceite a atualizacao." };
  }

  let lastError = "Editor do Google Docs nao encontrado.";
  for (let attempt = 0; attempt < 18; attempt += 1) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: insertSimpleClosureIntoGoogleDoc,
        args: [Object.assign({}, payload || {}, { placeholder: SIMPLE_CLOSURE_PLACEHOLDER })]
      });
      const result = (results || []).map((item) => item.result).find((item) => item && !item.skipped);
      if (result && result.ok) return result;
      if (result && result.error) lastError = result.error;
      if (result && result.attempted) return result;
    } catch (error) {
      lastError = error && error.message ? error.message : String(error);
    }
    await sleep(700);
  }

  return { ok: false, error: lastError };
}

async function injectPanel(sender) {
  const tabId = sender && sender.tab ? sender.tab.id : null;
  if (!tabId) {
    return {
      ok: false,
      error: "Aba do SPA nao identificada para injetar o painel."
    };
  }

  try {
    const alreadyLoaded = await cdspGeneralMainWorldResult(tabId, () =>
      Boolean(window.SPA_CDSP_EXTENSION_PANEL_INITIALIZED && document.getElementById("spa-cdsp-panel"))
    );
    if (alreadyLoaded) return { ok: true, alreadyLoaded: true };

    await cdspGeneralExecuteScript({
      target: { tabId },
      world: "MAIN",
      func: (config) => {
        window.SPA_CDSP_TRIAGEM_CONFIG = config;
      },
      args: [
        {
          version: chrome.runtime.getManifest().version_name || chrome.runtime.getManifest().version,
          headerImageUrl: chrome.runtime.getURL("images/logo-mtprev.png")
        }
      ]
    });

    await ensureSharedReportLibraries(tabId);
    await cdspGeneralExecuteScript({
      target: { tabId },
      files: [CDSP_GENERAL_ACTIVE_TEAM_DATABASE_FILE, "js/shared/mtprev_triage_rules.js", "js/triagem/mtprev_pop_panel.js", CDSP_GENERAL_TRIAGEM_PANEL_FILE],
      world: "MAIN"
    });

    const ready = await cdspGeneralMainWorldResult(tabId, () =>
      Boolean(window.SPA_CDSP_EXTENSION_PANEL_INITIALIZED && document.querySelector("#spa-cdsp-panel .mtprev-context-nav > button"))
    );
    if (!ready) throw new Error("O painel de Triagem nao terminou de carregar. Recarregue a aba e tente novamente.");

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : String(error)
    };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return false;

  if (message.type === "SPA_CDSP_SIMPLE_CLOSURE_INSERT_DOCUMENT") {
    insertSimpleClosureIntoCurrentDocument(_sender, message.payload)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ ok: false, error: error && error.message ? error.message : String(error) });
      });

    return true;
  }

  if (message.type === "CDSP_OFICIOS_EXTRACT_PROCESS_TAB") {
    cdspOficiosExtrairProcessoEmAba(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "CDSP_SIGADOC_PAGE_ACTION") {
    executarAcaoSigadocNoContextoPrincipal(_sender, message.action, message.payload)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ ok: false, error: error && error.message ? error.message : String(error) });
      });

    return true;
  }

  if (
    message.type === "cdspOficioSalvarPdf" ||
    message.type === "cdspOficioObterPdf" ||
    message.type === "cdspOficioApagarPdf" ||
    message.type === "cdspOficioBaixarArquivo"
  ) {
    cdspOficiosHandleMessage(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "CDSP_GENERAL_INJECT_TRIAGEM") {
    injectPanel(_sender)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "CDSP_GENERAL_INJECT_GESTAO") {
    injectManagementPanel(_sender)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "CDSP_GENERAL_INJECT_PRAZOS") {
    injectDeadlinePanel(_sender)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "SPA_CDSP_ENSURE_PDF_LIB") {
    ensurePdfMergeLibrary(_sender)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "SPA_CDSP_MANAGEMENT_FETCH_TEAM_DB") {
    sendResponse(cdspGeneralTeamDatabaseDescriptor());
    return false;
  }

  if (message.type === "SPA_CDSP_SCHEDULE_GET") {
    getRoutineConfig()
      .then(async (config) => {
        const protocolPassword = await getProtocolPassword();
        sendResponse({ ok: true, config, protocolPasswordSet: Boolean(protocolPassword) });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "SPA_CDSP_SCHEDULE_SAVE") {
    saveRoutineFromMessage(message, _sender)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "SPA_CDSP_SCHEDULE_RUN_NOW") {
    const config = normalizeRoutineConfig(message.config || {}, _sender);
    if (!config.steps.length) {
      sendResponse({ ok: false, error: "Nenhum passo programado." });
      return false;
    }
    if (scheduledRoutineRunning) {
      sendResponse({ ok: false, error: "Rotina programada ja esta em execucao." });
      return false;
    }
    setTimeout(() => {
      runScheduledRoutine("manual", config).catch(() => null);
    }, 0);
    sendResponse({ ok: true, started: true });
    return false;
  }

  if (message.type === "SPA_CDSP_SCHEDULE_PASSWORD_SET") {
    setProtocolPassword(message.password || "")
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "SPA_CDSP_INJECT_PANEL") {
    injectPanel(_sender)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "SPA_CDSP_OPEN_FILTERED_EXPEDIENTE_TABS") {
    openFilteredExpedienteTabs(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          opened: 0,
          kept: 0,
          closed: 0,
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "SPA_CDSP_CLASSIFY_PIECE_RECORDS") {
    classifyPieceRecords(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          results: [],
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "SPA_CDSP_FINGERPRINT_EXPEDIENTES") {
    fingerprintDuplicateReportExpedientes(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          results: [],
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "SPA_CDSP_VALIDATE_DUPLICATE_RECORDS") {
    validateDuplicateRecords(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          validated: 0,
          failed: 0,
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "SPA_CDSP_SEARCH_AUTOS_DOCUMENT") {
    searchAutosDocumentContent(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          found: false,
          record: message.record || null,
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "SPA_CDSP_INSPECT_INITIAL_PETITION_DOCUMENT") {
    inspectInitialPetitionDocument(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          isInitialPetition: false,
          inconclusive: true,
          record: message.record || null,
          error: error && error.message ? error.message : String(error),
        });
      });

    return true;
  }

  if (message.type === "SPA_CDSP_FETCH_PROCEDURE_MOVEMENTS") {
    fetchMniProcedureMovements(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          movements: [],
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "SPA_CDSP_OPEN_PIECE_REPORT_RECORD") {
    openPieceReportRecord(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          opened: 0,
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type !== "SPA_CDSP_OPEN_BACKGROUND_TABS") return false;

  openBackgroundTabs(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        opened: 0,
        error: error && error.message ? error.message : String(error)
      });
    });

  return true;
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "CDSP_GENERAL_TOGGLE_MENU" }, () => {
    void chrome.runtime.lastError;
  });
});

if (typeof importScripts === "function") {
  importScripts("process_watch_background.js");
}
