"use client";

import { useState } from "react";
import type { ScheduleMatchView } from "@/lib/types";
import DashboardCard from "./DashboardCard";
import HighlightButton from "./HighlightButton";
import { buildInternalHighlightPath } from "@/lib/fifa-match-centre";

const SEMI_KEYS = ["semi-final", "semi final", "semifinal"];
const FINAL_KEYS = ["final"];

function normalizeStage(stage: string): string {
  return stage.trim().toLowerCase();
}

function isSemiFinal(stage: string): boolean {
  const key = normalizeStage(stage);
  return SEMI_KEYS.some((token) => key === token || key.includes("semi-final") || key.includes("semi final"));
}

function isFinal(stage: string): boolean {
  const key = normalizeStage(stage);
  if (key.includes("third") || key.includes("play-off") || key.includes("playoff")) {
    return false;
  }
  return FINAL_KEYS.some((token) => key === token);
}

function statusBadge(status: ScheduleMatchView["status"]) {
  if (status === "live") {
    return (
      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
        LIVE
      </span>
    );
  }
  if (status === "finished") {
    return (
      <span className="rounded-full bg-zinc-700/50 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
        הסתיים
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[#d4af37]/15 px-2 py-0.5 text-[10px] font-medium text-[#d4af37]">
      עתידי
    </span>
  );
}

function scoreLabel(match: ScheduleMatchView): string {
  if (match.homeScore !== null && match.awayScore !== null) {
    return `${match.homeScore} - ${match.awayScore}`;
  }
  return "VS";
}

function teamLabel(name: string, flag: string): string {
  if (!name?.trim()) return "ייקבע";
  return `${flag} ${name}`.trim();
}

function KnockoutMatchCard({ match }: { match: ScheduleMatchView }) {
  const highlightUrl =
    match.status === "upcoming" ? null : buildInternalHighlightPath(match.id);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          {match.dateLabel} · {match.timeLabel}
        </p>
        {statusBadge(match.status)}
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <p className="truncate text-sm font-bold text-white">
          {teamLabel(match.home, match.homeFlag)}
        </p>
        <p className="text-lg font-black tabular-nums text-gold">{scoreLabel(match)}</p>
        <p className="truncate text-left text-sm font-bold text-white">
          {teamLabel(match.away, match.awayFlag)}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="truncate text-[11px] text-zinc-500">{match.venue || "—"}</p>
        <HighlightButton href={highlightUrl} />
      </div>
    </div>
  );
}

function StageColumn({
  title,
  matches,
}: {
  title: string;
  matches: ScheduleMatchView[];
}) {
  return (
    <DashboardCard title={title} variant="featured">
      <div className="space-y-3 p-4">
        {matches.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">אין משחקים עדיין</p>
        ) : (
          matches.map((match) => <KnockoutMatchCard key={match.id} match={match} />)
        )}
      </div>
    </DashboardCard>
  );
}

export default function UpcomingKnockoutPanel({
  matches,
}: {
  matches: ScheduleMatchView[];
}) {
  const [open, setOpen] = useState(false);

  const upcomingPool = matches.filter(
    (match) => match.status === "upcoming" || match.status === "live",
  );
  const semiFinals = upcomingPool
    .filter((match) => isSemiFinal(match.stage))
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
  const finals = upcomingPool
    .filter((match) => isFinal(match.stage))
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));

  const total = semiFinals.length + finals.length;

  return (
    <section id="upcoming" className="scroll-mt-24 space-y-5 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white">המשחקים הבאים</h2>
          <p className="mt-1 text-sm text-zinc-500">
            חצי גמר והגמר · {total} משחקים קרובים
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-black text-black shadow-[0_10px_28px_rgba(212,175,55,0.28)] transition-transform hover:scale-[1.03]"
          aria-expanded={open}
        >
          {open ? "הסתר משחקים הבאים" : "המשחקים הבאים"}
        </button>
      </div>

      {open ? (
        <div className="grid gap-6 md:grid-cols-2">
          <StageColumn title="חצי גמר" matches={semiFinals} />
          <StageColumn title="גמר" matches={finals} />
        </div>
      ) : null}
    </section>
  );
}
