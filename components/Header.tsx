"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_LINKS } from "@/lib/constants";
import ScrollLink, { scrollToSection } from "./ScrollLink";

const HASH_LINKS = NAV_LINKS.filter((link) => link.href.startsWith("#"));
const SECTION_IDS = [
  ...new Set(HASH_LINKS.map((link) => link.href.replace("#", ""))),
];

function NavItem({
  href,
  label,
  className,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  className: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  if (href.startsWith("#")) {
    return (
      <ScrollLink href={href} className={className} onNavigate={onNavigate}>
        {label}
        {active && (
          <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-gold" />
        )}
      </ScrollLink>
    );
  }

  return (
    <Link href={href} className={className} onClick={onNavigate}>
      {label}
      {active && (
        <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-gold" />
      )}
    </Link>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState("home");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const onHome = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!onHome) return;

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
  }, [onHome]);

  const isActive = (href: string) => {
    if (href.startsWith("/")) {
      return pathname === href || pathname.startsWith(`${href}/`);
    }
    if (!onHome) return false;
    const id = href.replace("#", "");
    return (
      activeSection === id ||
      (id === "teams" && activeSection === "standings") ||
      (id === "standings" && activeSection === "teams")
    );
  };

  const navClass = (href: string) =>
    `relative px-3 py-2 text-sm font-semibold transition-colors ${
      isActive(href) ? "text-gold" : "text-zinc-400 hover:text-white"
    }`;

  const goHome = () => {
    if (onHome) {
      scrollToSection("home");
      return;
    }
    window.location.href = "/";
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors ${
        scrolled
          ? "border-white/[0.08] bg-black/85 backdrop-blur-xl"
          : "border-transparent bg-black/40 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 md:px-8">
        <button
          type="button"
          onClick={goHome}
          className="group flex items-center gap-3 text-right transition-opacity hover:opacity-90"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-lg shadow-[0_0_24px_rgba(212,175,55,0.2)] transition-transform group-hover:scale-105">
            🏆
          </span>
          <span className="leading-tight">
            <span className="block text-[10px] font-bold tracking-[0.28em] text-gold">
              LIVE THE DREAM
            </span>
            <span className="block text-base font-black tracking-wide text-white md:text-lg">
              מונדיאל <span className="text-gold">2026</span>
            </span>
          </span>
        </button>

        <nav className="hidden items-center lg:flex">
          {NAV_LINKS.map((link) => (
            <NavItem
              key={link.href}
              href={link.href}
              label={link.label}
              className={navClass(link.href)}
              active={isActive(link.href)}
            />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/schedule"
            className="hidden items-center gap-2 rounded-full bg-gold px-4 py-2 text-xs font-black text-black shadow-[0_8px_24px_rgba(212,175,55,0.3)] transition-transform hover:scale-[1.03] sm:inline-flex"
          >
            לוח משחקים
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "סגור תפריט" : "פתח תפריט"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-200 lg:hidden"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/[0.06] bg-black/95 px-4 py-3 lg:hidden">
          <Link
            href="/schedule"
            onClick={() => setMobileOpen(false)}
            className="mb-2 block rounded-xl border border-gold/30 bg-gold/10 px-3 py-2.5 text-center text-sm font-bold text-gold"
          >
            לוח משחקים מלא
          </Link>
          {NAV_LINKS.map((link) =>
            link.href.startsWith("#") ? (
              <ScrollLink
                key={link.href}
                href={onHome ? link.href : `/#${link.href.slice(1)}`}
                onNavigate={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-gold"
              >
                {link.label}
              </ScrollLink>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-gold"
              >
                {link.label}
              </Link>
            ),
          )}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto border-t border-white/[0.06] px-4 py-2 scrollbar-hide lg:hidden">
        {NAV_LINKS.map((link) =>
          link.href.startsWith("#") ? (
            onHome ? (
              <ScrollLink
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  isActive(link.href) ? "bg-gold/15 text-gold" : "text-zinc-400"
                }`}
              >
                {link.label}
              </ScrollLink>
            ) : (
              <Link
                key={link.href}
                href={`/#${link.href.slice(1)}`}
                className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-zinc-400"
              >
                {link.label}
              </Link>
            )
          ) : (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                isActive(link.href) ? "bg-gold/15 text-gold" : "text-zinc-400"
              }`}
            >
              {link.label}
            </Link>
          ),
        )}
      </div>
    </header>
  );
}
