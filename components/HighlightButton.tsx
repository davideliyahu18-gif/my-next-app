"use client";

import Link from "next/link";

export default function HighlightButton({ href }: { href: string | null }) {
  if (!href) {
    return (
      <span className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-600">
        תקציר
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="shrink-0 rounded-lg border border-gold/35 bg-gold/10 px-3 py-1.5 text-[11px] font-bold text-gold transition-all hover:bg-gold hover:text-black"
    >
      ▶ תקציר
    </Link>
  );
}
