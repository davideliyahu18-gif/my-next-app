"use client";

import Link from "next/link";
import { useState } from "react";
import type { FootballLeague, LeagueMatchView } from "@/lib/football/leagues-data";
import DashboardCard from "./DashboardCard";
import TeamCrest from "./TeamCrest";

function TeamLine({
  name,
  logo,
  sideLabel,
}: {
  name: string;
  logo: string | null;
  sideLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-2">
        <TeamCrest src={logo} name={name} size={22} />
        <span className="truncate text-sm font-bold text-white">{name}</span>
      </span>
      {sideLabel ? (
        <span className="text-xs text-zinc-500">{sideLabel}</span>
      ) : null}
    </div>
  );
}

function MatchRow({ match }: { match: LeagueMatchView }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const score =
    match.homeScore !== null && match.awayScore !== null
      ? `${match.homeScore} - ${match.awayScore}`
      : match.timeLabel || "VS";

  return (
    <Link
      href={`/match/${match.id}`}
      className={`flex items-center gap-3 border-b border-white/[0.05] px-5 py-4 last:border-0 transition-colors ${
        isLive
          ? "bg-gradient-to-l from-live/[0.08] via-transparent to-transparent hover:from-live/[0.12]"
          : "hover:bg-white/[0.02]"
      }`}
    >
      <div className="w-16 shrink-0 text-center">
        <p className="text-[10px] font-semibold text-zinc-500">{match.dateLabel}</p>
        {!isFinished && !isLive && (
          <p className="text-xs font-bold text-gold">{match.timeLabel}</p>
        )}
        {isLive && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-live/20 px-2 py-0.5 text-[9px] font-black text-red-300">
            <span className="h-1 w-1 animate-live-pulse rounded-full bg-live" />
            LIVE
          </span>
        )}
        {isFinished && (
          <p className="text-[10px] font-semibold text-zinc-500">הסתיים</p>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <TeamLine
          name={match.home}
          logo={match.homeLogo}
          sideLabel={!isFinished && !isLive ? "בית" : undefined}
        />
        <TeamLine
          name={match.away}
          logo={match.awayLogo}
          sideLabel={!isFinished && !isLive ? "חוץ" : undefined}
        />
      </div>

      <div className="shrink-0 text-center">
        <span
          className={`text-lg font-black tabular-nums ${
            isLive ? "text-white" : isFinished ? "text-zinc-300" : "text-gold"
          }`}
        >
          {score}
        </span>
        {isLive && (
          <p className="text-[10px] font-bold text-zinc-400">{match.minute}</p>
        )}
      </div>
    </Link>
  );
}

export default function LeagueMatchesPanel({
  leagues,
  matchesByLeague,
  liveMatches,
}: {
  leagues: FootballLeague[];
  matchesByLeague: Record<string, LeagueMatchView[]>;
  liveMatches: LeagueMatchView[];
}) {
  const [activeSlug, setActiveSlug] = useState(leagues[0]?.slug ?? "");

  const activeLeague = leagues.find((league) => league.slug === activeSlug) ?? leagues[0];
  const activeMatches = activeLeague
    ? matchesByLeague[activeLeague.slug] ?? []
    : [];

  return (
    <section id="matches" className="animate-fade-up space-y-6">
      {liveMatches.length > 0 && (
        <DashboardCard
          variant="live"
          title="משחקים חיים עכשיו"
          badge={
            <span className="flex items-center gap-1.5 rounded-full bg-live/20 px-2.5 py-0.5 text-[10px] font-black tracking-wider text-red-300">
              <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-live" />
              {liveMatches.length} LIVE
            </span>
          }
        >
          {liveMatches.map((match) => (
            <MatchRow key={match.id} match={match} />
          ))}
        </DashboardCard>
      )}

      <DashboardCard
        variant="featured"
        title="לוח משחקים לפי ליגה"
        badge={
          <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-500">
            365scores
          </span>
        }
      >
        <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06] px-4 py-3 scrollbar-hide">
          {leagues.map((league) => {
            const count = matchesByLeague[league.slug]?.length ?? 0;
            const active = league.slug === activeSlug;
            return (
              <button
                key={league.slug}
                type="button"
                onClick={() => setActiveSlug(league.slug)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  active
                    ? "bg-gold/15 text-gold"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {league.countryFlag} {league.nameHe}
                {count > 0 && (
                  <span className="mr-1 text-[10px] opacity-70">({count})</span>
                )}
              </button>
            );
          })}
        </div>

        {activeLeague && (
          <div className="border-b border-white/[0.06] px-5 py-2.5">
            <p className="text-xs font-semibold text-zinc-400">
              {activeLeague.countryFlag} {activeLeague.nameHe} · {activeLeague.nameEn}
            </p>
          </div>
        )}

        {activeMatches.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-zinc-500">
            אין משחקים בלוח לליגה הזו כרגע
          </p>
        ) : (
          activeMatches.map((match) => <MatchRow key={match.id} match={match} />)
        )}
      </DashboardCard>
    </section>
  );
}
