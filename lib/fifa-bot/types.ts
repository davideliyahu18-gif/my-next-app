export type FifaBotCommand =
  | "help"
  | "status"
  | "score"
  | "tomorrow"
  | "lineup"
  | "scorers"
  | "schedule"
  | "unknown";

export type FifaBotAlertKind =
  | "goal"
  | "goal_scorer"
  | "half_time"
  | "full_time"
  | "kickoff_reminder"
  | "match_start";

export interface FifaBotGoalLine {
  eventId: string;
  scorer: string;
  teamName: string;
  teamFlag: string;
  minute: string;
  ownGoal: boolean;
}

export interface FifaBotAlert {
  id: string;
  kind: FifaBotAlertKind;
  matchId: string;
  text: string;
  createdAt: string;
}

export interface FifaBotPollSummary {
  ok: boolean;
  checkedAt: string;
  liveMatches: number;
  upcomingMatches: number;
  alerts: FifaBotAlert[];
  notified: number;
}

export interface FifaBotMatchSnapshot {
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
  stage: string;
  goals: FifaBotGoalLine[];
  /** Goal event ids that already got the flash "שער!!!" alert. */
  goalFlashIds: string[];
  /** Goal event ids that already got the "כובש השער" update. */
  goalScorerIds: string[];
  halfTimeSent?: boolean;
}
