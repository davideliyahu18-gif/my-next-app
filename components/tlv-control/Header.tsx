"use client";

import type { ConnectionState, SourceConnections } from "./types";

const DOT_COLOR: Record<ConnectionState, string> = {
  connected: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]",
  degraded: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]",
  down: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]",
  off: "bg-slate-600",
};

const SHORT_LABEL: Record<ConnectionState, string> = {
  connected: "LIVE",
  degraded: "חלקי",
  down: "לא זמין",
  off: "לא מחובר",
};

type SourceBadge = { key: keyof SourceConnections; emoji: string; label: string };

const BADGES: SourceBadge[] = [
  { key: "aircraft", emoji: "🛩️", label: "מטוסים" },
  { key: "bgn", emoji: "✈️", label: "נתב״ג" },
  { key: "weather", emoji: "🌦️", label: "מזג אוויר" },
  { key: "alerts", emoji: "🚨", label: "התרעות" },
];

export default function Header({
  sources,
  emergencyActive,
}: {
  sources: SourceConnections;
  emergencyActive: boolean;
}) {
  return (
    <header
      className={`relative z-20 flex items-center justify-between gap-2 border-b backdrop-blur-xl px-3 py-2.5 transition-colors sm:px-5 sm:py-3 ${
        emergencyActive ? "border-red-500/40 bg-red-950/70" : "border-sky-400/10 bg-[#050b14]/95"
      }`}
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.625rem)" }}
    >
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        {BADGES.map((badge) => {
          const state = sources[badge.key];
          return (
            <div key={badge.key} className="flex items-center gap-1" title={`${badge.label}: ${SHORT_LABEL[state]}`}>
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[state]} ${state === "connected" ? "animate-pulse" : ""}`}
              />
              <span aria-hidden className="text-[11px] sm:text-xs">
                {badge.emoji}
              </span>
              <span className="hidden text-[10px] font-bold tracking-wide text-slate-300 sm:inline">{badge.label}</span>
            </div>
          );
        })}
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
