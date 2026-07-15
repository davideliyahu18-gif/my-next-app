import { HEBREW_TEAM_NAMES } from "@/lib/team-display";
import { resolveFoxMatchHighlight } from "./fox-highlights";
import { formatHighlightCaption, formatHighlightLinkAlert } from "./format";
import { sendWhatsAppToChannels } from "./notify";
import {
  hasSeenAlert,
  loadMatchSnapshots,
  markAlertsSeen,
  saveMatchSnapshots,
} from "./store";
import type { FifaBotMatchSnapshot } from "./types";
import { sendHighlightVideoToChannels } from "./video-send";

const MAX_HIGHLIGHT_ATTEMPTS = Number(
  process.env.FIFA_BOT_HIGHLIGHT_MAX_ATTEMPTS || "120",
);
const HIGHLIGHT_WINDOW_MS = Number(
  process.env.FIFA_BOT_HIGHLIGHT_WINDOW_MS || `${36 * 60 * 60 * 1000}`,
);

const HEBREW_TO_CODE = Object.fromEntries(
  Object.entries(HEBREW_TEAM_NAMES).map(([code, name]) => [name, code]),
);

function codeForTeam(
  name: string | undefined,
  fallback?: string,
): string | undefined {
  if (fallback) return fallback;
  if (!name) return undefined;
  return HEBREW_TO_CODE[name];
}

function highlightEnabled(): boolean {
  const raw = (process.env.FIFA_BOT_SEND_HIGHLIGHTS ?? "1").toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

/**
 * After full-time, keep retrying until FOX publishes the 4-minute recap,
 * then compress (when ffmpeg is available) and send to LIVE + VIP.
 */
export async function processPendingHighlightVideos(): Promise<{
  checked: number;
  sentVideo: number;
  sentLink: number;
}> {
  if (!highlightEnabled()) {
    return { checked: 0, sentVideo: 0, sentLink: 0 };
  }

  const snapshots = await loadMatchSnapshots<FifaBotMatchSnapshot>();
  let checked = 0;
  let sentVideo = 0;
  let sentLink = 0;
  let changed = false;
  const now = Date.now();

  for (const snap of Object.values(snapshots)) {
    if (snap.status !== "finished") continue;
    if (snap.highlightVideoSent) continue;

    const homeCode = codeForTeam(snap.home, snap.homeCode);
    const awayCode = codeForTeam(snap.away, snap.awayCode);
    if (!homeCode || !awayCode) continue;
    if (!snap.homeCode || !snap.awayCode) {
      snap.homeCode = homeCode;
      snap.awayCode = awayCode;
      changed = true;
    }

    const kickMs = new Date(snap.kickoffAt).getTime();
    if (!Number.isFinite(kickMs) || now - kickMs > HIGHLIGHT_WINDOW_MS) {
      continue;
    }

    if ((snap.highlightAttempts ?? 0) >= MAX_HIGHLIGHT_ATTEMPTS) continue;

    if (await hasSeenAlert(`hl:${snap.id}`)) {
      snap.highlightVideoSent = true;
      changed = true;
      continue;
    }

    checked += 1;
    snap.highlightAttempts = (snap.highlightAttempts ?? 0) + 1;
    changed = true;

    let clip = null;
    try {
      clip = await resolveFoxMatchHighlight({
        homeCode,
        awayCode,
        kickoffAt: snap.kickoffAt,
        homeName: snap.home,
        awayName: snap.away,
      });
    } catch (error) {
      console.error("[fifa-bot] highlight resolve failed:", snap.id, error);
      continue;
    }

    if (!clip) {
      continue;
    }

    const caption = formatHighlightCaption(snap, clip.title);
    let videoOk = false;
    try {
      videoOk = await sendHighlightVideoToChannels(clip, caption);
    } catch (error) {
      console.error("[fifa-bot] highlight send failed:", snap.id, error);
    }

    if (videoOk) {
      await markAlertsSeen([`hl:${snap.id}`]);
      snap.highlightVideoSent = true;
      snap.highlightWatchUrl = clip.watchUrl;
      sentVideo += 1;
      console.log(
        "[fifa-bot] highlight video sent",
        snap.id,
        clip.fmcId,
        clip.source,
      );
      continue;
    }

    if (!snap.highlightLinkSent && clip.watchUrl) {
      const linkText = formatHighlightLinkAlert(snap, clip.watchUrl);
      const results = await sendWhatsAppToChannels(linkText, ["main", "vip"]);
      if (results.some((r) => r.ok)) {
        snap.highlightLinkSent = true;
        snap.highlightWatchUrl = clip.watchUrl;
        sentLink += 1;
      }
    }
  }

  if (changed) {
    await saveMatchSnapshots(snapshots);
  }

  return { checked, sentVideo, sentLink };
}
