/**
 * Fallback OSINT scrape + Gulf alert shaping — works even when Next.js is down.
 * Keep filters aligned with lib/missile-alerts/format.ts (regional Gulf path).
 */

const CHANNELS = [
  "newsil5",
  "shigurimisrael",
  "red_alert_il",
  "news0404il",
  "AbuAliExpress",
  "manniefabian",
  "Middle_East_Spectator",
  "OSINTdefender",
  "warfareanalysis",
  "IntelSky",
  "iranintl_en",
  "RocketAlert",
];

const TARGETS = [
  {
    id: "kuwait",
    labelHe: "כווית סיטי",
    lat: 29.3759,
    lng: 47.9774,
    re: /כווית|الكويت|kuwait/i,
  },
  {
    id: "bahrain",
    labelHe: "בחריין",
    lat: 26.2285,
    lng: 50.586,
    re: /בחריין|البحرين|bahrain|manama|מנאמה/i,
  },
  {
    id: "jazan",
    labelHe: "ג׳אזאן / ארמקו",
    lat: 16.8892,
    lng: 42.5706,
    re: /jazan|ג׳אזאן|ג'אזאן|جازان|aramco|ארמקו|yanbu|ינבו/i,
  },
  {
    id: "khamis",
    labelHe: "ח׳מיס מושייט",
    lat: 18.3,
    lng: 42.73,
    re: /khamis|חמיס מושייט|خميس مشيط/i,
  },
  {
    id: "dammam",
    labelHe: "דמאם / מזרח סעודיה",
    lat: 26.4207,
    lng: 50.0888,
    re: /dammam|dhahran|דמאם|ظهران|الدمام/i,
  },
  {
    id: "saudi",
    labelHe: "סעודיה",
    lat: 26.4207,
    lng: 50.0888,
    re: /סעודיה|السعودية|saudi|\bksa\b/i,
  },
  {
    id: "qatar",
    labelHe: "קטאר",
    lat: 25.2854,
    lng: 51.531,
    re: /קטאר|قطر|qatar|doha|דוחה/i,
  },
  {
    id: "dubai",
    labelHe: "דובאי",
    lat: 25.2048,
    lng: 55.2708,
    re: /דובאי|دبي|dubai|uae|אמירויות/i,
  },
  {
    id: "abu-dhabi",
    labelHe: "אבו דאבי",
    lat: 24.4539,
    lng: 54.3773,
    re: /אבו דאבי|أبو ظبي|abu dhabi/i,
  },
];

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseChannelHtml(html, username) {
  const blocks = html.split('class="tgme_widget_message_wrap');
  const messages = [];
  for (const block of blocks.slice(1)) {
    const textMatch = block.match(
      /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/,
    );
    const datetimeMatch = block.match(/datetime="([^"]+)"/);
    const linkMatch = block.match(
      new RegExp(`href="(https://t\\.me/${username}/\\d+)"`, "i"),
    );
    if (!textMatch || !datetimeMatch) continue;
    const text = stripHtml(textMatch[1]);
    if (!text) continue;
    const url =
      linkMatch?.[1] ??
      `https://t.me/${username}/${datetimeMatch[1].replace(/\W/g, "")}`;
    const idMatch = url.match(/\/(\d+)$/);
    messages.push({
      id: `${username}:${idMatch?.[1] ?? datetimeMatch[1]}`,
      channel: username,
      url,
      text,
      datetime: datetimeMatch[1],
    });
  }
  return messages;
}

async function fetchChannel(username) {
  const response = await fetch(`https://t.me/s/${username}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; RocketTrackBot/1.0; +https://vercel.app)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`Telegram fetch failed for ${username}: ${response.status}`);
  }
  return parseChannelHtml(await response.text(), username);
}

export async function scrapeOsintMessages() {
  const errors = [];
  const all = [];
  await Promise.all(
    CHANNELS.map(async (username) => {
      try {
        all.push(...(await fetchChannel(username)));
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : `Failed ${username}`,
        );
      }
    }),
  );
  all.sort((a, b) => Date.parse(b.datetime) - Date.parse(a.datetime));
  return { messages: all, errors };
}

function boldEveryLine(text) {
  return String(text || "")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (/^\*[^*].*\*$/.test(trimmed) && !trimmed.slice(1, -1).includes("*")) {
        return trimmed;
      }
      return `*${trimmed.replace(/\*/g, "")}*`;
    })
    .join("\n");
}

function formatClock(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Kuwait",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    hour12: false,
  }).format(date);
}

function firstTarget(text) {
  for (const t of TARGETS) {
    if (t.re.test(text)) return t;
  }
  return null;
}

/** Saudi/coalition bombing Yemen — not a Gulf defensive alert. */
export function isOutboundIntoYemen(text) {
  if (
    /סעודיה תקפה|saudi\s+arabia\s+bombed|bombed\s+the\s+port\s+of\s+hodeidah|saudi\s+led\s+coalition\s+airstrikes|coalition\s+airstrikes\s+targeted\s+hodeidah|תקיפות הסעודיות.{0,40}חודידה|airstrikes?\s+targeted\s+(?:hodeidah|sanaa|saada|yemen)/i.test(
      text,
    )
  ) {
    return true;
  }
  // "Saudi ... targeted ... Yemen/Hodeidah" without Yemen→Saudi attack language
  const saudiActs =
    /(?:saudi|סעודיה|coalition).{0,80}(?:bombed|airstrike|airstrikes|תקפה|תקיפה)/i.test(
      text,
    ) ||
    /(?:bombed|airstrike|airstrikes|תקפה).{0,80}(?:hodeidah|חודידה|yemen|תימן|sanaa)/i.test(
      text,
    );
  const yemenAsVictim =
    /hodeidah|חודידה|port of hodeidah|sanaa|saada|תימן|yemen/i.test(text);
  const yemenAttacksSaudi =
    /(?:yemen|תימן|חות.?ים|houthis?).{0,60}(?:saudi|סעודיה|jazan|aramco|yanbu|khamis)|(?:saudi|סעודיה|jazan|aramco).{0,60}(?:missile|ballistic|drone|טיל|פגיעה|impact).{0,40}(?:yemen|תימן|houthi)?/i.test(
      text,
    );
  return saudiActs && yemenAsVictim && !yemenAttacksSaudi;
}

export function isGulfStrikeMessage(text) {
  if (isOutboundIntoYemen(text)) return false;

  const saudiAsTarget =
    /(?:target|targets|attack|attacks|missile|ballistic|drone|impact|פגיעה|תקיפה|שיגור|wave of).{0,80}(?:saudi|סעודיה|aramco|jazan|yanbu|khamis|dammam|dhahran|riyadh)/i.test(
      text,
    ) ||
    /(?:saudi|סעודיה|aramco|jazan|yanbu|khamis|dammam|dhahran).{0,80}(?:target|attack|missile|ballistic|drone|impact|פגיעה|fire|burning|impacts?)/i.test(
      text,
    ) ||
    /שיגורים?\s*מתימן\s*לסעודיה|yemeni\s+ballistic\s+missiles?\s+target/i.test(
      text,
    );

  const gulfAsTarget =
    saudiAsTarget ||
    /(?:על|ל|לעבר|toward|towards|on|in)\s*(?:כווית|בחריין|קטאר|דובאי|אבו דאבי|אמירויות|bahrain|kuwait|qatar|dubai|abu dhabi|uae|dammam)/i.test(
      text,
    ) ||
    /(?:כווית|בחריין|קטאר|bahrain|kuwait|qatar).{0,40}(?:פגיעה|תקיפה|שיגור|טיל|impact|attack|missile)/i.test(
      text,
    ) ||
    /(?:ballistic|missile|drone|טיל|בליסטי|כטב).{0,50}(?:bahrain|kuwait|qatar|כווית|בחריין|קטאר|saudi|סעודיה|aramco|jazan)/i.test(
      text,
    ) ||
    firstTarget(text) != null;

  if (!gulfAsTarget) return false;
  return /שיגור|טיל|בליסטי|כטב.?מ|ירי|פגיעה|תקיפה|ballistic|missile|drone|attack|impact|strike|rocket|fire|burning|נפילות/i.test(
    text,
  );
}

function isFighterInIran(text) {
  const hasIran =
    /איראן|ايران|إيران|iran|טהרן|אספהאן|כרמאנשאה|בושהר|שיראז|tehran|isfahan/i.test(
      text,
    );
  if (!hasIran) return false;
  return /מטוס(?:י)?\s*קרב|מטוסי\s*קרב|F-?35|F-?16|fighter\s*jet|combat\s*aircraft|warplane|jets?\s+over\s+iran|פעילות\s*אווירית/i.test(
    text,
  );
}

export function messagesToLocalAlerts(messages) {
  const alerts = [];
  const seen = new Set();

  for (const message of messages) {
    if (isFighterInIran(message.text)) {
      const id = `air-${message.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const snippet = message.text.replace(/\s+/g, " ").trim().slice(0, 200);
      alerts.push({
        id,
        text: boldEveryLine(
          [
            "✈️ התראת מטוסי קרב · איראן",
            "",
            "🧭 סוג: מטוסי קרב / פעילות אווירית",
            `🕐 זוהו: ${formatClock(message.datetime)} (שעון כווית)`,
            "",
            `דיווח: ${snippet}`,
            `מקור: @${message.channel}`,
            message.url,
          ].join("\n"),
        ),
        location: {
          latitude: 32.65,
          longitude: 51.68,
          name: "איראן (משוער)",
          address: "אזור פעילות משוער · איראן",
        },
      });
      continue;
    }

    if (!isGulfStrikeMessage(message.text)) continue;
    const target = firstTarget(message.text) || TARGETS[0];
    const id = `gulf-${message.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const snippet = message.text.replace(/\s+/g, " ").trim().slice(0, 200);
    const weapon = /drone|כטב|מל.?ט/i.test(message.text)
      ? "טיל/כטב״מ"
      : /ballistic|בליסטי/i.test(message.text)
        ? "בליסטי"
        : "לא צוין";
    const origin = /איראן|iran/i.test(message.text)
      ? "איראן (משוער)"
      : /תימן|yemen|houthi|חות/i.test(message.text)
        ? "תימן (משוער)"
        : "לא צוין";

    alerts.push({
      id,
      text: boldEveryLine(
        [
          `🚨 התראת מפרץ · יעד: ${target.labelHe}`,
          "",
          `📍 מקור/משגר (משוער): ${origin}`,
          `🎯 לאן: ${target.labelHe}`,
          `🧭 סוג: ${weapon}`,
          `🕐 דיווח: ${formatClock(message.datetime)} (שעון כווית)`,
          "⏱ מתי מגיעים: לא צוין / באירוע",
          "",
          `דיווח: ${snippet}`,
          "",
          `🗺 מפה: https://maps.google.com/?q=${target.lat.toFixed(5)},${target.lng.toFixed(5)}`,
          `מקור: @${message.channel}`,
          message.url,
          "",
          "⚠️ מיקום מקורב לפי דיווח פומבי/OSINT",
        ].join("\n"),
      ),
      location: {
        latitude: target.lat,
        longitude: target.lng,
        name: target.labelHe,
        address: `אזור יעד משוער · ${target.labelHe}`,
      },
      launchLocation: {
        latitude: /תימן|yemen|houthi|חות/i.test(message.text) ? 16.94 : 28.92,
        longitude: /תימן|yemen|houthi|חות/i.test(message.text) ? 43.76 : 50.84,
        name: origin,
        address: `אזור שיגור משוער · ${origin}`,
      },
    });
  }

  return alerts;
}
