#!/usr/bin/env node
/**
 * Ultra-fast FIFA hotpath for one live match.
 * Polls live + timeline directly every ~1s and sends WhatsApp immediately
 * (skips calendar scan / Next cron overhead).
 *
 * MAIN: all except corners
 * VIP: all except open-play goals
 */
import { readFile, writeFile, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const SEEN_PATH = "/tmp/fifa-hotpath-seen.json";
const LOCK_PATH = process.env.FIFA_HOTPATH_LOCK_FILE || "/tmp/fifa-hotpath.lock";
const DEDUPE_PATH = process.env.FIFA_BOT_DEDUPE_FILE || "/tmp/fifa-whatsapp-dedupe.json";
const DEDUPE_TTL_MS = Number(process.env.FIFA_BOT_DEDUPE_TTL_SEC || "180") * 1000;

const MATCH = {
  id: process.env.FIFA_HOT_MATCH_ID || "400021540",
  idCompetition: "17",
  idSeason: "285023",
  idStage: "289290",
  home: "אנגליה",
  away: "ארגנטינה",
  homeFlag: "🇬🇧",
  awayFlag: "🇦🇷",
  homeId: "43942",
  awayId: "43922",
};

async function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(ROOT, name);
    if (!existsSync(p)) continue;
    const text = await readFile(p, "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i);
      const v = t.slice(i + 1);
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

function cfg() {
  return {
    intervalMs: Number(process.env.FIFA_HOTPATH_MS || "200"),
    instance: process.env.GREEN_API_INSTANCE || "",
    token: process.env.GREEN_API_TOKEN || "",
    apiHost: process.env.GREEN_API_HOST || "https://7107.api.green-api.com",
    mainChat:
      process.env.FIFA_WHATSAPP_MAIN_CHAT_ID || "120363410010039894@g.us",
    vipChat:
      process.env.FIFA_WHATSAPP_VIP_CHAT_ID || "120363427162994986@g.us",
  };
}

async function loadSeen() {
  try {
    return JSON.parse(await readFile(SEEN_PATH, "utf8"));
  } catch {
    return {
      corners: [],
      goals: [],
      penalties: [],
      delays: [],
      resumes: [],
      halfTime: false,
      secondHalf: false,
      matchStart: false,
      fullTime: false,
      penaltiesStart: false,
      stoppage1H: false,
      stoppage2H: false,
      endNinety: false,
      extraTimeStart: false,
      extraTimeHalf: false,
      extraTimeSecond: false,
      highlightVideo: false,
      highlightAttempts: 0,
      seeded: false,
      lastScore: "0-0",
    };
  }
}

async function saveSeen(seen) {
  await writeFile(SEEN_PATH, JSON.stringify(seen), "utf8");
}

async function fifaJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 FIFA-Hotpath",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`FIFA ${res.status} ${url}`);
  return res.json();
}

async function claimSend(chatId, message) {
  const key = createHash("sha256")
    .update(`${chatId}\n${String(message).replace(/\s+/g, " ").trim().slice(0, 500)}`)
    .digest("hex")
    .slice(0, 32);
  const now = Date.now();
  let data = {};
  try {
    data = JSON.parse(await readFile(DEDUPE_PATH, "utf8"));
  } catch {
    data = {};
  }
  for (const [k, exp] of Object.entries(data)) {
    if (exp <= now) delete data[k];
  }
  if (data[key] && data[key] > now) return false;
  data[key] = now + DEDUPE_TTL_MS;
  await writeFile(DEDUPE_PATH, JSON.stringify(data));
  return true;
}

async function writeHotpathLock() {
  const payload = {
    pid: process.pid,
    matchId: MATCH.id,
    updatedAt: Date.now(),
    // Keep lock sticky while hotpath loops; renew each tick.
    expiresAt: Date.now() + 60_000,
  };
  await writeFile(LOCK_PATH, JSON.stringify(payload));
}

async function clearHotpathLock() {
  try {
    await unlink(LOCK_PATH);
  } catch {
    // ignore
  }
}

async function sendGreen(c, chatId, message) {
  if (!(await claimSend(chatId, message))) {
    console.log(new Date().toISOString(), "HOT skip duplicate", chatId.slice(-12));
    return { skipped: true };
  }
  const url = `${c.apiHost}/waInstance${c.instance}/sendMessage/${c.token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Green ${res.status}: ${text.slice(0, 180)}`);
  return text;
}

async function blast(c, channels, message, kind) {
  await Promise.all(
    channels.map(async (channel) => {
      const chatId = channel === "main" ? c.mainChat : c.vipChat;
      await sendGreen(c, chatId, message);
      console.log(new Date().toISOString(), "HOT", channel, kind);
    }),
  );
}

function teamName(id) {
  if (String(id) === MATCH.homeId) return MATCH.home;
  if (String(id) === MATCH.awayId) return MATCH.away;
  return "";
}

function scoreEmoji(h, a) {
  const digits = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
  const one = (n) =>
    String(n)
      .split("")
      .map((ch) => digits[Number(ch)] ?? ch)
      .join("");
  return `${one(h ?? 0)}➖${one(a ?? 0)}`;
}

function periodStatus(period, matchStatus) {
  if (matchStatus === 0 || period === 10) return "finished";
  if (period === 4 || period === 8 || period === 16 || period === 17) return "pause";
  if (period === 11) return "penalties";
  if (period === 3 || period === 5 || period === 7 || period === 9 || period === 0) {
    return "live";
  }
  if (matchStatus === 1 || matchStatus === 3) return "live";
  return "scheduled";
}

async function tick(c, seen) {
  await writeHotpathLock();
  const liveUrl = `https://api.fifa.com/api/v3/live/football/${MATCH.idCompetition}/${MATCH.idSeason}/${MATCH.idStage}/${MATCH.id}?language=en-GB`;
  const tlUrl = `https://api.fifa.com/api/v3/timelines/${MATCH.id}?language=en-GB`;
  const [live, tl] = await Promise.all([fifaJson(liveUrl), fifaJson(tlUrl)]);
  const events = Array.isArray(tl.Event) ? tl.Event : [];
  const home = live.HomeTeam || {};
  const away = live.AwayTeam || {};
  const homeScore = home.Score ?? 0;
  const awayScore = away.Score ?? 0;
  const minute = String(live.MatchTime || "—");
  const status = periodStatus(Number(live.Period), Number(live.MatchStatus));

  // Seed existing history once so we don't spam the whole timeline.
  if (!seen.seeded) {
    seen.delays = seen.delays || [];
    for (const e of events) {
      const id = String(e.EventId || "");
      if (!id) continue;
      if (Number(e.Type) === 16) seen.corners.push(id);
      if ([0, 34, 39, 41].includes(Number(e.Type))) seen.goals.push(id);
      if (Number(e.Type) === 83) seen.delays.push(id);
      if (Number(e.Type) === 78) seen.resumes.push(id);
    }
    seen.seeded = true;
    seen.lastScore = `${homeScore}-${awayScore}`;
    if (status === "pause") seen.halfTime = true;
    if (status === "live" && Number(String(minute).replace(/[^\d].*$/, "")) >= 46) {
      seen.halfTime = true;
      seen.secondHalf = true;
    }
    if (status === "finished") seen.fullTime = true;
    if (String(minute).includes("+") && Number(String(minute).replace(/[^\d].*$/, "")) >= 90) {
      seen.stoppage2H = true;
    } else if (String(minute).includes("+") && Number(String(minute).replace(/[^\d].*$/, "")) >= 45) {
      seen.stoppage1H = true;
    }
    const periodNumSeed = Number(live.Period);
    if (periodNumSeed === 7 || periodNumSeed === 8 || periodNumSeed === 9) {
      seen.endNinety = true;
      seen.extraTimeStart = true;
    }
    if (periodNumSeed === 8 || periodNumSeed === 9) seen.extraTimeHalf = true;
    if (periodNumSeed === 9) seen.extraTimeSecond = true;
    await saveSeen(seen);
    console.log(new Date().toISOString(), "seeded events=", events.length, "status=", status, "min=", minute);
    return { status, minute };
  }

  if (!seen.matchStart && status === "live") {
    seen.matchStart = true;
    await blast(
      c,
      ["main", "vip"],
      `*🚩 המשחק התחיל*\n*🏟️ ${MATCH.homeFlag} ${MATCH.home} נגד ${MATCH.awayFlag} ${MATCH.away}*\n*⏱️ דקה | 0*`,
      "match_start",
    );
  }

  // Corners first — highest sensitivity complaints.
  for (const e of events) {
    if (Number(e.Type) !== 16) continue;
    const id = String(e.EventId || "");
    if (!id || seen.corners.includes(id)) continue;
    const team = teamName(e.IdTeam) || "קבוצה";
    const min = String(e.MatchMinute || minute || "—").replace(/'/g, "");
    const cornerEvents = events.filter((x) => Number(x.Type) === 16);
    const upto = [];
    for (const x of cornerEvents) {
      upto.push(x);
      if (String(x.EventId) === id) break;
    }
    const homeCount = upto.filter((x) => String(x.IdTeam) === MATCH.homeId).length;
    const awayCount = upto.filter((x) => String(x.IdTeam) === MATCH.awayId).length;
    const total = homeCount + awayCount;
    const text = [
      "🚩 *קרן*",
      `🏟️ *${MATCH.homeFlag} ${MATCH.home}* נגד *${MATCH.awayFlag} ${MATCH.away}*`,
      `⏱️ דקה | ${min} | ${team}`,
      `🚩 קרנות לפי FIFA עד עכשיו | סה"כ ${total} | ${MATCH.home} ${homeCount} - ${MATCH.away} ${awayCount}`,
    ].join("\n");
    seen.corners.push(id);
    await blast(c, ["vip"], text, "corner");
  }

  // Hydration / cooling drinks breaks (FIFA Type 83 Delay).
  seen.delays = seen.delays || [];
  for (const e of events) {
    if (Number(e.Type) !== 83) continue;
    const id = String(e.EventId || "");
    if (!id || seen.delays.includes(id)) continue;
    const desc = (((e.EventDescription || [])[0] || {}).Description || "").toLowerCase();
    const min = String(e.MatchMinute || minute || "—").replace(/'/g, "");
    const isHydration =
      desc.includes("hydrat") ||
      desc.includes("drink") ||
      desc.includes("cooling") ||
      desc.includes("water");
    const title = isHydration ? "*💧 הפסקת שתייה*" : "*⏸️ השהיית משחק*";
    const text = [
      title,
      `*🏟️ ${MATCH.homeFlag} ${MATCH.home} ${scoreEmoji(homeScore, awayScore)} ${MATCH.awayFlag} ${MATCH.away}*`,
      `*⏱️ דקה | ${min}*`,
      isHydration ? "_המשחק מושהה לחימום / שתייה_" : "_המשחק מושהה_",
    ].join("\n");
    seen.delays.push(id);
    await blast(c, ["main", "vip"], text, isHydration ? "drinks_break" : "delay");
  }

  // Resume after drinks / interruption (FIFA Type 78).
  seen.resumes = seen.resumes || [];
  for (const e of events) {
    if (Number(e.Type) !== 78) continue;
    const id = String(e.EventId || "");
    if (!id || seen.resumes.includes(id)) continue;
    const min = String(e.MatchMinute || minute || "—").replace(/'/g, "");
    const text = [
      "*▶️ חזרנו למשחק!*",
      `*🏟️ ${MATCH.homeFlag} ${MATCH.home} ${scoreEmoji(homeScore, awayScore)} ${MATCH.awayFlag} ${MATCH.away}*`,
      `*⏱️ דקה | ${min}*`,
      "_אחרי הפסקת שתייה / השהיה_",
    ].join("\n");
    seen.resumes.push(id);
    await blast(c, ["main", "vip"], text, "resume");
  }

  // Goals from timeline
  for (const e of events) {
    const type = Number(e.Type);
    if (![0, 34, 39, 41].includes(type)) continue;
    const id = String(e.EventId || "");
    if (!id || seen.goals.includes(id)) continue;
    const min = String(e.MatchMinute || minute || "—");
    const team = teamName(e.IdTeam);
    const desc = ((e.EventDescription || [])[0] || {}).Description || "";
    const scorer = desc.split(/\s+scores?/i)[0]?.trim() || "מתעדכן...";
    const hs = e.HomeGoals ?? homeScore;
    const as = e.AwayGoals ?? awayScore;
    await blast(
      c,
      ["main"],
      [
        `*⚽🔥 שער!!!*`,
        `*🏟️ ${MATCH.homeFlag} ${MATCH.home} 🆚 ${MATCH.awayFlag} ${MATCH.away}*`,
        `*⏱️ דקה ${min}*`,
        `*👤 כובש: מתעדכן...*`,
        `*🥅 תוצאה כעת:*`,
        `*${MATCH.homeFlag} ${scoreEmoji(hs, as)} ${MATCH.awayFlag}*`,
      ].join("\n"),
      "goal",
    );
    if (scorer && scorer !== "מתעדכן...") {
      await blast(
        c,
        ["main"],
        [
          `*✅ כובש השער!*`,
          `*🏟️ ${MATCH.homeFlag} ${MATCH.home} 🆚 ${MATCH.awayFlag} ${MATCH.away}*`,
          `*👤 ${scorer}${team ? ` | ${team}` : ""}*`,
          `*⏱️ דקה ${min}*`,
        ].join("\n"),
        "goal_scorer",
      );
    }
    seen.goals.push(id);
  }

  // Scoreboard jump before timeline
  const scoreKey = `${homeScore}-${awayScore}`;
  if (scoreKey !== seen.lastScore) {
    const [ph, pa] = String(seen.lastScore || "0-0").split("-").map(Number);
    const jump = Math.max(0, homeScore - (ph || 0)) + Math.max(0, awayScore - (pa || 0));
    if (jump > 0) {
      // Only flash if no new timeline goals in this tick were just handled for that jump;
      // still notify main for speed if timeline empty.
      const openGoals = events.filter((e) =>
        [0, 34, 39, 41].includes(Number(e.Type)),
      ).length;
      if (openGoals < (ph || 0) + (pa || 0) + jump) {
        await blast(
          c,
          ["main"],
          [
            `*⚽🔥 שער!!!*`,
            `*🏟️ ${MATCH.homeFlag} ${MATCH.home} 🆚 ${MATCH.awayFlag} ${MATCH.away}*`,
            `*⏱️ דקה ${minute}*`,
            `*👤 כובש: מתעדכן...*`,
            `*🥅 תוצאה כעת:*`,
            `*${MATCH.homeFlag} ${scoreEmoji(homeScore, awayScore)} ${MATCH.awayFlag}*`,
          ].join("\n"),
          "goal_scoreboard",
        );
      }
    }
    seen.lastScore = scoreKey;
  }

  if (status === "pause" && !seen.halfTime) {
    seen.halfTime = true;
    await blast(
      c,
      ["main", "vip"],
      `*⏸️ מחצית*\n\n*🏟️ ${MATCH.homeFlag} ${MATCH.home} ${scoreEmoji(homeScore, awayScore)} ${MATCH.awayFlag} ${MATCH.away}*`,
      "half_time",
    );
  }

  // Second-half whistle: FIFA Type 7 on period 5, or live again after HT.
  const secondHalfKickoff = events.some(
    (e) =>
      Number(e.Type) === 7 &&
      Number(e.Period) === 5 &&
      /second period|second half/i.test(
        (((e.EventDescription || [])[0] || {}).Description || ""),
      ),
  );
  if (
    !seen.secondHalf &&
    seen.halfTime &&
    (secondHalfKickoff ||
      status === "live" ||
      Number(live.Period) === 5)
  ) {
    // Avoid firing during 1H if halfTime was incorrectly set — require period 5 / type 7 / minute>=45.
    const minNum = Number(String(minute).replace(/[^\d].*$/, ""));
    const periodNum = Number(live.Period);
    const ready =
      secondHalfKickoff ||
      periodNum === 5 ||
      (status === "live" && Number.isFinite(minNum) && minNum >= 45);
    if (ready) {
      seen.secondHalf = true;
      await blast(
        c,
        ["main", "vip"],
        `*🏆 חצי הגמר*\n\n*🔔 שריקת הפתיחה למחצית השנייה!*\n\n*🏟️ ${MATCH.homeFlag} ${MATCH.home} ${scoreEmoji(homeScore, awayScore)} ${MATCH.awayFlag} ${MATCH.away}*`,
        "second_half",
      );
    }
  }

  // Injury / stoppage time (MatchTime like 45'+2' or 90'+4').
  const stoppageMatch = String(minute).match(/^(\d+)'?\s*\+\s*'?(\d+)/);
  if (stoppageMatch) {
    const base = Number(stoppageMatch[1]);
    const added = stoppageMatch[2];
    if (base >= 90 && !seen.stoppage2H) {
      seen.stoppage2H = true;
      await blast(
        c,
        ["main", "vip"],
        [
          "*⏱️ תוספת זמן — מחצית שנייה*",
          `*🏟️ ${MATCH.homeFlag} ${MATCH.home} ${scoreEmoji(homeScore, awayScore)} ${MATCH.awayFlag} ${MATCH.away}*`,
          `*➕ ${added} דקות לפחות*`,
        ].join("\n"),
        "stoppage_2h",
      );
    } else if (base >= 45 && base < 90 && !seen.stoppage1H) {
      seen.stoppage1H = true;
      await blast(
        c,
        ["main", "vip"],
        [
          "*⏱️ תוספת זמן — מחצית ראשונה*",
          `*🏟️ ${MATCH.homeFlag} ${MATCH.home} ${scoreEmoji(homeScore, awayScore)} ${MATCH.awayFlag} ${MATCH.away}*`,
          `*➕ ${added} דקות לפחות*`,
        ].join("\n"),
        "stoppage_1h",
      );
    }
  }

  const periodNum = Number(live.Period);
  const regulationEnded = events.some(
    (e) =>
      Number(e.Type) === 8 &&
      Number(e.Period) === 5 &&
      /second period to an end|second half to an end/i.test(
        (((e.EventDescription || [])[0] || {}).Description || ""),
      ),
  );

  // End of 90' — if tied, announce we're heading to extra time ASAP.
  const minuteBase = Number(String(minute).replace(/[^\d].*$/, ""));
  const nearFullTime =
    Number.isFinite(minuteBase) && minuteBase >= 90;
  if (
    !seen.endNinety &&
    seen.secondHalf &&
    (regulationEnded ||
      (nearFullTime && status === "pause" && periodNum === 4) ||
      (nearFullTime && status === "finished"))
  ) {
    seen.endNinety = true;
    if (homeScore === awayScore && status !== "finished") {
      await blast(
        c,
        ["main", "vip"],
        [
          "*🔔 סיום 90 דקות!*",
          `*🏟️ ${MATCH.homeFlag} ${MATCH.home} ${scoreEmoji(homeScore, awayScore)} ${MATCH.awayFlag} ${MATCH.away}*`,
          "*⏳ הולכים להארכה — גחוף!*",
        ].join("\n"),
        "end_ninety",
      );
    } else if (!(homeScore === awayScore && status !== "finished")) {
      await blast(
        c,
        ["main", "vip"],
        [
          "*🔔 סיום 90 דקות!*",
          `*🏟️ ${MATCH.homeFlag} ${MATCH.home} ${scoreEmoji(homeScore, awayScore)} ${MATCH.awayFlag} ${MATCH.away}*`,
        ].join("\n"),
        "end_ninety",
      );
    }
  }

  // Extra time (ET) — Period 7 start, 8 pause, 9 second ET half.
  if (
    !seen.extraTimeStart &&
    (periodNum === 7 ||
      events.some(
        (e) =>
          Number(e.Type) === 7 &&
          Number(e.Period) === 7,
      ))
  ) {
    seen.extraTimeStart = true;
    seen.endNinety = true;
    await blast(
      c,
      ["main", "vip"],
      [
        "*⏱️🔥 הארכה התחילה!*",
        `*🏟️ ${MATCH.homeFlag} ${MATCH.home} ${scoreEmoji(homeScore, awayScore)} ${MATCH.awayFlag} ${MATCH.away}*`,
        "*⏳ 30 דקות — מחליטים פה*",
      ].join("\n"),
      "extra_time",
    );
  }

  if (
    !seen.extraTimeHalf &&
    seen.extraTimeStart &&
    (periodNum === 8 || (status === "pause" && periodNum !== 4 && periodNum !== 5))
  ) {
    if (periodNum === 8 || (seen.extraTimeStart && status === "pause" && periodNum !== 4)) {
      seen.extraTimeHalf = true;
      await blast(
        c,
        ["main", "vip"],
        [
          "*⏸️ מחצית בהארכה*",
          `*🏟️ ${MATCH.homeFlag} ${MATCH.home} ${scoreEmoji(homeScore, awayScore)} ${MATCH.awayFlag} ${MATCH.away}*`,
        ].join("\n"),
        "extra_time_half",
      );
    }
  }

  if (
    !seen.extraTimeSecond &&
    seen.extraTimeStart &&
    (periodNum === 9 ||
      events.some((e) => Number(e.Type) === 7 && Number(e.Period) === 9))
  ) {
    seen.extraTimeSecond = true;
    await blast(
      c,
      ["main", "vip"],
      [
        "*🔔 מחצית שנייה בהארכה!*",
        `*🏟️ ${MATCH.homeFlag} ${MATCH.home} ${scoreEmoji(homeScore, awayScore)} ${MATCH.awayFlag} ${MATCH.away}*`,
      ].join("\n"),
      "extra_time_second",
    );
  }

  if (status === "penalties" && !seen.penaltiesStart) {
    seen.penaltiesStart = true;
    await blast(
      c,
      ["main", "vip"],
      `*⚡ פנדלים*\n*🏟️ ${MATCH.homeFlag} ${MATCH.home} נגד ${MATCH.awayFlag} ${MATCH.away}*\n*תוצאה לאחר הארכה | ${MATCH.home} ${homeScore} - ${MATCH.away} ${awayScore}*`,
      "penalties",
    );
  }

  if (status === "finished" && !seen.fullTime) {
    seen.fullTime = true;
    const scoreLine = scoreEmoji(homeScore, awayScore);
    let winnerLines;
    if (homeScore > awayScore) {
      winnerLines = [
        `*🥇 המנצחת: ${MATCH.homeFlag} ${MATCH.home}*`,
        "*🎉 ניצחון גדול — עולה לגמר!!!!*",
      ];
    } else if (awayScore > homeScore) {
      winnerLines = [
        `*🥇 המנצחת: ${MATCH.awayFlag} ${MATCH.away}*`,
        "*🎉 ניצחון גדול — עולה לגמר!!!!*",
      ];
    } else {
      winnerLines = ["*🤝 תיקו בסיום*", "*⚖️ ממשיכים להכריע...*"];
    }

    const scorers = [];
    for (const e of events) {
      if (![0, 34, 39, 41].includes(Number(e.Type))) continue;
      const desc = (((e.EventDescription || [])[0] || {}).Description || "");
      const scorer = desc.split(/\s+scores?/i)[0]?.trim();
      const team = teamName(e.IdTeam);
      const flag =
        String(e.IdTeam) === MATCH.homeId
          ? MATCH.homeFlag
          : String(e.IdTeam) === MATCH.awayId
            ? MATCH.awayFlag
            : "⚽";
      const min = String(e.MatchMinute || "").replace(/'/g, "’") || "—";
      if (scorer) scorers.push(`• ${flag} ${scorer} (${min})`);
    }

    const text = [
      "*🏁✨ סיום המשחק!*",
      "*🏆 חצי הגמר*",
      "",
      `*🏟️ ${MATCH.homeFlag} ${MATCH.home} ${scoreLine} ${MATCH.awayFlag} ${MATCH.away}*`,
      `*⏱️ ${String(minute).replace(/'/g, "’") || "90"}*`,
      "",
      ...winnerLines,
      "",
      "*⚽ כובשים:*",
      ...(scorers.length ? scorers : ["• אין שערים"]),
      "",
      "*📣 עדכוני כדורגל - 24/7 ⚽🥇🏆*",
    ].join("\n");

    await blast(c, ["main", "vip"], text, "full_time");
  }

  // Auto highlight video after FT (FOX 4-min recap → compress → Green upload).
  if (status === "finished" && seen.fullTime && !seen.highlightVideo) {
    seen.highlightAttempts = Number(seen.highlightAttempts || 0) + 1;
    if (seen.highlightAttempts <= 90) {
      try {
        const { sendMatchHighlight } = await import("./send-match-highlight.mjs");
        const homeCode = process.env.FIFA_HL_HOME_CODE || "ENG";
        const awayCode = process.env.FIFA_HL_AWAY_CODE || "ARG";
        process.env.FIFA_HL_HOME = MATCH.home;
        process.env.FIFA_HL_AWAY = MATCH.away;
        process.env.FIFA_HL_HOME_FLAG = MATCH.homeFlag;
        process.env.FIFA_HL_AWAY_FLAG = MATCH.awayFlag;
        process.env.FIFA_HL_HOME_SCORE = String(homeScore ?? "");
        process.env.FIFA_HL_AWAY_SCORE = String(awayScore ?? "");
        process.env.FIFA_HL_STAGE = "חצי הגמר";
        const result = await sendMatchHighlight({
          homeCode,
          awayCode,
          kickoffAt: process.env.FIFA_HL_KICKOFF || "2026-07-15T19:00:00.000Z",
        });
        if (result?.ok) {
          seen.highlightVideo = true;
          console.log(new Date().toISOString(), "HOT highlight video sent");
        } else {
          console.log(
            new Date().toISOString(),
            "HOT highlight pending",
            result?.reason || "retry",
            "attempt",
            seen.highlightAttempts,
          );
        }
      } catch (error) {
        console.error(
          new Date().toISOString(),
          "HOT highlight error",
          String(error),
        );
      }
    } else {
      seen.highlightVideo = true;
    }
  }

  await saveSeen(seen);
  return { status, minute, homeScore, awayScore, events: events.length };
}

async function main() {
  await loadEnv();
  const c = cfg();
  if (!c.instance || !c.token) {
    console.error("Missing Green API creds");
    process.exit(1);
  }
  let seen = await loadSeen();
  console.log("HOTPATH start match=", MATCH.id, "intervalMs=", c.intervalMs);
  await writeHotpathLock();
  const stop = async () => {
    await clearHotpathLock();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  for (;;) {
    const t0 = Date.now();
    try {
      const snap = await tick(c, seen);
      seen = await loadSeen();
      console.log(
        new Date().toISOString(),
        "ok",
        snap.status,
        snap.minute,
        `${snap.homeScore ?? "?"}-${snap.awayScore ?? "?"}`,
        "events",
        snap.events ?? "?",
        "ms",
        Date.now() - t0,
      );
    } catch (error) {
      console.error(new Date().toISOString(), "hotpath error", String(error));
    }
    const wait = Math.max(80, c.intervalMs - (Date.now() - t0));
    await new Promise((r) => setTimeout(r, wait));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
