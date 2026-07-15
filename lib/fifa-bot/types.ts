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
  | "corner"
  | "half_time"
  | "second_half"
  | "penalties"
  | "penalty_scored"
  | "penalty_missed"
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
  status: "live" | "pause" | "penalties" | "upcoming" | "finished";
  minute: string;
  kickoffAt: string;
  stage: string;
  goals: FifaBotGoalLine[];
  /** Goal event ids that already got the flash "שער!!!" alert. */
  goalFlashIds: string[];
  /** Goal event ids that already got the "כובש השער" update. */
  goalScorerIds: string[];
  /** Corner event ids already announced. */
  cornerIds: string[];
  /** Spot-kick event ids already announced (scored/missed). */
  penaltyKickIds: string[];
  halfTimeSent?: boolean;
  secondHalfSent?: boolean;
  penaltiesSent?: boolean;
}
