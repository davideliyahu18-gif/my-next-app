import type { LiveMatchView } from "./types";
import { attachHighlightPaths } from "./fifa-match-centre";

export function attachHighlightUrls(
  matches: LiveMatchView[],
): LiveMatchView[] {
  return attachHighlightPaths(matches);
}
