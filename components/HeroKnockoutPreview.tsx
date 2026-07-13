import Link from "next/link";
import type { ScheduleMatchView } from "@/lib/types";
import {
  filterKnockoutUpcoming,
  teamDisplayName,
} from "@/lib/knockout-stages";

function scoreLabel(match: ScheduleMatchView): string {
  if (match.homeScore !== null && match.awayScore !== null) {
    return `${match.homeScore}:${match.awayScore}`;
  }
  return "VS";
}

function MatchTile({ match }: { match: ScheduleMatchView }) {
  return (
    <Link
      href="/schedule#upcoming"
      className="block rounded-2xl border border-gold/25 bg-black/45 px-4 py-4 backdrop-blur-md transition-all hover:border-gold/50 hover:bg-black/60"
    >
      <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
        <span>
          {match.dateLabel} · {match.timeLabel}
        </span>
        <span className="font-bold text-gold/80">
          {match.status === "live" ? "LIVE" : "עתידי"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0 text-right">
          <p className="text-xl leading-none">{match.homeFlag || "🏳️"}</p>
          <p className="mt-1 truncate text-sm font-bold text-white">
            {teamDisplayName(match.home)}
          </p>
        </div>
        <p className="px-1 text-lg font-black tabular-nums text-gold">{scoreLabel(match)}</p>
        <div className="min-w-0 text-left">
          <p className="text-xl leading-none">{match.awayFlag || "🏳️"}</p>
          <p className="mt-1 truncate text-sm font-bold text-white">
            {teamDisplayName(match.away)}
          </p>
        </div>
      </div>
    </Link>
  );
}

function StageBlock({
  title,
  eyebrow,
  matches,
}: {
  title: string;
  eyebrow: string;
  matches: ScheduleMatchView[];
}) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold tracking-[0.22em] text-gold/80">{eyebrow}</p>
          <h3 className="mt-1 text-xl font-black text-white md:text-2xl">{title}</h3>
        </div>
        <span className="text-[11px] font-semibold text-zinc-500">
          {matches.length} משחקים
        </span>
      </div>
      <div className="space-y-3">
        {matches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
            ייקבע בהמשך
          </div>
        ) : (
          matches.map((match) => <MatchTile key={match.id} match={match} />)
        )}
      </div>
    </div>
  );
}

export default function HeroKnockoutPreview({
  matches,
}: {
  matches: ScheduleMatchView[];
}) {
  const { semiFinals, finals } = filterKnockoutUpcoming(matches);

  return (
    <div className="mt-10 w-full max-w-3xl animate-fade-up md:mr-0 md:ml-auto">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-300">
          משחקי חצי גמר ומשחק הגמר
        </p>
        <Link
          href="/schedule"
          className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-xs font-black text-gold transition-all hover:scale-[1.03] hover:bg-gold/20"
        >
          לוח משחקים מלא
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <StageBlock title="חצי גמר" eyebrow="SEMI-FINAL" matches={semiFinals} />
        <StageBlock title="גמר" eyebrow="FINAL" matches={finals} />
      </div>
    </div>
  );
}
