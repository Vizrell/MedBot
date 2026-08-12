"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, AlertTriangle, Mic, MicOff, FileUp, Image as ImageIcon, MessageSquare, Plus, Trash2, Volume2, VolumeX, Loader2 } from "lucide-react";
import MarkdownContent from "./MarkdownContent";
import { processImage, normalizeMediaType } from "../lib/imageUtils";

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

function cleanForSpeech(text: string): string {
  return text
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/[-•]\s/g, "")
    .replace(/\n+/g, ". ")
    .trim();
}

export default function Tutor() {
  // Estados de la app
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [apiHistory, setApiHistory] = useState<any[]>([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingMedia, setProcessingMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Control de voz del bot
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

  // Cargar chats desde localStorage de forma segura
  useEffect(() => {
    try {
      const savedChats = localStorage.getItem("medbot_local_chats");
      if (savedChats) {
        const parsedChats = JSON.parse(savedChats);
        setChats(parsedChats);
        if (parsedChats.length > 0) {
          const lastChat = parsedChats[0];
          setCurrentChatId(lastChat.id);
          setMessages(lastChat.messages || []);
          setApiHistory(lastChat.apiHistory || []);
        }
      }
    } catch (e) {
      console.warn("Error al cargar historial previo:", e);
    }
  }, []);

  const saveToLocalStorage = (updatedChats: ChatSession[]) => {
    setChats(updatedChats);
    try {
      // Sanitizar antes de guardar para no exceder los 5MB de quota del navegador
      const sanitizedChats = updatedChats.map(c => ({
        ...c,
        messages: (c.messages || []).map(m => ({
          ...m,
          // Mantener vista previa de imagen sólo si es ligera
          image: m.image && m.image.length > 400000 ? undefined : m.image,
        })),
        apiHistory: (c.apiHistory || []).map(entry => {
          if (Array.isArray(entry.content)) {
            return {
              ...entry,
              content: entry.content.map((block: any) => {
                if (block.type === "image") {
                  return { type: "text", text: "[Captura/Imagen médica adjunta procesada]" };
                }
                return block;
              }),
            };
          }
          return entry;
        }),
      }));
      localStorage.setItem("medbot_local_chats", JSON.stringify(sanitizedChats));
    } catch (e) {
      console.warn("No se pudo persistir en localStorage (límite de cuota):", e);
    }
  };

  // Detector de capturas de pantalla pegadas (Ctrl + V / Portapapeles)
  useEffect(() => {
    async function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;

          e.preventDefault();
          setProcessingMedia(true);
          setError(null);

          try {
            const processed = await processImage(file);
            setAttachment({
              type: "image",
              name: "captura_pantalla.jpg",
              content: processed.dataUrl,
              mediaType: processed.mediaType,
            });
            setInput("Analiza esta captura de pantalla médica detalladamente.");
          } catch (err: any) {
            console.error("Error al procesar captura:", err);
            setError("No se pudo procesar la captura de pantalla pegada.");
          } finally {
            setProcessingMedia(false);
          }
          break;
        }
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

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
      setMessages(selected.messages || []);
      setApiHistory(selected.apiHistory || []);
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

  // Enviar mensaje al bot
  async function send(textOverride?: string) {
    const textToSend = textOverride || input;
    const currentAttachment = attachmentRef.current;

    if ((!textToSend.trim() && !currentAttachment) || loading || processingMedia) return;

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
        const base64Raw = currentAttachment.content.includes(",")
          ? currentAttachment.content.split(",")[1]
          : currentAttachment.content;

        const mediaType = normalizeMediaType(currentAttachment.mediaType);

        apiMessageContent = [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
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

    // Optimizar historial para enviar a la API: evitar reenviar imágenes pesadas de turnos anteriores
    const cleanedApiHistory = apiHistory.slice(-8).map(entry => {
      if (Array.isArray(entry.content)) {
        return {
          ...entry,
          content: entry.content.map((block: any) => {
            if (block.type === "image") {
              return { type: "text", text: "[Imagen médica previa enviada]" };
            }
            return block;
          }),
        };
      }
      return entry;
    });

    const newApiEntry = { role: "user" as const, content: apiMessageContent };
    const updatedApiHistory = [...cleanedApiHistory, newApiEntry];
    const updatedMessages = [...messages, userMsg];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setError(null);
    setAttachment(null);

    let chatId = currentChatId;
    let currentChatsCopy = [...chats];

    if (!chatId) {
      chatId = "chat_" + Date.now();
      setCurrentChatId(chatId);
      const newChat: ChatSession = {
        id: chatId,
        title: baseText.length > 30 ? baseText.substring(0, 30) + "..." : baseText,
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

      if (!res.ok) {
        throw new Error(data.error || `Error del servidor (${res.status})`);
      }

      const assistantResponse = data.reply || "No se recibió respuesta del modelo.";

      const finalMessages = [...updatedMessages, { role: "assistant" as const, content: assistantResponse }];
      const finalApiHistory = [...updatedApiHistory, { role: "assistant" as const, content: assistantResponse }];

      setMessages(finalMessages);
      setApiHistory(finalApiHistory);

      const finalChats = currentChatsCopy.map(c =>
        c.id === chatId ? { ...c, messages: finalMessages, apiHistory: finalApiHistory } : c
      );
      saveToLocalStorage(finalChats);

      if (voiceEnabled && (isListening || textOverride)) {
        speak(assistantResponse);
      }

    } catch (err: any) {
      console.error("Error en consulta de chat:", err);
      const errorMsg = err?.message || "Error al conectar con el servidor.";
      setError(errorMsg);

      const fallbackReply = `⚠️ **Error en la consulta:** ${errorMsg}\n\n*Por favor, verifica tu conexión o credenciales de la API.*`;
      const finalMessages = [...updatedMessages, { role: "assistant" as const, content: fallbackReply }];
      setMessages(finalMessages);

      const finalChats = currentChatsCopy.map(c =>
        c.id === chatId ? { ...c, messages: finalMessages } : c
      );
      saveToLocalStorage(finalChats);
    } finally {
      setLoading(false);
    }
  }

  // Voz (Text-to-Speech)
  function speak(text: string) {
    if (!voiceEnabled) return;

    try {
      const cleanedText = cleanForSpeech(text);
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utterance.lang = "es-MX";
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voices = window.speechSynthesis.getVoices();
      const spanishVoice =
        voices.find(v => v.name.includes("Microsoft") && v.lang.startsWith("es")) ||
        voices.find(v => v.lang.startsWith("es"));

      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Error en síntesis de voz:", e);
    }
  }

  // Control de voz para el usuario (SpeechRecognition)
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

  function toggleBotVoiceOutput() {
    if (voiceEnabled) {
      window.speechSynthesis.cancel();
    }
    setVoiceEnabled(!voiceEnabled);
  }

  // Subida manual de archivos
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.type === "application/pdf") {
      if (file.size > 20 * 1024 * 1024) {
        setError("El archivo PDF supera el límite permitido de 20 MB.");
        return;
      }
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
          content: fullText.trim(),
        });

        setInput(`Analiza y resume el contenido de este PDF: "${file.name}"`);
      } catch (err) {
        console.error(err);
        setError("Error al leer el archivo PDF.");
      } finally {
        setLoading(false);
      }
    } else if (file.type.startsWith("image/")) {
      setProcessingMedia(true);
      try {
        const processed = await processImage(file);
        setAttachment({
          type: "image",
          name: file.name,
          content: processed.dataUrl,
          mediaType: processed.mediaType,
        });
        setInput(`Analiza esta imagen médica: "${file.name}"`);
      } catch (err) {
        console.error(err);
        setError("Error al procesar la imagen seleccionada.");
      } finally {
        setProcessingMedia(false);
      }
    } else {
      setError("Solo se aceptan archivos PDF o imágenes válidas (JPG, PNG, WEBP).");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="flex h-screen w-full gap-0 overflow-hidden text-primary">

      {/* Navbar lateral de historial */}
      <div className="w-64 h-full bg-black/30 border-r border-white/10 flex flex-col justify-between backdrop-blur-md shrink-0">
        <div className="flex flex-col flex-1 overflow-hidden p-3 gap-3">
          <button
            onClick={createNewChat}
            className="flex items-center gap-2 w-full border border-purple-500/30 bg-purple-600/10 hover:bg-purple-600/20 text-sm font-medium rounded-xl p-3 text-purple-200 transition-all shadow-md active:scale-[0.98]"
          >
            <Plus size={16} />
            Nueva consulta médica
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
          MANOLIA AI • Visión Médica Activa
        </div>
      </div>

      {/* Contenido principal del chat */}
      <div className="flex-1 flex flex-col h-full bg-transparent p-4 md:p-6 overflow-hidden">
        {error && (
          <div className="mb-3 flex animate-slide-up items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-yellow-300">
            <AlertTriangle size={16} className="flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-yellow-400 hover:text-white font-bold text-xs">✕</button>
          </div>
        )}

        {/* Ventana de mensajes */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-2 pb-4">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-70">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600/30 to-fuchsia-600/20 border border-purple-500/20 flex items-center justify-center">
                <Bot size={36} className="text-purple-300" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-purple-200 mb-1">Pregúntale a MANOLIA lo que necesites</p>
                <p className="max-w-md text-xs text-secondary leading-relaxed">
                  Puedes escribir dudas, pegar capturas de pantalla médicas con <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-purple-300">Ctrl + V</span>, o subir diapositivas y PDFs.
                </p>
              </div>
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
              <div className={`max-w-2xl rounded-3xl border border-purple-500/15 px-5 py-3.5 text-sm leading-relaxed backdrop-blur-md ${msg.role === "user" ? "bg-gradient-to-br from-purple-600/35 to-fuchsia-600/20 text-white" : "bg-white/5 text-slate-100"
                }`}>
                {msg.image && (
                  <img
                    src={msg.image}
                    alt="Captura o imagen adjunta"
                    className="w-full max-h-72 object-contain rounded-xl mb-3 border border-purple-500/20 bg-black/40"
                  />
                )}
                {msg.role === "assistant" ? (
                  <MarkdownContent variant="chat">{msg.content}</MarkdownContent>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
            </div>
          ))}

          {(loading || processingMedia) && (
            <div className="flex animate-slide-up items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-700 to-fuchsia-600">
                <Bot size={18} />
              </div>
              <div className="flex items-center gap-2.5 rounded-3xl border border-purple-500/15 bg-white/5 px-5 py-3.5 backdrop-blur-md text-xs text-purple-200">
                {processingMedia ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-purple-400" />
                    <span>Optimizando captura de pantalla médica...</span>
                  </>
                ) : (
                  <>
                    <span className="size-2 animate-bounce-dot rounded-full bg-purple-400 [animation-delay:0s]" />
                    <span className="size-2 animate-bounce-dot rounded-full bg-purple-400 [animation-delay:150ms]" />
                    <span className="size-2 animate-bounce-dot rounded-full bg-purple-400 [animation-delay:300ms]" />
                    <span className="ml-1 text-[11px] opacity-70">MANOLIA está analizando...</span>
                  </>
                )}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Archivos adjuntos actuales */}
        {attachment && (
          <div className="mb-2 flex animate-slide-up items-center gap-3 rounded-xl border border-purple-500/30 bg-purple-600/15 px-3.5 py-2 text-xs text-purple-200 max-w-xl">
            {attachment.type === "image" ? (
              <img
                src={attachment.content}
                alt="Thumbnail"
                className="w-10 h-10 rounded-lg object-cover border border-purple-400/30 shadow"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center border border-purple-400/30">
                <FileUp size={18} className="text-purple-300" />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium text-purple-100 truncate">{attachment.name}</span>
              <span className="text-[10px] opacity-70">
                {attachment.type === "image" ? "Captura médica optimizada para visión IA" : "Documento PDF listo"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => { setAttachment(null); setInput(""); }}
              className="p-1 rounded-md hover:bg-white/10 text-purple-300 hover:text-white"
              title="Quitar adjunto"
            >
              ✕
            </button>
          </div>
        )}

        {/* Barra de entrada */}
        <div className="flex gap-2 pt-4 border-t border-white/10 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf, image/png, image/jpeg, image/webp"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || processingMedia}
            title="Subir archivo PDF o imagen médica"
            className={`w-12 h-12 rounded-2xl border transition-all flex items-center justify-center ${attachment ? "border-purple-400/50 bg-purple-600/20 text-purple-300" : "border-white/10 bg-white/5 text-secondary hover:bg-white/10 hover:text-primary"
              }`}
          >
            <FileUp size={20} />
          </button>

          <button
            onClick={toggleVoice}
            disabled={loading}
            title={isListening ? "Detener dictado" : "Dictar con voz"}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all ${isListening ? "border-red-500/50 bg-red-600/20 text-red-400 animate-pulse" : "border-white/10 bg-white/5 text-secondary hover:bg-white/10 hover:text-primary"
              }`}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button
            onClick={toggleBotVoiceOutput}
            title={voiceEnabled ? "Silenciar voz de MANOLIA" : "Activar voz de MANOLIA"}
            className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all ${voiceEnabled ? "border-purple-500/40 bg-purple-600/15 text-purple-300" : "border-white/10 bg-white/5 text-secondary/40 hover:bg-white/10"
              }`}
          >
            {voiceEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={
              isListening
                ? "Escuchando tu voz..."
                : attachment
                  ? "Escribe una pregunta sobre la captura o presiona Enviar..."
                  : "Pregúntale a MANOLIA (o presiona Ctrl + V para pegar una captura médica)..."
            }
            disabled={loading || processingMedia}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-primary placeholder:text-secondary/60 outline-none transition-all focus:border-purple-500/50 focus:bg-white/[0.07]"
          />

          <button
            onClick={() => send()}
            disabled={loading || processingMedia || (!input.trim() && !attachment)}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-md ${loading || processingMedia || (!input.trim() && !attachment)
              ? "bg-white/5 text-secondary/40 border border-white/5 cursor-not-allowed"
              : "bg-gradient-to-br from-purple-600 to-fuchsia-500 hover:from-purple-500 hover:to-fuchsia-400 text-white shadow-purple-500/25 active:scale-95"
              }`}
          >
            <Send size={20} />
          </button>
        </div>
      </div>

    </div>
  );
}