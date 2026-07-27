import {
  fetchFootballAlertCandidates,
  type FootballMatch,
} from "@/lib/football/source";
import {
  formatFullTimeAlert,
  formatGoalAlert,
  formatHalfTimeAlert,
  formatKickoffReminder,
  formatMatchStartAlert,
} from "./format";
import {
  hasSeenAlert,
  loadMatchSnapshots,
  markAlertsSeen,
  saveMatchSnapshots,
} from "./store";
import type {
  FootballBotAlert,
  FootballBotMatchSnapshot,
} from "./types";

const REMINDER_WINDOW_MIN = Number(
  process.env.FOOTBALL_BOT_REMINDER_MINUTES ?? "30",
);
const REMINDER_TOLERANCE_MIN = 4;

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
    halfTimeSent: previous?.halfTimeSent ?? false,
    reminderSent: previous?.reminderSent ?? false,
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

    // Seed first sighting so we don't spam historical goals.
    if (!prev) {
      if (snapshot.status === "live" || snapshot.status === "pause") {
        // Still announce kickoff only if match just started (minute very early).
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

    if (!snapshot.reminderSent && snapshot.status === "upcoming") {
      const minutesLeft = Math.round(
        (new Date(snapshot.kickoffAt).getTime() - now) / 60_000,
      );
      if (
        minutesLeft <= REMINDER_WINDOW_MIN &&
        minutesLeft >= REMINDER_WINDOW_MIN - REMINDER_TOLERANCE_MIN
      ) {
        const alert = await buildAlert({
          id: `reminder:${snapshot.id}`,
          kind: "kickoff_reminder",
          matchId: snapshot.id,
          text: formatKickoffReminder(snapshot, minutesLeft),
        });
        if (alert) {
          alerts.push(alert);
          snapshot.reminderSent = true;
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
