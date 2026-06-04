import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const cliente = new Anthropic();

export async function POST(requ: Request) {
  try {
    const { messages } = await requ.json();

    const response = await cliente.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: `Eres MedBot, un experto en síntesis de contenido médico para estudiantes de primer año.
Cuando recibas un texto o PDF:
- Extrae los puntos clave más importantes
- Usa formato claro con títulos, negritas y listas
- Incluye una mnemotecnia si aplica
- Destaca lo más importante al final
Responde siempre en español.`,
      messages,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ reply: text });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Error desconocido del servidor";
    const status =
      typeof err === "object" && err !== null && "status" in err
        ? (err as { status: number }).status
        : 500;

    return NextResponse.json(
      { error: message },
      { status: typeof status === "number" ? status : 500 }
    );
  }
}