"use client";
import { useState, useRef, useEffect } from "react";
import { Sparkles, Copy, Check, FileUp, AlertTriangle, Loader2, X, FileDown } from "lucide-react";
import MarkdownContent from "./MarkdownContent";
import { processImage, normalizeMediaType } from "../lib/imageUtils";
import { downloadAsWordDocument } from "../lib/wordExport";

interface Attachment {
  id: string;
  type: "pdf" | "image";
  name: string;
  content: string; 
  mediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}

export default function Resumir() {
  const [topic, setTopic] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingMedia, setProcessingMedia] = useState(false);
  const [copied, setCopied] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detector de capturas de pantalla (Ctrl + V / Portapapeles) - múltiples capturas
  useEffect(() => {
    async function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length === 0) return;

      e.preventDefault();
      setProcessingMedia(true);
      setError(null);

      try {
        const processedResults = await Promise.all(
          imageFiles.map(file => processImage(file))
        );

        const newAttachments: Attachment[] = processedResults.map((p, idx) => ({
          id: `img_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          type: "image",
          name: imageFiles[idx].name || `captura_${idx + 1}.jpg`,
          content: p.dataUrl,
          mediaType: p.mediaType,
        }));

        setAttachments(prev => [...prev, ...newAttachments]);
        setTopic(prev =>
          prev.trim()
            ? prev
            : newAttachments.length > 1
              ? `Analiza y resume estas ${newAttachments.length} capturas de pantalla médicas.`
              : "Analiza y resume esta captura de pantalla médica detalladamente."
        );
      } catch (err) {
        console.error("Error al procesar capturas:", err);
        setError("No se pudieron procesar las capturas de pantalla pegadas.");
      } finally {
        setProcessingMedia(false);
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // Función de carga manual de archivos múltiples
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    setProcessingMedia(true);

    const fileList = Array.from(files);
    const newAttachments: Attachment[] = [];

    try {
      for (const file of fileList) {
        if (file.type === "application/pdf") {
          if (file.size > 20 * 1024 * 1024) {
            setError(`El archivo "${file.name}" supera el límite de 20 MB.`);
            continue;
          }

          const arrayBuffer = await file.arrayBuffer();
          const pdfjsLib = await import("pdfjs-dist");
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;

          let fullText = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              // @ts-ignore
              .map((item) => item.str || "")
              .join(" ");
            fullText += pageText + "\n";
          }

          if (fullText.trim().length >= 20) {
            newAttachments.push({
              id: `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              type: "pdf",
              name: file.name,
              content: fullText.trim(),
            });
          } else {
            setError(`No se pudo extraer texto legible del PDF "${file.name}".`);
          }
        } else if (file.type.startsWith("image/")) {
          const processed = await processImage(file);
          newAttachments.push({
            id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: "image",
            name: file.name,
            content: processed.dataUrl,
            mediaType: processed.mediaType,
          });
        }
      }

      if (newAttachments.length > 0) {
        setAttachments(prev => [...prev, ...newAttachments]);
        setTopic(prev =>
          prev.trim()
            ? prev
            : newAttachments.length > 1
              ? `Resumen de los ${newAttachments.length} archivos adjuntos`
              : `Resumen de: ${newAttachments[0].name}`
        );
      }
    } catch (err) {
      console.error("Error al procesar archivos:", err);
      setError("Ocurrió un error al procesar los archivos seleccionados.");
    } finally {
      setProcessingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(id: string) {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }

  function clearAllAttachments() {
    setAttachments([]);
  }

  function handleDownloadWord() {
    const cleanTitle = (topic || "Resumen_Medico").replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_ -]/g, "").slice(0, 35);
    downloadAsWordDocument(summary, `MANOLIA_${cleanTitle}.doc`, topic || "Resumen Médico");
  }

  async function generate() {
    const currentTopic = topic.trim();
    if ((!currentTopic && attachments.length === 0) || loading || processingMedia) return;

    setLoading(true);
    setSummary("");
    setError(null);

    try {
      const imageAttachments = attachments.filter(a => a.type === "image");
      const pdfAttachments = attachments.filter(a => a.type === "pdf");

      let basePromptText = currentTopic;
      if (!basePromptText) {
        if (imageAttachments.length > 0 && pdfAttachments.length > 0) {
          basePromptText = "Resumen completo de las imágenes y documentos médicos adjuntos.";
        } else if (imageAttachments.length > 0) {
          basePromptText = `Analiza y resume detalladamente las ${imageAttachments.length} imágenes médicas adjuntas.`;
        } else {
          basePromptText = `Resumen estructurado de los ${pdfAttachments.length} documentos PDF adjuntos.`;
        }
      }

      let pdfTextContent = "";
      if (pdfAttachments.length > 0) {
        pdfTextContent = pdfAttachments
          .map((p, idx) => `--- [Documento PDF ${idx + 1}: "${p.name}"] ---\n${p.content}`)
          .join("\n\n");
      }

      const promptTemplate = `
${pdfTextContent ? `Contenido de los documentos adjuntos:\n${pdfTextContent}\n\n---\n` : ""}
Solicitud del usuario:
"${basePromptText}"

Genera una respuesta estructurada utilizando exactamente este formato en Markdown:

## Resumen General
Explicación clara y organizada del contenido o de los hallazgos en las capturas.

## Conceptos Clave
- Punto importante 1
- Punto importante 2

## Tabla Resumen
| Concepto / Hallazgo | Descripción / Relevancia Clínica |

## Puntos de Examen
- Datos clave que suelen preguntarse en evaluaciones médicas sobre este tema.

## Mnemotecnia
Crea una mnemotecnia útil para recordar el tema si aplica.
`;

      const contentBlocks: any[] = [];

      // Agregar todas las imágenes como bloques multimodales
      for (const img of imageAttachments) {
        const base64Raw = img.content.includes(",")
          ? img.content.split(",")[1]
          : img.content;
        const mediaType = normalizeMediaType(img.mediaType);

        contentBlocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: base64Raw,
          },
        });
      }

      contentBlocks.push({
        type: "text",
        text: promptTemplate,
      });

      const messagesPayload = [
        {
          role: "user",
          content: contentBlocks.length === 1 && contentBlocks[0].type === "text"
            ? promptTemplate
            : contentBlocks,
        },
      ];

      const res = await fetch("/api/resumir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesPayload }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Error en la API (${res.status})`);
      } else {
        setSummary(data.reply || "No se recibió respuesta del modelo.");
      }
    } catch (err: any) {
      console.error("Error al generar resumen:", err);
      const errMsg = err?.message || "Error al conectar con el servidor.";
      setError(errMsg);
      setSummary(`⚠️ **No se pudo generar el resumen:** ${errMsg}\n\n*Por favor revisa tu conexión o clave de API.*`);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Banner de errores */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-yellow-300 text-xs">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-yellow-400 hover:text-white font-bold text-xs">✕</button>
        </div>
      )}

      {/* Barra de previsualización de archivos adjuntos */}
      {attachments.length > 0 && (
        <div className="flex flex-col gap-1.5 p-2.5 rounded-2xl border border-purple-500/30 bg-purple-950/40 backdrop-blur-md">
          <div className="flex items-center justify-between px-1 text-[11px] text-purple-300 font-medium">
            <span>
              {attachments.length} {attachments.length === 1 ? "archivo adjunto" : "archivos adjuntos"} listos para resumir
            </span>
            <button
              type="button"
              onClick={clearAllAttachments}
              className="text-[10px] text-purple-400 hover:text-red-400 transition-colors"
            >
              Limpiar todo
            </button>
          </div>

          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="group relative flex items-center gap-2 rounded-xl border border-purple-500/25 bg-purple-600/15 p-1.5 pr-3 text-xs text-purple-200 max-w-[220px]"
              >
                {att.type === "image" ? (
                  <img
                    src={att.content}
                    alt={att.name}
                    className="w-8 h-8 rounded-lg object-cover border border-purple-400/30 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center border border-purple-400/30 shrink-0">
                    <FileUp size={14} className="text-purple-300" />
                  </div>
                )}

                <span className="truncate text-[11px] flex-1 font-medium">{att.name}</span>

                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="p-1 rounded-md text-purple-300 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                  title="Quitar este archivo"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controles de entrada */}
      <div className="flex gap-2.5 items-center">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf, image/png, image/jpeg, image/webp"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || processingMedia}
          className={`w-12 h-12 rounded-2xl border transition-all flex-shrink-0 flex items-center justify-center ${attachments.length > 0
            ? "border-purple-400/50 bg-purple-600/20 text-purple-300"
            : "border-border bg-white/5 text-secondary hover:bg-white/10 hover:text-primary"
            }`}
          title="Subir archivos o múltiples imágenes médicas"
        >
          <FileUp size={20} />
        </button>

        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && generate()}
          placeholder={
            processingMedia
              ? "Optimizando capturas de pantalla..."
              : loading
                ? "Generando resumen estructurado con IA..."
                : attachments.length > 0
                  ? `Listo para resumir ${attachments.length} archivos adjuntos`
                  : "Escribe un tema, sube varios PDFs o pega capturas (Ctrl + V)..."
          }
          disabled={loading || processingMedia}
          className="flex-1 rounded-xl border border-border bg-white/5 px-5 py-3.5 text-sm text-primary outline-none focus:border-purple-500/50"
        />
        <button
          onClick={generate}
          disabled={loading || processingMedia || (!topic.trim() && attachments.length === 0)}
          className={`px-6 py-3.5 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all shadow-md ${loading || processingMedia || (!topic.trim() && attachments.length === 0)
            ? "bg-white/10 text-secondary/40 cursor-not-allowed"
            : "bg-gradient-to-br from-purple-600 to-fuchsia-500 hover:from-purple-500 hover:to-fuchsia-400 text-white active:scale-95 cursor-pointer"
            }`}
        >
          {loading || processingMedia ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Procesando...</span>
            </>
          ) : (
            <>
              <Sparkles size={18} />
              <span>Resumir</span>
            </>
          )}
        </button>
      </div>

      {/* Estado de carga */}
      {loading && (
        <div className="flex flex-1 flex-col gap-3 rounded-xl border border-purple-500/20 bg-white/5 p-6 animate-pulse">
          <div className="h-4 rounded-full bg-purple-500/20 w-3/4" />
          <div className="h-3.5 rounded-full bg-white/10 w-full" />
          <div className="h-3.5 rounded-full bg-white/10 w-[85%]" />
          <div className="h-3.5 rounded-full bg-white/10 w-[60%]" />
        </div>
      )}

      {/* Vista de resultados */}
      {summary && !loading && (
        <div className="relative flex-1 overflow-y-auto rounded-xl border border-purple-500/20 bg-white/5 p-7">
          {/* Botones de acción del resumen */}
          <div className="absolute right-4 top-4 flex items-center gap-2 z-10">
            <button
              onClick={handleDownloadWord}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-600/25 hover:bg-purple-600/40 text-purple-200 text-xs font-medium transition-all shadow-sm hover:scale-[1.02] active:scale-95 cursor-pointer"
              title="Descargar este resumen en formato Word (.doc)"
            >
              <FileDown size={14} className="text-purple-300" />
              <span>Descargar Word</span>
            </button>

            <button
              onClick={copyToClipboard}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white/10 text-secondary transition-all hover:text-white cursor-pointer ${copied ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : ""}`}
              title="Copiar texto del resumen"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>

          <div className="pt-2">
            <MarkdownContent variant="summary">{summary}</MarkdownContent>
          </div>
        </div>
      )}
    </div>
  );
}