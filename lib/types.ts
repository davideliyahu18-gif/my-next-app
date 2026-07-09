// ─── Domain entities (future live API shape) ───────────────────────────────

export interface Team {
  id: string;
  name: string;
  flag: string;
  code?: string;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  nationalityFlag: string;
  photoUrl: string;
  goals: number;
  assists: number;
}

export type MatchStatus = "live" | "upcoming" | "finished" | "postponed";

export interface Goal {
  id: string;
  matchId: string;
  playerId: string;
  playerName: string;
  teamId: string;
  minute: number;
  isPenalty?: boolean;
  isOwnGoal?: boolean;
}

export type CardType = "yellow" | "red";

export interface Card {
  id: string;
  matchId: string;
  playerId: string;
  playerName: string;
  teamId: string;
  minute: number;
  type: CardType;
}

export interface Substitution {
  id: string;
  matchId: string;
  playerOutId: string;
  playerOutName: string;
  playerInId: string;
  playerInName: string;
  teamId: string;
  minute: number;
}

export interface Match {
  id: string;
  tournamentId: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  /** Elapsed minute when live/finished; null when upcoming. */
  minute: number | null;
  /** Kick-off time label for upcoming matches (e.g. "21:00"). */
  scheduledTime: string | null;
  venue: string;
  stage: string;
  goals: Goal[];
  cards: Card[];
  substitutions: Substitution[];
}

export interface StandingRow {
  team: Team;
  played: number;
  goalDifference: number;
  points: number;
}

export interface Standing {
  group: string;
  rows: StandingRow[];
}

export interface News {
  id: string;
  title: string;
  excerpt: string;
  imageUrl: string;
  /** Relative time label for display (mock); replace with ISO date from API later. */
  publishedAt: string;
  category: string;
  featured: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  hostCountries: string[];
  totalTeams: number;
  totalMatches: number;
  totalCities: number;
  images: {
    stadium: string;
    trophy: string;
  };
}

export interface TournamentStats {
  totalGoals: number;
  goalsToday: number;
  matchesPlayed: number;
  totalMatches: number;
  viewers: string;
  viewersLabel: string;
  teams: number;
  teamsLabel: string;
}

// ─── View models (UI layer) ───────────────────────────────────────────────

export interface LiveMatchView {
  id: string;
  home: string;
  homeFlag: string;
  homeCode: string;
  away: string;
  awayFlag: string;
  awayCode: string;
  homeScore: number | null;
  awayScore: number | null;
  minute: string;
  status: "live" | "upcoming" | "finished";
  venue: string;
  league: string;
  kickoffAt: string;
  highlightUrl: string | null;
  fifaCentreUrl: string;
  idCompetition: string;
  idSeason: string;
  idStage: string;
}

export interface ScheduleMatchView {
  id: string;
  home: string;
  homeFlag: string;
  homeCode: string;
  away: string;
  awayFlag: string;
  awayCode: string;
  homeScore: number | null;
  awayScore: number | null;
  kickoffAt: string;
  dateLabel: string;
  timeLabel: string;
  status: "live" | "upcoming" | "finished";
  stage: string;
  venue: string;
  matchNumber: number | null;
}

export interface ScorerView {
  rank: number;
  name: string;
  team: string;
  teamCode: string;
  flag: string;
  goals: number;
  assists: number;
  photo: string;
}

export interface GroupStandingView {
  group: string;
  teams: {
    name: string;
    code: string;
    flag: string;
    played: number;
    gd: number;
    pts: number;
  }[];
}

export interface NewsView {
  id: string;
  title: string;
  excerpt: string;
  image: string;
  time: string;
  category: string;
  featured: boolean;
}

export interface StatCardView {
  label: string;
  value: string;
  change: string;
  icon: string;
}

export interface NavLinkView {
  href: string;
  label: string;
}

export interface FifaDashboardView {
  matches: LiveMatchView[];
  standings: GroupStandingView[];
  scorers: ScorerView[];
  nextMatch: LiveMatchView | null;
  fetchedAt: string;
}

/** One outbound WhatsApp message mirrored to the website feed. */
export interface WhatsAppFeedMessage {
  id: string;
  body: string;
  sentAt: string;
  source: string;
}

// ─── API layer contracts ──────────────────────────────────────────────────

export interface FootballDataProvider {
  getTournament(): Promise<Tournament>;
  getTournamentStats(): Promise<TournamentStats>;
  getMatches(): Promise<Match[]>;
  getStandings(): Promise<Standing[]>;
  getPlayers(): Promise<Player[]>;
  getNews(): Promise<News[]>;
}

export interface ApiError {
  code: string;
  message: string;
}

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };
