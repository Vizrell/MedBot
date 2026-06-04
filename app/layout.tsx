import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Manolito — Asistente de Medicina",
  description:
    "Manolito, tu asistente de IA para estudiantes de medicina. Tutor, Flashcards y Resúmenes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full">
      <body
        className={`${inter.className} min-h-full antialiased bg-gradient-to-b from-slate-900 via-surface to-purple-950 text-primary selection:bg-purple-500/40`}
      >
        {children}
      </body>
    </html>
  );
}
