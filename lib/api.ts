import { unstable_cache } from "next/cache";
import { LIVE_DATA_REVALIDATE_SECONDS } from "./constants";
import {
  fetchGroupStandings,
  fetchLiveMatches,
  fetchStatCards,
  fetchTopScorers,
  fetchTournament,
} from "./fifa-data";
import type {
  GroupStandingView,
  LiveMatchView,
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

function cachedFetch<T>(key: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  return unstable_cache(
    () => safeFetch(key, fn, fallback),
    ["fifa-api", key],
    { revalidate: LIVE_DATA_REVALIDATE_SECONDS },
  )();
}

export function getLiveMatches(): Promise<LiveMatchView[]> {
  return cachedFetch("live_matches", fetchLiveMatches, []);
}

export function getGroupStandings(): Promise<GroupStandingView[]> {
  return cachedFetch("group_standings", fetchGroupStandings, []);
}

export function getTopScorers(): Promise<ScorerView[]> {
  return cachedFetch("top_scorers", fetchTopScorers, []);
}

export function getStatCards(): Promise<StatCardView[]> {
  return cachedFetch("stat_cards", fetchStatCards, []);
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
