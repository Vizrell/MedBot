"use client";
import { useState } from "react";
import { Stethoscope, BookOpen, Sparkles, Activity, HelpCircle } from "lucide-react";
import Tutor from "./components/Tutor";
import Flashcards from "./components/Flashcards";
import Resumir from "./components/Resumir";
import Quiz from "./components/Quiz"; // Importamos tu nuevo componente

const TABS = [
  { id: "tutor", label: "Tutor", icon: Stethoscope },
  { id: "flashcards", label: "Flashcards", icon: BookOpen },
  { id: "quiz", label: "Quiz", icon: HelpCircle }, // Agregado a la barra de navegación
  { id: "resumir", label: "Resumir", icon: Sparkles },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("tutor");

  return (
    // ELIMINADO max-w-2xl: Ahora ocupa el 100% del ancho (w-full)
    <div className="flex flex-col h-screen w-full bg-[#0d0714] overflow-hidden">

      {/* ── Header adaptado a pantallas anchas y móviles ── */}
      <header className="flex items-center justify-between py-4 px-4 md:px-6 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 md:h-11 md:w-11 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-fuchsia-500 shadow-lg shadow-purple-500/30">
            <Activity size={20} className="text-white" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-purple-300 to-fuchsia-400 bg-clip-text text-xl md:text-2xl font-bold text-transparent">
              ManolitoIAPRO
            </h1>
            <p className="text-[10px] md:text-xs text-secondary truncate max-w-[240px] sm:max-w-none">
              Te voy a carrear eso rico culo que te cargas preciosa
            </p>
          </div>
        </div>
      </header>

      {/* ── Tabs Responsivas y centradas con un max-w estético para que no se estiren al infinito ── */}
      <div className="px-4 md:px-6 py-3 border-b border-white/5 shrink-0">
        <nav className="flex gap-1.5 max-w-xl mx-auto w-full">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-2 py-2.5 rounded-xl text-xs md:text-sm transition-all duration-300 select-none ${isActive
                  ? "border border-purple-500/25 bg-gradient-to-br from-purple-600/25 to-fuchsia-500/10 font-semibold text-purple-300 shadow-sm"
                  : "font-normal text-secondary hover:text-primary border border-transparent hover:bg-white/5"
                  }`}
              >
                <Icon size={16} className="shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Contenido Principal expandido al 100% con scroll vertical independiente si el quiz es largo ── */}
      <main className="flex-1 overflow-y-auto flex flex-col w-full p-4">
        {activeTab === "tutor" && <Tutor />}
        {activeTab === "flashcards" && <Flashcards />}
        {activeTab === "quiz" && <Quiz />}
        {activeTab === "resumir" && <Resumir />}
      </main>
    </div>
  );
}