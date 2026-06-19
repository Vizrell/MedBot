"use client";
import { useState } from "react";
import { RotateCcw, ChevronLeft, ChevronRight, Shuffle, Sparkles, AlertTriangle } from "lucide-react";

interface Card {
  question: string;
  answer: string;
}

const DEFAULT_CARDS: Card[] = [
  { question: "¿Cuáles son las 4 cavidades del corazón?", answer: "Aurícula derecha, aurícula izquierda, ventrículo derecho y ventrículo izquierdo." },
  { question: "¿Qué hormona regula la glucosa en sangre?", answer: "La insulina (producida por las células beta del páncreas) reduce la glucosa, y el glucagón (células alfa) la aumenta." },
  { question: "¿Cuáles son los pares craneales sensoriales puros?", answer: "I (olfatorio), II (óptico) y VIII (vestibulococlear)." },
  { question: "¿Qué es la homeostasis?", answer: "Es la capacidad del organismo de mantener un equilibrio interno estable a pesar de los cambios en el entorno externo." },
  { question: "¿Cuál es la función principal del riñón?", answer: "Filtrar la sangre, eliminar desechos metabólicos, regular el equilibrio hídrico y electrolítico, y mantener el pH sanguíneo." },
  { question: "¿Qué estructura conecta los dos hemisferios cerebrales?", answer: "El cuerpo calloso, una banda gruesa de fibras nerviosas que permite la comunicación interhemisférica." },
  { question: "¿Cuáles son las fases de la mitosis?", answer: "Profase, metafase, anafase y telofase (seguidas por la citocinesis)." },
  { question: "¿Qué es el ciclo de Krebs?", answer: "Es una serie de reacciones en la matriz mitocondrial que oxida el acetil-CoA para producir CO₂, NADH, FADH₂ y GTP." },
];

const SAMPLE_TOPICS = [
  "Sistema óseo", "Tejido muscular", "Sistema digestivo",
  "Neurona y sinapsis", "Ciclo celular",
];

const controlBtn =
  "flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg border border-border bg-white/5 text-primary transition-all hover:bg-white/10";

export default function Flashcards() {
  const [cards, setCards] = useState<Card[]>(DEFAULT_CARDS);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerated, setIsGenerated] = useState(false);

  const card = cards[index];

  function next() { setFlipped(false); setIndex((i) => (i + 1) % cards.length); }
  function prev() { setFlipped(false); setIndex((i) => (i - 1 + cards.length) % cards.length); }
  function shuffle() {
    setCards([...cards].sort(() => Math.random() - 0.5));
    setIndex(0); setFlipped(false);
  }
  function reset() {
    setCards(DEFAULT_CARDS);
    setIndex(0); setFlipped(false);
    setIsGenerated(false); setTopic("");
  }

  async function generate() {
    if (!topic.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `
              Genera exactamente 20 flashcards sobre "${topic.trim()}".

              Reglas:

              - Español.
              - Nivel universitario de medicina.
              - Preguntas cortas.
              - Respuestas claras.
              - No usar markdown.
              - No usar listas.
              - No usar texto adicional.

              Devuelve EXCLUSIVAMENTE este formato JSON:

              [
                {
                  "question": "Pregunta",
                  "answer": "Respuesta"
                }
              ]
              `,
            },
          ],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Error generando flashcards"
        );
      }
      // limpiar respuesta por si trae backticks o texto extra
      const clean = data.reply
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const parsed: Card[] = JSON.parse(clean);

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Formato inválido");
      }

      setCards(parsed);
      setIndex(0);
      setFlipped(false);
      setIsGenerated(true);
    } catch (err: any) {
      console.error("ERROR COMPLETO:", err);

      setError(
        err?.message ||
        "No se pudieron generar las tarjetas."
      );
    }
    finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col items-center gap-6 py-4">

      {/* Input para generar */}
      <div className="flex w-full max-w-md gap-2">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && generate()}
          placeholder="Escribe un tema para generar tarjetas..."
          className="flex-1 rounded-xl border border-border bg-white/5 px-4 py-3 text-sm text-primary outline-none transition-all focus:border-purple-500/50 focus:shadow-lg focus:shadow-purple-500/15"
        />
        <button
          onClick={generate}
          disabled={loading || !topic.trim()}
          className={`flex items-center gap-2 rounded-xl border-none px-5 py-3 text-sm font-semibold transition-all ${loading || !topic.trim()
            ? "cursor-not-allowed bg-white/10 text-secondary"
            : "bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white hover:shadow-lg hover:shadow-purple-500/25"
            }`}
        >
          <Sparkles size={16} />
          {loading ? "Generando..." : "Generar"}
        </button>
      </div>

      {/* topics rapidos */}
      {!isGenerated && !loading && (
        <div className="flex flex-wrap justify-center gap-2">
          {SAMPLE_TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className="rounded-lg border border-border bg-white/5 px-3 py-1.5 text-xs text-secondary transition-all hover:bg-white/10 hover:text-primary"
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* error */}
      {error && (
        <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-yellow-400">
          <AlertTriangle size={15} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* contador */}
      {!loading && (
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-secondary">
            {index + 1} / {cards.length}
          </p>
          {isGenerated && (
            <span className="rounded-full border border-purple-500/30 bg-purple-600/15 px-3 py-0.5 text-xs text-purple-300">
              IA · {topic}
            </span>
          )}
        </div>
      )}

      {/* esqueleto de carga */}
      {loading && (
        <div className="h-72 w-full max-w-md animate-pulse rounded-2xl border border-purple-500/25 bg-white/5 p-8 flex flex-col items-center justify-center gap-4">
          <div className="h-3 w-24 rounded-full bg-white/10" />
          <div className="h-4 w-full rounded-full bg-white/10" />
          <div className="h-4 w-3/4 rounded-full bg-white/10" />
          <div className="h-3 w-32 rounded-full bg-white/10 mt-4" />
        </div>
      )}

      {/* Flashcard */}
      {!loading && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setFlipped(!flipped)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFlipped(!flipped);
            }
          }}
          className="h-72 w-full max-w-md cursor-pointer [perspective:1000px]"
        >
          <div className={`relative h-full w-full transition-transform duration-500 ease-out [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""
            }`}>
            {/* frente */}
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-600/25 to-fuchsia-500/10 p-8 text-center shadow-lg shadow-purple-900/20 backdrop-blur-sm [backface-visibility:hidden]">
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-purple-300">Pregunta</p>
              <p className="text-lg leading-relaxed text-primary">{card.question}</p>
              <p className="mt-6 text-xs text-secondary">Toca para ver la respuesta</p>
            </div>
            {/* reverso */}
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-600/25 to-purple-500/15 p-8 text-center shadow-lg shadow-purple-900/20 backdrop-blur-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-fuchsia-300">Respuesta</p>
              <p className="text-base leading-relaxed text-primary">{card.answer}</p>
            </div>
          </div>
        </div>
      )}

      {/* controles */}
      {!loading && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={prev} title="Anterior" className={controlBtn}>
            <ChevronLeft size={20} />
          </button>
          <button type="button" onClick={shuffle} title="Barajar" className={controlBtn}>
            <Shuffle size={18} />
          </button>
          <button
            type="button"
            onClick={isGenerated ? reset : () => { setIndex(0); setFlipped(false); }}
            title={isGenerated ? "Volver a las predeterminadas" : "Reiniciar"}
            className={controlBtn}
          >
            <RotateCcw size={18} />
          </button>
          <button type="button" onClick={next} title="Siguiente" className={controlBtn}>
            <ChevronRight size={20} />
          </button>
        </div>
      )}

    </div>
  );
}