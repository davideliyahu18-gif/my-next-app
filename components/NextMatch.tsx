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
          className="rounded-xl border border-gold/20 bg-gradient-to-b from-gold/10 to-black/40 px-1.5 py-3 text-center"
        >
          <p className="text-xl font-black tabular-nums tracking-tight text-gold md:text-2xl">
            {String(cell.value).padStart(2, "0")}
          </p>
          <p className="mt-1 text-[10px] font-medium text-zinc-500">{cell.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function NextMatch({ match }: { match: LiveMatchView | null }) {
  if (!match) {
    return (
      <DashboardCard title="המשחק הבא" variant="featured">
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
    <DashboardCard title="המשחק הבא" variant="featured">
      <div className="space-y-5 p-5">
        <p className="text-center text-[11px] font-bold tracking-wide text-gold/80">
          {match.league}
        </p>

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-1 flex-col items-center gap-2">
            <span className="text-4xl drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
              {match.homeFlag}
            </span>
            <span className="text-center text-xs font-extrabold text-white">{match.home}</span>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black text-zinc-400">
            VS
          </span>
          <div className="flex flex-1 flex-col items-center gap-2">
            <span className="text-4xl drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
              {match.awayFlag}
            </span>
            <span className="text-center text-xs font-extrabold text-white">{match.away}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 text-xs text-zinc-400">
          <span className="font-semibold">{match.minute}</span>
          <span className="text-gold">•</span>
          <span>{kickoffLabel}</span>
        </div>

        {showCountdown && <Countdown targetIso={match.kickoffAt} />}

        <ScrollLinkButton
          href="#matches"
          className="w-full rounded-xl bg-gold py-3 text-sm font-black text-black transition-transform hover:scale-[1.02]"
        >
          לכל המשחקים
        </ScrollLinkButton>
      </div>
    </DashboardCard>
  );
}
