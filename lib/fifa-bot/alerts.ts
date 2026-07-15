import {
  getLiveMatchesNow,
  getMatchById,
  getUpcomingCalendarRows,
  calendarRowToMatch,
  isPlaceholderScorer,
  type FifaMatch,
} from "@/lib/fifa-api";
import {
  formatFullTimeAlert,
  formatGoalAlert,
  formatGoalScorerUpdate,
  formatKickoffReminder,
  formatMatchStartAlert,
} from "./format";
import {
  hasSeenAlert,
  loadMatchSnapshots,
  markAlertsSeen,
  saveMatchSnapshots,
} from "./store";
import type { FifaBotAlert, FifaBotMatchSnapshot } from "./types";

const REMINDER_WINDOW_MIN = Number(process.env.FIFA_BOT_REMINDER_MINUTES ?? "30");
const REMINDER_TOLERANCE_MIN = 4;

function goalEventId(goal: FifaMatch["goals"][number]): string {
  return goal.eventId || `${goal.minute}:${goal.scorer}:${goal.teamId}`;
}

function toSnapshot(
  match: FifaMatch,
  previous?: FifaBotMatchSnapshot,
): FifaBotMatchSnapshot {
  const status =
    match.status === "IN_PLAY" || match.status === "PAUSE"
      ? "live"
      : match.status === "FINISHED"
        ? "finished"
        : "upcoming";

  return {
    id: match.id,
    home: match.homeTeam,
    away: match.awayTeam,
    homeFlag: match.homeFlag,
    awayFlag: match.awayFlag,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status,
    minute: match.matchTime ?? (status === "finished" ? "סיום" : "—"),
    kickoffAt: match.utcDate.toISOString(),
    stage: match.group || match.stage || match.competition || "מונדיאל 2026",
    goalFlashIds: previous?.goalFlashIds ?? [],
    goalScorerIds: previous?.goalScorerIds ?? [],
  };
}

async function buildAlert(
  alert: Omit<FifaBotAlert, "createdAt">,
): Promise<FifaBotAlert | null> {
  if (await hasSeenAlert(alert.id)) return null;
  return { ...alert, createdAt: new Date().toISOString() };
}

export async function collectFifaBotAlerts(): Promise<{
  alerts: FifaBotAlert[];
  snapshots: Record<string, FifaBotMatchSnapshot>;
  liveMatches: number;
  upcomingMatches: number;
}> {
  const previous = await loadMatchSnapshots<FifaBotMatchSnapshot>();
  const nextSnapshots: Record<string, FifaBotMatchSnapshot> = { ...previous };
  const alerts: FifaBotAlert[] = [];

  const live = await getLiveMatchesNow(true);
  for (const match of live) {
    const rich =
      match.goals.length > 0
        ? match
        : await getMatchById(match.id, true).catch(() => match);
    const prev = previous[rich.id];
    const snapshot = toSnapshot(rich, prev);

    if (prev?.status === "upcoming" && snapshot.status === "live") {
      const alert = await buildAlert({
        id: `start:${snapshot.id}`,
        kind: "match_start",
        matchId: snapshot.id,
        text: formatMatchStartAlert(snapshot),
      });
      if (alert) alerts.push(alert);
    }

    const flashed = new Set(snapshot.goalFlashIds);
    const scored = new Set(snapshot.goalScorerIds);

    for (const goal of rich.goals) {
      const eventId = goalEventId(goal);

      if (!flashed.has(eventId)) {
        const alert = await buildAlert({
          id: `goal:${snapshot.id}:${eventId}`,
          kind: "goal",
          matchId: snapshot.id,
          text: formatGoalAlert(snapshot, goal.minute),
        });
        if (alert) {
          alerts.push(alert);
          flashed.add(eventId);
        }
      }

      if (
        !scored.has(eventId) &&
        goal.scorer &&
        !isPlaceholderScorer(goal.scorer)
      ) {
        const alert = await buildAlert({
          id: `goal-scorer:${snapshot.id}:${eventId}`,
          kind: "goal_scorer",
          matchId: snapshot.id,
          text: formatGoalScorerUpdate(
            snapshot,
            goal.scorer,
            goal.teamName,
            goal.minute,
          ),
        });
        if (alert) {
          alerts.push(alert);
          scored.add(eventId);
        }
      }
    }

    snapshot.goalFlashIds = [...flashed];
    snapshot.goalScorerIds = [...scored];
    nextSnapshots[snapshot.id] = snapshot;

    if (prev && prev.status !== "finished" && snapshot.status === "finished") {
      const alert = await buildAlert({
        id: `ft:${snapshot.id}`,
        kind: "full_time",
        matchId: snapshot.id,
        text: formatFullTimeAlert(snapshot),
      });
      if (alert) alerts.push(alert);
    }
  }

  // Catch full-time for matches that just left the live window.
  for (const [id, prev] of Object.entries(previous)) {
    if (prev.status !== "live" || nextSnapshots[id]?.status === "live") continue;
    try {
      const finished = await getMatchById(id, true);
      const snapshot = toSnapshot(finished, prev);
      nextSnapshots[id] = snapshot;
      if (snapshot.status === "finished") {
        const alert = await buildAlert({
          id: `ft:${snapshot.id}`,
          kind: "full_time",
          matchId: snapshot.id,
          text: formatFullTimeAlert(snapshot),
        });
        if (alert) alerts.push(alert);
      }
    } catch {
      // ignore stale match fetch errors
    }
  }

  const upcomingRows = await getUpcomingCalendarRows(3, true);
  const now = Date.now();
  let upcomingMatches = 0;

  for (const row of upcomingRows) {
    const match = calendarRowToMatch(row);
    if (match.status !== "SCHEDULED") continue;
    upcomingMatches += 1;
    const prev = previous[match.id];
    const snapshot = toSnapshot(match, prev);
    nextSnapshots[snapshot.id] = snapshot;

    const minutesLeft = Math.round((match.utcDate.getTime() - now) / 60_000);
    if (
      minutesLeft <= REMINDER_WINDOW_MIN &&
      minutesLeft >= REMINDER_WINDOW_MIN - REMINDER_TOLERANCE_MIN
    ) {
      const alert = await buildAlert({
        id: `reminder:${snapshot.id}:${REMINDER_WINDOW_MIN}`,
        kind: "kickoff_reminder",
        matchId: snapshot.id,
        text: formatKickoffReminder(snapshot, Math.max(minutesLeft, 1)),
      });
      if (alert) alerts.push(alert);
    }
  }

  await saveMatchSnapshots(nextSnapshots);
  await markAlertsSeen(alerts.map((alert) => alert.id));

  return {
    alerts,
    snapshots: nextSnapshots,
    liveMatches: live.length,
    upcomingMatches,
  };
}
