"use client";

import { useEffect, useState } from "react";
import { NAV_LINKS } from "@/lib/constants";
import ScrollLink, { scrollToSection } from "./ScrollLink";

const SECTION_IDS = [...new Set(NAV_LINKS.map((link) => link.href.replace("#", "")))];

function IconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-zinc-400 transition-colors hover:border-[#d4af37]/40 hover:text-[#d4af37]"
    >
      {children}
    </button>
  );
}

export default function Header() {
  const [activeSection, setActiveSection] = useState("home");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-28% 0px -58% 0px", threshold: [0, 0.12, 0.35] },
    );

    for (const id of SECTION_IDS) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  const navClass = (href: string) => {
    const id = href.replace("#", "");
    const isActive =
      activeSection === id ||
      (id === "teams" && activeSection === "standings") ||
      (id === "standings" && activeSection === "teams");
    return `relative px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? "text-[#d4af37]" : "text-zinc-400 hover:text-white"
    }`;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/90 backdrop-blur-xl">
      <div className="relative mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 md:px-8">
        <div className="flex items-center gap-2">
          <IconButton label="פרופיל">👤</IconButton>
          <IconButton label="מצב כהה">🌙</IconButton>
          <IconButton label="חיפוש">🔍</IconButton>
          <button
            type="button"
            className="hidden h-9 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-semibold text-zinc-300 sm:flex"
          >
            HE <span className="text-[10px] text-zinc-500">▾</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => scrollToSection("home")}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center transition-opacity hover:opacity-90"
        >
          <p className="text-[11px] font-bold tracking-[0.35em] text-[#d4af37]">
            LIVE THE DREAM
          </p>
          <p className="text-base font-black tracking-wide text-white md:text-lg">
            WORLD CUP <span className="text-[#d4af37]">2026</span>
            <span className="mr-1 text-sm">🏆</span>
          </p>
        </button>

        <div className="hidden items-center lg:flex">
          {NAV_LINKS.map((link) => (
            <ScrollLink key={link.href} href={link.href} className={navClass(link.href)}>
              {link.label}
              {(activeSection === link.href.replace("#", "") ||
                (link.href === "#teams" && activeSection === "standings") ||
                (link.href === "#standings" && activeSection === "teams")) && (
                <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-[#d4af37]" />
              )}
            </ScrollLink>
          ))}
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? "סגור תפריט" : "פתח תפריט"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 lg:hidden"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.06] px-4 py-3 lg:hidden">
          {NAV_LINKS.map((link) => (
            <ScrollLink
              key={link.href}
              href={link.href}
              onNavigate={() => setMobileOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-[#d4af37]"
            >
              {link.label}
            </ScrollLink>
          ))}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto border-t border-white/[0.06] px-4 py-2 scrollbar-hide lg:hidden">
        {NAV_LINKS.map((link) => (
          <ScrollLink
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              activeSection === link.href.replace("#", "")
                ? "bg-[#d4af37]/15 text-[#d4af37]"
                : "text-zinc-400"
            }`}
          >
            {link.label}
          </ScrollLink>
        ))}
      </div>
    </header>
  );
}
