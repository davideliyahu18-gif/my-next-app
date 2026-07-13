"use client";

import { useEffect, useState } from "react";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export default function MatchCountdown({
  targetIso,
  size = "md",
}: {
  targetIso: string;
  size?: "sm" | "md" | "lg";
}) {
  const [parts, setParts] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const [done, setDone] = useState(false);

  useEffect(() => {
    const target = new Date(targetIso).getTime();

    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setDone(diff === 0);
      setParts({
        days: Math.floor(diff / 86_400_000),
        hours: Math.floor((diff % 86_400_000) / 3_600_000),
        mins: Math.floor((diff % 3_600_000) / 60_000),
        secs: Math.floor((diff % 60_000) / 1000),
      });
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [targetIso]);

  if (done) {
    return (
      <p className="text-center text-sm font-bold text-gold">המשחק התחיל / בפתח</p>
    );
  }

  const cells = [
    { label: "ימים", value: parts.days },
    { label: "שעות", value: parts.hours },
    { label: "דקות", value: parts.mins },
    { label: "שניות", value: parts.secs },
  ];

  const valueClass =
    size === "lg"
      ? "text-3xl md:text-4xl"
      : size === "sm"
        ? "text-lg md:text-xl"
        : "text-xl md:text-2xl";
  const padClass = size === "lg" ? "py-4" : size === "sm" ? "py-2" : "py-3";

  return (
    <div className="grid grid-cols-4 gap-2">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className={`rounded-xl border border-gold/20 bg-gradient-to-b from-gold/10 to-black/40 px-1.5 text-center ${padClass}`}
        >
          <p className={`font-black tabular-nums tracking-tight text-gold ${valueClass}`}>
            {pad(cell.value)}
          </p>
          <p className="mt-1 text-[10px] font-medium text-zinc-500">{cell.label}</p>
        </div>
      ))}
    </div>
  );
}
