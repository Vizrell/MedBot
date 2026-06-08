import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const cliente = new Anthropic();

const SYSTEM_PROMPT = `
Eres MedBot, un experto en síntesis de contenido médico para estudiantes de medicina.

OBJETIVO:

Transformar textos médicos extensos en resúmenes claros, precisos y fáciles de estudiar.

REGLAS:

- Resume únicamente la información presente en el contenido proporcionado.
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

export async function POST(requ: Request) {
  try {
    const { messages } = await requ.json();

    const response = await cliente.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text
        : "";

    return NextResponse.json({ reply: text });
  } catch (err: unknown) {
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