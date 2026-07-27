export type FootballBotCommand =
  | "help"
  | "status"
  | "score"
  | "tomorrow"
  | "schedule"
  | "schedule_menu"
  | "lineup"
  | "lineup_menu"
  | "watch"
  | "unwatch"
  | "watchlist"
  | "morning"
  | "leagues"
  | "unknown";

export type FootballBotInteractive = {
  kind: "league_select";
  intent: "schedule" | "lineup";
  title: string;
  body: string;
  footer: string;
  buttonText: string;
  sectionTitle: string;
  options: Array<{
    id: string;
    title: string;
    description?: string;
    header?: string;
  }>;
};

export type FootballBotCommandResult = {
  command: FootballBotCommand;
  reply: string;
  interactive?: FootballBotInteractive;
};

export type FootballBotAlertKind =
  | "goal"
  | "half_time"
  | "full_time"
  | "kickoff_reminder"
  | "lineup"
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
  reminder30Sent?: boolean;
  reminder60Sent?: boolean;
  lineupSent?: boolean;
  /** @deprecated kept for old snapshots compatibility */
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
