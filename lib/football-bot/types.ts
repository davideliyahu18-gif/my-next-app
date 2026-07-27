export type FootballBotCommand =
  | "help"
  | "status"
  | "score"
  | "tomorrow"
  | "schedule"
  | "leagues"
  | "unknown";

export type FootballBotAlertKind =
  | "goal"
  | "half_time"
  | "full_time"
  | "kickoff_reminder"
  | "match_start";

export interface FootballBotAlert {
  id: string;
  kind: FootballBotAlertKind;
  matchId: string;
  text: string;
  createdAt: string;
}

export interface FootballBotMatchSnapshot {
  id: string;
  home: string;
  away: string;
  homeFlag: string;
  awayFlag: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "live" | "pause" | "upcoming" | "finished";
  minute: string;
  kickoffAt: string;
  competition: string;
  /** Timeline goal event ids already announced. */
  goalEventIds?: string[];
  halfTimeSent?: boolean;
  reminderSent?: boolean;
}

export interface FootballBotPollSummary {
  ok: boolean;
  checkedAt: string;
  liveMatches: number;
  upcomingMatches: number;
  alerts: FootballBotAlert[];
  notified: number;
}
