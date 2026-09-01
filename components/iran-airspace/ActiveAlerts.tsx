"use client";

import { useState } from "react";
import Panel, { PanelHeading } from "./Panel";
import { CATEGORY_COLORS } from "@/lib/iran-airspace/constants";
import type { AircraftCategory } from "@/lib/iran-airspace/types";

export type AlertEntry = {
  id: string;
  hex: string;
  category: AircraftCategory;
  text: string;
  time: string;
};

function PlaneGlyph({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className="mt-0.5 shrink-0">
      <path
        d="M12 1.5 14.1 8.6 21.5 12 14.1 13.6 13 22 12 19.5 11 22 9.9 13.6 2.5 12 9.9 8.6 12 1.5Z"
        fill={color}
      />
    </svg>
  );
}

export default function ActiveAlerts({
  alerts,
  onSelect,
}: {
  alerts: AlertEntry[];
  onSelect: (hex: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? alerts : alerts.slice(0, 5);

  return (
    <Panel>
      <PanelHeading>
        התראות פעילות
        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-300">
          {alerts.length}
        </span>
      </PanelHeading>
      <div className="max-h-72 space-y-1 overflow-y-auto p-2.5">
        {visible.length === 0 ? (
          <p className="px-1 py-4 text-center text-xs text-slate-500">אין התראות פעילות</p>
        ) : (
          visible.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect(a.hex)}
              className="flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-right transition-colors hover:bg-white/5"
            >
              <PlaneGlyph color={CATEGORY_COLORS[a.category]} />
              <span className="min-w-0 flex-1 text-[12px] leading-snug text-slate-300">
                <span className="font-mono text-slate-500">{a.time}</span> {a.text}
              </span>
            </button>
          ))
        )}
      </div>
      {alerts.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="block w-full border-t border-white/5 py-2 text-center text-xs font-bold text-red-300 hover:bg-red-500/5"
        >
          {expanded ? "הצג פחות" : "הצג את כל ההתראות"}
        </button>
      )}
    </Panel>
  );
}
