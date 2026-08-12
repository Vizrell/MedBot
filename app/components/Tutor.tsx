"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, AlertTriangle, Mic, MicOff, FileUp, Image as ImageIcon, MessageSquare, Plus, Trash2, Volume2, VolumeX, Loader2, X } from "lucide-react";
import MarkdownContent from "./MarkdownContent";
import { processImage, normalizeMediaType } from "../lib/imageUtils";

interface Attachment {
  id: string;
  type: "pdf" | "image";
  name: string;
  content: string; // DataURL para imágenes o texto extraído para PDFs
  mediaType?: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}

interface Message {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  image?: string; // Compatibilidad con chats previos
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

  // Múltiples archivos adjuntos (capturas o PDFs)
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<Attachment[]>(attachments);
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
          // Mantener vista previa de imágenes sólo si son ligeras
          images: m.images ? m.images.filter(img => img.length <= 350000) : undefined,
          image: m.image && m.image.length > 350000 ? undefined : m.image,
        })),
        apiHistory: (c.apiHistory || []).map(entry => {
          if (Array.isArray(entry.content)) {
            return {
              ...entry,
              content: entry.content.map((block: any) => {
                if (block.type === "image") {
                  return { type: "text", text: "[Captura/Imagen médica procesada]" };
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

  // Detector de capturas de pantalla pegadas (Ctrl + V / Portapapeles) - Múltiples capturas
  useEffect(() => {
    async function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length === 0) return;

      e.preventDefault();
      setProcessingMedia(true);
      setError(null);

      try {
        const processedResults = await Promise.all(
          imageFiles.map(file => processImage(file))
        );

        const newAttachments: Attachment[] = processedResults.map((p, idx) => ({
          id: `img_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
          type: "image",
          name: imageFiles[idx].name || `captura_${idx + 1}.jpg`,
          content: p.dataUrl,
          mediaType: p.mediaType,
        }));

        setAttachments(prev => [...prev, ...newAttachments]);

        setInput(prev =>
          prev.trim()
            ? prev
            : newAttachments.length > 1
              ? `Analiza estas ${newAttachments.length} capturas de pantalla médicas detalladamente.`
              : "Analiza esta captura de pantalla médica detalladamente."
        );
      } catch (err: any) {
        console.error("Error al procesar capturas pegadas:", err);
        setError("No se pudieron procesar las capturas de pantalla pegadas.");
      } finally {
        setProcessingMedia(false);
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function createNewChat() {
    window.speechSynthesis.cancel();
    setCurrentChatId(null);
    setMessages([]);
    setApiHistory([]);
    setInput("");
    setAttachments([]);
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

  function removeAttachment(id: string) {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }

  function clearAllAttachments() {
    setAttachments([]);
  }

  // Enviar mensaje al bot
  async function send(textOverride?: string) {
    const textToSend = textOverride || input;
    const currentAttachments = attachmentsRef.current;

    if ((!textToSend.trim() && currentAttachments.length === 0) || loading || processingMedia) return;

    let baseText = textToSend.trim();
    if (!baseText && currentAttachments.length > 0) {
      const imageCount = currentAttachments.filter(a => a.type === "image").length;
      const pdfCount = currentAttachments.filter(a => a.type === "pdf").length;

      if (imageCount > 0 && pdfCount > 0) {
        baseText = `Analiza las ${imageCount} imágenes y ${pdfCount} documentos adjuntos.`;
      } else if (imageCount > 1) {
        baseText = `Analiza detalladamente estas ${imageCount} capturas e imágenes médicas:`;
      } else if (imageCount === 1) {
        baseText = `Analiza esta imagen médica: "${currentAttachments[0].name}"`;
      } else {
        baseText = `Analiza y resume el contenido de estos ${pdfCount} documentos PDF:`;
      }
    }

    // Construir bloques de contenido multimodal para la API de Claude
    const contentBlocks: any[] = [];
    const imageAttachments = currentAttachments.filter(a => a.type === "image");
    const pdfAttachments = currentAttachments.filter(a => a.type === "pdf");

    // Agregar todas las imágenes como bloques de imagen
    for (const img of imageAttachments) {
      const base64Raw = img.content.includes(",")
        ? img.content.split(",")[1]
        : img.content;

      const mediaType = normalizeMediaType(img.mediaType);

      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64Raw,
        },
      });
    }

    // Integrar contenido textual de PDFs si los hay
    let promptText = baseText;
    if (pdfAttachments.length > 0) {
      const pdfDescriptions = pdfAttachments
        .map((p, idx) => `--- [Documento PDF ${idx + 1}: "${p.name}"] ---\n${p.content}`)
        .join("\n\n");
      promptText = `${pdfDescriptions}\n\n---\n\nConsulta del usuario: ${baseText}`;
    }

    contentBlocks.push({
      type: "text",
      text: promptText,
    });

    const apiMessageContent = contentBlocks.length === 1 && contentBlocks[0].type === "text"
      ? promptText
      : contentBlocks;

    const userMsg: Message = {
      role: "user",
      content: baseText,
      images: imageAttachments.map(img => img.content),
    };

    // Optimizar historial: convertir imágenes de turnos antiguos a texto para ahorrar miles de tokens
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
    setAttachments([]);

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

  // Subida manual de múltiples archivos
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    setProcessingMedia(true);

    const fileList = Array.from(files);
    const newAttachments: Attachment[] = [];

    try {
      for (const file of fileList) {
        if (file.type === "application/pdf") {
          if (file.size > 20 * 1024 * 1024) {
            setError(`El archivo "${file.name}" supera el límite de 20 MB.`);
            continue;
          }

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

          if (fullText.trim().length >= 20) {
            newAttachments.push({
              id: `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              type: "pdf",
              name: file.name,
              content: fullText.trim(),
            });
          } else {
            setError(`No se pudo extraer texto legible del PDF "${file.name}".`);
          }
        } else if (file.type.startsWith("image/")) {
          const processed = await processImage(file);
          newAttachments.push({
            id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: "image",
            name: file.name,
            content: processed.dataUrl,
            mediaType: processed.mediaType,
          });
        }
      }

      if (newAttachments.length > 0) {
        setAttachments(prev => [...prev, ...newAttachments]);
        setInput(prev =>
          prev.trim()
            ? prev
            : newAttachments.length > 1
              ? `Analiza estos ${newAttachments.length} archivos adjuntos.`
              : `Analiza este archivo: "${newAttachments[0].name}"`
        );
      }
    } catch (err: any) {
      console.error("Error al procesar archivos:", err);
      setError("Error al procesar los archivos seleccionados.");
    } finally {
      setProcessingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
          MANOLIA AI • Visión Multimodal Activa
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
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600/30 to-fuchsia-600/20 border border-purple-500/20 flex items-center justify-center shadow-lg shadow-purple-500/10">
                <Bot size={36} className="text-purple-300" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-purple-200 mb-1">Pregúntale a MANOLIA lo que necesites</p>
                <p className="max-w-md text-xs text-secondary leading-relaxed">
                  Puedes escribir dudas, pegar varias capturas con <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-purple-300">Ctrl + V</span> o subir múltiples imágenes médicas y PDFs a la vez.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const allImages = msg.images && msg.images.length > 0
              ? msg.images
              : msg.image
                ? [msg.image]
                : [];

            return (
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
                  {/* Galería de imágenes adjuntas en el mensaje */}
                  {allImages.length > 0 && (
                    <div className={`grid gap-2 mb-3 ${
                      allImages.length === 1
                        ? "grid-cols-1"
                        : allImages.length === 2
                          ? "grid-cols-2"
                          : "grid-cols-2 sm:grid-cols-3"
                    }`}>
                      {allImages.map((imgUrl, imgIdx) => (
                        <div key={imgIdx} className="relative group rounded-xl overflow-hidden border border-purple-500/20 bg-black/40">
                          <img
                            src={imgUrl}
                            alt={`Captura ${imgIdx + 1}`}
                            className="w-full h-44 object-contain group-hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.role === "assistant" ? (
                    <MarkdownContent variant="chat">{msg.content}</MarkdownContent>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              </div>
            );
          })}

          {(loading || processingMedia) && (
            <div className="flex animate-slide-up items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-700 to-fuchsia-600">
                <Bot size={18} />
              </div>
              <div className="flex items-center gap-2.5 rounded-3xl border border-purple-500/15 bg-white/5 px-5 py-3.5 backdrop-blur-md text-xs text-purple-200">
                {processingMedia ? (
                  <>
                    <Loader2 size={14} className="animate-spin text-purple-400" />
                    <span>Procesando y optimizando capturas médicas...</span>
                  </>
                ) : (
                  <>
                    <span className="size-2 animate-bounce-dot rounded-full bg-purple-400 [animation-delay:0s]" />
                    <span className="size-2 animate-bounce-dot rounded-full bg-purple-400 [animation-delay:150ms]" />
                    <span className="size-2 animate-bounce-dot rounded-full bg-purple-400 [animation-delay:300ms]" />
                    <span className="ml-1 text-[11px] opacity-70">MANOLIA está analizando tus capturas...</span>
                  </>
                )}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Barra de previsualización de múltiples archivos adjuntos */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-col gap-1.5 animate-slide-up p-2.5 rounded-2xl border border-purple-500/30 bg-purple-950/40 backdrop-blur-md">
            <div className="flex items-center justify-between px-1 text-[11px] text-purple-300 font-medium">
              <span>
                {attachments.length} {attachments.length === 1 ? "archivo adjunto" : "archivos adjuntos"} listos
              </span>
              <button
                type="button"
                onClick={clearAllAttachments}
                className="text-[10px] text-purple-400 hover:text-red-400 transition-colors"
              >
                Limpiar todo
              </button>
            </div>

            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="group relative flex items-center gap-2 rounded-xl border border-purple-500/25 bg-purple-600/15 p-1.5 pr-3 text-xs text-purple-200 max-w-[220px]"
                >
                  {att.type === "image" ? (
                    <img
                      src={att.content}
                      alt={att.name}
                      className="w-8 h-8 rounded-lg object-cover border border-purple-400/30 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center border border-purple-400/30 shrink-0">
                      <FileUp size={14} className="text-purple-300" />
                    </div>
                  )}

                  <span className="truncate text-[11px] flex-1 font-medium">{att.name}</span>

                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="p-1 rounded-md text-purple-300 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                    title="Eliminar este archivo"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Barra de entrada */}
        <div className="flex gap-2 pt-4 border-t border-white/10 items-center">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf, image/png, image/jpeg, image/webp"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || processingMedia}
            title="Subir archivos o múltiples imágenes médicas"
            className={`w-12 h-12 rounded-2xl border transition-all flex items-center justify-center ${attachments.length > 0 ? "border-purple-400/50 bg-purple-600/20 text-purple-300" : "border-white/10 bg-white/5 text-secondary hover:bg-white/10 hover:text-primary"
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
                : attachments.length > 0
                  ? `Escribe una duda sobre las ${attachments.length} capturas o presiona Enviar...`
                  : "Pregúntale a MANOLIA (o pega varias capturas con Ctrl + V)..."
            }
            disabled={loading || processingMedia}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-primary placeholder:text-secondary/60 outline-none transition-all focus:border-purple-500/50 focus:bg-white/[0.07]"
          />

          <button
            onClick={() => send()}
            disabled={loading || processingMedia || (!input.trim() && attachments.length === 0)}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-md ${loading || processingMedia || (!input.trim() && attachments.length === 0)
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