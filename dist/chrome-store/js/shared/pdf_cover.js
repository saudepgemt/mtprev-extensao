(function () {
  "use strict";

  // Adaptação da ideia de capa do pacote CDSP SPA2 para o visual e os autos MTPrev.
  // O chamador fornece um retrato dos dados antes de qualquer leitura assíncrona.
  async function prepend(pdf, fields, lib = globalThis.PDFLib) {
    const regular = await pdf.embedFont(lib.StandardFonts.Helvetica);
    const bold = await pdf.embedFont(lib.StandardFonts.HelveticaBold);
    const ink = lib.rgb(0.07, 0.15, 0.22);
    const teal = lib.rgb(0.06, 0.42, 0.43);
    const muted = lib.rgb(0.34, 0.40, 0.45);
    const clean = (value) => Array.from(String(value || "").normalize("NFC")
      .replace(/[\u0000-\u001f\u007f\s]+/g, " ").trim()).map((char) => {
      try { regular.encodeText(char); return char; } catch (_) { return "?"; }
    }).join("");
    const wrap = (text, font, size, width) => {
      const lines = [];
      let line = "";
      for (const word of text.split(" ")) {
        const next = line ? line + " " + word : word;
        if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
        if (line) lines.push(line);
        line = "";
        for (const char of word) {
          if (line && font.widthOfTextAtSize(line + char, size) > width) {
            lines.push(line); line = "";
          }
          line += char;
        }
      }
      if (line) lines.push(line);
      return lines;
    };
    const rows = (Array.isArray(fields) ? fields : []).map((field) => ({
      label: clean(field?.label), value: clean(field?.value)
    })).filter((field) => field.label && field.value);
    if (!rows.length) throw new Error("Não há dados do processo para gerar a capa.");
    if (rows.reduce((length, field) => length + field.label.length + field.value.length, 0) > 30000) {
      throw new Error("Os dados excedem o limite da capa. Confira os campos do processo.");
    }
    let page, y, coverPages = 0;
    const newPage = () => {
      page = pdf.insertPage(coverPages++, lib.PageSizes.A4);
      const { width, height } = page.getSize();
      page.drawRectangle({ x: 0, y: height - 100, width, height: 100, color: ink });
      page.drawText("MTPrev", { x: 42, y: height - 48, size: 25, font: bold, color: lib.rgb(1, 1, 1) });
      page.drawText("Documentos do processo" + (coverPages > 1 ? " · continuação" : ""), {
        x: 42, y: height - 73, size: 12, font: regular, color: lib.rgb(0.77, 0.89, 0.91)
      });
      page.drawText("Cópia de consulta · " + new Date().toLocaleDateString("pt-BR"), {
        x: 42, y: height - 124, size: 10, font: regular, color: muted
      });
      const note = "Capa gerada pela extensão MTPrev. Para conferir assinaturas digitais, consulte os documentos originais no sistema de origem.";
      wrap(note, regular, 9, width - 84).forEach((line, index) => {
        page.drawText(line, { x: 42, y: 44 - index * 12, size: 9, font: regular, color: muted });
      });
      y = height - 157;
    };
    newPage();
    for (const field of rows) {
      const width = page.getWidth() - 84;
      const labelLines = wrap(field.label, bold, 10, width);
      const valueLines = wrap(field.value, regular, 11, width);
      if (y < 90 + (labelLines.length + 1) * 15) newPage();
      for (const line of labelLines) {
        if (y < 80) newPage();
        page.drawText(line, { x: 42, y, size: 10, font: bold, color: teal });
        y -= 15;
      }
      for (const line of valueLines) {
        if (y < 80) newPage();
        page.drawText(line, { x: 42, y, size: 11, font: regular, color: ink });
        y -= 15;
      }
      y -= 12;
    }
    return coverPages;
  }

  globalThis.MTPrevPdfCover = { prepend };
})();
