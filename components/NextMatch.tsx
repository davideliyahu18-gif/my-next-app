"use client";

import type { LiveMatchView } from "@/lib/types";
import DashboardCard from "./DashboardCard";
import MatchCountdown from "./MatchCountdown";
import ScrollLinkButton from "./ScrollLinkButton";

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

        {showCountdown && <MatchCountdown targetIso={match.kickoffAt} />}

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
