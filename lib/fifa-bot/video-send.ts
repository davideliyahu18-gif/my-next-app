import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { FoxHighlightClip } from "./fox-highlights";
import type { FifaBotChannel } from "./channels";
import { channelsForAlert } from "./channels";

const GREEN_API_INSTANCE = process.env.GREEN_API_INSTANCE ?? "";
const GREEN_API_TOKEN = process.env.GREEN_API_TOKEN ?? "";
const GREEN_API_HOST = (
  process.env.GREEN_API_HOST || "https://7107.api.green-api.com"
).replace(/\/$/, "");
const GREEN_API_MEDIA_HOST = (
  process.env.GREEN_API_MEDIA_HOST || "https://media.green-api.com"
).replace(/\/$/, "");

const MAIN_CHAT_ID =
  process.env.FIFA_WHATSAPP_MAIN_CHAT_ID ||
  process.env.WHATSAPP_GROUP_CHAT_ID ||
  "";
const VIP_CHAT_ID = process.env.FIFA_WHATSAPP_VIP_CHAT_ID || "";

/** Green/WhatsApp is reliable under ~16MB for video payloads. */
const DIRECT_URL_MAX_BYTES = Number(
  process.env.FIFA_BOT_HIGHLIGHT_DIRECT_MAX_BYTES || `${15 * 1024 * 1024}`,
);
const COMPRESS_TARGET_BYTES = Number(
  process.env.FIFA_BOT_HIGHLIGHT_TARGET_BYTES || `${8 * 1024 * 1024}`,
);

function chatIdForChannel(channel: FifaBotChannel): string {
  return channel === "main" ? MAIN_CHAT_ID : VIP_CHAT_ID;
}

function runCommand(
  command: string,
  args: string[],
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
    child.on("error", (error) =>
      resolve({ code: 1, stderr: String(error) }),
    );
  });
}

export async function hasFfmpeg(): Promise<boolean> {
  if (process.env.VERCEL === "1" && process.env.FIFA_BOT_ALLOW_FFMPEG !== "1") {
    return false;
  }
  const result = await runCommand("ffmpeg", ["-version"]);
  return result.code === 0;
}

async function headContentLength(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "Mozilla/5.0 FIFA-Bot" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length"));
    return Number.isFinite(len) ? len : null;
  } catch {
    return null;
  }
}

async function downloadToFile(url: string, dest: string): Promise<number> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 FIFA-Bot" },
    cache: "no-store",
  });
  if (!res.ok || !res.body) {
    throw new Error(`Download failed ${res.status}`);
  }
  const nodeStream = Readable.fromWeb(
    res.body as import("node:stream/web").ReadableStream,
  );
  await pipeline(nodeStream, createWriteStream(dest));
  const buf = await readFile(dest);
  return buf.byteLength;
}

async function compressForWhatsApp(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  // WhatsApp-friendly H.264 Main @30fps + AAC, faststart, ~640px wide.
  const result = await runCommand("ffmpeg", [
    "-y",
    "-i",
    inputPath,
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
    outputPath,
  ]);
  if (result.code !== 0) {
    throw new Error(`ffmpeg failed: ${result.stderr.slice(-400)}`);
  }
}

async function sendGreenFileByUrl(
  chatId: string,
  urlFile: string,
  fileName: string,
  caption: string,
): Promise<boolean> {
  if (!GREEN_API_INSTANCE || !GREEN_API_TOKEN || !chatId) return false;
  const res = await fetch(
    `${GREEN_API_HOST}/waInstance${GREEN_API_INSTANCE}/sendFileByUrl/${GREEN_API_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        urlFile,
        fileName,
        caption,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[fifa-bot] sendFileByUrl failed:", chatId, res.status, body);
    return false;
  }
  return true;
}

async function sendGreenFileByUpload(
  chatId: string,
  filePath: string,
  fileName: string,
  caption: string,
): Promise<boolean> {
  if (!GREEN_API_INSTANCE || !GREEN_API_TOKEN || !chatId) return false;
  const bytes = await readFile(filePath);
  const form = new FormData();
  form.append("chatId", chatId);
  form.append("caption", caption);
  form.append("fileName", fileName);
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: "video/mp4" }),
    fileName,
  );

  const res = await fetch(
    `${GREEN_API_MEDIA_HOST}/waInstance${GREEN_API_INSTANCE}/sendFileByUpload/${GREEN_API_TOKEN}`,
    {
      method: "POST",
      body: form,
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      "[fifa-bot] sendFileByUpload failed:",
      chatId,
      res.status,
      body,
    );
    return false;
  }
  return true;
}

async function prepareWhatsAppVideo(
  mp4Url: string,
): Promise<{ mode: "url" | "file"; value: string; fileName: string } | null> {
  const size = await headContentLength(mp4Url);
  const fileName = `highlight-${Date.now()}.mp4`;

  if (size != null && size > 0 && size <= DIRECT_URL_MAX_BYTES) {
    return { mode: "url", value: mp4Url, fileName };
  }

  const canCompress = await hasFfmpeg();
  if (!canCompress) {
    // On serverless without ffmpeg, try direct URL anyway as last resort.
    if (size != null && size <= 80 * 1024 * 1024) {
      return { mode: "url", value: mp4Url, fileName };
    }
    return null;
  }

  const dir = await mkdtemp(path.join(tmpdir(), "fifa-hl-"));
  const src = path.join(dir, "src.mp4");
  const out = path.join(dir, "wa.mp4");
  try {
    const downloaded = await downloadToFile(mp4Url, src);
    console.log("[fifa-bot] highlight downloaded", downloaded, "bytes");
    await compressForWhatsApp(src, out);
    const compressed = await readFile(out);
    console.log("[fifa-bot] highlight compressed", compressed.byteLength, "bytes");
    if (compressed.byteLength > COMPRESS_TARGET_BYTES * 1.6) {
      // Still ok for upload; Green accepts >8MB regularly.
    }
    // Keep compressed file; caller deletes after send. Move out of temp dir mark.
    const stable = path.join(tmpdir(), fileName);
    await writeFile(stable, compressed);
    return { mode: "file", value: stable, fileName };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function sendHighlightVideoToChannels(
  clip: FoxHighlightClip,
  caption: string,
  channels: FifaBotChannel[] = channelsForAlert("highlight_video"),
): Promise<boolean> {
  const prepared = await prepareWhatsAppVideo(clip.mp4Url);
  if (!prepared) {
    console.warn("[fifa-bot] highlight video too large and ffmpeg unavailable");
    return false;
  }

  try {
    const results = await Promise.all(
      channels.map(async (channel) => {
        const chatId = chatIdForChannel(channel);
        if (!chatId) return false;
        if (prepared.mode === "url") {
          return sendGreenFileByUrl(
            chatId,
            prepared.value,
            prepared.fileName,
            caption,
          );
        }
        return sendGreenFileByUpload(
          chatId,
          prepared.value,
          prepared.fileName,
          caption,
        );
      }),
    );
    return results.some(Boolean);
  } finally {
    if (prepared.mode === "file") {
      await rm(prepared.value, { force: true }).catch(() => undefined);
    }
  }
}

export async function probeHighlightSize(
  clip: FoxHighlightClip,
): Promise<number | null> {
  return headContentLength(clip.mp4Url);
}
