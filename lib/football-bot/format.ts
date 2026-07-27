import type { FootballMatch } from "@/lib/football/source";
import type { FootballCompetition } from "@/lib/football/competitions";
import type { FootballBotMatchSnapshot } from "./types";

const JERUSALEM = "Asia/Jerusalem";

export const FOOTBALL_BOT_SIGNATURE = "*📲 דוד – עדכוני כדורגל ⚽*";

export function formatKickoffHe(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.toLocaleDateString("he-IL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: JERUSALEM,
  });
  const time = date.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: JERUSALEM,
  });
  return `${day} · ${time}`;
}

function scoreLine(match: {
  homeFlag: string;
  home: string;
  awayFlag: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  minute?: string;
  status?: string;
}): string {
  const score =
    match.homeScore == null || match.awayScore == null
      ? "vs"
      : `${match.homeScore}–${match.awayScore}`;
  const clock =
    match.status === "live" && match.minute
      ? ` · ${match.minute}`
      : match.status === "finished"
        ? " · סיום"
        : match.status === "pause"
          ? " · מחצית"
          : "";
  return `${match.homeFlag} *${match.home}* ${score} *${match.away}* ${match.awayFlag}${clock}`;
}

export function formatHelpMessage(): string {
  return [
    "⚽ *בוט כדורגל — כל הליגות*",
    "",
    "כתבו בקבוצה:",
    "• *תוצאה* — משחקים חיים / הקרובים",
    "• *מחר* — משחקי מחר",
    "• *לוח* — המשחקים הבאים",
    "• *ליגות* — מה הבוט עוקב אחריו",
    "• *סטטוס* / *בוט* — האם הבוט חי",
    "• *עזרה* — ההודעה הזאת",
    "",
    "התראות אוטומטיות: שער · פתיחה · מחצית · סיום · תזכורת 30 דק׳",
  ].join("\n");
}

export function formatStatusMessage(options: {
  liveCount: number;
  nextLabel: string | null;
  leagueCount: number;
  alertsEnabled: boolean;
}): string {
  return [
    "✅ *בוט כדורגל מחובר*",
    "",
    `🏆 ליגות פעילות: *${options.leagueCount}*`,
    options.liveCount > 0
      ? `🔴 עכשיו חיים: *${options.liveCount}* משחקים`
      : "אין משחק חי כרגע",
    options.nextLabel ? `⏭ הבא: ${options.nextLabel}` : null,
    options.alertsEnabled
      ? "🔔 התראות אוטומטיות: *פועל*"
      : "🔔 התראות אוטומטיות: *כבוי*",
    "",
    "כתבו *עזרה* לרשימת פקודות.",
  ]
    .filter((line) => line != null)
    .join("\n");
}

function toView(match: FootballMatch) {
  const status =
    match.status === "IN_PLAY"
      ? "live"
      : match.status === "PAUSE"
        ? "pause"
        : match.status === "FINISHED"
          ? "finished"
          : "upcoming";
  return {
    homeFlag: match.homeFlag,
    home: match.homeTeam,
    awayFlag: match.awayFlag,
    away: match.awayTeam,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    minute: match.matchTime || (status === "pause" ? "HT" : undefined),
    status,
    competition: match.competition,
    kickoffAt: match.utcDate.toISOString(),
    stage: match.stage,
  };
}

export function formatLiveScores(options: {
  live: FootballMatch[];
  upcoming: FootballMatch[];
  finished: FootballMatch[];
}): string {
  const live = options.live.map(toView);
  const upcoming = options.upcoming.slice(0, 5).map(toView);
  const finished = options.finished.slice(0, 4).map(toView);

  if (!live.length && !upcoming.length && !finished.length) {
    return "⚽ אין כרגע משחקים להצגה. כתבו *לוח* או *ליגות*.";
  }

  const lines: string[] = ["⚽ *תוצאות כדורגל*", ""];

  if (live.length) {
    lines.push("🔴 *חי עכשיו*");
    for (const match of live) {
      lines.push(scoreLine(match));
      lines.push(`   ${match.competition}`);
    }
    lines.push("");
  }

  if (upcoming.length) {
    lines.push("⏭ *הבא בתור*");
    for (const match of upcoming) {
      lines.push(scoreLine(match));
      lines.push(`   ${formatKickoffHe(match.kickoffAt)} · ${match.competition}`);
    }
    lines.push("");
  }

  if (!live.length && finished.length) {
    lines.push("✅ *האחרונים*");
    for (const match of finished) {
      lines.push(scoreLine(match));
      lines.push(`   ${match.competition}`);
    }
  }

  return lines.filter(Boolean).join("\n").trim();
}

export function formatTomorrowMatches(upcoming: FootballMatch[]): string {
  const now = new Date();
  const jerusalemTomorrow = new Date(
    now.toLocaleString("en-US", { timeZone: JERUSALEM }),
  );
  jerusalemTomorrow.setDate(jerusalemTomorrow.getDate() + 1);
  const target = jerusalemTomorrow.toLocaleDateString("en-CA", {
    timeZone: JERUSALEM,
  });

  const matches = upcoming.filter((match) => {
    const day = match.utcDate.toLocaleDateString("en-CA", {
      timeZone: JERUSALEM,
    });
    return day === target;
  });

  if (!matches.length) {
    return "📅 אין משחקים מתוזמנים למחר בליגות הפעילות. כתבו *לוח*.";
  }

  const lines = [`📅 *משחקי מחר* (${matches.length})`, ""];
  for (const match of matches) {
    const view = toView(match);
    lines.push(scoreLine(view));
    lines.push(
      `   ${formatKickoffHe(view.kickoffAt)} · ${match.competition}${
        match.stage ? ` · ${match.stage}` : ""
      }`,
    );
  }
  return lines.join("\n");
}

export function formatUpcomingSchedule(
  upcoming: FootballMatch[],
  limit = 8,
): string {
  const matches = upcoming.slice(0, limit);
  if (!matches.length) return "📋 אין משחקים קרובים ברשימה.";

  const lines = ["📋 *המשחקים הבאים*", ""];
  for (const match of matches) {
    const view = toView(match);
    const prefix = view.status === "live" || view.status === "pause" ? "🔴 " : "";
    lines.push(`${prefix}${scoreLine(view)}`);
    lines.push(`   ${formatKickoffHe(view.kickoffAt)} · ${match.competition}`);
  }
  return lines.join("\n");
}

export function formatLeagues(competitions: FootballCompetition[]): string {
  if (!competitions.length) {
    return "🏆 אין ליגות מוגדרות. הוסיפו ב־FOOTBALL_FIFA_COMPETITIONS.";
  }
  const lines = ["🏆 *ליגות במעקב*", ""];
  for (const competition of competitions) {
    lines.push(`• *${competition.nameHe}* (\`${competition.id}\`)`);
  }
  lines.push("");
  lines.push("כשתביא מקור FIFA נוסף — נוסיף אותו לרשימה.");
  return lines.join("\n");
}

const SCORE_DIGITS = [
  "0️⃣",
  "1️⃣",
  "2️⃣",
  "3️⃣",
  "4️⃣",
  "5️⃣",
  "6️⃣",
  "7️⃣",
  "8️⃣",
  "9️⃣",
] as const;

function scoreDigit(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "❓";
  if (n <= 9) return SCORE_DIGITS[n];
  return String(n)
    .split("")
    .map((ch) => SCORE_DIGITS[Number(ch)] ?? ch)
    .join("");
}

function formatEmojiScore(
  homeScore: number | null,
  awayScore: number | null,
): string {
  return `${scoreDigit(homeScore ?? 0)} - ${scoreDigit(awayScore ?? 0)}`;
}

function boldLine(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("*") && trimmed.endsWith("*")) return trimmed;
  return `*${trimmed}*`;
}

export function formatGoalAlert(snapshot: FootballBotMatchSnapshot): string {
  return [
    `*⚽🔥 שער!!!*`,
    `*🏟️ ${snapshot.homeFlag} ${snapshot.home} 🆚 ${snapshot.awayFlag} ${snapshot.away}*`,
    `*🏆 ${snapshot.competition}*`,
    snapshot.minute ? `*⏱️ דקה ${snapshot.minute}*` : "",
    `*🥅 תוצאה כעת:*`,
    `*${snapshot.homeFlag} ${formatEmojiScore(snapshot.homeScore, snapshot.awayScore)} ${snapshot.awayFlag}*`,
    "",
    FOOTBALL_BOT_SIGNATURE,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatFullTimeAlert(snapshot: FootballBotMatchSnapshot): string {
  return [
    boldLine("🏁 סיום המשחק"),
    boldLine(
      `🏟️ ${snapshot.homeFlag} ${snapshot.home} נגד ${snapshot.awayFlag} ${snapshot.away}`,
    ),
    boldLine(`🏆 ${snapshot.competition}`),
    boldLine(
      `🥅 תוצאה סופית | ${snapshot.home} ${snapshot.homeScore ?? 0} - ${snapshot.away} ${snapshot.awayScore ?? 0}`,
    ),
    "",
    FOOTBALL_BOT_SIGNATURE,
  ].join("\n");
}

export function formatHalfTimeAlert(snapshot: FootballBotMatchSnapshot): string {
  return [
    boldLine("⏸️ מחצית"),
    boldLine(
      `🏟️ ${snapshot.homeFlag} ${snapshot.home} נגד ${snapshot.awayFlag} ${snapshot.away}`,
    ),
    boldLine(`🏆 ${snapshot.competition}`),
    boldLine(
      `🥅 ${snapshot.homeFlag} ${formatEmojiScore(snapshot.homeScore, snapshot.awayScore)} ${snapshot.awayFlag}`,
    ),
    "",
    FOOTBALL_BOT_SIGNATURE,
  ].join("\n");
}

export function formatMatchStartAlert(
  snapshot: FootballBotMatchSnapshot,
): string {
  return [
    boldLine("🚩 המשחק התחיל"),
    boldLine(
      `🏟️ ${snapshot.homeFlag} ${snapshot.home} נגד ${snapshot.awayFlag} ${snapshot.away}`,
    ),
    boldLine(`🏆 ${snapshot.competition}`),
    boldLine("⏱️ דקה | 0"),
    "",
    FOOTBALL_BOT_SIGNATURE,
  ].join("\n");
}

export function formatKickoffReminder(
  snapshot: FootballBotMatchSnapshot,
  minutesLeft: number,
): string {
  return [
    `⏰ *עוד כ־${minutesLeft} דק׳ לפתיחה*`,
    "",
    scoreLine({
      homeFlag: snapshot.homeFlag,
      home: snapshot.home,
      awayFlag: snapshot.awayFlag,
      away: snapshot.away,
      homeScore: null,
      awayScore: null,
    }),
    `🕐 ${formatKickoffHe(snapshot.kickoffAt)}`,
    `🏆 ${snapshot.competition}`,
    "",
    FOOTBALL_BOT_SIGNATURE,
  ].join("\n");
}

export function formatScoreLineForMatch(match: FootballMatch): string {
  return scoreLine(toView(match));
}
