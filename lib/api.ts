import { unstable_cache } from "next/cache";
import { LIVE_DATA_REVALIDATE_SECONDS } from "./constants";
import {
  fetchFifaDashboard,
  fetchFullSchedule,
  fetchGroupStandings,
  fetchLiveMatches,
  fetchStatCards,
  fetchTopScorers,
  fetchTournament,
} from "./fifa-data";
import type {
  FifaDashboardView,
  GroupStandingView,
  LiveMatchView,
  ScheduleMatchView,
  ScorerView,
  StatCardView,
} from "./types";

async function safeFetch<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[fifa] ${label} failed:`, error);
    return fallback;
  }
}

const emptyDashboard = (): FifaDashboardView => ({
  matches: [],
  standings: [],
  scorers: [],
  nextMatch: null,
  fetchedAt: new Date().toISOString(),
});

function cachedFetch<T>(key: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  return unstable_cache(
    () => safeFetch(key, fn, fallback),
    ["fifa-api", key],
    { revalidate: LIVE_DATA_REVALIDATE_SECONDS },
  )();
}

/** Cached dashboard for SSR — fast first paint. */
export function getFifaDashboard(): Promise<FifaDashboardView> {
  return cachedFetch("dashboard", () => fetchFifaDashboard(false), emptyDashboard());
}

/** Live dashboard for client polling API. */
export function getFifaDashboardLive(): Promise<FifaDashboardView> {
  return safeFetch("dashboard_live", () => fetchFifaDashboard(true), emptyDashboard());
}

export function getLiveMatches(): Promise<LiveMatchView[]> {
  return cachedFetch("live_matches", () => fetchLiveMatches(false), []);
}

export function getGroupStandings(): Promise<GroupStandingView[]> {
  return cachedFetch("group_standings", () => fetchGroupStandings(false), []);
}

export function getTopScorers(): Promise<ScorerView[]> {
  return cachedFetch("top_scorers", () => fetchTopScorers(10, false), []);
}

export function getStatCards(): Promise<StatCardView[]> {
  return cachedFetch("stat_cards", () => fetchStatCards(false), []);
}

export function getFullSchedule(): Promise<ScheduleMatchView[]> {
  return cachedFetch("full_schedule", () => fetchFullSchedule(false), []);
}

export function getTournament() {
  return cachedFetch("tournament", fetchTournament, {
    totalTeams: 48,
    totalMatches: 104,
    totalCities: 16,
    images: {
      stadium:
        "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=2400&q=85",
      trophy: "/images/world-cup-trophy.jpg",
    },
  });
}
