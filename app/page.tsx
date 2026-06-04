"use client";
import { useState } from "react";
import { Stethoscope, BookOpen, Sparkles, Activity } from "lucide-react";
import Tutor from "./components/Tutor";
import Flashcards from "./components/Flashcards";
import Resumir from "./components/Resumir";

const TABS = [
  { id: "tutor",      label: "Tutor",      icon: Stethoscope },
  { id: "flashcards", label: "Flashcards", icon: BookOpen },
  { id: "resumir",    label: "Resumir",    icon: Sparkles },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("tutor");

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto px-5">
      {/* ── Header ── */}
      <header className="flex items-center justify-between py-5 border-b border-border mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-fuchsia-500 shadow-lg shadow-purple-500/30">
            <Activity size={22} className="text-white" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-purple-300 to-fuchsia-400 bg-clip-text text-2xl font-bold text-transparent">
              ManolitoIAPRO
            </h1>
            <p className="text-xs text-secondary">Te voy a carrear eso rico culo que te cargas preciosa</p>
          </div>
        </div>

        {/* Pulse indicator */}
        <div className="flex items-center gap-2 rounded-full border border-purple-500/25 bg-purple-500/10 px-3.5 py-1.5">
          <div className="h-2 w-2 animate-pulse rounded-full bg-purple-400" />
          <span className="text-xs font-medium text-purple-300">Online</span>
        </div>
      </header>

      {/* ── Tabs ── */}
      <nav className="flex gap-1 pb-4 border-b border-border mb-5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-2 py-3 rounded-lg text-sm transition-all duration-300 ${
                isActive
                  ? "border border-purple-500/25 bg-gradient-to-br from-purple-600/25 to-fuchsia-500/10 font-semibold text-purple-300"
                  : "font-normal text-secondary hover:text-primary border border-transparent"
              }`}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Content ── */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "tutor" && <Tutor />}
        {activeTab === "flashcards" && <Flashcards />}
        {activeTab === "resumir" && <Resumir />}
      </main>
    </div>
  );
}