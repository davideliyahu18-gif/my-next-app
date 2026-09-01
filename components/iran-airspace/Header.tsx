"use client";

import { SITE_SUBTITLE_HE, SITE_TITLE_HE } from "@/lib/iran-airspace/constants";
import type { ConnectionState } from "@/lib/iran-airspace/types";

function formatClock(iso: string | null): string {
  if (!iso) return "--:--:--";
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

const DOT_COLOR: Record<ConnectionState, string> = {
  connected: "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]",
  degraded: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]",
  down: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]",
};

const LABEL: Record<ConnectionState, string> = {
  connected: "LIVE",
  degraded: "LIVE (איטי)",
  down: "לא זמין",
};

export default function Header({
  connection,
  lastUpdate,
}: {
  connection: ConnectionState;
  lastUpdate: string | null;
}) {
  return (
    <header className="relative z-20 flex items-center justify-between gap-3 border-b border-sky-400/10 bg-[#050b14]/95 px-3 py-2.5 backdrop-blur-xl sm:px-5 sm:py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none sm:gap-2.5">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_COLOR[connection]} ${connection === "connected" ? "animate-pulse" : ""}`} />
        <span className="text-xs font-bold tracking-widest text-slate-200 sm:text-sm">
          {LABEL[connection]}
        </span>
      </div>

      <div className="min-w-0 flex-1 text-center sm:flex-none">
        <h1 className="truncate text-[15px] font-extrabold tracking-tight text-slate-50 sm:text-2xl">
          {SITE_TITLE_HE}
        </h1>
        <p className="mt-0.5 hidden text-[11px] text-slate-400 sm:block sm:text-xs">
          {SITE_SUBTITLE_HE}
        </p>
      </div>

      <div className="flex flex-1 justify-end sm:flex-none">
        <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-slate-400 sm:text-xs">
          עדכון אחרון: {formatClock(lastUpdate)}
        </span>
      </div>
    </header>
  );
}
