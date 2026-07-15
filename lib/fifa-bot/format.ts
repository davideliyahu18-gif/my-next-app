import type { LiveMatchView, ScorerView, ScheduleMatchView } from "@/lib/types";
import type { SemiFinalLineupMatchView } from "@/lib/types";
import type { FifaBotAlertKind, FifaBotMatchSnapshot } from "./types";

const JERUSALEM = "Asia/Jerusalem";

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

export function formatScoreLine(match: {
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
        : "";
  return `${match.homeFlag} *${match.home}* ${score} *${match.away}* ${match.awayFlag}${clock}`;
}

export function formatHelpMessage(): string {
  return [
    "⚽ *בוט מונדיאל — שלט רחוק*",
    "",
    "כתבו בקבוצה:",
    "• *תוצאה* — משחקים חיים / הקרובים",
    "• *מחר* — משחקי מחר",
    "• *לוח* — 6 המשחקים הבאים",
    "• *הרכב* — הרכבי חצי הגמר",
    "• *מלך שערים* — טבלת השערים",
    "• *סטטוס* / *בוט* — האם הבוט חי",
    "• *עזרה* — ההודעה הזאת",
    "",
    "התראות אוטומטיות: שער · סיום · תזכורת 30 דק׳ לפני",
  ].join("\n");
}

export function formatStatusMessage(options: {
  liveCount: number;
  nextLabel: string | null;
  alertsEnabled: boolean;
}): string {
  return [
    "✅ *בוט מונדיאל מחובר*",
    "",
    options.liveCount > 0
      ? `🔴 עכשיו חיים: *${options.liveCount}* משחקים`
      : "אין משחק חי כרגע",
    options.nextLabel ? `⏭ הבא: ${options.nextLabel}` : "",
    options.alertsEnabled
      ? "🔔 התראות אוטומטיות: *פועל*"
      : "🔔 התראות אוטומטיות: *כבוי*",
    "",
    "כתבו *עזרה* לרשימת פקודות.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatLiveScores(matches: LiveMatchView[]): string {
  const live = matches.filter((m) => m.status === "live");
  const upcoming = matches.filter((m) => m.status === "upcoming").slice(0, 4);
  const finished = matches.filter((m) => m.status === "finished").slice(0, 3);

  if (!live.length && !upcoming.length && !finished.length) {
    return "⚽ אין כרגע משחקים להצגה. כתבו *לוח* לרשימה מורחבת.";
  }

  const lines: string[] = ["⚽ *תוצאות מונדיאל*", ""];

  if (live.length) {
    lines.push("🔴 *חי עכשיו*");
    for (const match of live) {
      lines.push(formatScoreLine(match));
      if (match.league) lines.push(`   ${match.league}`);
    }
    lines.push("");
  }

  if (upcoming.length) {
    lines.push("⏭ *הבא בתור*");
    for (const match of upcoming) {
      lines.push(formatScoreLine(match));
      lines.push(`   ${formatKickoffHe(match.kickoffAt)}`);
    }
    lines.push("");
  }

  if (!live.length && finished.length) {
    lines.push("✅ *האחרונים*");
    for (const match of finished) {
      lines.push(formatScoreLine(match));
    }
  }

  return lines.filter(Boolean).join("\n").trim();
}

export function formatTomorrowMatches(schedule: ScheduleMatchView[]): string {
  const now = new Date();
  const jerusalemTomorrow = new Date(
    now.toLocaleString("en-US", { timeZone: JERUSALEM }),
  );
  jerusalemTomorrow.setDate(jerusalemTomorrow.getDate() + 1);
  const target = jerusalemTomorrow.toLocaleDateString("en-CA", {
    timeZone: JERUSALEM,
  });

  const matches = schedule.filter((match) => {
    const day = new Date(match.kickoffAt).toLocaleDateString("en-CA", {
      timeZone: JERUSALEM,
    });
    return day === target;
  });

  if (!matches.length) {
    return "📅 אין משחקים מתוזמנים למחר. כתבו *לוח* לראות את הקרובים.";
  }

  const lines = [`📅 *משחקי מחר* (${matches.length})`, ""];
  for (const match of matches) {
    lines.push(formatScoreLine(match));
    lines.push(`   ${match.timeLabel} · ${match.stage}`);
    if (match.venue && match.venue !== "—") lines.push(`   📍 ${match.venue}`);
  }
  return lines.join("\n");
}

export function formatUpcomingSchedule(
  schedule: ScheduleMatchView[],
  limit = 6,
): string {
  const now = Date.now();
  const upcoming = schedule
    .filter(
      (match) =>
        match.status === "upcoming" ||
        match.status === "live" ||
        new Date(match.kickoffAt).getTime() >= now - 3 * 60 * 60 * 1000,
    )
    .filter((match) => match.status !== "finished")
    .slice(0, limit);

  if (!upcoming.length) {
    return "📋 אין משחקים קרובים ברשימה.";
  }

  const lines = ["📋 *המשחקים הבאים*", ""];
  for (const match of upcoming) {
    const prefix = match.status === "live" ? "🔴 " : "";
    lines.push(`${prefix}${formatScoreLine(match)}`);
    lines.push(`   ${formatKickoffHe(match.kickoffAt)} · ${match.stage}`);
  }
  return lines.join("\n");
}

export function formatScorers(scorers: ScorerView[], limit = 10): string {
  if (!scorers.length) {
    return "🥇 עדיין אין מספיק נתונים למלך השערים.";
  }

  const lines = ["🥇 *מלך השערים*", ""];
  for (const scorer of scorers.slice(0, limit)) {
    const assists =
      scorer.assists > 0 ? ` · ${scorer.assists} בישולים` : "";
    lines.push(
      `${scorer.rank}. ${scorer.flag} *${scorer.name}* — ${scorer.goals} שע׳${assists}`,
    );
    lines.push(`   ${scorer.team}`);
  }
  return lines.join("\n");
}

export function formatLineups(lineups: SemiFinalLineupMatchView[]): string {
  if (!lineups.length) {
    return "🧍 אין עדיין הרכבים לחצי הגמר. נסו שוב קרוב למשחק.";
  }

  const lines = ["🧍 *הרכבי חצי הגמר*", ""];
  for (const match of lineups) {
    lines.push(
      `${match.homeFlag} *${match.home}* vs *${match.away}* ${match.awayFlag}`,
    );
    lines.push(`   ${match.dateLabel} · ${match.timeLabel}`);

    const sides = [
      { label: match.home, lineup: match.homeLineup },
      { label: match.away, lineup: match.awayLineup },
    ];

    for (const side of sides) {
      if (!side.lineup) {
        lines.push(`   ${side.label}: עדיין אין הרכב`);
        continue;
      }
      const starters = side.lineup.starters
        .slice(0, 11)
        .map((p) => (p.shirtNumber != null ? `${p.shirtNumber}. ${p.name}` : p.name))
        .join(", ");
      lines.push(`   *${side.label}* (${side.lineup.sourceLabel})`);
      lines.push(`   ${starters || "—"}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

const SCORE_DIGITS = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"] as const;

function scoreDigit(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "❓";
  if (n <= 9) return SCORE_DIGITS[n];
  return String(n)
    .split("")
    .map((ch) => SCORE_DIGITS[Number(ch)] ?? ch)
    .join("");
}

function minuteLabel(minute: string): string {
  const raw = String(minute).trim();
  if (!raw) return "—";
  return raw.includes("'") ? raw : `${raw}'`;
}

function formatEmojiScore(homeScore: number | null, awayScore: number | null): string {
  return `${scoreDigit(homeScore ?? 0)} - ${scoreDigit(awayScore ?? 0)}`;
}

/** Immediate goal flash — scorer still updating. */
export function formatGoalAlert(
  snapshot: FifaBotMatchSnapshot,
  minute: string,
): string {
  return [
    `*⚽🔥 שער!!!*`,
    `*🏟️ ${snapshot.homeFlag} ${snapshot.home} 🆚 ${snapshot.awayFlag} ${snapshot.away}*`,
    `*⏱️ דקה ${minuteLabel(minute)}*`,
    `*👤 כובש: מתעדכן...*`,
    `*🥅 תוצאה כעת:*`,
    `*${snapshot.homeFlag} ${formatEmojiScore(snapshot.homeScore, snapshot.awayScore)} ${snapshot.awayFlag}*`,
  ].join("\n");
}

/** Follow-up once the scorer name is known. */
export function formatGoalScorerUpdate(
  snapshot: FifaBotMatchSnapshot,
  scorer: string,
  teamName: string,
  minute: string,
): string {
  const scorerLine = teamName ? `${scorer} | ${teamName}` : scorer;
  return [
    `*✅ כובש השער!*`,
    `*🏟️ ${snapshot.homeFlag} ${snapshot.home} 🆚 ${snapshot.awayFlag} ${snapshot.away}*`,
    `*👤 ${scorerLine}*`,
    `*🥅 תוצאה כעת:*`,
    `*${snapshot.homeFlag} ${formatEmojiScore(snapshot.homeScore, snapshot.awayScore)} ${snapshot.awayFlag}*`,
    `*⏱️ דקה ${minuteLabel(minute)}*`,
  ].join("\n");
}

export function formatFullTimeAlert(snapshot: FifaBotMatchSnapshot): string {
  return [
    "🏁 *סיום המשחק*",
    "",
    formatScoreLine({ ...snapshot, status: "finished" }),
    snapshot.stage ? `🏆 ${snapshot.stage}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatKickoffReminder(
  snapshot: FifaBotMatchSnapshot,
  minutesLeft: number,
): string {
  return [
    `⏰ *עוד כ־${minutesLeft} דק׳ לפתיחה*`,
    "",
    formatScoreLine(snapshot),
    `🕐 ${formatKickoffHe(snapshot.kickoffAt)}`,
    snapshot.stage ? `🏆 ${snapshot.stage}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatMatchStartAlert(snapshot: FifaBotMatchSnapshot): string {
  return [
    "▶️ *המשחק התחיל!*",
    "",
    formatScoreLine({ ...snapshot, status: "live", minute: "1'" }),
    snapshot.stage ? `🏆 ${snapshot.stage}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function alertKindLabel(kind: FifaBotAlertKind): string {
  switch (kind) {
    case "goal":
      return "שער";
    case "goal_scorer":
      return "כובש";
    case "full_time":
      return "סיום";
    case "kickoff_reminder":
      return "תזכורת";
    case "match_start":
      return "פתיחה";
    default:
      return kind;
  }
}
