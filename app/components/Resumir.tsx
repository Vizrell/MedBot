"use client";
import { useState, useRef, useEffect } from "react";
import { Sparkles, Copy, Check, FileUp, AlertTriangle } from "lucide-react";
import MarkdownContent from "./MarkdownContent";

const SAMPLE_TOPICS = [
  "Sistema Cardiovascular",
  "Sistema Nervioso",
  "Farmacología Básica",
  "Anatomía del Aparato Digestivo",
  "Inmunología",
];

const MOCK_SUMMARIES: Record<string, string> = {
  "sistema cardiovascular": `## Sistema Cardiovascular\n\n**Componentes principales:**\n- **Corazón**: Órgano muscular con 4 cavidades...\n`,
  "sistema nervioso": `## Sistema Nervioso\n\n### Divisiones\n- **SNC**: Cerebro + Médula espinal...\n`
};

export default function Resumir() {
  const [topic, setTopic] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [attachment, setAttachment] = useState<{
    type: "pdf" | "image";
    name: string;
    content: string; // Guarda el texto completo extraído del PDF o base64 de imagen
    mediaType?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = (event) => {
            setAttachment({
              type: "image",
              name: "captura.png",
              content: event.target?.result as string,
              mediaType: item.type,
            });
            setTopic("Analiza y resume esta captura de pantalla");
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // ── FUNCIÓN CON CARGA DINÁMICA DE PDF (CORRECCIÓN DE SSR) ──
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // Validación de tamaño límite (20 MB)
    if (file.size > 20 * 1024 * 1024) {
      setError("El archivo supera el límite permitido de 20 MB.");
      return;
    }

    if (file.type === "application/pdf") {
      setLoading(true);
      setError(null);
      try {
        const arrayBuffer = await file.arrayBuffer();

        // 🚀 IMPORTACIÓN EN TIEMPO DE EJECUCIÓN (Previene el error 'DOMMatrix is not defined')
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        // Cargamos el PDF seguro en la memoria del cliente
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        let fullText = "";

        // Iteramos todas las páginas para extraer el texto de tus apuntes
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
          setError("No se pudo extraer texto legible. Verifica que el PDF no contenga solo imágenes escaneadas sin capas de texto.");
          setLoading(false);
          return;
        }

        // Almacenamos el texto completo nativo sin recortes drásticos
        setAttachment({
          type: "pdf",
          name: file.name,
          content: fullText.trim(),
        });

        setTopic(`Resumen de: ${file.name}`);
      } catch (err) {
        console.error(err);
        setError("Ocurrió un error al intentar procesar el PDF en el navegador.");
      } finally {
        setLoading(false);
      }
    } else if (file.type.startsWith("image/")) {
      if (file.size > 4 * 1024 * 1024) {
        setError("Para imágenes, se recomienda un tamaño menor a 4 MB debido a límites de Vercel.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachment({
          type: "image",
          name: file.name,
          content: event.target?.result as string,
          mediaType: file.type,
        });
        setTopic(`Resumen de: ${file.name}`);
      };
      reader.readAsDataURL(file);
    } else {
      setError("Formato no soportado. Por favor, sube archivos PDF o imágenes válidas.");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function generate() {
    if (!topic.trim() && !attachment) return;
    setLoading(true);
    setSummary("");
    setError(null);

    const key = topic.trim().toLowerCase();

    if (!attachment) {
      const mockMatch = Object.entries(MOCK_SUMMARIES).find(([k]) => key.includes(k));
      if (mockMatch) {
        await new Promise((r) => setTimeout(r, 1200));
        setSummary(mockMatch[1]);
        setLoading(false);
        return;
      }
    }

    try {
      let promptContent = `Genera un resumen estructurado sobre: "${topic}". Usa markdown con títulos (##), subtítulos (###) y viñetas.`;
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
          const base64Raw = attachment.content.split(",")[1];
          messagesPayload = [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: attachment.mediaType || "image/jpeg",
                    data: base64Raw,
                  },
                },
                {
                  type: "text",
                  text: `Analiza detalladamente esta imagen médica...`,
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
        if (attachment) {
          await new Promise((r) => setTimeout(r, 1500));
          setSummary(`## Resumen de: ${attachment.name} (Modo de prueba)\n\nTexto procesado exitosamente en el navegador (${attachment.content.length} caracteres analizados).\n\n> ⚠️ **Nota:** Modo de prueba activado. Configura tu API Key real en producción para ver el análisis de la IA.`);
          setError("Sin créditos disponibles — usando modo de prueba.");
        } else {
          setSummary(`> ⚠️ **Modo de prueba** — La API no está disponible.`);
        }
      } else {
        setSummary(data.reply);
      }
    } catch {
      setError("Error de conexión al servidor.");
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
      {/* Banner de Errores */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-yellow-400 text-xs">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Banner de Archivo Adjunto */}
      {attachment && (
        <div className="flex items-center gap-2 rounded-lg border border-purple-500/25 bg-purple-600/15 px-3.5 py-2 text-xs text-purple-300">
          <FileUp size={15} />
          <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
            {attachment.type === "image" ? "📷" : "📄"} {attachment.name} ({((attachment.content.length * 2) / 1024).toFixed(1)} KB extraídos)
          </span>
          <button
            type="button"
            onClick={() => {
              setAttachment(null);
              setTopic("");
            }}
            className="ml-auto text-purple-300 hover:text-purple-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Controles de Entrada */}
      <div className="flex gap-2.5 items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf, image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className={`w-12 h-12 rounded-2xl border transition-all flex-shrink-0 flex items-center justify-center ${attachment
              ? "border-purple-400/50 bg-purple-600/15 text-purple-300"
              : "border-border bg-white/5 text-secondary hover:bg-white/10"
            }`}
        >
          <FileUp size={20} />
        </button>

        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          placeholder={loading ? "Extrayendo contenido del documento..." : attachment ? `Listo para procesar: ${attachment.name}` : "Scribe un tema o arrastra un PDF de hasta 20MB..."}
          className="flex-1 rounded-xl border border-border bg-white/5 px-5 py-3.5 text-sm text-primary outline-none focus:border-purple-500/50"
        />
        <button
          onClick={generate}
          disabled={loading || (!topic.trim() && !attachment)}
          className={`px-6 py-3.5 rounded-xl flex items-center gap-2 text-sm font-semibold transition-all ${loading || (!topic.trim() && !attachment)
              ? "bg-white/10 text-secondary cursor-not-allowed"
              : "bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white"
            }`}
        >
          <Sparkles size={18} />
          {loading ? "Procesando..." : "Resumir"}
        </button>
      </div>

      {/* Estado de Carga */}
      {loading && (
        <div className="flex flex-1 flex-col gap-3 rounded-xl border border-border bg-white/5 p-6 animate-pulse">
          <div className="h-3.5 rounded-full bg-white/10 w-full" />
          <div className="h-3.5 rounded-full bg-white/10 w-[85%]" />
          <div className="h-3.5 rounded-full bg-white/10 w-[60%]" />
        </div>
      )}

      {/* Vista de Resultados */}
      {summary && !loading && (
        <div className="relative flex-1 overflow-y-auto rounded-xl border border-border bg-white/5 p-7">
          <button
            onClick={copyToClipboard}
            className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white/10 text-secondary ${copied ? "text-emerald-400" : ""}`}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <MarkdownContent variant="summary">{summary}</MarkdownContent>
        </div>
      )}
    </div>
  );
}