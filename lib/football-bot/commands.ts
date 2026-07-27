import {
  fetchFootballBoard,
  fetchFootballCalendar,
} from "@/lib/football/source";
import { getEnabledFootballCompetitions } from "@/lib/football/competitions";
import {
  formatHelpMessage,
  formatLeagues,
  formatLiveScores,
  formatScoreLineForMatch,
  formatStatusMessage,
  formatTomorrowMatches,
  formatUpcomingSchedule,
  formatKickoffHe,
} from "./format";
import type { FootballBotCommand } from "./types";

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[?!.,]/g, "")
    .replace(/\s+/g, " ");
}

export function parseFootballBotCommand(raw: string): FootballBotCommand {
  const text = normalize(raw);
  if (!text) return "unknown";

  if (
    text === "עזרה" ||
    text === "help" ||
    text === "פקודות" ||
    text.includes("מה אפשר")
  ) {
    return "help";
  }

  if (
    text === "בוט" ||
    text === "סטטוס" ||
    text === "status" ||
    text.includes("בוט חי") ||
    text.includes("הבוט חי")
  ) {
    return "status";
  }

  if (
    text === "תוצאה" ||
    text === "תוצאות" ||
    text === "חי" ||
    text === "לייב" ||
    text === "live" ||
    text.startsWith("תוצאה ")
  ) {
    return "score";
  }

  if (text === "מחר" || text.includes("משחקי מחר") || text === "tomorrow") {
    return "tomorrow";
  }

  if (
    text === "לוח" ||
    text === "לוז" ||
    text === "לו״ז" ||
    text === "schedule" ||
    text.includes("משחקים הבאים")
  ) {
    return "schedule";
  }

  if (
    text === "ליגות" ||
    text === "ליגה" ||
    text === "leagues" ||
    text.includes("איזה ליגות")
  ) {
    return "leagues";
  }

  return "unknown";
}

export function isFootballBotRemoteCommand(raw: string): boolean {
  return parseFootballBotCommand(raw) !== "unknown";
}

export async function runFootballBotCommand(
  raw: string,
): Promise<{ command: FootballBotCommand; reply: string }> {
  const command = parseFootballBotCommand(raw);

  switch (command) {
    case "help":
      return { command, reply: formatHelpMessage() };
    case "status": {
      const board = await fetchFootballBoard(true);
      const next = board.upcoming[0];
      return {
        command,
        reply: formatStatusMessage({
          liveCount: board.live.length,
          nextLabel: next
            ? `${formatScoreLineForMatch(next)} · ${formatKickoffHe(next.utcDate.toISOString())}`
            : null,
          leagueCount: board.competitions.length,
          alertsEnabled: process.env.FOOTBALL_BOT_ALERTS !== "false",
        }),
      };
    }
    case "score": {
      const board = await fetchFootballBoard(true);
      return {
        command,
        reply: formatLiveScores({
          live: board.live,
          upcoming: board.upcoming,
          finished: board.finished,
        }),
      };
    }
    case "tomorrow": {
      const upcoming = await fetchFootballCalendar([0, 1, 2], true);
      return { command, reply: formatTomorrowMatches(upcoming) };
    }
    case "schedule": {
      const board = await fetchFootballBoard(true);
      return {
        command,
        reply: formatUpcomingSchedule(board.upcoming),
      };
    }
    case "leagues": {
      return {
        command,
        reply: formatLeagues(getEnabledFootballCompetitions()),
      };
    }
    default: {
      return {
        command: "unknown",
        reply: "לא הבנתי את הפקודה.\nכתבו *עזרה* לרשימה.",
      };
    }
  }
}
