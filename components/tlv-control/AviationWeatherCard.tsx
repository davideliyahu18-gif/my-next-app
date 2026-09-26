"use client";

import Panel, { PanelHeading } from "./Panel";
import type { AviationWeatherSnapshot } from "@/lib/tlv-control/types";

function formatClock(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export default function AviationWeatherCard({ data }: { data: AviationWeatherSnapshot | null }) {
  if (!data || !data.ok) {
    return (
      <Panel>
        <PanelHeading>מזג אוויר תעופתי — {data?.station ?? "LLBG"}</PanelHeading>
        <p className="px-4 pb-4 pt-2 text-sm text-slate-500">המקור אינו זמין כרגע{data?.error ? ` (${data.error})` : ""}</p>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeading>מזג אוויר תעופתי — {data.station}</PanelHeading>
      <div className="space-y-3 p-4">
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-bold text-slate-300">METAR</span>
            <span>עודכן: {formatClock(data.metarObservedAt)}</span>
          </div>
          <p className="rounded-md border border-white/5 bg-black/30 p-2.5 font-mono text-[12px] leading-relaxed text-slate-200 break-words">
            {data.metarRaw || "—"}
          </p>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-bold text-slate-300">TAF</span>
            <span>הופק: {formatClock(data.tafIssuedAt)}</span>
          </div>
          <p className="rounded-md border border-white/5 bg-black/30 p-2.5 font-mono text-[12px] leading-relaxed text-slate-200 break-words whitespace-pre-wrap">
            {data.tafRaw || "—"}
          </p>
        </div>
      </div>
    </Panel>
  );
}
