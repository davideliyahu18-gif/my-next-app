import { Redis } from "@upstash/redis";
import { isRedisConfigured } from "@/lib/feed-store";
import { SITE_BRAND } from "@/lib/constants";
import {
  LEAGUE_BY_ID,
  getDomesticAndUclIdsCsv,
} from "@/lib/football/competitions";
import {
  getScores365Games,
  type Scores365Json,
} from "@/lib/football/scores365-client";
import { broadcastPush } from "@/lib/push/send";
import { isPushConfigured } from "@/lib/push/vapid";

type MatchScoreSnap = {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  leagueSlug: string;
  leagueName: string;
  leagueFlag: string;
  status: "live" | "upcoming" | "finished";
  minute: string;
};

type GoalEvent = {
  matchId: string;
  scorerSide: "home" | "away";
  teamName: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  leagueSlug: string;
  leagueName: string;
  leagueFlag: string;
  minute: string;
};

const STATE_KEY = "push:live-scores";
const LOCK_KEY = "push:live-goals:lock";
const LAST_RUN_KEY = "push:live-goals:last-run";
const MIN_INTERVAL_MS = 20_000;

declare global {
  var __liveScoreState: Record<string, MatchScoreSnap> | undefined;
  var __liveGoalsLastRun: number | undefined;
  var __liveGoalsLockUntil: number | undefined;
}

function getRedis(): Redis | null {
  if (!isRedisConfigured()) return null;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL!;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN!;
  return new Redis({ url, token });
}

function asRecord(value: unknown): Scores365Json | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Scores365Json)
    : null;
}

function parseScore(value: unknown): number | null {
  if (value == null || value === "" || value === -1 || value === -1.0) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

function mapStatus(
  statusGroup: number,
  statusText: string,
): MatchScoreSnap["status"] {
  const text = statusText.trim();
  if (statusGroup === 3 || /חי|live|שידור/i.test(text)) return "live";
  if (statusGroup === 4 || /הסתיים|סיום|final|finished/i.test(text)) {
    return "finished";
  }
  return "upcoming";
}

async function loadState(): Promise<Record<string, MatchScoreSnap>> {
  const redis = getRedis();
  if (redis) {
    const value = await redis.get<Record<string, MatchScoreSnap>>(STATE_KEY);
    return value ?? {};
  }
  return globalThis.__liveScoreState ?? {};
}

async function saveState(state: Record<string, MatchScoreSnap>): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(STATE_KEY, state, { ex: 60 * 60 * 12 });
  } else {
    globalThis.__liveScoreState = state;
  }
}

async function acquireLock(): Promise<boolean> {
  const now = Date.now();
  const redis = getRedis();
  if (redis) {
    const last = await redis.get<number>(LAST_RUN_KEY);
    if (typeof last === "number" && now - last < MIN_INTERVAL_MS) {
      return false;
    }
    const locked = await redis.set(LOCK_KEY, String(now), {
      nx: true,
      px: MIN_INTERVAL_MS,
    });
    if (!locked) return false;
    await redis.set(LAST_RUN_KEY, now, { ex: 120 });
    return true;
  }

  if (
    typeof globalThis.__liveGoalsLastRun === "number" &&
    now - globalThis.__liveGoalsLastRun < MIN_INTERVAL_MS
  ) {
    return false;
  }
  if (
    typeof globalThis.__liveGoalsLockUntil === "number" &&
    now < globalThis.__liveGoalsLockUntil
  ) {
    return false;
  }
  globalThis.__liveGoalsLockUntil = now + MIN_INTERVAL_MS;
  globalThis.__liveGoalsLastRun = now;
  return true;
}

function jerusalemToday(): Date {
  // Approximate "today" date in Asia/Jerusalem for 365scores date filter.
  const label = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Jerusalem",
  });
  return new Date(`${label}T12:00:00+03:00`);
}

async function fetchTrackedMatches(): Promise<Record<string, MatchScoreSnap>> {
  const day = jerusalemToday();
  const payload = await getScores365Games({
    competitionIds: getDomesticAndUclIdsCsv(),
    startDate: day,
    endDate: day,
    fresh: true,
  });

  const games = Array.isArray(payload.games)
    ? (payload.games as Scores365Json[])
    : [];

  const snaps: Record<string, MatchScoreSnap> = {};

  for (const game of games) {
    const competitionId = Number(game.competitionId ?? 0);
    const league = LEAGUE_BY_ID.get(competitionId);
    if (!league) continue;

    const id = String(game.id ?? "");
    if (!id) continue;

    const home = asRecord(game.homeCompetitor) ?? {};
    const away = asRecord(game.awayCompetitor) ?? {};
    const homeName = String(home.name ?? "").trim();
    const awayName = String(away.name ?? "").trim();
    if (!homeName || !awayName) continue;

    const homeScore = parseScore(home.score);
    const awayScore = parseScore(away.score);
    if (homeScore == null || awayScore == null) continue;

    const statusGroup = Number(game.statusGroup ?? 0);
    const statusText = String(game.statusText ?? game.shortStatusText ?? "");
    const status = mapStatus(statusGroup, statusText);
    if (status === "upcoming") continue;

    const gameTime = game.gameTime;
    const minute =
      status === "live" && gameTime != null && Number(gameTime) > 0
        ? `${Math.trunc(Number(gameTime))}'`
        : status === "finished"
          ? "סיום"
          : "";

    snaps[id] = {
      home: homeName,
      away: awayName,
      homeScore,
      awayScore,
      leagueSlug: league.slug,
      leagueName: league.nameHe,
      leagueFlag: league.countryFlag,
      status,
      minute,
    };
  }

  return snaps;
}

function detectGoals(
  previous: Record<string, MatchScoreSnap>,
  current: Record<string, MatchScoreSnap>,
): GoalEvent[] {
  const events: GoalEvent[] = [];

  for (const [matchId, snap] of Object.entries(current)) {
    const prev = previous[matchId];
    if (!prev) {
      // First sighting — seed only, no backfill spam.
      continue;
    }

    if (snap.homeScore > prev.homeScore) {
      const delta = snap.homeScore - prev.homeScore;
      for (let i = 0; i < delta; i += 1) {
        events.push({
          matchId,
          scorerSide: "home",
          teamName: snap.home,
          home: snap.home,
          away: snap.away,
          homeScore: prev.homeScore + i + 1,
          awayScore: snap.awayScore,
          leagueSlug: snap.leagueSlug,
          leagueName: snap.leagueName,
          leagueFlag: snap.leagueFlag,
          minute: snap.minute,
        });
      }
    }

    if (snap.awayScore > prev.awayScore) {
      const delta = snap.awayScore - prev.awayScore;
      for (let i = 0; i < delta; i += 1) {
        events.push({
          matchId,
          scorerSide: "away",
          teamName: snap.away,
          home: snap.home,
          away: snap.away,
          homeScore: snap.homeScore,
          awayScore: prev.awayScore + i + 1,
          leagueSlug: snap.leagueSlug,
          leagueName: snap.leagueName,
          leagueFlag: snap.leagueFlag,
          minute: snap.minute,
        });
      }
    }
  }

  return events;
}

function formatGoalPush(event: GoalEvent) {
  const scoreline = `${event.homeScore}-${event.awayScore}`;
  const minute = event.minute ? ` (${event.minute})` : "";
  return {
    title: `גול! ${event.leagueFlag} ${event.leagueName}`,
    body: `${event.teamName} כבשה · ${event.home} ${scoreline} ${event.away}${minute}`,
    url: "/#today",
    tag: `goal-${event.matchId}-${scoreline}`,
  };
}

export async function processLiveGoals(): Promise<{
  ran: boolean;
  skipped?: string;
  tracked: number;
  goals: number;
  sent: number;
  failed: number;
}> {
  if (!isPushConfigured()) {
    return {
      ran: false,
      skipped: "push-not-configured",
      tracked: 0,
      goals: 0,
      sent: 0,
      failed: 0,
    };
  }

  const locked = await acquireLock();
  if (!locked) {
    return {
      ran: false,
      skipped: "rate-limited",
      tracked: 0,
      goals: 0,
      sent: 0,
      failed: 0,
    };
  }

  const previous = await loadState();
  const current = await fetchTrackedMatches();
  const goals = detectGoals(previous, current);

  // Merge: keep current snaps; drop stale finished matches not in current.
  await saveState(current);

  let sent = 0;
  let failed = 0;

  for (const goal of goals) {
    const payload = formatGoalPush(goal);
    const result = await broadcastPush(payload, {
      leagues: [goal.leagueSlug],
    });
    // Also notify subscribers with empty favorites (all leagues).
    // broadcastPush already includes empty-league subscribers when filtering.
    sent += result.sent;
    failed += result.failed;
  }

  return {
    ran: true,
    tracked: Object.keys(current).length,
    goals: goals.length,
    sent,
    failed,
  };
}

export async function seedLiveScoresQuietly(): Promise<number> {
  const current = await fetchTrackedMatches();
  const previous = await loadState();
  const merged = { ...previous, ...current };
  // Only add new matches; don't wipe unknown.
  for (const [id, snap] of Object.entries(current)) {
    if (!previous[id]) merged[id] = snap;
    else merged[id] = snap;
  }
  await saveState(merged);
  return Object.keys(current).length;
}

export const liveGoalsMeta = {
  brand: SITE_BRAND.nameWithEmoji,
};
