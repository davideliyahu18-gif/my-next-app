"use client";

import { useEffect, useState } from "react";
import { NAV_LINKS } from "@/lib/constants";
import ScrollLink, { scrollToSection } from "./ScrollLink";

const SECTION_IDS = NAV_LINKS.map((link) => link.href.replace("#", ""));

export default function Header() {
  const [activeSection, setActiveSection] = useState("");
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
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.15, 0.4] },
    );

    for (const id of SECTION_IDS) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  const handleNavClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    href: string,
  ) => {
    event.preventDefault();
    scrollToSection(href.replace("#", ""));
    window.history.replaceState(null, "", href);
    setMobileOpen(false);
  };

  const linkClass = (href: string) => {
    const id = href.replace("#", "");
    const isActive = activeSection === id;
    return `rounded-lg px-4 py-2 text-sm font-medium transition-all ${
      isActive
        ? "bg-amber-400/15 text-amber-300 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.25)]"
        : "text-zinc-400 hover:bg-white/5 hover:text-amber-300"
    }`;
  };

  const mobileLinkClass = (href: string) => {
    const id = href.replace("#", "");
    const isActive = activeSection === id;
    return `shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-all ${
      isActive
        ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
        : "border-white/10 bg-white/5 text-zinc-300 hover:border-amber-400/30"
    }`;
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 md:px-8">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-3 text-right transition-opacity hover:opacity-90"
        >
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
        </button>

        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <ScrollLink
              key={link.href}
              href={link.href}
              className={linkClass(link.href)}
            >
              {link.label}
            </ScrollLink>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(event) => handleNavClick(event, "#news")}
            className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition-all hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-300 sm:block"
          >
            שידור חי
          </button>
          <button
            type="button"
            aria-label={mobileOpen ? "סגור תפריט" : "פתח תפריט"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:border-amber-400/30 lg:hidden"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      <div
        className={`flex flex-col gap-2 border-t border-white/5 px-4 py-3 lg:hidden ${
          mobileOpen ? "" : "hidden"
        }`}
      >
        {NAV_LINKS.map((link) => (
          <ScrollLink
            key={link.href}
            href={link.href}
            onNavigate={() => setMobileOpen(false)}
            className={`rounded-xl px-4 py-3 text-sm font-medium ${linkClass(link.href)}`}
          >
            {link.label}
          </ScrollLink>
        ))}
        <button
          type="button"
          onClick={(event) => handleNavClick(event, "#news")}
          className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200"
        >
          שידור חי
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto border-t border-white/5 px-4 py-2 lg:hidden">
        {NAV_LINKS.map((link) => (
          <ScrollLink
            key={link.href}
            href={link.href}
            className={mobileLinkClass(link.href)}
          >
            {link.label}
          </ScrollLink>
        ))}
      </div>
    </nav>
  );
}
