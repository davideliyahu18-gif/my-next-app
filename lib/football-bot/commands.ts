import {
  fetchFootballBoard,
  fetchFootballCalendar,
  type FootballMatch,
} from "@/lib/football/source";
import { getEnabledFootballCompetitions } from "@/lib/football/competitions";
import {
  fetchMatchLineups,
  formatMatchLineupsMessage,
} from "@/lib/football/lineups";
import {
  formatHelpMessage,
  formatLeagues,
  formatLiveScores,
  formatMorningStatus,
  formatScoreLineForMatch,
  formatStatusMessage,
  formatTomorrowMatches,
  formatUpcomingSchedule,
  formatKickoffHe,
} from "./format";
import {
  buildLineupLeagueSelect,
  buildScheduleLeagueSelect,
  buildStandingsLeagueSelect,
} from "./interactive";
import {
  extractLineupLeagueQuery,
  extractScheduleLeagueQuery,
  extractStandingsLeagueQuery,
  formatLineupLeagueMenu,
  formatScheduleLeagueMenu,
  formatStandingsLeagueMenu,
  resolveLeaguePick,
} from "./league-menu";
import {
  addWatchedTeam,
  extractFollowQuery,
  extractRosterQuery,
  extractUnfollowQuery,
  formatWatchlistMessage,
  loadWatchlist,
  removeWatchedTeam,
  resolveRosterTeam,
} from "./watchlist";
import {
  fetchLeagueStandings,
  formatStandingsMessage,
} from "@/lib/football/standings";
import { renderStandingsPng } from "@/lib/football/standings-image";
import {
  fetchTeamRoster,
  formatRosterMessage,
} from "@/lib/football/roster";
import { renderRosterPng } from "@/lib/football/roster-image";
import type { FootballBotCommand, FootballBotCommandResult } from "./types";

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
    text === "מעקב" ||
    text === "המעקב" ||
    text === "watchlist" ||
    text === "קבוצות במעקב"
  ) {
    return "watchlist";
  }

  if (
    text === "בוקר" ||
    text === "בוקר טוב" ||
    text === "סטטוס בוקר" ||
    text === "morning" ||
    text === "daily"
  ) {
    return "morning";
  }

  const unfollowQuery = extractUnfollowQuery(raw);
  if (unfollowQuery !== null) return "unwatch";

  const followQuery = extractFollowQuery(raw);
  if (followQuery !== null) return "watch";

  const lineupQuery = extractLineupLeagueQuery(raw);
  if (lineupQuery !== null) {
    return lineupQuery === "" ? "lineup_menu" : "lineup";
  }

  const standingsQuery = extractStandingsLeagueQuery(raw);
  if (standingsQuery !== null) {
    return standingsQuery === "" ? "standings_menu" : "standings";
  }

  const rosterQuery = extractRosterQuery(raw);
  if (rosterQuery !== null) {
    return "roster";
  }

  const scheduleQuery = extractScheduleLeagueQuery(raw);
  if (scheduleQuery !== null) {
    return scheduleQuery === "" ? "schedule_menu" : "schedule";
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

function filterByLeague(
  matches: FootballMatch[],
  competitionId: string,
): FootballMatch[] {
  return matches.filter((match) => match.competitionId === competitionId);
}

async function replyLineupForMatches(
  matches: FootballMatch[],
  leagueLabel: string,
): Promise<string> {
  const upcoming = matches
    .filter((match) => match.status === "SCHEDULED" || match.status === "IN_PLAY")
    .slice(0, 1);

  if (!upcoming.length) {
    return [
      `🧍 *הרכבים — ${leagueLabel}*`,
      "",
      "אין משחק קרוב בליגה הזאת כרגע.",
      "כתבו *הרכב* לבחירה מחדש.",
    ].join("\n");
  }

  const match = upcoming[0];
  const lineups = await fetchMatchLineups(match, true);
  if (!lineups) {
    return [
      `🏟️ *${match.homeTeam}* נגד *${match.awayTeam}*`,
      `🏆 ${match.competition}`,
      `🕐 ${formatKickoffHe(match.utcDate.toISOString())}`,
      "",
      "אין מקור הרכב למשחק הזה עדיין.",
    ].join("\n");
  }
  return formatMatchLineupsMessage(match, lineups, {
    title: `🧍 *הרכבים — ${leagueLabel}*`,
  });
}

export async function runFootballBotCommand(
  raw: string,
): Promise<FootballBotCommandResult> {
  const command = parseFootballBotCommand(raw);

  switch (command) {
    case "help":
      return { command, reply: formatHelpMessage() };
    case "status": {
      const board = await fetchFootballBoard(true);
      const next = board.upcoming[0];
      const watchlist = await loadWatchlist();
      return {
        command,
        reply: [
          formatStatusMessage({
            liveCount: board.live.length,
            nextLabel: next
              ? `${formatScoreLineForMatch(next)} · ${formatKickoffHe(next.utcDate.toISOString())}`
              : null,
            leagueCount: board.competitions.length,
            alertsEnabled: process.env.FOOTBALL_BOT_ALERTS !== "false",
          }),
          watchlist.length
            ? `\n⭐ במעקב: ${watchlist.map((t) => t.nameHe).join(" · ")}`
            : "",
        ]
          .filter(Boolean)
          .join(""),
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
    case "schedule_menu":
      return {
        command,
        reply: formatScheduleLeagueMenu(getEnabledFootballCompetitions()),
        interactive: buildScheduleLeagueSelect(),
      };
    case "schedule": {
      const scheduleQuery = extractScheduleLeagueQuery(raw);
      const leagueRaw =
        scheduleQuery === null || scheduleQuery === ""
          ? raw
          : scheduleQuery;
      const pick = resolveLeaguePick(leagueRaw);

      if (pick.kind === "none") {
        return {
          command: "schedule_menu",
          reply: [
            "לא זיהיתי את הליגה 🙈",
            "",
            formatScheduleLeagueMenu(getEnabledFootballCompetitions()),
          ].join("\n"),
          interactive: buildScheduleLeagueSelect(),
        };
      }

      const board = await fetchFootballBoard(true);
      if (pick.kind === "all") {
        return {
          command,
          reply: formatUpcomingSchedule(board.upcoming, 10, "כל הליגות"),
        };
      }

      const filtered = filterByLeague(board.upcoming, pick.competition.id);
      return {
        command,
        reply: formatUpcomingSchedule(
          filtered,
          10,
          pick.competition.nameHe,
        ),
      };
    }
    case "lineup_menu":
      return {
        command,
        reply: formatLineupLeagueMenu(getEnabledFootballCompetitions()),
        interactive: buildLineupLeagueSelect(),
      };
    case "lineup": {
      const lineupQuery = extractLineupLeagueQuery(raw);
      const leagueRaw =
        lineupQuery === null || lineupQuery === "" ? raw : lineupQuery;
      const pick = resolveLeaguePick(leagueRaw);

      if (pick.kind === "none") {
        return {
          command: "lineup_menu",
          reply: [
            "לא זיהיתי את הליגה 🙈",
            "",
            formatLineupLeagueMenu(getEnabledFootballCompetitions()),
          ].join("\n"),
          interactive: buildLineupLeagueSelect(),
        };
      }

      const board = await fetchFootballBoard(true);
      if (pick.kind === "all") {
        return {
          command,
          reply: await replyLineupForMatches(board.upcoming, "כל הליגות"),
        };
      }

      const filtered = filterByLeague(board.upcoming, pick.competition.id);
      return {
        command,
        reply: await replyLineupForMatches(filtered, pick.competition.nameHe),
      };
    }
    case "standings_menu":
      return {
        command,
        reply: formatStandingsLeagueMenu(getEnabledFootballCompetitions()),
        interactive: buildStandingsLeagueSelect(),
      };
    case "standings": {
      const standingsQuery = extractStandingsLeagueQuery(raw);
      const leagueRaw =
        standingsQuery === null || standingsQuery === ""
          ? raw
          : standingsQuery;
      const pick = resolveLeaguePick(leagueRaw);

      if (pick.kind === "none" || pick.kind === "all") {
        return {
          command: "standings_menu",
          reply: [
            pick.kind === "all"
              ? "בחרו ליגה אחת לטבלה (אין טבלה ל־הכל)."
              : "לא זיהיתי את הליגה 🙈",
            "",
            formatStandingsLeagueMenu(getEnabledFootballCompetitions()),
          ].join("\n"),
          interactive: buildStandingsLeagueSelect(),
        };
      }

      try {
        const table = await fetchLeagueStandings(
          pick.competition.id,
          pick.competition.nameHe,
        );
        const reply = formatStandingsMessage(table);
        const caption = [
          `📊 *טבלה — ${pick.competition.nameHe}*`,
          table.seasonLabel ? `עונה: ${table.seasonLabel}` : null,
          "כתבו *טבלה* לבחירת ליגה אחרת",
        ]
          .filter(Boolean)
          .join("\n");

        try {
          const png = await renderStandingsPng(table);
          return {
            command,
            reply,
            media: {
              kind: "image",
              mime: "image/png",
              base64: png.toString("base64"),
              caption,
            },
          };
        } catch (imageError) {
          console.error("[football-bot/standings-image]", imageError);
          return { command, reply };
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "שגיאה בטבלה";
        return {
          command,
          reply: [
            `⚠️ לא הצלחתי להביא טבלה ל־*${pick.competition.nameHe}*`,
            message.slice(0, 120),
            "",
            "נסו שוב: *טבלה 1* · *טבלה אנגלית*",
          ].join("\n"),
        };
      }
    }
    case "roster": {
      const rosterQuery = extractRosterQuery(raw) ?? "";
      const team = await resolveRosterTeam(rosterQuery);
      if (!team) {
        return {
          command,
          reply: [
            "🧍 *סגל שחקנים*",
            "",
            "לא זיהיתי קבוצה.",
            "נסו: *סגל ברצלונה* · *סגל ריאל*",
            "או הוסיפו למעקב ואז *סגל*.",
          ].join("\n"),
        };
      }
      if (!team.espnTeamId || !team.leagueId) {
        return {
          command,
          reply: [
            `🧍 אין סגל ESPN עדיין ל־*${team.nameHe}*`,
            "כרגע נתמך: *ברצלונה* · *ריאל מדריד*",
          ].join("\n"),
        };
      }

      try {
        const roster = await fetchTeamRoster({
          leagueId: team.leagueId,
          espnTeamId: team.espnTeamId,
          teamNameHe: team.nameHe,
        });
        const reply = formatRosterMessage(roster);
        const newcomers = roster.players
          .filter((player) => player.isNewSigning)
          .map((player) => player.nameHe || player.name);
        const caption = [
          `🧍 *סגל — ${team.nameHe}*`,
          roster.seasonLabel ? `עונה: ${roster.seasonLabel}` : null,
          newcomers.length ? `🆕 רכש: ${newcomers.join(" · ")}` : null,
          "⭐ במעקב · כתבו *סגל ריאל* לקבוצה אחרת",
        ]
          .filter(Boolean)
          .join("\n");

        try {
          const png = await renderRosterPng(roster);
          return {
            command,
            reply,
            media: {
              kind: "image",
              mime: "image/png",
              base64: png.toString("base64"),
              caption,
            },
          };
        } catch (imageError) {
          console.error("[football-bot/roster-image]", imageError);
          return { command, reply };
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "שגיאה בסגל";
        return {
          command,
          reply: [
            `⚠️ לא הצלחתי להביא סגל ל־*${team.nameHe}*`,
            message.slice(0, 120),
            "",
            "נסו שוב: *סגל ברצלונה*",
          ].join("\n"),
        };
      }
    }
    case "watch": {
      const query = extractFollowQuery(raw) ?? "";
      if (!query) {
        return {
          command,
          reply: [
            "⭐ כתבו איזו קבוצה לעקוב:",
            "• *עקוב ברצלונה*",
            "• *עקוב ארסנל*",
            "• *עקוב מכבי חיפה*",
            "",
            "רשימה: *מעקב*",
          ].join("\n"),
        };
      }
      const result = await addWatchedTeam(query);
      if (!result.ok || !result.team) {
        return { command, reply: result.error || "לא הצלחתי להוסיף." };
      }
      if (result.already) {
        return {
          command,
          reply: `⭐ *${result.team.nameHe}* כבר במעקב.\nכתבו *מעקב* לרשימה.`,
        };
      }
      return {
        command,
        reply: [
          `✅ נוספה למעקב: *${result.team.nameHe}* (${result.team.nameEn})`,
          "",
          "מעכשיו תזכורות · הרכבים · שערים · סיום — בעיקר לקבוצות במעקב.",
          "כתבו *מעקב* לרשימה המלאה.",
        ].join("\n"),
      };
    }
    case "unwatch": {
      const query = extractUnfollowQuery(raw) ?? "";
      if (!query) {
        return {
          command,
          reply: "כתבו למשל: *הסר ברצלונה*",
        };
      }
      const result = await removeWatchedTeam(query);
      if (!result.ok || !result.team) {
        return { command, reply: result.error || "לא הצלחתי להסיר." };
      }
      return {
        command,
        reply: `🗑️ הוסרה מהמעקב: *${result.team.nameHe}*`,
      };
    }
    case "watchlist": {
      const teams = await loadWatchlist();
      return { command, reply: formatWatchlistMessage(teams) };
    }
    case "morning": {
      const board = await fetchFootballBoard(true);
      const watchlist = await loadWatchlist();
      const jerusalem = "Asia/Jerusalem";
      const todayKey = new Date().toLocaleDateString("en-CA", {
        timeZone: jerusalem,
      });
      const now = Date.now();

      const upcomingToday = board.upcoming.filter((match) => {
        const day = match.utcDate.toLocaleDateString("en-CA", {
          timeZone: jerusalem,
        });
        return day === todayKey;
      });

      const upcomingSoon = board.upcoming
        .filter((match) => {
          const kickoff = match.utcDate.getTime();
          return kickoff >= now && kickoff <= now + 72 * 60 * 60 * 1000;
        })
        .slice(0, 8);

      return {
        command,
        reply: formatMorningStatus({
          leagueNames: board.competitions.map((c) => c.nameHe),
          upcomingToday,
          upcomingSoon,
          watchedTeams: watchlist.map((t) => t.nameHe),
          liveCount: board.live.length,
        }),
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
