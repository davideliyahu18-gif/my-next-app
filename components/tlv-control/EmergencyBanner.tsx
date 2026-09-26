"use client";

import type { ActiveAlert } from "@/lib/tlv-control/types";

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso));
}

export default function EmergencyBanner({ alert }: { alert: ActiveAlert }) {
  return (
    <div className="flex animate-pulse items-center gap-2 border-b border-red-400/40 bg-red-600 px-3 py-2 text-white sm:px-5">
      <span aria-hidden className="text-lg">🚨</span>
      <span className="text-[13px] font-extrabold">התרעת פיקוד העורף</span>
      <span className="text-[12px] font-semibold">{alert.category}</span>
      <span className="mr-auto text-[11px] font-mono">{formatClock(alert.issuedAt)}</span>
      <span className="hidden truncate text-[12px] sm:block">{alert.areas.join(", ")}</span>
    </div>
  );
}
