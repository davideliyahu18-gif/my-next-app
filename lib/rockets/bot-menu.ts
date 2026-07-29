import {
  ALERT_AREAS,
  formatShelterSeconds,
  siteBaseUrl,
} from "@/lib/rockets/alert-areas";
import type { BotSubscriber } from "@/lib/rockets/bot-subscribers";
import type { InlineButton, ReplyMarkup } from "@/lib/rockets/telegram-api";
import type { ActiveAlertArea } from "@/lib/rockets/types";

/** Areas shown in the subscription picker (skip generic israel). */
export const MENU_AREA_IDS = [
  "tel-aviv",
  "gush-dan",
  "sharon",
  "jerusalem",
  "center",
  "haifa",
  "north",
  "galil",
  "golan",
  "ashdod",
  "ashkelon",
  "beer-sheva",
  "gaza-envelope",
  "south",
  "eilat",
] as const;

export function mainMenuKeyboard(sub?: BotSubscriber | null): ReplyMarkup {
  const muteLabel = sub?.muted ? "🔔 הפעל התראות" : "🔕 השתק";
  return {
    inline_keyboard: [
      [
        { text: "🛡️ התראות שלי", callback_data: "menu:areas" },
        { text: "🗺️ מפה חיה", callback_data: "menu:map" },
      ],
      [
        { text: "⏱️ זמן למרחב מוגן", callback_data: "menu:shelter" },
        { text: "📊 מצב עכשיו", callback_data: "menu:status" },
      ],
      [
        { text: "✅ אני בטוח", callback_data: "menu:safe" },
        { text: muteLabel, callback_data: "menu:mute" },
      ],
      [{ text: "⬅️ תפריט ראשי", callback_data: "menu:home" }],
    ],
  };
}

export function areasKeyboard(sub: BotSubscriber): ReplyMarkup {
  const selected = new Set(sub.areas);
  const areas = MENU_AREA_IDS.map(
    (id) => ALERT_AREAS.find((a) => a.id === id)!,
  ).filter(Boolean);

  const rows: InlineButton[][] = [];
  for (let i = 0; i < areas.length; i += 2) {
    const chunk = areas.slice(i, i + 2);
    rows.push(
      chunk.map((area) => ({
        text: `${selected.has(area.id) ? "✅ " : ""}${area.labelHe}`,
        callback_data: `area:${area.id}`,
      })),
    );
  }
  rows.push([
    {
      text: selected.size === 0 ? "🌍 הכל (פעיל)" : "🌍 קבל הכל",
      callback_data: "area:clear",
    },
  ]);
  rows.push([{ text: "⬅️ חזרה לתפריט", callback_data: "menu:home" }]);
  return { inline_keyboard: rows };
}

export function replyMenuKeyboard(): ReplyMarkup {
  return {
    keyboard: [
      [{ text: "תפריט" }, { text: "מצב עכשיו" }],
      [{ text: "אני בטוח" }, { text: "מפה" }],
    ],
    resize_keyboard: true,
  };
}

export function welcomeText(firstName?: string): string {
  const name = firstName ? `, ${firstName}` : "";
  return [
    `🛡️ חמ״ל לייב${name}`,
    "",
    "בוט התראות טילים/כטב״מ לפי אזור — עם מפה וזמן למרחב מוגן.",
    "",
    "בחרו מהתפריט למטה, או כתבו /menu",
    "",
    "⚠️ הערכת OSINT בלבד — לא מחליף פיקוד העורף.",
  ].join("\n");
}

export function homeText(sub: BotSubscriber): string {
  const areas =
    sub.areas.length === 0
      ? "הכל (כל הארץ)"
      : sub.areas
          .map((id) => ALERT_AREAS.find((a) => a.id === id)?.labelHe ?? id)
          .join(" · ");
  return [
    "🛡️ תפריט חמ״ל לייב",
    "",
    `התראות: ${sub.muted ? "מושתק 🔕" : "פעיל 🔔"}`,
    `אזורים: ${areas}`,
    sub.safeAt
      ? `צ׳ק־אין אחרון: ${new Date(sub.safeAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}`
      : "צ׳ק־אין: עדיין לא",
    "",
    "בחרו פעולה:",
  ].join("\n");
}

export function areasText(sub: BotSubscriber): string {
  const areas =
    sub.areas.length === 0
      ? "כרגע מקבלים הכל. לחצו על ערים כדי לסנן."
      : `נבחרו: ${sub.areas
          .map((id) => ALERT_AREAS.find((a) => a.id === id)?.labelHe ?? id)
          .join(" · ")}`;
  return [
    "🛡️ התראות שלי — בחירת אזור",
    "",
    areas,
    "",
    "לחיצה על עיר מוסיפה/מסירה אותה.",
  ].join("\n");
}

export function shelterText(sub: BotSubscriber): string {
  const ids =
    sub.areas.length > 0
      ? sub.areas
      : ["tel-aviv", "haifa", "ashdod", "jerusalem", "gaza-envelope"];
  const lines = ids.map((id) => {
    const area = ALERT_AREAS.find((a) => a.id === id);
    if (!area) return `• ${id}`;
    return `• ${area.labelHe}: ${formatShelterSeconds(area.shelterSeconds)} (${area.shelterSeconds} שנ׳)`;
  });
  return [
    "⏱️ זמן למרחב מוגן",
    "",
    ...lines,
    "",
    "הערכת ייחוס פומבית — לא הוראת פיקוד העורף.",
  ].join("\n");
}

export function mapText(): string {
  const base = siteBaseUrl();
  const url = base ? `${base}/rockets` : "/rockets";
  return [
    "🗺️ מפה חיה",
    "",
    "פתחו את חמ״ל המפה:",
    url,
    "",
    "אפשר גם לקבל קישור ממוקד אחרי התראת שיגור.",
  ].join("\n");
}

export function mapInlineKeyboard(areaId?: string): ReplyMarkup {
  const base = siteBaseUrl();
  const path = areaId ? `/rockets?area=${encodeURIComponent(areaId)}` : "/rockets";
  const absolute = base ? `${base}${path}` : "";
  if (!absolute) {
    return {
      inline_keyboard: [[{ text: "⬅️ חזרה", callback_data: "menu:home" }]],
    };
  }
  return {
    inline_keyboard: [
      [{ text: "🗺️ פתח מפה", url: absolute }],
      [{ text: "⬅️ חזרה", callback_data: "menu:home" }],
    ],
  };
}

export function statusText(input: {
  related: number;
  tracks: number;
  areas: ActiveAlertArea[];
  updatedAt?: string;
}): string {
  const areaLines =
    input.areas.length === 0
      ? ["אין אזור פעיל כרגע בפיד."]
      : input.areas.slice(0, 6).map((a) => {
          return `• ${a.labelHe}: ${formatShelterSeconds(a.shelterSeconds)}`;
        });
  return [
    "📊 מצב עכשיו — חמ״ל לייב",
    "",
    `דיווחי שיגור במעקב: ${input.related}`,
    `מסלולים: ${input.tracks}`,
    "",
    "אזורים:",
    ...areaLines,
    "",
    input.updatedAt
      ? `עודכן: ${new Date(input.updatedAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}`
      : "",
    "⚠️ OSINT בלבד",
  ]
    .filter(Boolean)
    .join("\n");
}

export function safeText(sub: BotSubscriber): string {
  const when = sub.safeAt
    ? new Date(sub.safeAt).toLocaleString("he-IL", {
        timeZone: "Asia/Jerusalem",
      })
    : "";
  return [
    "✅ נרשם: אני בטוח",
    "",
    when ? `זמן: ${when}` : "",
    "אם תרצו — אפשר לשתף את זה בקבוצת המשפחה.",
  ]
    .filter(Boolean)
    .join("\n");
}

export const BOT_COMMANDS = [
  { command: "start", description: "הפעלה ותפריט" },
  { command: "menu", description: "פתח תפריט" },
  { command: "status", description: "מצב עכשיו" },
  { command: "areas", description: "בחירת אזורים" },
  { command: "shelter", description: "זמן למרחב מוגן" },
  { command: "map", description: "מפה חיה" },
  { command: "safe", description: "אני בטוח" },
  { command: "mute", description: "השתק התראות" },
  { command: "unmute", description: "הפעל התראות" },
] as const;
