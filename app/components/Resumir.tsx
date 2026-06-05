"use client";
import { useState, useRef } from "react";
import { Sparkles, Copy, Check, FileUp, AlertTriangle, Image as ImageIcon } from "lucide-react";
import MarkdownContent from "./MarkdownContent";

const SAMPLE_TOPICS = [
  "Sistema Cardiovascular",
  "Sistema Nervioso",
  "Farmacología Básica",
  "Anatomía del Aparato Digestivo",
  "Inmunología",
];

const MOCK_SUMMARIES: Record<string, string> = {
  "sistema cardiovascular": `## Sistema Cardiovascular

**Componentes principales:**
- **Corazón**: Órgano muscular con 4 cavidades (2 aurículas, 2 ventrículos)
- **Vasos sanguíneos**: Arterias, venas y capilares
- **Sangre**: Plasma, glóbulos rojos, blancos y plaquetas

### Circulación Mayor (Sistémica)
Ventrículo izquierdo → Aorta → Arterias → Capilares → Venas → Vena cava → Aurícula derecha

### Circulación Menor (Pulmonar)
Ventrículo derecho → Arteria pulmonar → Pulmones → Venas pulmonares → Aurícula izquierda

### Datos clave
- El corazón late ~100,000 veces al día
- Gasto cardíaco normal: ~5 L/min
- Presión arterial normal: 120/80 mmHg`,

  "sistema nervioso": `## Sistema Nervioso

### Divisiones
- **SNC**: Cerebro + Médula espinal
- **SNP**: Nervios craneales (12 pares) + Nervios espinales (31 pares)

### Tipos de neuronas
1. **Sensoriales** (aferentes) — llevan info al SNC
2. **Motoras** (eferentes) — llevan info del SNC
3. **Interneuronas** — conexión entre ambas

### Neurotransmisores principales
| Neurotransmisor | Función principal |
|---|---|
| Acetilcolina | Contracción muscular |
| Dopamina | Placer, motivación |
| Serotonina | Estado de ánimo |
| GABA | Inhibición |
| Glutamato | Excitación |

### Lóbulos cerebrales
- **Frontal**: razonamiento, movimiento voluntario
- **Parietal**: sensibilidad, orientación espacial
- **Temporal**: audición, memoria
- **Occipital**: visión`,
};

export default function Resumir() {
  const [topic, setTopic] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [attachment, setAttachment] = useState<{
    type: "pdf" | "image";
    name: string;
    content: string; // text content for PDF, base64 data for image
    mediaType?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Unified File/Image Upload ──
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      setError("El archivo no debe superar los 5 MB.");
      return;
    }

    if (file.type === "application/pdf") {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let text = "";
        const decoder = new TextDecoder("utf-8", { fatal: false });
        const raw = decoder.decode(bytes);

        const btMatches = raw.match(/BT\s([\s\S]*?)ET/g);
        if (btMatches) {
          for (const block of btMatches) {
            const tjMatches = block.match(/\(([^)]*)\)/g);
            if (tjMatches) {
              for (const tj of tjMatches) {
                text += tj.slice(1, -1) + " ";
              }
            }
          }
        }

        if (text.trim().length < 20) {
          text = raw.replace(/[^\x20-\x7E\xC0-\xFF\n]/g, " ").replace(/\s{3,}/g, "\n").trim();
          if (text.length > 15000) text = text.slice(0, 15000);
        }

        if (text.trim().length < 10) {
          setError("No se pudo extraer texto del PDF. Intenta con otro archivo.");
          return;
        }

        setAttachment({
          type: "pdf",
          name: file.name,
          content: text.trim().slice(0, 15000),
        });
        setError(null);
        setTopic(`Resumen de: ${file.name}`);
      } catch {
        setError("Error al leer el archivo PDF.");
      }
    } else if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target?.result as string;
        setAttachment({
          type: "image",
          name: file.name,
          content: base64Data,
          mediaType: file.type,
        });
        setError(null);
        setTopic(`Resumen de: ${file.name}`);
      };
      reader.onerror = () => {
        setError("Error al leer la imagen.");
      };
      reader.readAsDataURL(file);
    } else {
      setError("Solo se aceptan archivos PDF o imágenes (JPG, PNG, WEBP, etc).");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function generate() {
    if (!topic.trim() && !attachment) return;
    setLoading(true);
    setSummary("");
    setError(null);

    const key = topic.trim().toLowerCase();

    // If not a PDF/image, check if we have a mock summary match
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
      let promptContent = `Genera un resumen conciso y bien estructurado sobre: "${topic}". Usa markdown con títulos (##), subtítulos (###), listas con viñetas, negritas y tablas cuando sea apropiado. Enfócate en los puntos más importantes para un estudiante de medicina.`;
      let messagesPayload: any[] = [];

      if (attachment) {
        if (attachment.type === "pdf") {
          promptContent = `
Analiza el siguiente contenido médico extraído del PDF "${attachment.name}".

Genera una respuesta en este formato:

## Resumen General

Explicación clara y organizada.

## Conceptos Clave

- Punto importante 1
- Punto importante 2
- Punto importante 3

## Tabla Resumen

| Concepto | Descripción |
|-----------|------------|

## Puntos de Examen

- Dato frecuente en evaluaciones
- Concepto que suele preguntarse

## Mnemotecnia

Si aplica, crea una mnemotecnia útil para recordar la información.

Contenido:

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
                  text: `Analiza detalladamente esta imagen.

                        Responde utilizando:

                        ## Descripción

                        ¿Qué se observa?

                        ## Hallazgos Importantes

                        - Hallazgo 1
                        - Hallazgo 2

                        ## Interpretación

                        Explica el significado médico.

                        ## Conceptos Relacionados

                        Relaciona la imagen con anatomía, fisiología o patología cuando sea posible.

                        ## Puntos de Examen

                        Conceptos que un estudiante debería recordar.`,
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
          if (attachment.type === "image") {
            setSummary(`## Resumen de la imagen: ${attachment.name} (Modo de prueba)

**Análisis visual simulado:**
En este modo simulado de prueba, se detectaron los siguientes elementos médicos en tu captura de pantalla/imagen:
1. **Identificación preliminar** — Imagen anatómica, esquema o texto de estudio de medicina.
2. **Estructuras principales** — Se reconocen formas celulares o secciones de apuntes.
3. **Conceptos sugeridos** — Diagnóstico clínico visual o diagramación de órganos.

> ⚠️ **Nota:** Esta es una simulación visual. Cuando tus credenciales de API estén listas, el modelo Claude 3.5 Sonnet analizará de verdad los píxeles de tu captura de pantalla.`);
          } else {
            setSummary(`## Resumen de: ${attachment.name} (Modo de prueba)

**Análisis de documento:**
El archivo PDF contiene información académica sobre medicina. En este modo simulado, se identificaron los siguientes puntos estructurales:
- **Sección 1: Introducción Clínica** — Conceptos básicos y marco conceptual.
- **Sección 2: Diagnóstico Diferencial** — Signos y síntomas principales para el análisis clínico.
- **Sección 3: Abordaje Terapéutico** — Principales fármacos y dosis recomendadas.

> ⚠️ **Nota:** Esta es una simulación ya que la API no tiene créditos activos. Cuando configures tus claves de API, obtendrás un resumen real de tu documento.`);
          }
          setError("Sin créditos disponibles — usando modo de prueba.");
        } else {
          setSummary(`> ⚠️ **Modo de prueba** — La API no está disponible.\n\nEscribe uno de estos temas para ver un resumen de ejemplo:\n\n${SAMPLE_TOPICS.map((t) => `- ${t}`).join("\n")}`);
        }
      } else {
        setSummary(data.reply);
      }
    } catch {
      if (attachment) {
        setSummary(`## Resumen de: ${attachment.name} (Modo de prueba offline)

**Análisis del documento/imagen:**
- **Punto 1:** Importancia de la anamnesis clínica.
- **Punto 2:** Fisiopatología del sistema afectado.
- **Punto 3:** Diagnóstico y tratamiento.

> ⚠️ **Nota:** Sin conexión al servidor — usando modo de prueba.`);
        setError("Sin conexión al servidor — usando modo de prueba.");
      } else {
        setSummary(`> ⚠️ **Modo de prueba** — Sin conexión al servidor.\n\nEscribe uno de estos temas para ver un resumen de ejemplo:\n\n${SAMPLE_TOPICS.map((t) => `- ${t}`).join("\n")}`);
      }
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
      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-yellow-400 text-xs animate-slide-up">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Attached file/image banner */}
      {attachment && (
        <div className="flex animate-slide-up items-center gap-2 rounded-lg border border-purple-500/25 bg-purple-600/15 px-3.5 py-2 text-xs text-purple-300">
          {attachment.type === "pdf" ? <FileUp size={15} /> : <ImageIcon size={15} />}
          <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
            {attachment.type === "image" && (
              <img
                src={attachment.content}
                alt="Thumbnail"
                className="h-6 w-6 shrink-0 rounded border border-white/10 object-cover"
              />
            )}
            {attachment.type === "pdf" ? "📄" : "📷"} {attachment.name} adjunto
          </span>
          <button
            type="button"
            onClick={() => {
              setAttachment(null);
              setTopic("");
            }}
            className="ml-auto shrink-0 cursor-pointer border-0 bg-transparent text-base leading-none text-purple-300 transition-colors hover:text-purple-200"
            aria-label="Quitar adjunto"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input */}
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
          title="Subir archivo o imagen para resumir"
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
          placeholder={attachment ? `Resumiendo ${attachment.name}...` : "Escribe un tema o sube un archivo/imagen..."}
          className="flex-1 rounded-xl border border-border bg-white/5 px-5 py-3.5 text-sm text-primary outline-none transition-all focus:border-purple-500/50 focus:shadow-lg focus:shadow-purple-500/15"
        />
        <button
          onClick={generate}
          disabled={loading || (!topic.trim() && !attachment)}
          className={`px-6 py-3.5 rounded-xl border-none whitespace-nowrap flex items-center gap-2 text-sm font-semibold transition-all ${loading || (!topic.trim() && !attachment)
            ? "cursor-not-allowed bg-white/10 text-secondary"
            : "bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white hover:shadow-lg hover:shadow-purple-500/25"
            }`}
        >
          <Sparkles size={18} />
          {loading ? "Generando..." : "Resumir"}
        </button>
      </div>

      {/* Quick topics */}
      {!summary && !loading && (
        <div className="flex flex-wrap gap-2">
          {SAMPLE_TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className="cursor-pointer rounded-lg border border-border bg-white/5 px-4 py-2 text-xs text-secondary transition-all hover:bg-white/10 hover:text-primary"
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-1 flex-col gap-3 rounded-xl border border-border bg-white/5 p-6 animate-pulse">
          {(["w-full", "w-[85%]", "w-[92%]", "w-3/5", "w-[78%]", "w-[88%]", "w-[45%]"] as const).map(
            (widthClass, i) => (
              <div key={i} className={`h-3.5 rounded-full bg-white/10 ${widthClass}`} />
            )
          )}
        </div>
      )}

      {/* Summary result — rendered with ReactMarkdown */}
      {summary && !loading && (
        <div className="relative flex-1 animate-slide-up overflow-y-auto rounded-xl border border-border bg-white/5 p-7 backdrop-blur-sm">
          <button
            type="button"
            onClick={copyToClipboard}
            title="Copiar"
            className={`absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-white/10 text-secondary transition-all hover:bg-white/15 ${copied ? "text-emerald-400" : ""
              }`}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <MarkdownContent variant="summary">{summary}</MarkdownContent>
        </div>
      )}

      {/* Empty state */}
      {!summary && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center opacity-40 gap-3">
          <Sparkles size={40} strokeWidth={1.2} />
          <p className="text-sm text-secondary">
            Ingresa un tema para generar un resumen
          </p>
        </div>
      )}

    </div>
  );
}
