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
            Eres MedBot Flashcards. Generas tarjetas médicas de nivel universitario.

            REGLA DE ORO PARA AHORRAR TOKENS: 
            Sé extremadamente minimalista. Evita explicaciones largas, rodeos o contexto innecesario.

            - Pregunta: Una frase directa, al grano (ej: "¿Qué sintetizan las células beta del páncreas?").
            - Respuesta: Máximo 3 a 7 palabras (ej: "Insulina").
            
            Devuelve EXCLUSIVAMENTE un array en formato JSON puro. No agregues saludos, ni explicaciones, ni bloques de código de tipo markdown (sin \`\`\`json).
            
            Ejemplo de salida:
            [{"question": "Pregunta", "answer": "Respuesta"}]
            `,

            messages,
        });

        const text = response.content[0].type === "text" ? response.content[0].text : "";

        return NextResponse.json({ reply: text });

    } catch (err: unknown) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Error del servidor" },
            { status: 500 }
        );
    }
}