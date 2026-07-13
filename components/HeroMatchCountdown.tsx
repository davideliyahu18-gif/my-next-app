import MatchCountdown from "@/components/MatchCountdown";
import type { ScheduleMatchView } from "@/lib/types";
import { teamDisplayName } from "@/lib/knockout-stages";

export default function HeroMatchCountdown({
  match,
}: {
  match: ScheduleMatchView | null;
}) {
  if (!match || match.status !== "upcoming") return null;

  return (
    <div className="mt-8 w-full max-w-xl animate-fade-up rounded-2xl border border-gold/30 bg-black/50 p-5 backdrop-blur-md md:mr-0 md:ml-auto">
      <p className="text-center text-[11px] font-bold tracking-[0.2em] text-gold">
        ספירה לאחור · חצי גמר
      </p>
      <div className="mt-3 flex items-center justify-center gap-3 text-sm font-black text-white md:text-base">
        <span>
          {match.homeFlag} {teamDisplayName(match.home)}
        </span>
        <span className="text-gold">VS</span>
        <span>
          {teamDisplayName(match.away)} {match.awayFlag}
        </span>
      </div>
      <p className="mt-2 text-center text-xs text-zinc-400">
        {match.dateLabel} · {match.timeLabel} · {match.venue || "—"}
      </p>
      <div className="mt-4">
        <MatchCountdown targetIso={match.kickoffAt} size="lg" />
      </div>
    </div>
  );
}
