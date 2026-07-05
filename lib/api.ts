import {
  fetchFifaDashboard,
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

/** Fresh FIFA data — no cache. Used for live dashboard + API route. */
export function getFifaDashboard(): Promise<FifaDashboardView> {
  return safeFetch("dashboard", () => fetchFifaDashboard(true), emptyDashboard());
}

export function getLiveMatches(): Promise<LiveMatchView[]> {
  return safeFetch("live_matches", () => fetchLiveMatches(true), []);
}

export function getGroupStandings(): Promise<GroupStandingView[]> {
  return safeFetch("group_standings", () => fetchGroupStandings(true), []);
}

export function getTopScorers(): Promise<ScorerView[]> {
  return safeFetch("top_scorers", () => fetchTopScorers(10, true), []);
}

export function getStatCards(): Promise<StatCardView[]> {
  return safeFetch("stat_cards", () => fetchStatCards(true), []);
}

export function getTournament() {
  return safeFetch("tournament", fetchTournament, {
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
