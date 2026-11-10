(function () {
"use strict";

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

function normalizeSearchText(text) {
  return String(text || "")
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

function buildSearchSnippet(text, query, exact) {
  const normalized = normalizeSearchText(text);
  const terms = parseSearchTerms(query, exact);
  if (!normalized || !terms.length) return "";

  for (const term of terms) {
    const normalizedQuery = normalizeSearchText(term);
    if (!normalizedQuery) continue;

    let index = normalized.indexOf(normalizedQuery);
    if (index < 0 && !exact) {
      const compactQuery = compactSearchText(term);
      if (compactQuery.length >= 4) {
        const firstToken = normalizeSearchText(term).split(/\s+/).filter(Boolean)[0] || "";
        index = firstToken ? normalized.indexOf(firstToken) : -1;
      }
    }

    if (index < 0) continue;

    return normalized
      .slice(Math.max(0, index - 180), Math.min(normalized.length, index + normalizedQuery.length + 260))
      .trim();
  }

  return "";
}

function pageTextMatchesQuery(text, query, exact) {
  return Boolean(findMatchingSearchTerm(text, query, exact));
}

function base64ToBytes(value) {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function normalizePdfInput(input) {
  if (typeof input === "string") return base64ToBytes(input);
  if (Array.isArray(input)) return new Uint8Array(input);
  return new Uint8Array(input || []);
}

async function extractPdfText(input) {
  if (!globalThis.pdfjsLib || typeof globalThis.pdfjsLib.getDocument !== "function") {
    throw new Error("PDF.js nao carregado no leitor interno.");
  }

  if (globalThis.pdfjsLib.GlobalWorkerOptions) {
    globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("js/vendor/pdf.worker.min.js");
  }

  const data = normalizePdfInput(input);
  if (!data.byteLength) {
    throw new Error("PDF chegou vazio ao leitor interno.");
  }

  const loadingTask = globalThis.pdfjsLib.getDocument({
    data,
    disableWorker: false,
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

async function pdfPageHasLargeImage(page) {
  const ops = globalThis.pdfjsLib?.OPS;
  if (!ops || !page.getOperatorList || !page.view) return false;
  const area = Math.abs((page.view[2] - page.view[0]) * (page.view[3] - page.view[1]));
  if (!area) return false;
  const list = await page.getOperatorList();
  const stack = [];
  let matrix = [1, 0, 0, 1, 0, 0];
  const multiply = (a, b) => [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
  for (let index = 0; index < list.fnArray.length; index++) {
    const op = list.fnArray[index], args = list.argsArray[index];
    if (op === ops.save) stack.push([...matrix]);
    else if (op === ops.restore || op === ops.paintFormXObjectEnd) matrix = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (op === ops.transform) matrix = multiply(matrix, args);
    else if (op === ops.paintFormXObjectBegin) {
      stack.push([...matrix]);
      if (args[0]) matrix = multiply(matrix, args[0]);
    } else if ([ops.paintImageXObject, ops.paintInlineImageXObject, ops.paintImageXObjectRepeat].includes(op) &&
      Math.abs(matrix[0]*matrix[3]-matrix[1]*matrix[2]) > area * 0.35) return true;
  }
  return false;
}

async function searchPdfText(input, query, exact) {
  if (!globalThis.pdfjsLib || typeof globalThis.pdfjsLib.getDocument !== "function") {
    throw new Error("PDF.js nao carregado no leitor interno.");
  }

  if (globalThis.pdfjsLib.GlobalWorkerOptions) {
    globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("js/vendor/pdf.worker.min.js");
  }

  const data = normalizePdfInput(input);
  if (!data.byteLength) {
    throw new Error("PDF chegou vazio ao leitor interno.");
  }

  const loadingTask = globalThis.pdfjsLib.getDocument({
    data,
    disableWorker: false,
    isEvalSupported: false,
    useSystemFonts: true,
    useWorkerFetch: false
  });

  const pdf = await loadingTask.promise;
  let pagesRead = 0;
  let scannedLength = 0;
  let incompletePages = 0;
  const pageLimit = Math.min(pdf.numPages, 600);

  try {
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent({
        normalizeWhitespace: true,
        disableCombineTextItems: false
      });
      const pageText = combinePdfTextItems(content.items);
      pagesRead += 1;
      scannedLength += normalizeSearchText(pageText).length;

      // Uma capa com texto não torna pesquisável o restante digitalizado do PDF.
      let incomplete = !pageText.trim();
      try { incomplete = incomplete || await pdfPageHasLargeImage(page); }
      catch (_) { incomplete = true; }
      if (incomplete) incompletePages += 1;

      if (typeof page.cleanup === "function") {
        page.cleanup();
      }

      const matchedQuery = findMatchingSearchTerm(pageText, query, exact);
      if (matchedQuery) {
        return {
          found: true,
          snippet: buildSearchSnippet(pageText, matchedQuery, exact),
          matchedQuery,
          page: pageNumber,
          incompletePages,
          textLength: scannedLength,
          pagesRead,
          totalPages: pdf.numPages
        };
      }
    }
  } finally {
    if (typeof pdf.destroy === "function") {
      await pdf.destroy();
    }
  }

  return {
    found: false,
    inconclusive: incompletePages > 0 || pagesRead < pdf.numPages || scannedLength === 0,
    incompletePages,
    snippet: "",
    matchedQuery: "",
    textLength: scannedLength,
    pagesRead,
    totalPages: pdf.numPages
  };
}

// Also used directly by Firefox's background document, which has no offscreen API.
globalThis.MTPrevPdfReader = { extractPdfText, searchPdfText };

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return false;

  if (message.type === "SPA_CDSP_OFFSCREEN_SEARCH_PDF_TEXT") {
    searchPdfText(message.base64 || message.bytes || message.buffer, message.query || "", message.exact === true)
      .then((result) => {
        sendResponse(Object.assign({ ok: true, requestId: message.requestId || "" }, result));
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          requestId: message.requestId || "",
          error: error && error.message ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type !== "SPA_CDSP_OFFSCREEN_EXTRACT_PDF_TEXT") return false;

  extractPdfText(message.base64 || message.bytes || message.buffer)
    .then((text) => {
      sendResponse({
        ok: true,
        requestId: message.requestId || "",
        text
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        requestId: message.requestId || "",
        error: error && error.message ? error.message : String(error)
      });
    });

  return true;
});
})();
