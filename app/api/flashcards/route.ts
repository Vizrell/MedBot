import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const cliente = new Anthropic();

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        const response = await cliente.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2048,

            system: `
Eres MedBot Flashcards.

Tu única tarea es generar tarjetas de estudio médicas.

Reglas:

- Responde únicamente JSON válido.
- No uses markdown.
- No uses texto fuera del JSON.
- Cada tarjeta debe tener:
  - question
  - answer
- Respuestas cortas y precisas.
- Nivel universitario.
`,

            messages,
        });

        const text =
            response.content[0].type === "text"
                ? response.content[0].text
                : "";

        return NextResponse.json({
            reply: text,
        });

    } catch (err: unknown) {
        return NextResponse.json(
            {
                error:
                    err instanceof Error
                        ? err.message
                        : "Error del servidor",
            },
            { status: 500 }
        );
    }
}