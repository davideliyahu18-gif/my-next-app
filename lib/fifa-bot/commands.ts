import {
  fetchFifaDashboard,
  fetchFullSchedule,
  fetchLiveMatches,
  fetchTopScorers,
} from "@/lib/fifa-data";
import { fetchSemiFinalLineups } from "@/lib/fifa-lineups";
import {
  formatHelpMessage,
  formatLineups,
  formatLiveScores,
  formatScorers,
  formatStatusMessage,
  formatTomorrowMatches,
  formatUpcomingSchedule,
  formatKickoffHe,
  formatScoreLine,
} from "./format";
import type { FifaBotCommand } from "./types";

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[?!.,]/g, "")
    .replace(/\s+/g, " ");
}

/** Parse a Hebrew/WhatsApp remote-control command. */
export function parseFifaBotCommand(raw: string): FifaBotCommand {
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
    text === "הרכב" ||
    text === "הרכבים" ||
    text === "lineup" ||
    text.includes("הרכב ")
  ) {
    return "lineup";
  }

  if (
    text === "מלך שערים" ||
    text === "מלךהשערים" ||
    text === "כובשים" ||
    text === "scorers" ||
    text.includes("מלך שער")
  ) {
    return "scorers";
  }

  return "unknown";
}

export function isFifaBotRemoteCommand(raw: string): boolean {
  return parseFifaBotCommand(raw) !== "unknown";
}

export async function runFifaBotCommand(
  raw: string,
): Promise<{ command: FifaBotCommand; reply: string }> {
  const command = parseFifaBotCommand(raw);

  switch (command) {
    case "help":
      return { command, reply: formatHelpMessage() };
    case "status": {
      const matches = await fetchLiveMatches(true);
      const liveCount = matches.filter((m) => m.status === "live").length;
      const next = matches.find((m) => m.status === "upcoming");
      const nextLabel = next
        ? `${formatScoreLine(next)} · ${formatKickoffHe(next.kickoffAt)}`
        : null;
      return {
        command,
        reply: formatStatusMessage({
          liveCount,
          nextLabel,
          alertsEnabled: process.env.FIFA_BOT_ALERTS !== "false",
        }),
      };
    }
    case "score": {
      const matches = await fetchLiveMatches(true);
      return { command, reply: formatLiveScores(matches) };
    }
    case "tomorrow": {
      const schedule = await fetchFullSchedule(true);
      return { command, reply: formatTomorrowMatches(schedule) };
    }
    case "schedule": {
      const schedule = await fetchFullSchedule(true);
      return { command, reply: formatUpcomingSchedule(schedule) };
    }
    case "lineup": {
      const schedule = await fetchFullSchedule(true);
      const lineups = await fetchSemiFinalLineups(schedule, true);
      return { command, reply: formatLineups(lineups) };
    }
    case "scorers": {
      const scorers = await fetchTopScorers(10, true);
      return { command, reply: formatScorers(scorers) };
    }
    default: {
      const dashboard = await fetchFifaDashboard(true).catch(() => null);
      const hint = dashboard?.nextMatch
        ? `\n\nהבא: ${formatScoreLine(dashboard.nextMatch)}`
        : "";
      return {
        command: "unknown",
        reply: `לא הבנתי את הפקודה.\nכתבו *עזרה* לרשימה.${hint}`,
      };
    }
  }
}
