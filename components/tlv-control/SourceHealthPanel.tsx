"use client";

import Panel, { PanelHeading } from "./Panel";
import type { SourceHealthEntry } from "@/lib/tlv-control/types";

const STATUS_DOT: Record<SourceHealthEntry["status"], string> = {
  connected: "bg-emerald-400",
  stale: "bg-amber-400",
  unavailable: "bg-red-500",
};

const STATUS_LABEL: Record<SourceHealthEntry["status"], string> = {
  connected: "מחובר",
  stale: "נתונים ישנים",
  unavailable: "לא זמין",
};

function formatAgo(iso: string | null): string {
  if (!iso) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `לפני ${seconds} שנ׳`;
  const minutes = Math.round(seconds / 60);
  return `לפני ${minutes} דק׳`;
}

export default function SourceHealthPanel({ sources }: { sources: SourceHealthEntry[] }) {
  return (
    <Panel>
      <PanelHeading>מקורות מידע</PanelHeading>
      <div className="space-y-1.5 p-3">
        {sources.map((s) => (
          <div key={s.key} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[12px]">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[s.status]}`} />
              <span className="truncate font-semibold text-slate-200">{s.label}</span>
            </div>
            <div className="shrink-0 text-left text-slate-500">
              <div>{STATUS_LABEL[s.status]}</div>
              <div className="text-[10px]">{formatAgo(s.lastSuccessfulUpdate)}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
