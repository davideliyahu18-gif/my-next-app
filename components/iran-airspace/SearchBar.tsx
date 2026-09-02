"use client";

import { useMemo, useState } from "react";
import type { Aircraft } from "@/lib/iran-airspace/types";
import { CATEGORY_LABELS_HE } from "@/lib/iran-airspace/constants";

export default function SearchBar({
  aircraft,
  onSelect,
}: {
  aircraft: Aircraft[];
  onSelect: (hex: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return aircraft
      .filter(
        (a) =>
          a.callsign?.toUpperCase().includes(q) ||
          a.registration?.toUpperCase().includes(q) ||
          a.hex.toUpperCase().includes(q) ||
          a.aircraftType?.toUpperCase().includes(q),
      )
      .slice(0, 8);
  }, [aircraft, query]);

  return (
    <div className="relative z-30 w-full max-w-md">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="חיפוש: Callsign · Registration · ICAO · סוג מטוס"
        className="w-full rounded-lg border border-white/10 bg-[#0a1220]/90 px-3.5 py-2 text-sm text-slate-100 shadow-lg backdrop-blur-xl placeholder:text-slate-500 focus:border-sky-400/50 focus:outline-none"
      />
      {focused && query.trim() && (
        <div className="absolute inset-x-0 top-full mt-1.5 max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-[#0a1220]/95 shadow-2xl backdrop-blur-xl">
          {results.length === 0 ? (
            <div className="px-3.5 py-3 text-xs text-slate-500">אין תוצאות</div>
          ) : (
            results.map((a) => (
              <button
                key={a.hex}
                type="button"
                onMouseDown={() => onSelect(a.hex)}
                className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-right text-xs text-slate-200 hover:bg-white/5"
              >
                <span className="font-mono font-bold">{a.callsign || a.hex}</span>
                <span className="text-slate-500">
                  {a.registration || "—"} · {a.aircraftType || "—"} · {CATEGORY_LABELS_HE[a.category]}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
