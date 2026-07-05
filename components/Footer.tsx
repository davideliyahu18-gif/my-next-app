import { NAV_LINKS, TOURNAMENT_META } from "@/lib/constants";
import ScrollLink from "./ScrollLink";

export default function Footer() {
  return (
    <footer className="relative mt-24 border-t border-amber-400/10 bg-black/60 backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-amber-400/5 to-transparent" />
      <div className="relative mx-auto max-w-[1440px] px-4 py-16 md:px-8">
        <div className="grid gap-12 md:grid-cols-3">
          <div>
            <p className="text-2xl font-black text-white">
              FIFA World Cup{" "}
              <span className="bg-gradient-to-l from-amber-200 to-amber-500 bg-clip-text text-transparent">
                2026
              </span>
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              {TOURNAMENT_META.footerHosts}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-zinc-400">
            {NAV_LINKS.map((link) => (
              <ScrollLink
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-amber-300"
              >
                {link.label}
              </ScrollLink>
            ))}
          </div>
          <div className="text-sm text-zinc-500 md:text-left">
            <p>נתונים לדוגמה בלבד</p>
            <p className="mt-1">© 2026 FIFA World Cup</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
