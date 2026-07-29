import {
  fetchFootballAlertCandidates,
  type FootballMatch,
} from "@/lib/football/source";
import {
  fetchMatchLineups,
  formatMatchLineupsMessage,
} from "@/lib/football/lineups";
import {
  formatFullTimeAlert,
  formatGoalAlert,
  formatHalfTimeAlert,
  formatKickoffReminder,
  formatLineupAlert,
  formatMatchStartAlert,
} from "./format";
import {
  hasSeenAlert,
  loadMatchSnapshots,
  markAlertsSeen,
  saveMatchSnapshots,
} from "./store";
import {
  loadWatchlist,
  matchInvolvesWatchedTeam,
} from "./watchlist";
import type {
  FootballBotAlert,
  FootballBotMatchSnapshot,
} from "./types";

const REMINDER_30_MIN = Number(process.env.FOOTBALL_BOT_REMINDER_MINUTES ?? "30");
const REMINDER_60_MIN = Number(process.env.FOOTBALL_BOT_REMINDER_60_MINUTES ?? "60");
const REMINDER_TOLERANCE_MIN = 4;
const LINEUP_WINDOW_MIN = Number(process.env.FOOTBALL_BOT_LINEUP_MINUTES ?? "90");
/** When watchlist is set, filter auto-alerts to watched teams only. */
const WATCHLIST_FILTER_ALERTS =
  process.env.FOOTBALL_BOT_WATCHLIST_FILTER !== "false";

function mapStatus(
  status: FootballMatch["status"],
): FootballBotMatchSnapshot["status"] {
  if (status === "PAUSE") return "pause";
  if (status === "IN_PLAY") return "live";
  if (status === "FINISHED") return "finished";
  return "upcoming";
}

function toSnapshot(
  match: FootballMatch,
  previous?: FootballBotMatchSnapshot,
): FootballBotMatchSnapshot {
  const status = mapStatus(match.status);
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
      (status === "pause" ? "HT" : status === "finished" ? "FT" : "—"),
    kickoffAt: match.utcDate.toISOString(),
    competition: match.competition,
    goalEventIds: previous?.goalEventIds ?? [],
    halfTimeSent: previous?.halfTimeSent ?? false,
    reminder30Sent: previous?.reminder30Sent ?? previous?.reminderSent ?? false,
    reminder60Sent: previous?.reminder60Sent ?? false,
    lineupSent: previous?.lineupSent ?? false,
  };
}

async function buildAlert(
  alert: Omit<FootballBotAlert, "createdAt">,
): Promise<FootballBotAlert | null> {
  if (await hasSeenAlert(alert.id)) return null;
  return { ...alert, createdAt: new Date().toISOString() };
}

function totalScore(home: number | null, away: number | null): number {
  return (home ?? 0) + (away ?? 0);
}

async function lineupTextForMatch(match: FootballMatch): Promise<string | null> {
  const lineups = await fetchMatchLineups(match, true);
  if (!lineups?.available) return null;
  // Reuse formatter but strip the outer title for embedding in reminders.
  const full = formatMatchLineupsMessage(match, lineups, { title: "🧍 *הרכבים*" });
  return full;
}

function withinWindow(minutesLeft: number, target: number): boolean {
  return minutesLeft <= target && minutesLeft >= target - REMINDER_TOLERANCE_MIN;
}

export async function collectFootballBotAlerts(): Promise<{
  alerts: FootballBotAlert[];
  snapshots: Record<string, FootballBotMatchSnapshot>;
  liveMatches: number;
  upcomingMatches: number;
}> {
  const previous = await loadMatchSnapshots<FootballBotMatchSnapshot>();
  const nextSnapshots: Record<string, FootballBotMatchSnapshot> = {
    ...previous,
  };
  const alerts: FootballBotAlert[] = [];
  const now = Date.now();
  const watchlist = await loadWatchlist();

  const matches = await fetchFootballAlertCandidates(true);
  let liveMatches = 0;
  let upcomingMatches = 0;

  for (const match of matches) {
    const prev = previous[match.id];
    const snapshot = toSnapshot(match, prev);
    nextSnapshots[match.id] = snapshot;

    if (snapshot.status === "live" || snapshot.status === "pause") {
      liveMatches += 1;
    }
    if (snapshot.status === "upcoming") upcomingMatches += 1;

    const watchedMatch =
      !WATCHLIST_FILTER_ALERTS ||
      matchInvolvesWatchedTeam(match, watchlist);

    // First sighting: seed timeline goals so we don't spam history.
    if (!prev) {
      snapshot.goalEventIds = match.goals.map((goal) => goal.eventId);
      if (
        watchedMatch &&
        (snapshot.status === "live" || snapshot.status === "pause")
      ) {
        const minuteNum = Number(String(snapshot.minute).replace(/\D/g, ""));
        if (!Number.isFinite(minuteNum) || minuteNum <= 3) {
          const start = await buildAlert({
            id: `start:${snapshot.id}`,
            kind: "match_start",
            matchId: snapshot.id,
            text: formatMatchStartAlert(snapshot),
          });
          if (start) alerts.push(start);
        }
      }
      nextSnapshots[match.id] = snapshot;
      continue;
    }

    if (!watchedMatch) {
      snapshot.goalEventIds = [
        ...new Set([
          ...(snapshot.goalEventIds ?? []),
          ...match.goals.map((goal) => goal.eventId),
        ]),
      ];
      nextSnapshots[match.id] = snapshot;
      continue;
    }

    if (
      prev.status === "upcoming" &&
      (snapshot.status === "live" || snapshot.status === "pause")
    ) {
      const alert = await buildAlert({
        id: `start:${snapshot.id}`,
        kind: "match_start",
        matchId: snapshot.id,
        text: formatMatchStartAlert(snapshot),
      });
      if (alert) alerts.push(alert);
    }

    const seenGoals = new Set(snapshot.goalEventIds ?? []);
    let announcedFromTimeline = false;

    for (const goal of match.goals) {
      if (seenGoals.has(goal.eventId)) continue;
      seenGoals.add(goal.eventId);
      const alert = await buildAlert({
        id: `goal:${snapshot.id}:${goal.eventId}`,
        kind: "goal",
        matchId: snapshot.id,
        text: formatGoalAlert(snapshot, {
          scorer: goal.scorer,
          teamName: goal.teamName,
          minute: goal.minute,
        }),
      });
      if (alert) {
        alerts.push(alert);
        announcedFromTimeline = true;
      }
    }
    snapshot.goalEventIds = [...seenGoals];

    if (!announcedFromTimeline) {
      const prevTotal = totalScore(prev.homeScore, prev.awayScore);
      const nextTotal = totalScore(snapshot.homeScore, snapshot.awayScore);
      if (
        (snapshot.status === "live" ||
          snapshot.status === "pause" ||
          snapshot.status === "finished") &&
        nextTotal > prevTotal
      ) {
        const alert = await buildAlert({
          id: `goal:${snapshot.id}:${snapshot.homeScore}-${snapshot.awayScore}`,
          kind: "goal",
          matchId: snapshot.id,
          text: formatGoalAlert(snapshot),
        });
        if (alert) alerts.push(alert);
      }
    }

    if (
      !snapshot.halfTimeSent &&
      prev.status === "live" &&
      snapshot.status === "pause"
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

    if (prev.status !== "finished" && snapshot.status === "finished") {
      const alert = await buildAlert({
        id: `ft:${snapshot.id}`,
        kind: "full_time",
        matchId: snapshot.id,
        text: formatFullTimeAlert(snapshot),
      });
      if (alert) alerts.push(alert);
    }

    if (snapshot.status === "upcoming") {
      const minutesLeft = Math.round(
        (new Date(snapshot.kickoffAt).getTime() - now) / 60_000,
      );

      // Lineups drop window — announce once when first available.
      if (
        !snapshot.lineupSent &&
        minutesLeft <= LINEUP_WINDOW_MIN &&
        minutesLeft > 0
      ) {
        const lineupBlock = await lineupTextForMatch(match);
        if (lineupBlock) {
          const alert = await buildAlert({
            id: `lineup:${snapshot.id}`,
            kind: "lineup",
            matchId: snapshot.id,
            text: formatLineupAlert(snapshot, lineupBlock),
          });
          if (alert) {
            alerts.push(alert);
            snapshot.lineupSent = true;
          }
        }
      }

      if (!snapshot.reminder60Sent && withinWindow(minutesLeft, REMINDER_60_MIN)) {
        const lineupBlock = await lineupTextForMatch(match);
        const alert = await buildAlert({
          id: `reminder:60:${snapshot.id}`,
          kind: "kickoff_reminder",
          matchId: snapshot.id,
          text: formatKickoffReminder(snapshot, minutesLeft, lineupBlock),
        });
        if (alert) {
          alerts.push(alert);
          snapshot.reminder60Sent = true;
          if (lineupBlock) snapshot.lineupSent = true;
        }
      }

      if (!snapshot.reminder30Sent && withinWindow(minutesLeft, REMINDER_30_MIN)) {
        const lineupBlock = await lineupTextForMatch(match);
        const alert = await buildAlert({
          id: `reminder:30:${snapshot.id}`,
          kind: "kickoff_reminder",
          matchId: snapshot.id,
          text: formatKickoffReminder(snapshot, minutesLeft, lineupBlock),
        });
        if (alert) {
          alerts.push(alert);
          snapshot.reminder30Sent = true;
          if (lineupBlock) snapshot.lineupSent = true;
        }
      }
    }

    nextSnapshots[match.id] = snapshot;
  }

  await saveMatchSnapshots(nextSnapshots);
  if (alerts.length) {
    await markAlertsSeen(alerts.map((alert) => alert.id));
  }

  return { alerts, snapshots: nextSnapshots, liveMatches, upcomingMatches };
}
