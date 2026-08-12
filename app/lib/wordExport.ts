/**
 * Utilitario para exportar contenido Markdown directamente a documentos de Microsoft Word (.doc / .docx)
 * con diseño profesional, tipografía médica, tablas, encabezados y formato compatible con Microsoft Office,
 * Google Docs y LibreOffice.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMarkdownToHtml(text: string): string {
  return text
    // Negrita + Cursiva
    .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
    // Negrita
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Cursiva
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    // Código inline
    .replace(/`([^`]+)`/g, "<code style='background-color: #f3f4f6; padding: 2px 5px; font-family: Consolas, monospace; font-size: 10pt; border-radius: 3px;'>$1</code>");
}

export function markdownToWordHtml(markdown: string, documentTitle = "Documento Médico MANOLIA"): string {
  const lines = markdown.split("\n");
  const htmlParts: string[] = [];

  let inList: "ul" | "ol" | null = null;
  let inTable = false;
  let inBlockquote = false;
  let blockquoteContent: string[] = [];

  const closeList = () => {
    if (inList) {
      htmlParts.push(`</${inList}>`);
      inList = null;
    }
  };

  const closeBlockquote = () => {
    if (inBlockquote) {
      htmlParts.push(`<blockquote>${blockquoteContent.join("<br/>")}</blockquote>`);
      blockquoteContent = [];
      inBlockquote = false;
    }
  };

  const closeTable = () => {
    if (inTable) {
      htmlParts.push("</tbody></table>");
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Líneas vacías
    if (!line) {
      closeList();
      closeBlockquote();
      closeTable();
      continue;
    }

    // Encabezados (# H1, ## H2, ### H3, #### H4)
    if (line.startsWith("# ")) {
      closeList();
      closeBlockquote();
      closeTable();
      htmlParts.push(`<h1>${inlineMarkdownToHtml(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("## ")) {
      closeList();
      closeBlockquote();
      closeTable();
      htmlParts.push(`<h2>${inlineMarkdownToHtml(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("### ")) {
      closeList();
      closeBlockquote();
      closeTable();
      htmlParts.push(`<h3>${inlineMarkdownToHtml(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("#### ")) {
      closeList();
      closeBlockquote();
      closeTable();
      htmlParts.push(`<h4>${inlineMarkdownToHtml(line.slice(5))}</h4>`);
      continue;
    }

    // Separador horizontal
    if (line === "---" || line === "***" || line === "___") {
      closeList();
      closeBlockquote();
      closeTable();
      htmlParts.push("<hr/>");
      continue;
    }

    // Citas (Blockquotes)
    if (line.startsWith("> ")) {
      closeList();
      closeTable();
      inBlockquote = true;
      blockquoteContent.push(inlineMarkdownToHtml(line.slice(2)));
      continue;
    } else if (inBlockquote) {
      closeBlockquote();
    }

    // Tablas Markdown (| col1 | col2 |)
    if (line.startsWith("|") && line.endsWith("|")) {
      closeList();
      closeBlockquote();

      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());

      // Verificar si es la fila divisoria (| --- | --- |)
      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        htmlParts.push("<table><thead><tr>");
        cells.forEach((c) => {
          htmlParts.push(`<th>${inlineMarkdownToHtml(c)}</th>`);
        });
        htmlParts.push("</tr></thead><tbody>");
      } else {
        htmlParts.push("<tr>");
        cells.forEach((c) => {
          htmlParts.push(`<td>${inlineMarkdownToHtml(c)}</td>`);
        });
        htmlParts.push("</tr>");
      }
      continue;
    } else if (inTable) {
      closeTable();
    }

    // Listas no ordenadas (- o *)
    if (/^[-*]\s+/.test(line)) {
      closeBlockquote();
      closeTable();
      if (inList !== "ul") {
        closeList();
        inList = "ul";
        htmlParts.push("<ul>");
      }
      const itemContent = line.replace(/^[-*]\s+/, "");
      htmlParts.push(`<li>${inlineMarkdownToHtml(itemContent)}</li>`);
      continue;
    }

    // Listas numeradas (1., 2., etc.)
    if (/^\d+\.\s+/.test(line)) {
      closeBlockquote();
      closeTable();
      if (inList !== "ol") {
        closeList();
        inList = "ol";
        htmlParts.push("<ol>");
      }
      const itemContent = line.replace(/^\d+\.\s+/, "");
      htmlParts.push(`<li>${inlineMarkdownToHtml(itemContent)}</li>`);
      continue;
    }

    // Si es texto normal, cerrar listas y agregar párrafo
    closeList();
    closeBlockquote();
    closeTable();
    htmlParts.push(`<p>${inlineMarkdownToHtml(line)}</p>`);
  }

  closeList();
  closeBlockquote();
  closeTable();

  const now = new Date();
  const dateFormatted = now.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${escapeHtml(documentTitle)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: 8.5in 11.0in;
      margin: 1.0in 1.0in 1.0in 1.0in;
      mso-header-margin: .5in;
      mso-footer-margin: .5in;
      mso-paper-source: 0;
    }
    div.Section1 { page: Section1; }
    body {
      font-family: 'Calibri', 'Segoe UI', 'Arial', sans-serif;
      font-size: 11pt;
      line-height: 1.55;
      color: #1f2937;
      background-color: #ffffff;
    }
    .doc-header {
      border-bottom: 2pt solid #9333ea;
      padding-bottom: 10pt;
      margin-bottom: 20pt;
    }
    .doc-badge {
      font-size: 9pt;
      font-weight: bold;
      color: #7e22ce;
      text-transform: uppercase;
      letter-spacing: 1.5pt;
    }
    .doc-title {
      font-size: 20pt;
      color: #581c87;
      font-weight: bold;
      margin-top: 4pt;
      margin-bottom: 2pt;
    }
    .doc-meta {
      font-size: 9.5pt;
      color: #6b7280;
    }
    h1 {
      font-size: 16pt;
      color: #6b21a8;
      font-weight: bold;
      margin-top: 18pt;
      margin-bottom: 6pt;
      border-bottom: 1pt solid #e9d5ff;
      padding-bottom: 3pt;
    }
    h2 {
      font-size: 13.5pt;
      color: #7e22ce;
      font-weight: bold;
      margin-top: 14pt;
      margin-bottom: 4pt;
    }
    h3 {
      font-size: 12pt;
      color: #9333ea;
      font-weight: bold;
      margin-top: 10pt;
      margin-bottom: 3pt;
    }
    h4 {
      font-size: 11pt;
      color: #374151;
      font-weight: bold;
      margin-top: 8pt;
      margin-bottom: 2pt;
    }
    p {
      margin-top: 0pt;
      margin-bottom: 6.5pt;
      text-align: justify;
    }
    ul, ol {
      margin-top: 2pt;
      margin-bottom: 8pt;
      padding-left: 20pt;
    }
    li {
      margin-bottom: 3.5pt;
    }
    strong {
      color: #111827;
      font-weight: 600;
    }
    hr {
      border: 0;
      border-top: 1pt solid #e5e7eb;
      margin: 16pt 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin-top: 10pt;
      margin-bottom: 12pt;
    }
    th {
      background-color: #f3e8ff;
      color: #581c87;
      font-weight: bold;
      border: 1pt solid #d8b4fe;
      padding: 6pt 8pt;
      text-align: left;
      font-size: 10.5pt;
    }
    td {
      border: 1pt solid #e9d5ff;
      padding: 5.5pt 8pt;
      font-size: 10.5pt;
    }
    blockquote {
      border-left: 3.5pt solid #9333ea;
      background-color: #faf5ff;
      padding: 8pt 12pt;
      margin: 10pt 0;
      color: #4b5563;
      font-style: italic;
    }
    .doc-footer {
      margin-top: 30pt;
      padding-top: 8pt;
      border-top: 1pt solid #e5e7eb;
      font-size: 9pt;
      color: #9ca3af;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="Section1">
    <div class="doc-header">
      <div class="doc-badge">MANOLIA • Tutor Médico Virtual</div>
      <div class="doc-title">${escapeHtml(documentTitle)}</div>
      <div class="doc-meta">Generado el ${dateFormatted} • Documento de estudio médico</div>
    </div>

    <div class="doc-content">
      ${htmlParts.join("\n")}
    </div>

    <div class="doc-footer">
      Documento generado automáticamente por <strong>MANOLIA AI</strong> • Material de apoyo para estudiantes universitarios de medicina.
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Descarga una cadena en Markdown como un archivo de Word (.docx / .doc)
 */
export function downloadAsWordDocument(markdown: string, filename = "documento_medico.doc", documentTitle = "Reporte Médico MANOLIA") {
  const wordHtml = markdownToWordHtml(markdown, documentTitle);
  const blob = new Blob(["\ufeff", wordHtml], {
    type: "application/msword;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;

  const cleanFilename = filename.endsWith(".doc") || filename.endsWith(".docx")
    ? filename
    : `${filename}.doc`;

  downloadLink.download = cleanFilename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
}
