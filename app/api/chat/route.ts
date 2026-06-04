import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const cliente = new Anthropic();

export async function POST(requ: Request) {
  try {
    const { messages } = await requ.json();
    console.log("mensaje recibido:", JSON.stringify(messages).slice(0, 500))
    const response = await cliente.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: "Eres Manolito, un asistente especializado para estudiantes de medicina. Responde de forma clara, concisa y educativa. Usa formato con negritas y listas cuando sea apropiado.",
      messages,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ reply: text });
  } catch (err: unknown) {
    console.log("Error completo", JSON.stringify(err));
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
