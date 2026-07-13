import type { SemiFinalLineupMatchView, TeamLineupView } from "@/lib/types";
import DashboardCard from "./DashboardCard";
import MatchCountdown from "./MatchCountdown";

function PlayerRow({
  player,
}: {
  player: TeamLineupView["starters"][number];
}) {
  return (
    <li className="flex items-center gap-2 border-b border-white/[0.04] py-1.5 last:border-0">
      <span className="w-6 text-center text-xs font-black tabular-nums text-gold">
        {player.shirtNumber ?? "—"}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-white">
        {player.name}
        {player.captain ? (
          <span className="mr-1 text-[10px] font-bold text-gold"> (C)</span>
        ) : null}
      </span>
      <span className="text-[10px] text-zinc-500">{player.positionLabel}</span>
    </li>
  );
}

function TeamLineupCard({ lineup }: { lineup: TeamLineupView }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black text-white">
            {lineup.flag} {lineup.team}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {lineup.formation ? `מערך ${lineup.formation}` : "מערך יפורסם"}
            {lineup.coach ? ` · ${lineup.coach}` : ""}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
            lineup.source === "official"
              ? "bg-gold/15 text-gold"
              : "bg-white/5 text-zinc-400"
          }`}
        >
          {lineup.sourceLabel}
        </span>
      </div>

      <p className="mt-4 text-[10px] font-bold tracking-wide text-zinc-500">
        הרכב פותח
      </p>
      <ul className="mt-1">
        {lineup.starters.slice(0, 11).map((player) => (
          <PlayerRow key={player.id} player={player} />
        ))}
      </ul>

      {lineup.substitutes.length > 0 ? (
        <>
          <p className="mt-4 text-[10px] font-bold tracking-wide text-zinc-500">
            ספסל
          </p>
          <ul className="mt-1">
            {lineup.substitutes.slice(0, 7).map((player) => (
              <PlayerRow key={player.id} player={player} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function SemiMatchBlock({ match }: { match: SemiFinalLineupMatchView }) {
  return (
    <DashboardCard
      title={`${match.homeFlag} ${match.home}  vs  ${match.away} ${match.awayFlag}`}
      badge={
        <span className="text-[10px] font-bold text-gold/80">SEMI-FINAL</span>
      }
      variant="featured"
    >
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
          <span>
            {match.dateLabel} · {match.timeLabel}
          </span>
          <span>{match.venue || "—"}</span>
        </div>

        {match.status === "upcoming" ? (
          <MatchCountdown targetIso={match.kickoffAt} size="sm" />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {match.homeLineup ? (
            <TeamLineupCard lineup={match.homeLineup} />
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
              ההרכב של {match.home} יפורסם לפני המשחק
            </p>
          )}
          {match.awayLineup ? (
            <TeamLineupCard lineup={match.awayLineup} />
          ) : (
            <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
              ההרכב של {match.away} יפורסם לפני המשחק
            </p>
          )}
        </div>
      </div>
    </DashboardCard>
  );
}

export default function SemiFinalLineupsPanel({
  matches,
}: {
  matches: SemiFinalLineupMatchView[];
}) {
  if (!matches.length) return null;

  return (
    <section id="lineups" className="mt-12 space-y-6">
      <div>
        <p className="text-[11px] font-bold tracking-[0.2em] text-gold">LINEUPS</p>
        <h2 className="mt-1 text-2xl font-black text-white">הרכבים · חצי גמר</h2>
        <p className="mt-2 text-sm text-zinc-400">
          הרכב רשמי כשמתפרסם · עד אז מוצג ההרכב האחרון בטורניר
        </p>
      </div>

      <div className="space-y-6">
        {matches.map((match) => (
          <SemiMatchBlock key={match.id} match={match} />
        ))}
      </div>
    </section>
  );
}
