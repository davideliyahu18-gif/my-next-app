import type { ScheduleMatchView } from "@/lib/types";

function normalizeStage(stage: string): string {
  return stage.trim().toLowerCase();
}

export function isSemiFinalStage(stage: string): boolean {
  const key = normalizeStage(stage);
  return (
    key === "semi-final" ||
    key === "semi final" ||
    key === "semifinal" ||
    key.includes("semi-final") ||
    key.includes("semi final")
  );
}

export function isFinalStage(stage: string): boolean {
  const key = normalizeStage(stage);
  if (key.includes("third") || key.includes("play-off") || key.includes("playoff")) {
    return false;
  }
  return key === "final";
}

export function filterKnockoutUpcoming(matches: ScheduleMatchView[]): {
  semiFinals: ScheduleMatchView[];
  finals: ScheduleMatchView[];
} {
  const pool = matches.filter(
    (match) => match.status === "upcoming" || match.status === "live",
  );

  return {
    semiFinals: pool
      .filter((match) => isSemiFinalStage(match.stage))
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt)),
    finals: pool
      .filter((match) => isFinalStage(match.stage))
      .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt)),
  };
}

export function teamDisplayName(name: string): string {
  return name?.trim() ? name : "ייקבע";
}
