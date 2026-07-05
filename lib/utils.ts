import type {
  GroupStandingView,
  LiveMatchView,
  Match,
  News,
  NewsView,
  Player,
  ScorerView,
  Standing,
  StatCardView,
  TournamentStats,
} from "./types";

export function formatGoalDifference(gd: number): string {
  return gd > 0 ? `+${gd}` : `${gd}`;
}

export function formatMatchMinute(match: Match): string {
  if (match.status === "upcoming" && match.scheduledTime) {
    return match.scheduledTime;
  }
  if (match.minute !== null) {
    return `${match.minute}'`;
  }
  return "—";
}

export function toLiveMatchView(match: Match): LiveMatchView {
  const status = match.status === "live" ? "live" : "upcoming";

  return {
    id: match.id,
    home: match.homeTeam.name,
    homeFlag: match.homeTeam.flag,
    homeCode: match.homeTeam.code ?? "",
    away: match.awayTeam.name,
    awayFlag: match.awayTeam.flag,
    awayCode: match.awayTeam.code ?? "",
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    minute: formatMatchMinute(match),
    status,
    venue: match.venue,
    league: match.stage,
    kickoffAt: new Date().toISOString(),
    highlightUrl: null,
  };
}

export function toLiveMatchViews(matches: Match[]): LiveMatchView[] {
  return matches
    .filter((m) => m.status === "live" || m.status === "upcoming")
    .map(toLiveMatchView);
}

export function toGroupStandingViews(
  standings: Standing[],
): GroupStandingView[] {
  return standings.map((standing) => ({
    group: standing.group,
    teams: standing.rows.map((row) => ({
      name: row.team.name,
      flag: row.team.flag,
      played: row.played,
      gd: row.goalDifference,
      pts: row.points,
    })),
  }));
}

export function toScorerViews(players: Player[]): ScorerView[] {
  return [...players]
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
    .map((player, index) => ({
      rank: index + 1,
      name: player.name,
      team: player.teamName,
      flag: player.nationalityFlag,
      goals: player.goals,
      assists: player.assists,
      photo: player.photoUrl,
    }));
}

export function toNewsView(news: News): NewsView {
  return {
    id: news.id,
    title: news.title,
    excerpt: news.excerpt,
    image: news.imageUrl,
    time: news.publishedAt,
    category: news.category,
    featured: news.featured,
  };
}

export function toNewsViews(newsItems: News[]): NewsView[] {
  return newsItems.map(toNewsView);
}

export function toStatCardViews(stats: TournamentStats): StatCardView[] {
  return [
    {
      label: "שערים",
      value: String(stats.totalGoals),
      change: `+${stats.goalsToday} היום`,
      icon: "⚽",
    },
    {
      label: "משחקים",
      value: String(stats.matchesPlayed),
      change: `מתוך ${stats.totalMatches}`,
      icon: "🏟️",
    },
    {
      label: "צופים",
      value: stats.viewers,
      change: stats.viewersLabel,
      icon: "👥",
    },
    {
      label: "נבחרות",
      value: String(stats.teams),
      change: stats.teamsLabel,
      icon: "🌍",
    },
  ];
}

/** Simulates network latency — swap for real fetch later. */
export function delay(ms = 0): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

export function formatFeedTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
