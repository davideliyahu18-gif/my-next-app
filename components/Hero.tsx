import Image from "next/image";
import { getStatCards, getTournament } from "@/lib/api";
import { TOURNAMENT_META } from "@/lib/constants";
import GlassCard from "./GlassCard";

async function StatsBar() {
  const statsCards = await getStatCards();

  return (
    <section id="stats" className="relative -mt-10 px-4 md:px-8">
      <div className="mx-auto grid max-w-[1440px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <GlassCard
            key={stat.label}
            className="group relative overflow-hidden p-6"
          >
            <div className="absolute -left-4 -top-4 text-5xl opacity-[0.06] transition-transform duration-500 group-hover:scale-110 group-hover:opacity-10">
              {stat.icon}
            </div>
            <p className="text-sm font-medium text-zinc-500">{stat.label}</p>
            <p className="mt-2 text-4xl font-black tabular-nums tracking-tight text-white">
              {stat.value}
            </p>
            <p className="mt-1 text-xs font-semibold text-amber-400/80">
              {stat.change}
            </p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}

export default async function Hero() {
  const tournament = await getTournament();

  return (
    <>
      <section className="relative min-h-[520px] overflow-hidden md:min-h-[620px] lg:min-h-[680px]">
        <Image
          src={tournament.images.stadium}
          alt="אצטדיון כדורגל מואר בלילה"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-[#050505] via-[#050505]/85 to-[#050505]/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/60" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(212,175,55,0.15),transparent_55%)]" />

        <div className="relative mx-auto flex h-full max-w-[1440px] flex-col items-center gap-10 px-4 py-16 md:flex-row md:items-center md:justify-between md:gap-16 md:px-8 md:py-24">
          <div className="max-w-2xl text-center md:text-right">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-xs font-bold tracking-wider text-amber-200">
                LIVE · מונדיאל 2026
              </span>
            </div>

            <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              גביע העולם
              <span className="mt-2 block bg-gradient-to-l from-amber-100 via-amber-300 to-amber-600 bg-clip-text text-transparent">
                FIFA 2026
              </span>
            </h1>

            <p className="mt-6 text-base leading-relaxed text-zinc-300 md:text-lg lg:text-xl">
              {tournament.totalTeams} נבחרות · {tournament.totalMatches} משחקים
              · {tournament.totalCities} ערים
              <br />
              <span className="text-zinc-400">{TOURNAMENT_META.tagline}</span>
            </p>

            <div className="mt-10 flex flex-wrap justify-center gap-4 md:justify-start">
              <button className="rounded-full bg-gradient-to-l from-amber-300 via-amber-400 to-amber-600 px-8 py-3.5 text-sm font-black text-black shadow-[0_8px_32px_rgba(212,175,55,0.35)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_12px_40px_rgba(212,175,55,0.5)]">
                ▶ צפו עכשיו
              </button>
              <button className="rounded-full border border-white/20 bg-white/10 px-8 py-3.5 text-sm font-bold text-white backdrop-blur-md transition-all duration-300 hover:border-amber-400/40 hover:bg-white/15">
                לוח משחקים מלא
              </button>
            </div>
          </div>

          <div className="relative shrink-0">
            <div className="absolute -inset-8 animate-pulse rounded-full bg-amber-400/20 blur-3xl" />
            <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-amber-400/30 to-transparent blur-2xl" />
            <div className="relative h-56 w-56 overflow-hidden rounded-full border-2 border-amber-400/40 bg-black/30 shadow-[0_0_80px_rgba(212,175,55,0.35)] backdrop-blur-sm md:h-72 md:w-72 lg:h-80 lg:w-80">
              <Image
                src={tournament.images.trophy}
                alt="גביע העולם FIFA"
                fill
                className="object-cover object-center scale-110 transition-transform duration-700 hover:scale-125"
                sizes="(max-width:768px) 224px, 320px"
              />
            </div>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-400/30 bg-black/60 px-5 py-2 text-xs font-bold tracking-widest text-amber-300 backdrop-blur-xl">
              {TOURNAMENT_META.dateRange}
            </div>
          </div>
        </div>
      </section>
      <StatsBar />
    </>
  );
}
