import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const cliente = new Anthropic();

const SYSTEM_PROMPT = `
Eres MANOLIA, un tutor virtual especializado en medicina para estudiantes universitarios.

OBJETIVO:
Ayudar a comprender, analizar y repasar temas médicos de forma clara, precisa y basada en evidencia científica.

REGLAS GENERALES:

- Responde siempre en español.
- Prioriza la precisión sobre la rapidez.
- Utiliza terminología médica correcta.
- Explica los conceptos de forma clara y ordenada.
- Organiza las respuestas con títulos, subtítulos y listas.
- No inventes diagnósticos, estudios, referencias ni estadísticas.
- Si no tienes suficiente información, indícalo claramente.
- Si la pregunta es ambigua o incompleta, solicita más información.
- Mantén un tono académico y profesional.

CUANDO ANALICES CAPTURAS O IMÁGENES MÉDICAS:
- Describe detalladamente los hallazgos visuales, anatómicos, radiológicos o histológicos que observes.
- Si la imagen contiene texto médico, diapositivas o preguntas de examen, extrae y analiza el texto explícitamente.
- Indica estructuras anatómicas identificables, densidades, anomalías o hallazgos patológicos relevantes.

CUANDO EXPLIQUES ENFERMEDADES:

1. Definición
2. Etiología
3. Fisiopatología
4. Manifestaciones clínicas
5. Diagnóstico
6. Tratamiento
7. Complicaciones

CUANDO EXPLIQUES MEDICAMENTOS:

1. Grupo farmacológico
2. Mecanismo de acción
3. Indicaciones
4. Efectos adversos
5. Contraindicaciones

CUANDO RESUELVAS CASOS CLÍNICOS:

1. Resume el caso.
2. Identifica hallazgos clave.
3. Analiza los síntomas y datos disponibles.
4. Propón diagnósticos diferenciales.
5. Explica por qué se descarta cada alternativa.
6. Indica el diagnóstico más probable.
7. Sugiere estudios complementarios si son necesarios.

IMPORTANTE:

- No sustituyes el criterio clínico profesional.
- No inventes información faltante.
- Si faltan datos relevantes para un caso clínico, indícalo.

Al final de explicaciones importantes incluye:

## Lo que debes recordar

con 3 a 5 puntos clave.
`;

const VALID_IMAGE_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function normalizeMediaType(mime?: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (!mime) return "image/jpeg";
  const lower = mime.toLowerCase();
  if (lower.includes("png")) return "image/png";
  if (lower.includes("webp")) return "image/webp";
  if (lower.includes("gif")) return "image/gif";
  if (lower.includes("jpeg") || lower.includes("jpg") || lower.includes("pjpeg")) return "image/jpeg";
  return "image/jpeg";
}

export async function POST(requ: Request) {
  try {
    const body = await requ.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron mensajes válidos." },
        { status: 400 }
      );
    }

    // Sanitizar y validar los bloques de mensajes para la API de Anthropic
    const sanitizedMessages: any[] = [];

    for (const msg of messages) {
      const role = msg.role === "assistant" ? "assistant" : "user";

      if (Array.isArray(msg.content)) {
        const sanitizedContent = msg.content.map((block: any) => {
          if (block.type === "image" && block.source?.type === "base64") {
            const rawMediaType = block.source.media_type;
            const validMediaType = VALID_IMAGE_MEDIA_TYPES.has(rawMediaType)
              ? rawMediaType
              : normalizeMediaType(rawMediaType);

            return {
              type: "image",
              source: {
                type: "base64",
                media_type: validMediaType,
                data: block.source.data,
              },
            };
          }
          return block;
        });

        sanitizedMessages.push({ role, content: sanitizedContent });
      } else {
        sanitizedMessages.push({
          role,
          content: typeof msg.content === "string" ? msg.content : String(msg.content || ""),
        });
      }
    }

    // Asegurar que los roles alternen correctamente (user -> assistant -> user)
    const normalizedHistory: any[] = [];
    for (const msg of sanitizedMessages) {
      if (
        normalizedHistory.length > 0 &&
        normalizedHistory[normalizedHistory.length - 1].role === msg.role
      ) {
        const prev = normalizedHistory[normalizedHistory.length - 1];
        if (typeof prev.content === "string" && typeof msg.content === "string") {
          prev.content = `${prev.content}\n\n${msg.content}`;
        } else {
          const prevArray = Array.isArray(prev.content)
            ? prev.content
            : [{ type: "text", text: prev.content }];
          const msgArray = Array.isArray(msg.content)
            ? msg.content
            : [{ type: "text", text: msg.content }];
          prev.content = [...prevArray, ...msgArray];
        }
      } else {
        normalizedHistory.push(msg);
      }
    }

    const response = await cliente.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: normalizedHistory,
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text
        : "";

    return NextResponse.json({ reply: text });
  } catch (err: any) {
    console.error("ERROR ANTHROPIC CHAT:", err);

    return NextResponse.json(
      {
        error: err?.message || "Error al comunicarse con la IA.",
        status: err?.status || 500,
        type: err?.error?.type,
      },
      {
        status: err?.status || 500,
      }
    );
  }
}