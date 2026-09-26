"use client";

import type { ConnectionState } from "./types";

const DOT_COLOR: Record<ConnectionState, string> = {
  connected: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]",
  degraded: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]",
  down: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]",
};

const LABEL: Record<ConnectionState, string> = {
  connected: "LIVE",
  degraded: "LIVE (חלקי)",
  down: "לא זמין",
};

export default function Header({
  connection,
  emergencyActive,
}: {
  connection: ConnectionState;
  emergencyActive: boolean;
}) {
  return (
    <header
      className={`relative z-20 flex items-center justify-between gap-2 border-b backdrop-blur-xl px-3 py-2.5 transition-colors sm:px-5 sm:py-3 ${
        emergencyActive ? "border-red-500/40 bg-red-950/70" : "border-sky-400/10 bg-[#050b14]/95"
      }`}
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.625rem)" }}
    >
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_COLOR[connection]} ${connection === "connected" ? "animate-pulse" : ""}`} />
        <span className="text-[11px] font-bold tracking-widest text-slate-200 sm:text-sm">{LABEL[connection]}</span>
      </div>

      <div className="min-w-0 flex-1 text-center">
        <h1 className="truncate text-[13px] font-extrabold tracking-tight text-slate-50 sm:text-2xl">
          🛫 מרכז בקרה אווירי – נתב״ג
        </h1>
        <p className="mt-0.5 hidden text-[11px] text-slate-400 sm:block sm:text-xs">
          מטוסים חיים, המראות ונחיתות, מזג אוויר ומידע תעופתי — נתב״ג
        </p>
      </div>

      <div className="w-[70px] shrink-0 sm:w-24" />
    </header>
  );
}
