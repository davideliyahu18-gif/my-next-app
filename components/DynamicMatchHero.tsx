"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import HeroMatchCountdown from "@/components/HeroMatchCountdown";
import type { ScheduleMatchView } from "@/lib/types";
import {
  filterKnockoutUpcoming,
  teamDisplayName,
} from "@/lib/knockout-stages";
import { resolveVenueAtmosphere } from "@/lib/venue-visuals";

function scoreLabel(match: ScheduleMatchView): string {
  if (match.homeScore !== null && match.awayScore !== null) {
    return `${match.homeScore}:${match.awayScore}`;
  }
  return "VS";
}

function MatchTile({
  match,
  active,
  onSelect,
}: {
  match: ScheduleMatchView;
  active: boolean;
  onSelect: () => void;
}) {
  const atmosphere = resolveVenueAtmosphere(match);

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onSelect}
      onFocus={onSelect}
      className={`relative block w-full overflow-hidden rounded-2xl border text-right transition-all ${
        active
          ? "border-gold/70 shadow-[0_12px_40px_rgba(212,175,55,0.22)]"
          : "border-gold/25 hover:border-gold/50"
      }`}
    >
      <Image
        src={atmosphere.image}
        alt={atmosphere.alt}
        fill
        className="object-cover transition-transform duration-700 hover:scale-105"
        sizes="(max-width:640px) 100vw, 40vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-black/35" />
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background: `linear-gradient(135deg, ${atmosphere.accentFrom}, ${atmosphere.accentTo})`,
        }}
      />

      <div className="relative px-4 py-4">
        <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-300">
          <span>
            {match.dateLabel} · {match.timeLabel}
          </span>
          <span className="font-bold text-gold/90">
            {match.status === "live" ? "LIVE" : atmosphere.city || "עתידי"}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="min-w-0">
            <p className="text-xl leading-none">{match.homeFlag || "🏳️"}</p>
            <p className="mt-1 truncate text-sm font-bold text-white">
              {teamDisplayName(match.home)}
            </p>
          </div>
          <p className="px-1 text-lg font-black tabular-nums text-gold">
            {scoreLabel(match)}
          </p>
          <div className="min-w-0 text-left">
            <p className="text-xl leading-none">{match.awayFlag || "🏳️"}</p>
            <p className="mt-1 truncate text-sm font-bold text-white">
              {teamDisplayName(match.away)}
            </p>
          </div>
        </div>

        <p className="mt-3 truncate text-[11px] text-zinc-300">
          {atmosphere.venueLabel}
        </p>
      </div>
    </button>
  );
}

function StageBlock({
  title,
  eyebrow,
  matches,
  activeId,
  onSelect,
}: {
  title: string;
  eyebrow: string;
  matches: ScheduleMatchView[];
  activeId: string | null;
  onSelect: (match: ScheduleMatchView) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold tracking-[0.22em] text-gold/80">
            {eyebrow}
          </p>
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
          matches.map((match) => (
            <MatchTile
              key={match.id}
              match={match}
              active={activeId === match.id}
              onSelect={() => onSelect(match)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function DynamicMatchHero({
  schedule,
  fallbackImage,
  children,
}: {
  schedule: ScheduleMatchView[];
  fallbackImage: string;
  children: ReactNode;
}) {
  const { semiFinals, finals } = filterKnockoutUpcoming(schedule);
  const featured = useMemo(
    () => [...semiFinals, ...finals],
    [semiFinals, finals],
  );
  const initial = featured[0] ?? null;
  const [activeMatch, setActiveMatch] = useState<ScheduleMatchView | null>(initial);
  const atmosphere = resolveVenueAtmosphere(activeMatch, fallbackImage);

  return (
    <div className="relative min-h-[72vh] md:min-h-[78vh]">
      <Image
        key={atmosphere.image}
        src={atmosphere.image}
        alt={atmosphere.alt}
        fill
        priority
        className="object-cover object-center animate-[fade-up_0.8s_ease-out]"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-black/70 to-black/45" />
      <div className="absolute inset-0 bg-gradient-to-l from-background via-black/50 to-transparent" />
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background: `radial-gradient(ellipse at 30% 40%, ${atmosphere.accentFrom}, ${atmosphere.accentTo} 55%, transparent 70%)`,
        }}
      />

      <div className="relative mx-auto flex min-h-[72vh] max-w-[1440px] flex-col justify-end px-4 pb-10 pt-28 md:min-h-[78vh] md:justify-center md:px-8 md:pb-14 md:pt-24">
        {children}

        <HeroMatchCountdown match={activeMatch} />

        <div className="mt-10 w-full max-w-3xl animate-fade-up md:mr-0 md:ml-auto">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-zinc-300">
              משחקי חצי גמר ומשחק הגמר · רקע לפי אצטדיון
            </p>
            <Link
              href="/schedule"
              className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-xs font-black text-gold transition-all hover:scale-[1.03] hover:bg-gold/20"
            >
              לוח משחקים מלא
            </Link>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <StageBlock
              title="חצי גמר"
              eyebrow="SEMI-FINAL"
              matches={semiFinals}
              activeId={activeMatch?.id ?? null}
              onSelect={setActiveMatch}
            />
            <StageBlock
              title="גמר"
              eyebrow="FINAL"
              matches={finals}
              activeId={activeMatch?.id ?? null}
              onSelect={setActiveMatch}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
