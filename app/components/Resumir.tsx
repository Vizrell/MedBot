"use client";
import { useState, useRef, useEffect } from "react";
import { Sparkles, Copy, Check, FileUp, AlertTriangle, Loader2 } from "lucide-react";
import MarkdownContent from "./MarkdownContent";
import { processImage, normalizeMediaType } from "../lib/imageUtils";

const SAMPLE_TOPICS = [
  "Sistema Cardiovascular",
  "Sistema Nervioso",
  "Farmacología Básica",
  "Anatomía del Aparato Digestivo",
  "Inmunología",
];

export default function Resumir() {
  const [topic, setTopic] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingMedia, setProcessingMedia] = useState(false);
  const [copied, setCopied] = useState(false);
  const [attachment, setAttachment] = useState<{
    type: "pdf" | "image";
    name: string;
    content: string; 
    mediaType?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detector de capturas de pantalla (Ctrl + V / Portapapeles)
  useEffect(() => {
    async function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;

          e.preventDefault();
          setProcessingMedia(true);
          setError(null);

          try {
            const processed = await processImage(file);
            setAttachment({
              type: "image",
              name: "captura_portapapeles.jpg",
              content: processed.dataUrl,
              mediaType: processed.mediaType,
            });
            setTopic("Analiza y resume esta captura de pantalla médica detalladamente.");
          } catch (err) {
            console.error("Error al procesar captura:", err);
            setError("No se pudo procesar la captura de pantalla pegada.");
          } finally {
            setProcessingMedia(false);
          }
          break;
        }
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // Función de carga manual de archivos
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.type === "application/pdf") {
      if (file.size > 20 * 1024 * 1024) {
        setError("El archivo supera el límite permitido de 20 MB.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
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

        if (fullText.trim().length < 20) {
          setError("No se pudo extraer texto legible. Verifica que el PDF contenga texto o capas legibles.");
          setLoading(false);
          return;
        }

        setAttachment({
          type: "pdf",
          name: file.name,
          content: fullText.trim(),
        });

        setTopic(`Resumen de: ${file.name}`);
      } catch (err) {
        console.error(err);
        setError("Ocurrió un error al intentar procesar el PDF.");
      } finally {
        setLoading(false);
      }
    } else if (file.type.startsWith("image/")) {
      setProcessingMedia(true);
      try {
        const processed = await processImage(file);
        setAttachment({
          type: "image",
          name: file.name,
          content: processed.dataUrl,
          mediaType: processed.mediaType,
        });
        setTopic(`Resumen de: ${file.name}`);
      } catch (err) {
        console.error(err);
        setError("Error al procesar la imagen seleccionada.");
      } finally {
        setProcessingMedia(false);
      }
    } else {
      setError("Formato no soportado. Por favor, sube archivos PDF o imágenes válidas.");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function generate() {
    const currentTopic = topic.trim();
    if ((!currentTopic && !attachment) || loading || processingMedia) return;

    setLoading(true);
    setSummary("");
    setError(null);

    try {
      let basePromptText = currentTopic || (attachment?.type === "pdf" ? `Resumen del documento médico` : `Analiza detalladamente esta imagen médica...`);
      let promptContent = `Genera un resumen estructurado sobre: "${basePromptText}". Usa markdown con títulos (##), subtítulos (###) y viñetas.`;
      let messagesPayload: any[] = [];

      if (attachment) {
        if (attachment.type === "pdf") {
          promptContent = `
Analiza el siguiente contenido médico extraído del PDF "${attachment.name}".

Genera una respuesta estructurada utilizando exactamente este formato:

## Resumen General
Explicación clara y organizada de la lectura.

## Conceptos Clave
- Punto importante 1
- Punto importante 2

## Tabla Resumen
| Concepto | Descripción |

## Puntos de Examen
- Datos que suelen preguntarse en evaluaciones médicas.

## Mnemotecnia
Crea una mnemotecnia útil si aplica para el tema.

Contenido del documento original:
${attachment.content}
`;
          messagesPayload = [{ role: "user", content: promptContent }];
        } else if (attachment.type === "image") {
          const base64Raw = attachment.content.includes(",")
            ? attachment.content.split(",")[1]
            : attachment.content;

          const mediaType = normalizeMediaType(attachment.mediaType);

          messagesPayload = [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64Raw,
                  },
                },
                {
                  type: "text",
                  text: basePromptText,
                },
              ],
            },
          ];
        }
      } else {
        messagesPayload = [{ role: "user", content: promptContent }];
      }

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
    <div className="flex flex-col h-full gap-5">
      {/* Banner de errores */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-yellow-300 text-xs">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-yellow-400 hover:text-white font-bold text-xs">✕</button>
        </div>
      )}

      {/* Banner de archivo adjunto */}
      {attachment && (
        <div className="flex items-center gap-3 rounded-xl border border-purple-500/30 bg-purple-600/15 px-3.5 py-2 text-xs text-purple-200">
          {attachment.type === "image" ? (
            <img
              src={attachment.content}
              alt="Thumbnail"
              className="w-10 h-10 rounded-lg object-cover border border-purple-400/30 shadow"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center border border-purple-400/30">
              <FileUp size={18} className="text-purple-300" />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium text-purple-100 truncate">{attachment.name}</span>
            <span className="text-[10px] opacity-70">
              {attachment.type === "image" ? "Captura médica optimizada" : "Documento PDF listo"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setAttachment(null);
              setTopic("");
            }}
            className="p-1 rounded-md hover:bg-white/10 text-purple-300 hover:text-white"
            title="Quitar adjunto"
          >
            ✕
          </button>
        </div>
      )}

      {/* Controles de entrada */}
      <div className="flex gap-2.5 items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf, image/png, image/jpeg, image/webp"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || processingMedia}
          className={`w-12 h-12 rounded-2xl border transition-all flex-shrink-0 flex items-center justify-center ${attachment
            ? "border-purple-400/50 bg-purple-600/20 text-purple-300"
            : "border-border bg-white/5 text-secondary hover:bg-white/10 hover:text-primary"
            }`}
          title="Subir PDF o Imagen Médica"
        >
          <FileUp size={20} />
        </button>

        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && generate()}
          placeholder={
            processingMedia
              ? "Optimizando captura de pantalla..."
              : loading
                ? "Generando resumen médico con IA..."
                : attachment
                  ? `Listo para resumir: ${attachment.name}`
                  : "Escribe un tema, sube un PDF o pega un screenshot (Ctrl + V)..."
          }
          disabled={loading || processingMedia}
          className="flex-1 rounded-xl border border-border bg-white/5 px-5 py-3.5 text-sm text-primary outline-none focus:border-purple-500/50"
        />
        <button
          onClick={generate}
          disabled={loading || processingMedia || (!topic.trim() && !attachment)}
          className={`px-6 py-3.5 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all shadow-md ${loading || processingMedia || (!topic.trim() && !attachment)
            ? "bg-white/10 text-secondary/40 cursor-not-allowed"
            : "bg-gradient-to-br from-purple-600 to-fuchsia-500 hover:from-purple-500 hover:to-fuchsia-400 text-white active:scale-95"
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
          <button
            onClick={copyToClipboard}
            className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white/10 text-secondary transition-all hover:text-white ${copied ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : ""}`}
            title="Copiar resumen"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <MarkdownContent variant="summary">{summary}</MarkdownContent>
        </div>
      )}
    </div>
  );
}