import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const cliente = new Anthropic();

const SYSTEM_PROMPT = `
Eres MedBot, un experto en síntesis de contenido médico para estudiantes de medicina.

OBJETIVO:

Transformar textos y capturas de contenido médico en resúmenes claros, precisos y fáciles de estudiar.

REGLAS:

- Resume únicamente la información presente en el contenido proporcionado.
- Si recibes una captura o imagen médica (diapositivas, libros, artículos, casos clínicos), analiza todo su contenido visual y textual detalladamente.
- No inventes información.
- No agregues datos externos.
- Organiza el contenido usando títulos y listas.
- Identifica conceptos importantes.
- Destaca definiciones relevantes.
- Resume mecanismos fisiopatológicos cuando aparezcan.
- Resume tratamientos únicamente si están presentes en el texto.
- Utiliza lenguaje académico.

ESTRUCTURA:

# Resumen General

# Conceptos Clave

# Datos Importantes para Examen

# Mnemotecnias
(Solo si son útiles)

# Lo Más Importante

Incluye entre 5 y 10 puntos clave para repasar.

Responde siempre en español.
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
    const { messages } = await requ.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "No se proporcionaron mensajes válidos." },
        { status: 400 }
      );
    }

    const sanitizedMessages = messages.map((msg: any) => {
      const role = msg.role === "assistant" ? "assistant" : "user";
      if (Array.isArray(msg.content)) {
        return {
          role,
          content: msg.content.map((block: any) => {
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
          }),
        };
      }
      return {
        role,
        content: typeof msg.content === "string" ? msg.content : String(msg.content || ""),
      };
    });

    const response = await cliente.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: sanitizedMessages,
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text
        : "";

    return NextResponse.json({ reply: text });
  } catch (err: unknown) {
    console.error("ERROR ANTHROPIC RESUMIR:", err);
    const message =
      err instanceof Error
        ? err.message
        : "Error desconocido del servidor";

    const status =
      typeof err === "object" &&
        err !== null &&
        "status" in err
        ? (err as { status: number }).status
        : 500;

    return NextResponse.json(
      { error: message },
      { status: typeof status === "number" ? status : 500 }
    );
  }
}