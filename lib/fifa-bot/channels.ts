import type { FifaBotAlertKind } from "./types";

export type FifaBotChannel = "main" | "vip";

/** Main LIVE group: everything except corners. */
const MAIN_BLOCKED = new Set<FifaBotAlertKind>(["corner"]);

/** VIP group: everything except open-play goals / scorer updates. */
const VIP_BLOCKED = new Set<FifaBotAlertKind>(["goal", "goal_scorer"]);

// highlight_video is allowed on both channels (not in blocked sets).

export function alertAllowedForChannel(
  kind: FifaBotAlertKind,
  channel: FifaBotChannel,
): boolean {
  if (channel === "main") return !MAIN_BLOCKED.has(kind);
  if (channel === "vip") return !VIP_BLOCKED.has(kind);
  return true;
}

export function channelsForAlert(kind: FifaBotAlertKind): FifaBotChannel[] {
  const channels: FifaBotChannel[] = [];
  if (alertAllowedForChannel(kind, "main")) channels.push("main");
  if (alertAllowedForChannel(kind, "vip")) channels.push("vip");
  return channels;
}
