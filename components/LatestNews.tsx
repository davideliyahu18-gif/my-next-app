import Image from "next/image";
import { getLatestNews } from "@/lib/api";
import GlassCard from "./GlassCard";
import SectionHeader from "./SectionHeader";

export default async function LatestNews() {
  const latestNews = await getLatestNews();

  if (latestNews.length === 0) {
    return null;
  }

  const [featured, ...rest] = latestNews;

  return (
    <section id="news" className="py-4">
      <SectionHeader
        title="חדשות אחרונות"
        subtitle="כל העדכונים, הניתוחים והרגעים הגדולים מהמונדיאל"
        action="עוד חדשות"
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard className="group relative min-h-[320px] overflow-hidden p-0 lg:row-span-2">
          <Image
            src={featured.image}
            alt={featured.title}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width:1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
            <span className="mb-3 w-fit rounded-full bg-amber-400/90 px-3 py-1 text-[10px] font-black tracking-wider text-black">
              {featured.category}
            </span>
            <h3 className="text-xl font-black leading-snug text-white md:text-2xl lg:text-3xl">
              {featured.title}
            </h3>
            <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-zinc-300">
              {featured.excerpt}
            </p>
            <p className="mt-4 text-xs font-medium text-zinc-500">
              {featured.time}
            </p>
          </div>
        </GlassCard>

        <div className="flex flex-col gap-5">
          {rest.map((item) => (
            <GlassCard
              key={item.id}
              className="group flex gap-4 overflow-hidden p-0 sm:gap-5"
            >
              <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-36">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  sizes="144px"
                />
              </div>
              <div className="flex flex-1 flex-col justify-center py-4 pl-2">
                <span className="mb-1.5 text-[10px] font-bold tracking-wider text-amber-400">
                  {item.category}
                </span>
                <h3 className="line-clamp-2 text-sm font-bold leading-snug text-white transition-colors group-hover:text-amber-200 md:text-base">
                  {item.title}
                </h3>
                <p className="mt-2 text-[11px] text-zinc-500">{item.time}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}
