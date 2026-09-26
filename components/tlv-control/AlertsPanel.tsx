"use client";

import Panel, { PanelHeading } from "./Panel";
import type { AlertsSnapshot } from "@/lib/tlv-control/types";

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso));
}

export default function AlertsPanel({ alerts }: { alerts: AlertsSnapshot | null }) {
  return (
    <Panel className="flex min-h-0 flex-1 flex-col">
      <PanelHeading>🔔 התרעות פיקוד העורף</PanelHeading>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!alerts || alerts.state === "unavailable" ? (
          <div className="rounded-lg border border-amber-400/20 bg-amber-500/5 p-4">
            <p className="text-sm font-bold text-amber-300">המקור אינו זמין כרגע</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {alerts?.reason ??
                "אין API רשמי וציבורי של פיקוד העורף לשליפת התרעות בזמן אמת. המערכת בנויה כך שברגע שיתפרסם מקור רשמי, ניתן לחבר אותו ישירות לרכיב הזה — אך היא לעולם לא תציג נתוני התרעה מומצאים."}
            </p>
          </div>
        ) : alerts.active.length === 0 ? (
          <p className="px-1 py-8 text-center text-xs text-slate-500">אין התרעות פעילות כרגע</p>
        ) : (
          <div className="space-y-2">
            {alerts.active.map((a) => (
              <div key={a.id} className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-bold text-red-300">{a.category}</span>
                  <span className="font-mono text-slate-400">{formatClock(a.issuedAt)}</span>
                </div>
                <p className="mt-1 text-[12px] text-slate-300">{a.areas.join(", ")}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
