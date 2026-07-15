#!/usr/bin/env node
/**
 * Resolve FOX WC highlight + compress + Green sendFileByUpload.
 * Used by live-hotpath after full-time (and can be run manually).
 *
 * Env: GREEN_API_*, FIFA_WHATSAPP_*_CHAT_ID
 * Args via env:
 *   FIFA_HL_HOME_CODE=ENG FIFA_HL_AWAY_CODE=ARG
 *   FIFA_HL_HOME=אנגליה FIFA_HL_AWAY=ארגנטינה
 *   FIFA_HL_HOME_FLAG=🇬🇧 FIFA_HL_AWAY_FLAG=🇦🇷
 *   FIFA_HL_HOME_SCORE=1 FIFA_HL_AWAY_SCORE=2
 *   FIFA_HL_STAGE=חצי הגמר
 *   FIFA_HL_KICKOFF=2026-07-15T19:00:00.000Z
 */
import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const FOX_KEY = process.env.FOX_SPORTS_API_KEY || "jE7yBJVRNAwdDesMgTzTXUUSx1It41Fq";
const FOX_API = "https://api.foxsports.com/bifrost/v1";
const UA = "Mozilla/5.0 FIFA-Bot-Highlight";

const FOX_TEAM_EN = {
  ARG: "Argentina",
  ENG: "England",
  ESP: "Spain",
  FRA: "France",
  GER: "Germany",
  BRA: "Brazil",
  POR: "Portugal",
  NED: "Netherlands",
  CRO: "Croatia",
  MAR: "Morocco",
  USA: "USA",
  MEX: "Mexico",
  JPN: "Japan",
  KOR: "South Korea",
  AUS: "Australia",
  CAN: "Canada",
  SUI: "Switzerland",
  NOR: "Norway",
  BEL: "Belgium",
  URU: "Uruguay",
  COL: "Colombia",
  SEN: "Senegal",
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

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function codesMatch(u, l, h, a) {
  u = u.toUpperCase();
  l = l.toUpperCase();
  h = h.toUpperCase();
  a = a.toUpperCase();
  return (u === h && l === a) || (u === a && l === h);
}

async function foxJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function foxHtml(url) {
  const res = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.text();
}

function pickBestMp4(mp4Urls, preferredFmc) {
  if (!mp4Urls.length) return null;
  const cuwh = mp4Urls.find((url) => /cuwh/i.test(url));
  if (cuwh) return cuwh;
  const scored = mp4Urls.map((url) => {
    let score = 0;
    const file = url.toLowerCase();
    if (preferredFmc && url.includes(preferredFmc)) score += 50;
    if (/4min_.*_hl_|_hl_.*lowres/.test(file)) score += 40;
    if (/_hl_/.test(file)) score += 25;
    if (/goal|equal|comp_yt|rivalry|feature|essay|sot_/.test(file)) score -= 30;
    return { url, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.url ?? null;
}

function extractHighlight(html, homeEn, awayEn) {
  const mp4Urls = [
    ...html.matchAll(
      /https:\/\/statics\.foxsports\.com\/mediacloud\/fmc-[a-z0-9]+\/[^"'\\\s]+\.mp4/gi,
    ),
  ].map((m) => m[0]);
  const home = norm(homeEn);
  const away = norm(awayEn);
  let preferredFmc = null;
  let preferredTitle = "";
  const titleRe =
    /((?:[A-Za-z .]+)\s+vs\s+(?:[A-Za-z .]+)\s+(?:Extended\s+)?Highlights[^"<]*)/gi;
  for (const match of html.matchAll(titleRe)) {
    const title = match[1].replace(/\s+/g, " ").trim();
    const compact = norm(title);
    if (!(compact.includes(home) && compact.includes(away))) continue;
    if (compact.includes("extendedhighlights")) continue;
    const around = html.slice(
      Math.max(0, match.index - 180),
      Math.min(html.length, match.index + title.length + 180),
    );
    const fmc = around.match(/fmc-[a-z0-9]+/i)?.[0]?.toLowerCase();
    if (fmc) {
      preferredFmc = fmc;
      preferredTitle = title;
      break;
    }
  }
  const mp4Url = pickBestMp4(mp4Urls, preferredFmc);
  if (!mp4Url) return null;
  const fmcId =
    preferredFmc ||
    mp4Url.match(/mediacloud\/(fmc-[a-z0-9]+)\//i)?.[1]?.toLowerCase();
  if (!fmcId) return null;
  return {
    title: preferredTitle || `${homeEn} vs ${awayEn} Highlights`,
    fmcId,
    mp4Url,
    watchUrl: `https://www.foxsports.com/watch/${fmcId}`,
  };
}

async function resolveClip(homeCode, awayCode, kickoffAt) {
  const homeEn = FOX_TEAM_EN[homeCode.toUpperCase()] || homeCode;
  const awayEn = FOX_TEAM_EN[awayCode.toUpperCase()] || awayCode;
  const d = new Date(kickoffAt);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const segments = [
    `${y}${String(m).padStart(2, "0")}`,
    `${y}${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`,
  ];

  for (const segment of [...new Set(segments)]) {
    const data = await foxJson(
      `${FOX_API}/soccer/specialevent/wc/segment/${segment}?apikey=${FOX_KEY}`,
    );
    for (const section of data?.sectionList || []) {
      for (const ev of section.events || []) {
        const u = ev.upperTeam?.name || "";
        const l = ev.lowerTeam?.name || "";
        if (!codesMatch(u, l, homeCode, awayCode)) continue;
        const webUrl = ev.entityLink?.webUrl;
        if (!webUrl) continue;
        const html = await foxHtml(`https://www.foxsports.com${webUrl}`);
        if (!html) continue;
        const clip = extractHighlight(html, homeEn, awayEn);
        if (clip) return clip;
      }
    }
  }

  const trending = await foxJson(
    `${FOX_API}/general/trending/videos?duration=4&apikey=${FOX_KEY}`,
  );
  for (const row of trending?.data?.results || []) {
    const title = row.title || "";
    const compact = norm(title);
    if (!compact.includes("highlights")) continue;
    if (compact.includes("extended")) continue;
    if (!(compact.includes(norm(homeEn)) && compact.includes(norm(awayEn)))) {
      continue;
    }
    const fmcId = (row.external_id || row.mcvod?.content_id || "").toLowerCase();
    const mp4Url = row.mcvod?.proxy_url;
    if (fmcId && mp4Url) {
      return {
        title,
        fmcId,
        mp4Url,
        watchUrl: `https://www.foxsports.com/watch/${fmcId}`,
      };
    }
  }
  return null;
}

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (c) => {
      stderr += c.toString("utf8");
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
    child.on("error", (e) => resolve({ code: 1, stderr: String(e) }));
  });
}

async function download(url, dest) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok || !res.body) throw new Error(`download ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

async function compress(src, out) {
  const r = await run("ffmpeg", [
    "-y",
    "-i",
    src,
    "-vf",
    "scale=640:-2:flags=lanczos,setsar=1",
    "-c:v",
    "libx264",
    "-profile:v",
    "main",
    "-level",
    "3.1",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-g",
    "60",
    "-b:v",
    "600k",
    "-maxrate",
    "800k",
    "-bufsize",
    "1600k",
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-ac",
    "2",
    "-ar",
    "44100",
    "-movflags",
    "+faststart",
    out,
  ]);
  if (r.code !== 0) throw new Error(r.stderr.slice(-400));
}

async function sendUpload(cfg, chatId, filePath, fileName, caption) {
  const bytes = await readFile(filePath);
  const form = new FormData();
  form.append("chatId", chatId);
  form.append("caption", caption);
  form.append("fileName", fileName);
  form.append("file", new Blob([bytes], { type: "video/mp4" }), fileName);
  const media = (cfg.mediaHost || "https://media.green-api.com").replace(
    /\/$/,
    "",
  );
  const res = await fetch(
    `${media}/waInstance${cfg.instance}/sendFileByUpload/${cfg.token}`,
    { method: "POST", body: form },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`upload ${res.status} ${text.slice(0, 200)}`);
  return text;
}

function captionFromEnv(clipTitle) {
  const home = process.env.FIFA_HL_HOME || "בית";
  const away = process.env.FIFA_HL_AWAY || "חוץ";
  const hf = process.env.FIFA_HL_HOME_FLAG || "";
  const af = process.env.FIFA_HL_AWAY_FLAG || "";
  const hs = process.env.FIFA_HL_HOME_SCORE ?? "?";
  const as = process.env.FIFA_HL_AWAY_SCORE ?? "?";
  const stage = process.env.FIFA_HL_STAGE || "מונדיאל 2026";
  return [
    "🎬 תקציר המשחק",
    `🏆 ${stage}`,
    "",
    `${hf} ${home} ${hs}➖${as} ${af} ${away}`,
    clipTitle ? `🎙 ${clipTitle}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendMatchHighlight(options = {}) {
  await loadEnv();
  const homeCode = options.homeCode || process.env.FIFA_HL_HOME_CODE;
  const awayCode = options.awayCode || process.env.FIFA_HL_AWAY_CODE;
  const kickoffAt =
    options.kickoffAt ||
    process.env.FIFA_HL_KICKOFF ||
    new Date().toISOString();
  if (!homeCode || !awayCode) {
    throw new Error("Missing home/away FIFA codes");
  }

  const clip = await resolveClip(homeCode, awayCode, kickoffAt);
  if (!clip) return { ok: false, reason: "not_ready" };

  const cfg = {
    instance: process.env.GREEN_API_INSTANCE || "",
    token: process.env.GREEN_API_TOKEN || "",
    mediaHost: process.env.GREEN_API_MEDIA_HOST || "https://media.green-api.com",
    mainChat:
      process.env.FIFA_WHATSAPP_MAIN_CHAT_ID || "120363410010039894@g.us",
    vipChat:
      process.env.FIFA_WHATSAPP_VIP_CHAT_ID || "120363427162994986@g.us",
  };
  if (!cfg.instance || !cfg.token) throw new Error("Missing Green API creds");

  const dir = await mkdtemp(path.join(tmpdir(), "fifa-hl-"));
  const src = path.join(dir, "src.mp4");
  const out = path.join(dir, "wa.mp4");
  const fileName = `highlight-${homeCode}-${awayCode}.mp4`;
  const caption = options.caption || captionFromEnv(clip.title);

  try {
    await download(clip.mp4Url, src);
    await compress(src, out);
    const chats = [cfg.mainChat, cfg.vipChat].filter(Boolean);
    for (const chatId of chats) {
      await sendUpload(cfg, chatId, out, fileName, caption);
      console.log(new Date().toISOString(), "HL sent", chatId, clip.fmcId);
    }
    return { ok: true, clip };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  sendMatchHighlight()
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      if (!r.ok) process.exitCode = 2;
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
