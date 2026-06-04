"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, AlertTriangle, Mic, MicOff, FileUp, Image as ImageIcon } from "lucide-react";
import MarkdownContent from "./MarkdownContent";

interface Message {
  role: "user" | "assistant";
  content: string;
  image?: string;
}

const MOCK_REPLIES = [
  "¡Buena pregunta! La **mitocondria** es conocida como la *central energética* de la célula porque produce la mayor parte del ATP mediante fosforilación oxidativa.",
  "El sistema nervioso se divide en dos partes principales:\n\n- **SNC** (Sistema Nervioso Central): cerebro y médula espinal\n- **SNP** (Sistema Nervioso Periférico): nervios craneales y espinales",
  "La **hemoglobina** es una proteína tetramérica presente en los glóbulos rojos que transporta oxígeno desde los pulmones hacia los tejidos del cuerpo.",
  "Los cuatro tipos principales de tejido en el cuerpo humano son:\n\n1. **Epitelial** — recubrimiento y protección\n2. **Conectivo** — soporte y unión\n3. **Muscular** — movimiento\n4. **Nervioso** — comunicación y control",
  "La presión arterial normal en un adulto se considera alrededor de **120/80 mmHg**. Valores superiores a 140/90 mmHg se clasifican como *hipertensión*.",
];

const MOCK_IMAGE_REPLIES = [
  "He analizado la imagen médica que has subido. Parece ser un corte histológico o una radiografía de estudio. En un entorno real con la clave API activa, podré describirte con precisión anatómica cada hallazgo y patología visible en tu captura.",
  "Captura recibida. Analizando la imagen con criterios de diagnóstico clínico... (Modo de prueba: activa tus créditos de Anthropic para ver la clasificación anatómica completa).",
  "Imagen médica cargada. En la versión de producción, analizaré densidades, tejidos y contrastes para darte un reporte detallado.",
];

export default function Tutor() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [apiHistory, setApiHistory] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [attachment, setAttachment] = useState<{
    type: "pdf" | "image";
    name: string;
    content: string;
    mediaType?: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentRef = useRef(attachment);
  const stoppedRef = useRef(false); // ← ref para controlar el estado de la voz

  useEffect(() => {
    attachmentRef.current = attachment;
  }, [attachment]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Send ──
  async function send(textOverride?: string) {
    const textToSend = textOverride || input;
    const currentAttachment = attachmentRef.current;

    if (!textToSend.trim() || loading) return;

    let apiMessageContent: any = textToSend.trim();
    if (currentAttachment) {
      if (currentAttachment.type === "pdf") {
        apiMessageContent = `[Contenido del PDF "${currentAttachment.name}"]:\n${currentAttachment.content}\n\n---\n\nPregunta del usuario: ${textToSend.trim()}`;
      } else if (currentAttachment.type === "image") {
        const base64Raw = currentAttachment.content.split(",")[1];
        apiMessageContent = [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: currentAttachment.mediaType || "image/jpeg",
              data: base64Raw,
            },
          },
          { type: "text", text: textToSend.trim() },
        ];
      }
    }

    const userMsg: Message = {
      role: "user",
      content: textToSend.trim(),
      image: currentAttachment?.type === "image" ? currentAttachment.content : undefined,
    };

    const newApiEntry = { role: "user" as const, content: apiMessageContent };
    const apiMessages = [...apiHistory.slice(-6), newApiEntry];

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setError(null);

    const isImageSent = currentAttachment?.type === "image";
    setAttachment(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = await res.json();

      if (!res.ok) {
        const mock = isImageSent
          ? MOCK_IMAGE_REPLIES[Math.floor(Math.random() * MOCK_IMAGE_REPLIES.length)]
          : MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
        setMessages((prev) => [...prev, { role: "assistant", content: mock }]);
        setError("Sin créditos disponibles — usando modo de prueba. Intenta más tarde.");
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        setApiHistory((prev) => [
          ...prev,
          newApiEntry,
          { role: "assistant" as const, content: data.reply },
        ]);
      }
    } catch {
      const mock = isImageSent
        ? MOCK_IMAGE_REPLIES[Math.floor(Math.random() * MOCK_IMAGE_REPLIES.length)]
        : MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
      setMessages((prev) => [...prev, { role: "assistant", content: mock }]);
      setError("Sin conexión al servidor — usando modo de prueba.");
    } finally {
      setLoading(false);
    }
  }

  // ── Voice ──
function toggleVoice() {
  // DETENER
  if (isListening) {
    stoppedRef.current = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setIsListening(false);
    return;
  }

  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setError("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.");
    return;
  }

  // Reset limpio antes de empezar
  stoppedRef.current = false;
  let fullTranscript = "";
  let isRestarting = false; // ← evita reinicios en paralelo

  function startRecognition() {
    if (stoppedRef.current || isRestarting) return;
    isRestarting = true;

    const recognition = new SpeechRecognition();
    recognition.lang = "es-MX";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isRestarting = false; // ← ya arrancó, permite futuros reinicios
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (final) fullTranscript += final;
      setInput((fullTranscript + interim).trim());
    };

    recognition.onend = () => {
      isRestarting = false;
      if (stoppedRef.current) {
        // Usuario detuvo — enviar
        setIsListening(false);
        const text = fullTranscript.trim();
        if (text) setTimeout(() => send(text), 100);
      } else {
        // Se cortó solo — reiniciar después de un pequeño delay
        setTimeout(() => startRecognition(), 200);
      }
    };

    recognition.onerror = (event: any) => {
      isRestarting = false;
      if (event.error === "no-speech" || event.error === "aborted") {
        if (!stoppedRef.current) setTimeout(() => startRecognition(), 200);
      } else {
        setError("Error con el micrófono. Intenta de nuevo.");
        stoppedRef.current = true;
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      isRestarting = false;
      if (!stoppedRef.current) setTimeout(() => startRecognition(), 300);
    }
  }

  setIsListening(true);
  startRecognition();
}
  // ── File / Image Upload ──
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > 5 * 1024 * 1024) {
      setError("El archivo no debe superar los 5 MB.");
      return;
    }

    if (file.type === "application/pdf") {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let text = "";
        const decoder = new TextDecoder("utf-8", { fatal: false });
        const raw = decoder.decode(bytes);

        const btMatches = raw.match(/BT\s([\s\S]*?)ET/g);
        if (btMatches) {
          for (const block of btMatches) {
            const tjMatches = block.match(/\(([^)]*)\)/g);
            if (tjMatches) {
              for (const tj of tjMatches) {
                text += tj.slice(1, -1) + " ";
              }
            }
          }
        }

        if (text.trim().length < 20) {
          text = raw.replace(/[^\x20-\x7E\xC0-\xFF\n]/g, " ").replace(/\s{3,}/g, "\n").trim();
          if (text.length > 3000) text = text.slice(0, 3000);
        }

        if (text.trim().length < 10) {
          setError("No se pudo extraer texto del PDF. Intenta con otro archivo.");
          return;
        }

        setAttachment({
          type: "pdf",
          name: file.name,
          content: text.trim().slice(0, 3000),
        });
        setInput(`Analiza y resume el contenido de este PDF: "${file.name}"`);
      } catch {
        setError("Error al leer el archivo PDF.");
      }
    } else if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target?.result as string;
        setAttachment({
          type: "image",
          name: file.name,
          content: base64Data,
          mediaType: file.type,
        });
        setInput(`Analiza esta imagen: "${file.name}"`);
      };
      reader.onerror = () => setError("Error al leer la imagen.");
      reader.readAsDataURL(file);
    } else {
      setError("Solo se aceptan archivos PDF o imágenes (JPG, PNG, WEBP, etc).");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex flex-col h-full gap-0">
      {error && (
        <div className="mb-3 flex animate-slide-up items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-yellow-400">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-2 pb-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
            <Bot size={48} strokeWidth={1.2} />
            <p className="text-center text-sm text-secondary">
              Pregúntale a MedBot lo que necesites
            </p>
            <p className="mx-auto max-w-xs text-center text-xs text-secondary">
              También puedes usar el micrófono 🎤 o subir un PDF 📄
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex animate-slide-up items-start gap-3 ${
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${
              msg.role === "user"
                ? "from-purple-600 to-fuchsia-500"
                : "from-purple-700 to-fuchsia-600"
            }`}>
              {msg.role === "user" ? <User size={18} /> : <Bot size={18} />}
            </div>
            <div className={`max-w-xs rounded-3xl border border-purple-500/15 px-5 py-3.5 text-sm leading-relaxed text-primary backdrop-blur-md ${
              msg.role === "user"
                ? "bg-gradient-to-br from-purple-600/35 to-fuchsia-600/20"
                : "bg-white/5"
            }`}>
              {msg.image && (
                <img
                  src={msg.image}
                  alt="Adjunto"
                  className="w-full max-h-56 object-contain rounded-lg mb-2.5 border border-white/10"
                />
              )}
              {msg.role === "assistant" ? (
                <MarkdownContent variant="chat">{msg.content}</MarkdownContent>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex animate-slide-up items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-700 to-fuchsia-600">
              <Bot size={18} />
            </div>
            <div className="flex items-center gap-1.5 rounded-3xl border border-purple-500/15 bg-white/5 px-5 py-3.5 backdrop-blur-md">
              <span className="size-2 animate-bounce-dot rounded-full bg-purple-400 [animation-delay:0s]" />
              <span className="size-2 animate-bounce-dot rounded-full bg-purple-400 [animation-delay:150ms]" />
              <span className="size-2 animate-bounce-dot rounded-full bg-purple-400 [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {attachment && (
        <div className="mb-2 flex animate-slide-up items-center gap-2 rounded-lg border border-purple-500/25 bg-purple-600/15 px-3.5 py-2 text-xs text-purple-300">
          {attachment.type === "pdf" ? <FileUp size={15} /> : <ImageIcon size={15} />}
          <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
            {attachment.type === "image" && (
              <img
                src={attachment.content}
                alt="Thumbnail"
                className="w-6 h-6 rounded object-cover border border-white/10"
              />
            )}
            {attachment.type === "pdf" ? "📄" : "📷"} {attachment.name} adjunto
          </span>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            className="ml-auto shrink-0 cursor-pointer border-0 bg-transparent text-base leading-none text-purple-300 transition-colors hover:text-purple-200"
            aria-label="Quitar adjunto"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t border-border items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf, image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Subir archivo o imagen"
          className={`w-12 h-12 rounded-2xl border transition-all flex-shrink-0 flex items-center justify-center ${
            attachment
              ? "border-purple-400/50 bg-purple-600/15 text-purple-300"
              : "border-border bg-white/5 text-secondary hover:bg-white/10"
          }`}
        >
          <FileUp size={20} />
        </button>

        <button
          onClick={toggleVoice}
          title={isListening ? "Toca para enviar" : "Activar micrófono"}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all ${
            isListening
              ? "animate-pulse-mic border-red-500/50 bg-red-600/15 text-red-400"
              : "border-border bg-white/5 text-secondary hover:bg-white/10"
          }`}
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={isListening ? "Hablando... toca el mic para enviar" : "Pregúntame algo de medicina..."}
          className="flex-1 rounded-xl border border-border bg-white/5 px-5 py-3.5 text-sm text-primary outline-none transition-all focus:border-purple-500/50 focus:shadow-lg focus:shadow-purple-500/15"
        />

        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className={`w-14 h-14 rounded-xl border-none flex-shrink-0 flex items-center justify-center transition-all ${
            loading || !input.trim()
              ? "cursor-not-allowed bg-white/10 text-secondary"
              : "bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white hover:shadow-lg hover:shadow-purple-500/25"
          }`}
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}