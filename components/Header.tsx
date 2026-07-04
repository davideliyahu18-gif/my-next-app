import { NAV_LINKS } from "@/lib/constants";

export const navLinks = NAV_LINKS;

export default function Header() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-700 shadow-lg shadow-amber-500/20">
            <span className="text-lg">🏆</span>
          </div>
          <div>
            <p className="text-sm font-black tracking-wide text-white">
              FIFA WORLD CUP
            </p>
            <p className="text-[10px] font-semibold tracking-[0.25em] text-amber-400">
              2026
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-all hover:bg-white/5 hover:text-amber-300"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:border-amber-400/30 hover:text-amber-300 sm:block">
            שידור חי
          </button>
          <button
            aria-label="תפריט"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 lg:hidden"
          >
            ☰
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-t border-white/5 px-4 py-2 lg:hidden">
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-zinc-300"
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
