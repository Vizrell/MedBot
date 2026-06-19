"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, AlertTriangle, Mic, MicOff, FileUp, Image as ImageIcon, MessageSquare, Plus, Trash2, Volume2, VolumeX } from "lucide-react";
import MarkdownContent from "./MarkdownContent";

interface Message {
  role: "user" | "assistant";
  content: string;
  image?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  apiHistory: any[];
  createdAt: string;
}

const MOCK_REPLIES = [
  "¡Buena pregunta! La **mitocondria** es conocida como la *central energética* de la célula porque produce la mayor parte del ATP mediante fosforilación oxidativa.",
  "El sistema nervioso se divide en dos partes principales:\n\n- **SNC** (Sistema Nervioso Central): cerebro y médula espinal\n- **SNP** (Sistema Periférico): nervios craneales y espinales",
  "La **hemoglobina** es una proteína tetramérica presente en los glóbulos rojos que transporta oxígeno desde los pulmones hacia los tejidos del cuerpo.",
  "Los cuatro tipos principales de tejido en el cuerpo humano son:\n\n1. **Epitelial** — recubrimiento y protección\n2. **Conectivo** — soporte y unión\n3. **Muscular** — movimiento\n4. **Nervioso** — comunicación y control",
  "La presión arterial normal en un adulto se considera alrededor de **120/80 mmHg**. Valores superiores a 140/90 mmHg se clasifican como *hipertensión*.",
];

const MOCK_IMAGE_REPLIES = [
  "He analizado la imagen médica que has subido. Parece ser un corte histológico o una radiografía de estudio. En un entorno real con la clave API activa, podré describirte con precisión anatómica cada hallazgo y patología visible en tu captura.",
  "Captura recibida. Analizando la imagen con criterios de diagnóstico clínico... (Modo de prueba: activa tus créditos de Anthropic para ver la clasificación anatómica completa).",
  "Imagen médica cargada. En la versión de producción, analizaré densidades, tejidos y contrastes para darte un reporte detallado.",
];

function cleanForSpeech(text: string): string {
  return text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.*?)\*\"/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/[-•]\s/g, "")
    .replace(/\n+/g, ". ")
    .trim();
}

export default function Tutor() {
  // states app
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [apiHistory, setApiHistory] = useState<any[]>([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  // control de voz del bot
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);

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
  const stoppedRef = useRef(false);

  // cargar chats desde el local storage
  useEffect(() => {
    const savedChats = localStorage.getItem("medbot_local_chats");
    if (savedChats) {
      const parsedChats = JSON.parse(savedChats);
      setChats(parsedChats);
      if (parsedChats.length > 0) {
        const lastChat = parsedChats[0];
        setCurrentChatId(lastChat.id);
        setMessages(lastChat.messages);
        setApiHistory(lastChat.apiHistory);
      }
    }
  }, []);

  // detector de screen shots
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = (event) => {
            const base64Result = event.target?.result as string;

            setAttachment({
              type: "image",
              name: "captura_portapapeles.png",
              content: base64Result,
              mediaType: item.type,
            });

            
            setInput("Analiza esta captura de pantalla médica");
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const saveToLocalStorage = (updatedChats: ChatSession[]) => {
    setChats(updatedChats);
    localStorage.setItem("medbot_local_chats", JSON.stringify(updatedChats));
  };

  useEffect(() => {
    attachmentRef.current = attachment;
  }, [attachment]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function createNewChat() {
    window.speechSynthesis.cancel();
    setCurrentChatId(null);
    setMessages([]);
    setApiHistory([]);
    setInput("");
    setAttachment(null);
  }

  function selectChat(chatId: string) {
    window.speechSynthesis.cancel();
    const selected = chats.find(c => c.id === chatId);
    if (selected) {
      setCurrentChatId(selected.id);
      setMessages(selected.messages);
      setApiHistory(selected.apiHistory);
    }
  }

  function deleteChat(chatId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updatedChats = chats.filter(c => c.id !== chatId);
    saveToLocalStorage(updatedChats);

    if (currentChatId === chatId) {
      createNewChat();
    }
  }

  // enviar mensaje
  async function send(textOverride?: string) {
    const textToSend = textOverride || input;
    const currentAttachment = attachmentRef.current;

    if ((!textToSend.trim() && !currentAttachment) || loading) return;

    // fallos si la caja de texto queda vacía pero hay un archivo
    let baseText = textToSend.trim();
    if (!baseText && currentAttachment) {
      baseText = currentAttachment.type === "pdf"
        ? `Analiza y resume el contenido de este PDF: "${currentAttachment.name}"`
        : `Analiza esta imagen médica: "${currentAttachment.name}"`;
    }

    let apiMessageContent: any = baseText;
    if (currentAttachment) {
      if (currentAttachment.type === "pdf") {
        apiMessageContent = `[Contenido completo del PDF "${currentAttachment.name}"]: \n${currentAttachment.content}\n\n---\n\nPregunta del usuario: ${baseText}`;
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
          { type: "text", text: baseText },
        ];
      }
    }

    const userMsg: Message = {
      role: "user",
      content: baseText,
      image: currentAttachment?.type === "image" ? currentAttachment.content : undefined,
    };

    const newApiEntry = { role: "user" as const, content: apiMessageContent };
    const updatedApiHistory = [...apiHistory.slice(-10), newApiEntry];
    const updatedMessages = [...messages, userMsg];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setError(null);

    const isImageSent = currentAttachment?.type === "image";
    setAttachment(null);

    let chatId = currentChatId;
    let currentChatsCopy = [...chats];

    if (!chatId) {
      chatId = "chat_" + Date.now();
      setCurrentChatId(chatId);
      const newChat: ChatSession = {
        id: chatId,
        title: baseText.length > 25 ? baseText.substring(0, 25) + "..." : baseText,
        messages: updatedMessages,
        apiHistory: updatedApiHistory,
        createdAt: new Date().toLocaleDateString(),
      };
      currentChatsCopy = [newChat, ...currentChatsCopy];
    } else {
      currentChatsCopy = currentChatsCopy.map(c =>
        c.id === chatId ? { ...c, messages: updatedMessages, apiHistory: updatedApiHistory } : c
      );
    }
    saveToLocalStorage(currentChatsCopy);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedApiHistory }),
      });
      const data = await res.json();

      let assistantResponse = "";

      if (!res.ok) {
        throw new Error(data.error || "Error al consultar");
      } else {
        assistantResponse = data.reply;
      }

      const finalMessages = [...updatedMessages, { role: "assistant" as const, content: assistantResponse }];
      const finalApiHistory = [...updatedApiHistory, { role: "assistant" as const, content: assistantResponse }];

      setMessages(finalMessages);
      setApiHistory(finalApiHistory);

      const finalChats = currentChatsCopy.map(c =>
        c.id === chatId ? { ...c, messages: finalMessages, apiHistory: finalApiHistory } : c
      );
      saveToLocalStorage(finalChats);

      // solo habla si el interruptor de voz está encendido
      if (voiceEnabled && (isListening || textOverride)) speak(assistantResponse);

    } catch {
      const mock = isImageSent
        ? MOCK_IMAGE_REPLIES[Math.floor(Math.random() * MOCK_IMAGE_REPLIES.length)]
        : MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];

      const finalMessages = [...updatedMessages, { role: "assistant" as const, content: mock }];
      setMessages(finalMessages);
      setError("Sin conexión al servidor — usando modo de prueba.");

      const finalChats = currentChatsCopy.map(c =>
        c.id === chatId ? { ...c, messages: finalMessages } : c
      );
      saveToLocalStorage(finalChats);

      if (voiceEnabled && (isListening || textOverride)) speak(mock);
    } finally {
      setLoading(false);
    }
  }

  // Voz
  function speak(text: string) {
    if (!voiceEnabled) return;

    const cleanedText = cleanForSpeech(text);
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = "es-MX";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const spanishVoice =
      voices.find(v => v.name.includes("Microsoft")) ||
      voices.find(v => v.lang.startsWith("es"));

    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  // control de voz para el usuario
  function toggleVoice() {
    if (isListening) {
      stoppedRef.current = true;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.");
      return;
    }

    stoppedRef.current = false;
    let fullTranscript = "";
    let isRestarting = false;

    function startRecognition() {
      if (stoppedRef.current || isRestarting) return;
      isRestarting = true;

      const recognition = new SpeechRecognition();
      recognition.lang = "es-MX";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => { isRestarting = false; };

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript + " ";
          else interim += event.results[i][0].transcript;
        }
        if (final) fullTranscript += final;
        setInput((fullTranscript + interim).trim());
      };

      recognition.onend = () => {
        isRestarting = false;
        if (stoppedRef.current) {
          setIsListening(false);
          const text = fullTranscript.trim();
          if (text) setTimeout(() => send(text), 100);
        } else {
          setTimeout(() => startRecognition(), 200);
        }
      };

      recognition.onerror = () => {
        isRestarting = false;
        if (!stoppedRef.current) setTimeout(() => startRecognition(), 200);
      };

      recognitionRef.current = recognition;
      try { recognition.start(); } catch { isRestarting = false; }
    }

    setIsListening(true);
    startRecognition();
  }

  // alternar silencio al audio del bot
  function toggleBotVoiceOutput() {
    if (voiceEnabled) {
      window.speechSynthesis.cancel(); // detiene el habla actual inmediatamente si se desactiva
    }
    setVoiceEnabled(!voiceEnabled);
  }

  // subida de archivos manual 
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > 20 * 1024 * 1024) {
      setError("El archivo supera el límite permitido de 20 MB.");
      return;
    }

    if (file.type === "application/pdf") {
      setLoading(true);
      setError(null);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            // @ts-ignore
            .map((item) => item.str || "")
            .join(" ");
          fullText += pageText + "\n";
        }

        if (fullText.trim().length < 20) {
          setError("No se pudo extraer texto legible del PDF. Verifica que no sea puramente un escaneo de imágenes.");
          setLoading(false);
          return;
        }

        setAttachment({
          type: "pdf",
          name: file.name,
          content: fullText.trim()
        });

        setInput(`Analiza y resume el contenido de este PDF: "${file.name}"`);
      } catch (err) {
        console.error(err);
        setError("Error al leer el archivo PDF con el cargador dinámico.");
      } finally {
        setLoading(false);
      }
    } else if (file.type.startsWith("image/")) {
      if (file.size > 4 * 1024 * 1024) {
        setError("Para capturas o imágenes médicas, se recomienda un peso menor a 4 MB por restricciones de Vercel.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachment({
          type: "image",
          name: file.name,
          content: event.target?.result as string,
          mediaType: file.type
        });
        setInput(`Analiza esta imagen: "${file.name}"`);
      };
      reader.readAsDataURL(file);
    } else {
      setError("Solo se aceptan archivos PDF o imágenes válidas.");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex h-screen w-full gap-0 overflow-hidden text-primary">

      {/* navbar lateral */}
      <div className="w-64 h-full bg-black/30 border-r border-white/10 flex flex-col justify-between backdrop-blur-md shrink-0">
        <div className="flex flex-col flex-1 overflow-hidden p-3 gap-3">
          <button
            onClick={createNewChat}
            className="flex items-center gap-2 w-full border border-purple-500/30 bg-purple-600/10 hover:bg-purple-600/20 text-sm font-medium rounded-xl p-3 text-purple-200 transition-all shadow-md active:scale-[0.98]"
          >
            <Plus size={16} />
            Nuevo historial médico
          </button>

          <div className="flex flex-col gap-1 overflow-y-auto flex-1 pr-1 select-none">
            <p className="text-[10px] uppercase tracking-wider font-semibold opacity-40 px-2 py-1">Historial Reciente</p>
            {chats.length === 0 ? (
              <p className="text-xs opacity-30 text-center py-4 italic">No hay consultas guardadas</p>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => selectChat(chat.id)}
                  className={`group flex items-center justify-between w-full rounded-xl px-3 py-2.5 text-xs font-medium cursor-pointer transition-all ${currentChatId === chat.id
                    ? "bg-gradient-to-r from-purple-600/30 to-fuchsia-600/15 border border-purple-500/20 text-purple-200"
                    : "hover:bg-white/5 text-secondary"
                    }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare size={14} className="opacity-60 shrink-0" />
                    <span className="truncate">{chat.title}</span>
                  </div>
                  <button
                    onClick={(e) => deleteChat(chat.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-500/20 text-secondary hover:text-red-400 transition-all"
                    title="Eliminar consulta"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-3 border-t border-white/5 bg-black/10 text-[11px] opacity-40 text-center font-mono">
          MedBot Local Storage v1.0
        </div>
      </div>

      {/*  contenido del area del chat principal */}
      <div className="flex-1 flex flex-col h-full bg-transparent p-4 md:p-6 overflow-hidden">
        {error && (
          <div className="mb-3 flex animate-slide-up items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-yellow-400">
            <AlertTriangle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ventana de mensajes */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-2 pb-4">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
              <Bot size={48} strokeWidth={1.2} />
              <p className="text-center text-sm text-secondary">Pregúntale a MANOLIA lo que necesites</p>
              <p className="mx-auto max-w-xs text-center text-xs text-secondary">
                Tu historial de consultas se guardará automáticamente en el panel izquierdo.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex animate-slide-up items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${msg.role === "user" ? "from-purple-600 to-fuchsia-500" : "from-purple-700 to-fuchsia-600"
                }`}>
                {msg.role === "user" ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div className={`max-w-xl rounded-3xl border border-purple-500/15 px-5 py-3.5 text-sm leading-relaxed backdrop-blur-md ${msg.role === "user" ? "bg-gradient-to-br from-purple-600/35 to-fuchsia-600/20" : "bg-white/5"
                }`}>
                {msg.image && (
                  <img src={msg.image} alt="Adjunto" className="w-full max-h-56 object-contain rounded-lg mb-2.5 border border-white/10" />
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

        {/* archivos adjuntos actuales */}
        {attachment && (
          <div className="mb-2 flex animate-slide-up items-center gap-2 rounded-lg border border-purple-500/25 bg-purple-600/15 px-3.5 py-2 text-xs text-purple-300 max-w-xl">
            {attachment.type === "pdf" ? <FileUp size={15} /> : <ImageIcon size={15} />}
            <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
              {attachment.type === "image" && (
                <img src={attachment.content} alt="Thumbnail" className="w-6 h-6 rounded object-cover border border-white/10" />
              )}
              {attachment.type === "pdf" ? "📄" : "📷"} {attachment.name} ({((attachment.content.length * 2) / 1024).toFixed(1)} KB extraídos)
            </span>
            <button type="button" onClick={() => { setAttachment(null); setInput(""); }} className="ml-auto text-purple-300 hover:text-purple-100 font-bold">✕</button>
          </div>
        )}

        {/* input Bar */}
        <div className="flex gap-2 pt-4 border-t border-white/10 items-center">
          <input ref={fileInputRef} type="file" accept=".pdf, image/*" onChange={handleFileUpload} className="hidden" />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            title="Subir archivo"
            className={`w-12 h-12 rounded-2xl border transition-all flex items-center justify-center ${attachment ? "border-purple-400/50 bg-purple-600/15 text-purple-300" : "border-white/10 bg-white/5 text-secondary hover:bg-white/10"
              }`}
          >
            <FileUp size={20} />
          </button>

          <button
            onClick={toggleVoice}
            title={isListening ? "Detener" : "Hablar"}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all ${isListening ? "border-red-500/50 bg-red-600/15 text-red-400 animate-pulse" : "border-white/10 bg-white/5 text-secondary hover:bg-white/10"
              }`}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* botón de control de voz del Bot */}
          <button
            onClick={toggleBotVoiceOutput}
            title={voiceEnabled ? "Silenciar respuestas del bot" : "Escuchar respuestas del bot"}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all ${voiceEnabled ? "border-purple-500/30 bg-purple-600/10 text-purple-400" : "border-white/10 bg-white/5 text-secondary/50 hover:bg-white/10"
              }`}
          >
            {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={isListening ? "Escuchando... presione Enter o el botón para enviar" : attachment ? "Escribe una duda sobre el archivo o presiona Enviar..." : "Pregúntame algo de medicina (PDF hasta 20MB o pega una captura)..."}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-primary outline-none transition-all focus:border-purple-500/50"
          />

          <button
            onClick={() => send()}
            disabled={loading || (!input.trim() && !attachment)}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${loading || (!input.trim() && !attachment) ? "bg-white/5 text-secondary cursor-not-allowed" : "bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white"
              }`}
          >
            <Send size={20} />
          </button>
        </div>
      </div>

    </div>
  );
}