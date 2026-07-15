import {
  getLiveMatchesNow,
  getMatchById,
  getUpcomingCalendarRows,
  calendarRowToMatch,
  isPlaceholderScorer,
  type FifaMatch,
} from "@/lib/fifa-api";
import {
  formatCornerAlert,
  formatFullTimeAlert,
  formatGoalAlert,
  formatGoalScorerUpdate,
  formatHalfTimeAlert,
  formatKickoffReminder,
  formatMatchStartAlert,
  formatPenaltiesStartAlert,
  formatPenaltyKickAlert,
  formatSecondHalfStartAlert,
} from "./format";
import {
  hasSeenAlert,
  loadMatchSnapshots,
  markAlertsSeen,
  saveMatchSnapshots,
} from "./store";
import type {
  FifaBotAlert,
  FifaBotGoalLine,
  FifaBotMatchSnapshot,
} from "./types";

const REMINDER_WINDOW_MIN = Number(process.env.FIFA_BOT_REMINDER_MINUTES ?? "30");
const REMINDER_TOLERANCE_MIN = 4;

function goalEventId(goal: FifaMatch["goals"][number]): string {
  return goal.eventId || `${goal.minute}:${goal.scorer}:${goal.teamId}`;
}

function mapSnapshotStatus(
  status: FifaMatch["status"],
): FifaBotMatchSnapshot["status"] {
  if (status === "PAUSE") return "pause";
  if (status === "IN_PLAY") return "live";
  if (status === "PENALTIES") return "penalties";
  if (status === "FINISHED") return "finished";
  return "upcoming";
}

function teamFlagForGoal(match: FifaMatch, teamName: string): string {
  if (teamName === match.awayTeam) return match.awayFlag;
  if (teamName === match.homeTeam) return match.homeFlag;
  return match.homeFlag;
}

function goalsForSnapshot(match: FifaMatch): FifaBotGoalLine[] {
  return match.goals
    .filter((goal) => goal.scorer && !isPlaceholderScorer(goal.scorer))
    .map((goal) => ({
      eventId: goalEventId(goal),
      scorer: goal.scorer,
      teamName: goal.teamName,
      teamFlag: teamFlagForGoal(match, goal.teamName),
      minute: goal.minute,
      ownGoal: goal.ownGoal,
    }));
}

function toSnapshot(
  match: FifaMatch,
  previous?: FifaBotMatchSnapshot,
): FifaBotMatchSnapshot {
  const status = mapSnapshotStatus(match.status);

  return {
    id: match.id,
    home: match.homeTeam,
    away: match.awayTeam,
    homeFlag: match.homeFlag,
    awayFlag: match.awayFlag,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status,
    minute:
      match.matchTime ||
      (status === "pause"
        ? "HT"
        : status === "finished"
          ? previous?.minute || "90"
          : "—"),
    kickoffAt: match.utcDate.toISOString(),
    stage: match.group || match.stage || match.competition || "מונדיאל 2026",
    goals: goalsForSnapshot(match),
    goalFlashIds: previous?.goalFlashIds ?? [],
    goalScorerIds: previous?.goalScorerIds ?? [],
    cornerIds: previous?.cornerIds ?? [],
    penaltyKickIds: previous?.penaltyKickIds ?? [],
    halfTimeSent: previous?.halfTimeSent ?? false,
    secondHalfSent: previous?.secondHalfSent ?? false,
    penaltiesSent: previous?.penaltiesSent ?? false,
    homeCode: match.homeTeamCode || previous?.homeCode,
    awayCode: match.awayTeamCode || previous?.awayCode,
    highlightVideoSent: previous?.highlightVideoSent ?? false,
    highlightLinkSent: previous?.highlightLinkSent ?? false,
    highlightAttempts: previous?.highlightAttempts ?? 0,
    highlightWatchUrl: previous?.highlightWatchUrl,
  };
}

async function buildAlert(
  alert: Omit<FifaBotAlert, "createdAt">,
): Promise<FifaBotAlert | null> {
  if (await hasSeenAlert(alert.id)) return null;
  return { ...alert, createdAt: new Date().toISOString() };
}

function parseMinuteNumber(minute: string | undefined): number | null {
  if (!minute) return null;
  const minuteNum = Number(String(minute).replace(/[^\d].*$/, ""));
  return Number.isFinite(minuteNum) ? minuteNum : null;
}

async function processLiveMatch(
  rich: FifaMatch,
  previous: Record<string, FifaBotMatchSnapshot>,
  nextSnapshots: Record<string, FifaBotMatchSnapshot>,
  alerts: FifaBotAlert[],
): Promise<void> {
  const prev = previous[rich.id];
  const snapshot = toSnapshot(rich, prev);

  const becameLive =
    snapshot.status === "live" || snapshot.status === "pause";
  if (
    becameLive &&
    (prev?.status === "upcoming" ||
      (!prev && (parseMinuteNumber(snapshot.minute) ?? 0) <= 3))
  ) {
    const alert = await buildAlert({
      id: `start:${snapshot.id}`,
      kind: "match_start",
      matchId: snapshot.id,
      text: formatMatchStartAlert(snapshot),
    });
    if (alert) alerts.push(alert);
  }

  const corners = rich.corners ?? [];

  // First time we see this match: seed existing events so we don't spam history.
  if (!prev) {
    const minuteNum = parseMinuteNumber(snapshot.minute);
    const joinedAtKickoff =
      becameLive && (minuteNum == null || minuteNum <= 3);
    snapshot.goalFlashIds = joinedAtKickoff
      ? []
      : rich.goals.map((goal) => goalEventId(goal));
    snapshot.goalScorerIds = joinedAtKickoff
      ? []
      : rich.goals
          .filter((goal) => goal.scorer && !isPlaceholderScorer(goal.scorer))
          .map((goal) => goalEventId(goal));
    snapshot.cornerIds = joinedAtKickoff
      ? []
      : corners.map((corner) => corner.eventId);
    snapshot.penaltyKickIds = joinedAtKickoff
      ? []
      : (rich.penalties ?? []).map((penalty) => penalty.eventId);
    if (snapshot.status === "pause") {
      snapshot.halfTimeSent = true;
    }
    // Mid-match join in 2nd half: don't announce second-half whistle later.
    if (snapshot.status === "live" && minuteNum != null && minuteNum >= 46) {
      snapshot.halfTimeSent = true;
      snapshot.secondHalfSent = true;
    }
    if (snapshot.status === "penalties" || snapshot.status === "finished") {
      snapshot.penaltiesSent = true;
    }
    // Just after kickoff: keep processing so early events still fire this tick.
    if (!joinedAtKickoff) {
      nextSnapshots[snapshot.id] = snapshot;
      return;
    }
  }

  const flashed = new Set(snapshot.goalFlashIds);
  const scored = new Set(snapshot.goalScorerIds);
  const cornerSeen = new Set(snapshot.cornerIds);
  const penaltySeen = new Set(snapshot.penaltyKickIds);
  const penaltyKicks = rich.penalties ?? [];

  for (const kick of penaltyKicks) {
    if (penaltySeen.has(kick.eventId)) continue;
    const alert = await buildAlert({
      id: `pen-kick:${snapshot.id}:${kick.eventId}`,
      kind: kick.scored ? "penalty_scored" : "penalty_missed",
      matchId: snapshot.id,
      text: formatPenaltyKickAlert(snapshot, {
        scored: kick.scored,
        player: kick.player,
        teamName: kick.teamName,
        minute: kick.minute,
        homeScore: kick.homeScore,
        awayScore: kick.awayScore,
      }),
    });
    if (alert) {
      alerts.push(alert);
      penaltySeen.add(kick.eventId);
    }
  }

  for (let index = 0; index < corners.length; index += 1) {
    const corner = corners[index];
    if (cornerSeen.has(corner.eventId)) continue;

    const upTo = corners.slice(0, index + 1);
    const homeCount = upTo.filter(
      (item) => item.teamName === rich.homeTeam,
    ).length;
    const awayCount = upTo.filter(
      (item) => item.teamName === rich.awayTeam,
    ).length;

    const alert = await buildAlert({
      id: `corner:${snapshot.id}:${corner.eventId}`,
      kind: "corner",
      matchId: snapshot.id,
      text: formatCornerAlert(
        snapshot,
        corner.teamName,
        corner.minute,
        homeCount,
        awayCount,
      ),
    });
    if (alert) {
      alerts.push(alert);
      cornerSeen.add(corner.eventId);
    }
  }

  for (const goal of rich.goals) {
    const eventId = goalEventId(goal);

    // Spot-kick goals use the dedicated penalty templates instead.
    if (goal.penalty) {
      flashed.add(eventId);
      if (goal.scorer && !isPlaceholderScorer(goal.scorer)) {
        scored.add(eventId);
      }
      continue;
    }

    if (!flashed.has(eventId)) {
      const provisionalId = [...flashed].find((id) =>
        id.startsWith("scoreboard:"),
      );
      if (provisionalId) {
        // Scoreboard flash already went out — just bind the real event id.
        flashed.delete(provisionalId);
        flashed.add(eventId);
      } else {
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

  // Scoreboard can update before the timeline goal event lands — flash ASAP.
  const prevHome = prev?.homeScore ?? 0;
  const prevAway = prev?.awayScore ?? 0;
  const curHome = snapshot.homeScore ?? 0;
  const curAway = snapshot.awayScore ?? 0;
  const scoreJump =
    Math.max(0, curHome - prevHome) + Math.max(0, curAway - prevAway);
  const openPlayFlashes = [...flashed].filter((id) => {
    // Penalty kick goals are tracked separately.
    return !id.includes(":pen");
  }).length;
  const prevOpenPlayFlashes = (prev?.goalFlashIds ?? []).filter((id) => {
    return !id.includes(":pen");
  }).length;
  const newlyFlashedThisTick = Math.max(0, openPlayFlashes - prevOpenPlayFlashes);
  const provisionalNeeded = Math.max(0, scoreJump - newlyFlashedThisTick);
  for (let i = 0; i < provisionalNeeded; i += 1) {
    const eventId = `scoreboard:${snapshot.id}:${curHome}-${curAway}:${i}`;
    if (flashed.has(eventId)) continue;
    const alert = await buildAlert({
      id: `goal:${snapshot.id}:${eventId}`,
      kind: "goal",
      matchId: snapshot.id,
      text: formatGoalAlert(snapshot, snapshot.minute || "—"),
    });
    if (alert) {
      alerts.push(alert);
      flashed.add(eventId);
    }
  }

  snapshot.goalFlashIds = [...flashed];
  snapshot.goalScorerIds = [...scored];
  snapshot.cornerIds = [...cornerSeen];
  snapshot.penaltyKickIds = [...penaltySeen];

  if (
    snapshot.status === "pause" &&
    !snapshot.halfTimeSent &&
    prev?.status !== "pause"
  ) {
    const alert = await buildAlert({
      id: `ht:${snapshot.id}`,
      kind: "half_time",
      matchId: snapshot.id,
      text: formatHalfTimeAlert(snapshot),
    });
    if (alert) {
      alerts.push(alert);
      snapshot.halfTimeSent = true;
    }
  }

  if (
    snapshot.status === "live" &&
    prev?.status === "pause" &&
    !snapshot.secondHalfSent
  ) {
    const alert = await buildAlert({
      id: `h2:${snapshot.id}`,
      kind: "second_half",
      matchId: snapshot.id,
      text: formatSecondHalfStartAlert(snapshot),
    });
    if (alert) {
      alerts.push(alert);
      snapshot.secondHalfSent = true;
    }
  }

  if (
    snapshot.status === "penalties" &&
    prev?.status !== "penalties" &&
    !snapshot.penaltiesSent
  ) {
    const alert = await buildAlert({
      id: `pens:${snapshot.id}`,
      kind: "penalties",
      matchId: snapshot.id,
      text: formatPenaltiesStartAlert(snapshot),
    });
    if (alert) {
      alerts.push(alert);
      snapshot.penaltiesSent = true;
    }
  }

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

export async function collectFifaBotAlerts(): Promise<{
  alerts: FifaBotAlert[];
  snapshots: Record<string, FifaBotMatchSnapshot>;
  liveMatches: number;
  upcomingMatches: number;
}> {
  const previous = await loadMatchSnapshots<FifaBotMatchSnapshot>();
  const nextSnapshots: Record<string, FifaBotMatchSnapshot> = { ...previous };
  const alerts: FifaBotAlert[] = [];

  // getLiveMatchesNow already hydrates live+timeline — no second fetch.
  const live = await getLiveMatchesNow(true);
  for (const rich of live) {
    await processLiveMatch(rich, previous, nextSnapshots, alerts);
  }

  // Near kickoff: poke FIFA match centre directly so we catch kickoff faster
  // than the calendar live window alone.
  const nowMs = Date.now();
  const nearKickoffIds = Object.values(previous)
    .filter((snap) => snap.status === "upcoming")
    .filter((snap) => {
      const kick = new Date(snap.kickoffAt).getTime();
      return kick - nowMs <= 8 * 60_000 && kick - nowMs >= -12 * 60_000;
    })
    .map((snap) => snap.id)
    .filter((id) => !live.some((match) => match.id === id));

  if (nearKickoffIds.length) {
    const watched = await Promise.all(
      nearKickoffIds.map((id) => getMatchById(id, true).catch(() => null)),
    );
    for (const rich of watched) {
      if (!rich) continue;
      if (
        rich.status !== "IN_PLAY" &&
        rich.status !== "PAUSE" &&
        rich.status !== "PENALTIES" &&
        rich.status !== "FINISHED"
      ) {
        continue;
      }
      await processLiveMatch(rich, previous, nextSnapshots, alerts);
    }
  }

  // Catch full-time for matches that just left the live/pause/pens window.
  for (const [id, prev] of Object.entries(previous)) {
    const wasInPlay =
      prev.status === "live" ||
      prev.status === "pause" ||
      prev.status === "penalties";
    const stillInPlay =
      nextSnapshots[id]?.status === "live" ||
      nextSnapshots[id]?.status === "pause" ||
      nextSnapshots[id]?.status === "penalties";
    if (!wasInPlay || stillInPlay) continue;
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
