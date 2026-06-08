import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const cliente = new Anthropic();

export async function POST(req: Request) {
    try {
        const { topic } = await req.json();

        const response = await cliente.messages.create({
            model: "claude-3-5-haiku-20241022",
            max_tokens: 2048,

            system: `
            Eres MedBot Quiz. Generas cuestionarios médicos de nivel universitario sobre el tema solicitado.
            
            REGLA DE ORO PARA AHORRAR TOKENS: Sé extremadamente directo. Preguntas concisas y opciones de respuesta de máximo 3 palabras si es posible.

            Debes generar exactamente 10 preguntas.
            Devuelve EXCLUSIVAMENTE un array JSON plano sin marcas de código (\`\`\`json).
            
            Formato requerido:
            [
              {
                "question": "¿Pregunta corta?",
                "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
                "correctIndex": 0
              }
            ]
            `,
            messages: [{ role: "user", content: `Genera un quiz de 10 preguntas sobre: ${topic}` }],
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