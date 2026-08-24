"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FIFA_LIVE_POLL_MS } from "@/lib/constants";
import type {
  FootballLeague,
  LeagueMatchView,
  TodaysMatchesView,
} from "@/lib/football/leagues-data";
import TeamCrest from "./TeamCrest";

const FAVORITES_KEY = "football-favorite-leagues-v1";

function MatchListRow({ match }: { match: LeagueMatchView }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const score =
    match.homeScore !== null && match.awayScore !== null
      ? `${match.homeScore} - ${match.awayScore}`
      : "VS";

  return (
    <Link
      href={`/match/${match.id}`}
      className={`block border-b border-white/[0.06] px-4 py-4 transition-colors last:border-0 hover:bg-white/[0.03] ${
        isLive ? "bg-live/[0.06]" : ""
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-semibold text-zinc-400">
          {match.leagueFlag} {match.leagueName}
          {match.roundLabel ? ` · ${match.roundLabel}` : ""}
        </p>
        {isLive ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-live/20 px-2 py-0.5 text-[9px] font-black text-red-300">
            <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-live" />
            LIVE {match.minute}
          </span>
        ) : (
          <span className="shrink-0 text-[11px] font-bold text-zinc-500">
            {isFinished ? "הסתיים" : match.timeLabel}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate text-sm font-bold text-white">
            {match.home}
          </span>
          <TeamCrest src={match.homeLogo} name={match.home} size={28} />
        </div>
        <div className="text-center">
          <p
            className={`text-lg font-black tabular-nums ${
              isLive ? "text-white" : "text-gold"
            }`}
          >
            {score}
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <TeamCrest src={match.awayLogo} name={match.away} size={28} />
          <span className="truncate text-sm font-bold text-white">
            {match.away}
          </span>
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] font-semibold text-gold/80">
        פרטים · הרכבים · אצטדיון ←
      </p>
    </Link>
  );
}

function LeagueFilterChip({
  league,
  active,
  onToggle,
}: {
  league: FootballLeague;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
        active
          ? "border-gold/50 bg-gold/15 text-gold"
          : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-white"
      }`}
    >
      {league.countryFlag} {league.nameHe}
    </button>
  );
}

export default function TodayMatchesBoard({
  initial,
}: {
  initial: TodaysMatchesView;
}) {
  const [data, setData] = useState(initial);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<"all" | "favorites" | string>("all");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAVORITES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setFavorites(parsed.filter((item) => typeof item === "string"));
        }
      }
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites, ready]);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/today", { cache: "no-store" });
      if (!response.ok) return;
      const next = (await response.json()) as TodaysMatchesView;
      setData(next);
    } catch {
      // keep last snapshot
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, FIFA_LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const filtered = useMemo(() => {
    let matches = data.matches;
    if (filter === "favorites") {
      if (favorites.length === 0) return matches;
      matches = matches.filter((match) => favorites.includes(match.leagueSlug));
    } else if (filter !== "all") {
      matches = matches.filter((match) => match.leagueSlug === filter);
    }

    return [...matches].sort((a, b) => {
      const statusRank = (status: LeagueMatchView["status"]) =>
        status === "live" ? 0 : status === "upcoming" ? 1 : 2;
      const byStatus = statusRank(a.status) - statusRank(b.status);
      if (byStatus !== 0) return byStatus;
      if (favorites.length) {
        const aFav = favorites.includes(a.leagueSlug) ? 0 : 1;
        const bFav = favorites.includes(b.leagueSlug) ? 0 : 1;
        if (aFav !== bFav) return aFav - bFav;
      }
      return new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime();
    });
  }, [data.matches, filter, favorites]);

  const toggleFavorite = (slug: string) => {
    setFavorites((prev) =>
      prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug],
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.22em] text-gold">
            משחקי היום
          </p>
          <h1 className="mt-1 text-3xl font-black text-white md:text-4xl">
            {data.dayLabel || "היום"}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            הליגות שבחרת · רשימה מתעדכנת כל יום
            {data.liveCount > 0 ? (
              <span className="mr-2 inline-flex items-center gap-1 font-bold text-red-300">
                <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-live" />
                {data.liveCount} LIVE
              </span>
            ) : null}
          </p>
        </div>
        <p className="text-[11px] text-zinc-600">
          {syncing
            ? "מעדכן…"
            : `עודכן ${new Date(data.fetchedAt).toLocaleTimeString("he-IL", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Jerusalem",
              })}`}
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-card p-4">
        <p className="mb-3 text-xs font-bold text-zinc-400">ליגות מועדפות</p>
        <div className="flex flex-wrap gap-2">
          {data.leagues.map((league) => (
            <LeagueFilterChip
              key={league.slug}
              league={league}
              active={favorites.includes(league.slug)}
              onToggle={() => toggleFavorite(league.slug)}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
            filter === "all"
              ? "bg-gold/15 text-gold"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          הכל ({data.matches.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter("favorites")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
            filter === "favorites"
              ? "bg-gold/15 text-gold"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          מועדפים
          {favorites.length ? ` (${favorites.length})` : ""}
        </button>
        {data.leagues.map((league) => {
          const count = data.matches.filter(
            (match) => match.leagueSlug === league.slug,
          ).length;
          if (count === 0) return null;
          return (
            <button
              key={league.slug}
              type="button"
              onClick={() => setFilter(league.slug)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                filter === league.slug
                  ? "bg-gold/15 text-gold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {league.countryFlag} {count}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-card">
        {filtered.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-zinc-500">
            אין משחקים היום לפי הסינון שנבחר
          </p>
        ) : (
          filtered.map((match) => (
            <MatchListRow key={match.id} match={match} />
          ))
        )}
      </div>
    </div>
  );
}
