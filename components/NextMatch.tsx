"use client";

import { useEffect, useState } from "react";
import type { LiveMatchView } from "@/lib/types";
import DashboardCard from "./DashboardCard";
import ScrollLinkButton from "./ScrollLinkButton";

function Countdown({ targetIso }: { targetIso: string }) {
  const [parts, setParts] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const target = new Date(targetIso).getTime();

    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setParts({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  const cells = [
    { label: "ימים", value: parts.days },
    { label: "שעות", value: parts.hours },
    { label: "דקות", value: parts.mins },
    { label: "שניות", value: parts.secs },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-lg border border-white/[0.06] bg-black/40 px-2 py-2 text-center"
        >
          <p className="text-lg font-black tabular-nums text-[#d4af37]">
            {String(cell.value).padStart(2, "0")}
          </p>
          <p className="text-[10px] text-zinc-500">{cell.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function NextMatch({ match }: { match: LiveMatchView | null }) {
  if (!match) {
    return (
      <DashboardCard title="המשחק הבא">
        <p className="px-5 py-8 text-center text-sm text-zinc-500">אין משחקים קרובים</p>
      </DashboardCard>
    );
  }

  const kickoffLabel = new Date(match.kickoffAt).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });

  const showCountdown = match.status === "upcoming";

  return (
    <DashboardCard title="המשחק הבא">
      <div className="space-y-4 p-5">
        <p className="text-center text-xs font-semibold text-zinc-500">{match.league}</p>

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-1 flex-col items-center gap-2">
            <span className="text-3xl">{match.homeFlag}</span>
            <span className="text-center text-xs font-bold text-white">{match.home}</span>
          </div>
          <span className="text-sm font-bold text-zinc-500">VS</span>
          <div className="flex flex-1 flex-col items-center gap-2">
            <span className="text-3xl">{match.awayFlag}</span>
            <span className="text-center text-xs font-bold text-white">{match.away}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 text-sm text-zinc-400">
          <span>{match.minute}</span>
          <span className="text-[#d4af37]">•</span>
          <span>{kickoffLabel}</span>
        </div>

        {showCountdown && <Countdown targetIso={match.kickoffAt} />}

        <ScrollLinkButton
          href="#matches"
          className="w-full rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/10 py-2.5 text-sm font-bold text-[#d4af37] transition-colors hover:bg-[#d4af37]/20"
        >
          פרטי משחק
        </ScrollLinkButton>
      </div>
    </DashboardCard>
  );
}
