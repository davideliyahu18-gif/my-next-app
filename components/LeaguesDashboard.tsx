"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FIFA_LIVE_POLL_MS } from "@/lib/constants";
import type {
  LeagueMatchView,
  LeaguesDashboardView,
} from "@/lib/football/leagues-data";
import FeedNews from "./FeedNews";
import ChampionsLeagueSection from "./ChampionsLeagueSection";
import LeagueMatchesPanel from "./LeagueMatchesPanel";
import LeagueNextMatch from "./LeagueNextMatch";
import LeagueStandingsSection from "./LeagueStandingsSection";
import SocialBar from "./SocialBar";
import TodayFootballHub from "./TodayFootballHub";

type ClientPushSubscription = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: { p256dh?: string; auth?: string };
};

type ScoreSnap = { home: number; away: number };

const SCORE_KEY = "football-live-score-snaps-v1";
const SENT_KEY = "football-goal-push-sent-v1";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

async function getPushContext(): Promise<{
  subscription: ClientPushSubscription | null;
  leagues: string[];
}> {
  let subscription: ClientPushSubscription | null = null;
  let leagues: string[] = [];
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      if (sub) subscription = sub.toJSON() as ClientPushSubscription;
    }
    const raw = window.localStorage.getItem("football-favorite-leagues-v1");
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) leagues = parsed.map(String);
    }
  } catch {
    // best-effort
  }
  return { subscription, leagues };
}

function collectScoredMatches(dashboard: LeaguesDashboardView): LeagueMatchView[] {
  const byId = new Map<string, LeagueMatchView>();
  for (const match of dashboard.liveMatches) byId.set(match.id, match);
  for (const matches of Object.values(dashboard.matchesByLeague)) {
    for (const match of matches) {
      if (match.homeScore == null || match.awayScore == null) continue;
      if (match.status === "upcoming") continue;
      byId.set(match.id, match);
    }
  }
  for (const match of dashboard.championsLeague.matches) {
    if (match.homeScore == null || match.awayScore == null) continue;
    if (match.status === "upcoming") continue;
    byId.set(match.id, match);
  }
  return [...byId.values()];
}

async function notifyClientGoals(dashboard: LeaguesDashboardView) {
  const { subscription, leagues } = await getPushContext();
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return;
  }

  const previous = loadJson<Record<string, ScoreSnap>>(SCORE_KEY, {});
  const sent = loadJson<Record<string, true>>(SENT_KEY, {});
  const next: Record<string, ScoreSnap> = { ...previous };
  const matches = collectScoredMatches(dashboard);

  for (const match of matches) {
    if (match.homeScore == null || match.awayScore == null) continue;
    const snap = { home: match.homeScore, away: match.awayScore };
    const prev = previous[match.id];
    next[match.id] = snap;
    if (!prev) continue;

    const events: { team: string; home: number; away: number }[] = [];
    for (let score = prev.home + 1; score <= snap.home; score += 1) {
      events.push({ team: match.home, home: score, away: prev.away });
    }
    for (let score = prev.away + 1; score <= snap.away; score += 1) {
      events.push({
        team: match.away,
        home: snap.home,
        away: score,
      });
    }

    for (const event of events) {
      const scoreline = `${event.home}-${event.away}`;
      const tag = `goal-${match.id}-${scoreline}`;
      if (sent[tag]) continue;
      sent[tag] = true;

      const minute =
        match.status === "live" && match.minute ? ` (${match.minute})` : "";
      await fetch("/api/push/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription,
          leagues,
          title: `גול! ${match.leagueFlag} ${match.leagueName}`,
          body: `${event.team} כבשה · ${match.home} ${scoreline} ${match.away}${minute}`,
          url: "/#today",
          tag,
        }),
      });
    }
  }

  saveJson(SCORE_KEY, next);
  saveJson(SENT_KEY, sent);
}

export default function LeaguesDashboard({
  initial,
}: {
  initial: LeaguesDashboardView;
}) {
  const [data, setData] = useState(initial);
  const [syncing, setSyncing] = useState(false);
  const seeded = useRef(false);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/leagues/dashboard", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const dashboard = (await response.json()) as LeaguesDashboardView;
      setData(dashboard);

      // Client-side goal detection (works without Redis on Vercel Hobby).
      void notifyClientGoals(dashboard);

      // Server tick still useful when Redis/KV is configured later.
      void (async () => {
        const { subscription, leagues } = await getPushContext();
        await fetch("/api/push/live-goals", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription, leagues }),
        });
      })();
    } catch {
      // Keep last good snapshot on transient network errors.
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!seeded.current) {
      seeded.current = true;
      // Seed scores from SSR snapshot so kickoff doesn't spam old goals.
      void notifyClientGoals(initial);
    }
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, FIFA_LIVE_POLL_MS);

    return () => window.clearInterval(id);
  }, [initial, refresh]);

  const liveCount = data.liveMatches.length;

  return (
    <>
      <TodayFootballHub
        leagues={data.leagues}
        matchesByLeague={data.matchesByLeague}
        liveMatches={data.liveMatches}
        championsLeague={data.championsLeague}
        nextMatch={data.nextMatch}
      />

      <div className="mb-5 flex items-center justify-end gap-2 text-[11px] text-zinc-500">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            syncing ? "animate-pulse bg-amber-400" : "bg-success"
          }`}
        />
        נתוני 365scores · עודכן{" "}
        {new Date(data.fetchedAt).toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Jerusalem",
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <aside className="space-y-6 lg:col-span-3">
          <LeagueNextMatch match={data.nextMatch} liveCount={liveCount} />
          <SocialBar />
        </aside>

        <div className="lg:col-span-6">
          <LeagueMatchesPanel
            leagues={data.leagues}
            matchesByLeague={data.matchesByLeague}
            liveMatches={data.liveMatches}
          />
        </div>

        <aside className="space-y-6 lg:col-span-3">
          <FeedNews />
        </aside>
      </div>

      <LeagueStandingsSection standings={data.standings} />
      <ChampionsLeagueSection data={data.championsLeague} />
    </>
  );
}
