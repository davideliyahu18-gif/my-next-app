"use client";

import { NAV_ITEMS, type NavSection } from "./types";

export default function Nav({
  active,
  onChange,
  alertBadge,
}: {
  active: NavSection;
  onChange: (section: NavSection) => void;
  alertBadge?: number;
}) {
  return (
    <nav className="tlv-control-scroll flex shrink-0 gap-1 overflow-x-auto border-b border-white/5 bg-[#050b14]/90 px-2 py-1.5 sm:flex-col sm:gap-0.5 sm:overflow-visible sm:border-b-0 sm:border-l sm:px-2 sm:py-3">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-bold transition-colors sm:w-full sm:justify-start ${
            active === item.id ? "bg-sky-500/15 text-sky-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
          }`}
        >
          <span aria-hidden>{item.emoji}</span>
          <span>{item.label}</span>
          {item.id === "alerts" && Boolean(alertBadge) && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {alertBadge}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
