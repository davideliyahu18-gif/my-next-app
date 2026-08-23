"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  ChampionsLeagueView,
  FootballLeague,
  LeagueMatchView,
} from "@/lib/football/leagues-data";
import MatchCountdown from "./MatchCountdown";
import EnablePushNotifications from "./EnablePushNotifications";
import TeamCrest from "./TeamCrest";

const FAVORITES_KEY = "football-favorite-leagues-v1";

function jerusalemDayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "Asia/Jerusalem",
  });
}

function todayJerusalemKey(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Jerusalem",
  });
}

function collectTodayMatches(options: {
  matchesByLeague: Record<string, LeagueMatchView[]>;
  liveMatches: LeagueMatchView[];
  championsLeague: ChampionsLeagueView;
}): LeagueMatchView[] {
  const today = todayJerusalemKey();
  const byId = new Map<string, LeagueMatchView>();

  for (const match of options.liveMatches) {
    byId.set(match.id, match);
  }
  for (const matches of Object.values(options.matchesByLeague)) {
    for (const match of matches) {
      if (jerusalemDayKey(match.kickoffAt) === today) {
        byId.set(match.id, match);
      }
    }
  }
  for (const match of options.championsLeague.matches) {
    if (jerusalemDayKey(match.kickoffAt) === today) {
      byId.set(match.id, match);
    }
  }

  return [...byId.values()].sort(
    (a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
  );
}

function MatchTile({ match }: { match: LeagueMatchView }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const score =
    match.homeScore !== null && match.awayScore !== null
      ? `${match.homeScore}:${match.awayScore}`
      : match.timeLabel;

  return (
    <article
      className={`min-w-[220px] snap-start rounded-2xl border px-4 py-4 transition-transform duration-300 hover:-translate-y-1 ${
        isLive
          ? "border-live/40 bg-gradient-to-b from-red-950/50 to-black/40"
          : "border-white/[0.08] bg-white/[0.03] hover:border-gold/35"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-semibold text-zinc-400">
          {match.leagueFlag} {match.leagueName}
        </p>
        {isLive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-live/20 px-2 py-0.5 text-[9px] font-black text-red-300">
            <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-live" />
            LIVE
          </span>
        ) : (
          <span className="text-[10px] font-bold text-zinc-500">
            {isFinished ? "הסתיים" : match.timeLabel}
          </span>
        )}
      </div>
      <p className="flex items-center gap-2 truncate text-sm font-bold text-white">
        <TeamCrest src={match.homeLogo} name={match.home} size={20} />
        <span className="truncate">{match.home}</span>
      </p>
      <p className="mt-1.5 flex items-center gap-2 truncate text-sm font-bold text-white">
        <TeamCrest src={match.awayLogo} name={match.away} size={20} />
        <span className="truncate">{match.away}</span>
      </p>
      <p
        className={`mt-3 text-center text-xl font-black tabular-nums ${
          isLive ? "text-white" : "text-gold"
        }`}
      >
        {score}
      </p>
    </article>
  );
}

export default function TodayFootballHub({
  leagues,
  matchesByLeague,
  liveMatches,
  championsLeague,
  nextMatch,
}: {
  leagues: FootballLeague[];
  matchesByLeague: Record<string, LeagueMatchView[]>;
  liveMatches: LeagueMatchView[];
  championsLeague: ChampionsLeagueView;
  nextMatch: LeagueMatchView | null;
}) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [installTip, setInstallTip] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAVORITES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setFavorites(parsed.map(String).filter(Boolean));
        }
      }
    } catch {
      // ignore storage errors
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch {
      // ignore storage errors
    }
  }, [favorites, ready]);

  const todayMatches = useMemo(
    () =>
      collectTodayMatches({
        matchesByLeague,
        liveMatches,
        championsLeague,
      }),
    [matchesByLeague, liveMatches, championsLeague],
  );

  const sortedToday = useMemo(() => {
    if (!favorites.length) return todayMatches;
    return [...todayMatches].sort((a, b) => {
      const aFav = favorites.includes(a.leagueSlug) ? 0 : 1;
      const bFav = favorites.includes(b.leagueSlug) ? 0 : 1;
      return aFav - bFav || new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime();
    });
  }, [todayMatches, favorites]);

  const spotlight =
    liveMatches[0] ??
    sortedToday.find((match) => match.status === "upcoming") ??
    nextMatch;

  const leagueOptions = useMemo(
    () => [
      ...leagues,
      championsLeague.competition,
    ],
    [leagues, championsLeague.competition],
  );

  const toggleFavorite = (slug: string) => {
    setFavorites((prev) =>
      prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug],
    );
  };

  const todayLabel = new Date().toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Jerusalem",
  });

  return (
    <section
      id="today"
      className="relative mb-10 overflow-hidden rounded-[1.75rem] border border-gold/20 bg-gradient-to-br from-[#14110a] via-[#0a0a0a] to-[#0d1512] animate-fade-up"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(212,175,55,0.14),transparent_55%)]" />
      <div className="pointer-events-none absolute -left-20 bottom-0 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative grid gap-8 p-5 md:p-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="text-[11px] font-bold tracking-[0.24em] text-gold">
            היום בכדורגל
          </p>
          <h2 className="mt-2 text-3xl font-black leading-tight text-white md:text-4xl">
            כל המשחקים של היום במקום אחד
          </h2>
          <p className="mt-2 text-sm text-zinc-400">{todayLabel}</p>

          {spotlight ? (
            <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/30 p-5">
              <p className="text-xs font-semibold text-zinc-400">
                {spotlight.status === "live" ? "משחק חי עכשיו" : "המשחק הבא שלך"}
              </p>
              <p className="mt-2 text-sm font-bold text-gold">
                {spotlight.leagueFlag} {spotlight.leagueName}
              </p>
              <p className="mt-3 text-2xl font-black text-white">
                {spotlight.home}
              </p>
              <p className="text-lg font-bold text-zinc-300">נגד {spotlight.away}</p>

              {spotlight.status === "upcoming" ? (
                <div className="mt-5">
                  <MatchCountdown targetIso={spotlight.kickoffAt} size="md" />
                </div>
              ) : (
                <p className="mt-5 text-3xl font-black tabular-nums text-white">
                  {spotlight.homeScore ?? 0} - {spotlight.awayScore ?? 0}
                  <span className="mr-3 text-sm font-bold text-red-300">
                    {spotlight.minute}
                  </span>
                </p>
              )}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/30 p-5">
              <p className="text-sm text-zinc-400">
                אין משחקים היום — עקוב אחרי הליגות שלך ותקבל עדכון ברגע שיש
              </p>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs font-bold text-zinc-300">הליגות שלי</p>
            <p className="mt-1 text-[11px] text-zinc-500">
              נשמר במכשיר — בסיס לאפליקציה האישית שלך בהמשך
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {leagueOptions.map((league) => {
                const active = favorites.includes(league.slug);
                return (
                  <button
                    key={league.slug}
                    type="button"
                    onClick={() => toggleFavorite(league.slug)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                      active
                        ? "bg-gold text-black shadow-[0_0_24px_rgba(212,175,55,0.35)]"
                        : "border border-white/10 bg-black/20 text-zinc-300 hover:border-gold/40 hover:text-gold"
                    }`}
                  >
                    {league.countryFlag} {league.nameHe}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-white">לוח היום</h3>
              <p className="text-xs text-zinc-500">
                {sortedToday.length > 0
                  ? `${sortedToday.length} משחקים · הליגות שלך מופיעות קודם`
                  : "אין משחקים להיום כרגע"}
              </p>
            </div>
            <a
              href="#matches"
              className="text-xs font-bold text-gold transition-colors hover:text-white"
            >
              לכל הליגות ←
            </a>
          </div>

          {sortedToday.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
              {sortedToday.map((match) => (
                <MatchTile key={match.id} match={match} />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 px-6 text-center text-sm text-zinc-500">
              ברגע שיהיו משחקים היום — הם יופיעו כאן בזמן אמת
            </div>
          )}

          <div className="mt-6 space-y-3">
            <EnablePushNotifications />

            <div className="flex flex-col gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-300">אתר עכשיו · אפליקציה בהמשך</p>
              <p className="mt-1 text-xs text-zinc-400">
                שמור במסך הבית וקבל חוויית אפליקציה כבר עכשיו. בהמשך — התראות חכמות לפי הליגות שלך.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
                setInstallTip(
                  isIos
                    ? "באייפון: שתף → הוסף למסך הבית"
                    : "באנדרואיד/כרום: תפריט ⋮ → התקן אפליקציה / הוסף למסך הבית",
                );
              }}
              className="shrink-0 rounded-full bg-emerald-400 px-5 py-2.5 text-xs font-black text-black transition-transform hover:scale-[1.03]"
            >
              הוסף למסך הבית
            </button>
          </div>
          {installTip && (
            <p className="mt-3 text-xs font-semibold text-emerald-300/90">{installTip}</p>
          )}
          </div>
        </div>
      </div>
    </section>
  );
}
