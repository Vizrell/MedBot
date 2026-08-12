"use client";
import { useState } from "react";
import { Sparkles, CheckCircle2, XCircle, RotateCcw, AlertTriangle, FileDown } from "lucide-react";
import { downloadAsWordDocument } from "../lib/wordExport";

interface Question {
    question: string;
    options: string[];
    correctIndex: number;
}

export default function Quiz() {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [index, setIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [score, setScore] = useState(0);
    const [topic, setTopic] = useState("");
    const [loading, setLoading] = useState(false);
    const [quizOver, setQuizOver] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function generateQuiz() {
        if (!topic.trim() || loading) return;
        setLoading(true);
        setQuizOver(false);
        setScore(0);
        setIndex(0);
        setSelectedAnswer(null);
        setQuestions([]);
        setError(null);

        try {
            const res = await fetch("/api/quiz", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic: topic.trim() }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || `Error del servidor (Status ${res.status})`);
            }

            if (!data || typeof data.reply !== "string") {
                throw new Error("La IA no devolvió el formato de texto esperado.");
            }

            const clean = data.reply.replace(/```json/g, "").replace(/```/g, "").trim();
            const parsed: Question[] = JSON.parse(clean);

            if (!Array.isArray(parsed) || parsed.length === 0) {
                throw new Error("El formato del Quiz generado no es un array válido.");
            }

            setQuestions(parsed);
        } catch (err) {
            console.error("Error al generar el quiz:", err);
            setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
        } finally {
            setLoading(false);
        }
    }

    function handleAnswer(optionIndex: number) {
        if (selectedAnswer !== null) return;
        setSelectedAnswer(optionIndex);

        if (optionIndex === questions[index].correctIndex) {
            setScore((s) => s + 1);
        }

        setTimeout(() => {
            if (index + 1 < questions.length) {
                setIndex((i) => i + 1);
                setSelectedAnswer(null);
            } else {
                setQuizOver(true);
            }
        }, 1500);
    }

    function handleDownloadWord() {
        if (questions.length === 0) return;

        let markdownContent = `# Cuestionario de Evaluación Médica: ${topic || "Medicina"}\n\n`;
        markdownContent += `**Total de preguntas:** ${questions.length}\n\n`;
        markdownContent += `---\n\n## Preguntas de Examen\n\n`;

        questions.forEach((q, qIdx) => {
            markdownContent += `### ${qIdx + 1}. ${q.question}\n\n`;
            q.options.forEach((opt, optIdx) => {
                const letter = String.fromCharCode(65 + optIdx);
                markdownContent += `- **${letter})** ${opt}\n`;
            });
            markdownContent += `\n`;
        });

        markdownContent += `---\n\n## Clave de Respuestas Correctas\n\n`;
        markdownContent += `| # | Respuesta Correcta |\n|---|---|\n`;
        questions.forEach((q, qIdx) => {
            const letter = String.fromCharCode(65 + q.correctIndex);
            markdownContent += `| ${qIdx + 1} | **${letter})** ${q.options[q.correctIndex]} |\n`;
        });

        const cleanTopic = (topic || "Quiz_Medico").replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_ -]/g, "").slice(0, 30);
        downloadAsWordDocument(markdownContent, `Quiz_${cleanTopic}.doc`, `Cuestionario: ${topic || "Medicina"}`);
    }

    return (
        <div className="flex h-full flex-col items-center gap-6 py-4 max-w-md mx-auto w-full">
            {/* Selector de tema */}
            <div className="flex w-full gap-2">
                <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && generateQuiz()}
                    placeholder="Tema para el Quiz (ej: Neuroanatomía)..."
                    className="flex-1 rounded-xl border border-border bg-white/5 px-4 py-3 text-sm text-primary outline-none transition-all focus:border-purple-500/50 focus:shadow-lg focus:shadow-purple-500/15"
                />
                <button
                    onClick={generateQuiz}
                    disabled={loading || !topic.trim()}
                    className={`flex items-center gap-2 rounded-xl border-none px-5 py-3 text-sm font-semibold transition-all cursor-pointer ${loading || !topic.trim()
                            ? "cursor-not-allowed bg-white/10 text-secondary"
                            : "bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white hover:shadow-lg hover:shadow-purple-500/25 active:scale-95"
                        }`}
                >
                    <Sparkles size={16} />
                    {loading ? "Creando..." : "Empezar"}
                </button>
            </div>

            {/* Manejo visual de errores integrados */}
            {error && (
                <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-yellow-400">
                    <AlertTriangle size={15} className="flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {loading && (
                <p className="text-sm text-secondary animate-pulse mt-4">
                    Generando cuestionario de nivel médico con IA...
                </p>
            )}

            {/* Pantalla de resultados finales */}
            {quizOver && (
                <div className="w-full text-center p-8 border border-purple-500/25 bg-gradient-to-br from-purple-600/10 to-fuchsia-500/5 rounded-2xl flex flex-col items-center gap-4 shadow-lg">
                    <h3 className="text-xl font-bold text-primary">¡Quiz Terminado!</h3>
                    <p className="text-4xl font-extrabold text-purple-400">
                        {score} / {questions.length}
                    </p>
                    <p className="text-sm text-secondary">
                        {score >= 7 ? "¡Excelente nivel doctor!" : "Buen intento, a repasar un poco más."}
                    </p>
                    <div className="flex gap-2 mt-2">
                        <button
                            onClick={handleDownloadWord}
                            className="flex items-center gap-2 rounded-lg bg-purple-600/25 hover:bg-purple-600/40 px-4 py-2 text-xs text-purple-200 transition-all border border-purple-500/30 cursor-pointer shadow-sm active:scale-95"
                        >
                            <FileDown size={14} className="text-purple-300" /> Descargar en Word
                        </button>
                        <button
                            onClick={() => { setQuestions([]); setQuizOver(false); setTopic(""); }}
                            className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-xs text-primary hover:bg-white/20 transition-all border border-border cursor-pointer"
                        >
                            <RotateCcw size={14} /> Otro Quiz
                        </button>
                    </div>
                </div>
            )}

            {/* Cuerpo del quiz */}
            {questions.length > 0 && !quizOver && !loading && (
                <div className="w-full flex flex-col gap-4">
                    <div className="flex justify-between items-center text-xs text-secondary px-1">
                        <span>Pregunta {index + 1} de {questions.length}</span>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleDownloadWord}
                                className="flex items-center gap-1 text-[11px] text-purple-300 hover:text-purple-200 underline cursor-pointer"
                                title="Descargar cuestionario completo en Word"
                            >
                                <FileDown size={12} /> Word
                            </button>
                            <span className="font-semibold text-purple-400">Puntuación: {score}</span>
                        </div>
                    </div>

                    {/* Pregunta */}
                    <div className="p-6 rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-600/10 to-fuchsia-500/5 min-h-[100px] flex items-center justify-center text-center shadow-md">
                        <p className="text-base font-medium text-primary">{questions[index].question}</p>
                    </div>

                    {/* Opciones */}
                    <div className="flex flex-col gap-2.5 w-full">
                        {questions[index].options.map((option, i) => {
                            let btnStyle = "border-white/10 bg-white/5 hover:bg-white/10 text-primary cursor-pointer";
                            if (selectedAnswer !== null) {
                                if (i === questions[index].correctIndex) {
                                    btnStyle = "border-green-500/50 bg-green-500/20 text-green-300 font-medium";
                                } else if (i === selectedAnswer) {
                                    btnStyle = "border-red-500/50 bg-red-500/20 text-red-300 font-medium";
                                } else {
                                    btnStyle = "border-white/5 bg-white/5 opacity-40 cursor-not-allowed";
                                }
                            }

                            return (
                                <button
                                    key={i}
                                    disabled={selectedAnswer !== null}
                                    onClick={() => handleAnswer(i)}
                                    className={`flex items-center justify-between w-full px-4 py-3.5 text-left text-sm rounded-xl border transition-all duration-200 ${btnStyle}`}
                                >
                                    <span>{option}</span>
                                    {selectedAnswer !== null && i === questions[index].correctIndex && (
                                        <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                                    )}
                                    {selectedAnswer !== null && i === selectedAnswer && i !== questions[index].correctIndex && (
                                        <XCircle size={16} className="text-red-400 flex-shrink-0" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}