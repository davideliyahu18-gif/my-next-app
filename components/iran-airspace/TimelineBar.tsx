"use client";

function formatClock(t: number): string {
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(t));
}

export default function TimelineBar({
  history,
  currentIndex,
  isLive,
  onScrub,
  onGoLive,
}: {
  history: { t: number }[];
  currentIndex: number;
  isLive: boolean;
  onScrub: (index: number) => void;
  onGoLive: () => void;
}) {
  const maxIndex = Math.max(0, history.length - 1);
  const value = Math.min(currentIndex, maxIndex);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxIndex));

  return (
    <div className="pointer-events-auto flex items-center gap-2 border-t border-white/5 bg-[#050b14]/95 px-3 py-1.5 backdrop-blur-xl sm:gap-3 sm:px-4 sm:py-2">
      <button
        type="button"
        onClick={onGoLive}
        aria-label={isLive ? "השהה" : "חזור לשידור חי"}
        title={isLive ? "השהה" : "חזור לשידור חי"}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold sm:px-3 sm:text-xs"
      >
        {isLive ? (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            <span className="text-red-300">LIVE</span>
          </>
        ) : (
          <span className="text-sky-300">▶ שידור חי</span>
        )}
      </button>

      <input
        type="range"
        min={0}
        max={maxIndex}
        step={1}
        value={value}
        onChange={(e) => onScrub(Number(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer accent-sky-400"
        aria-label="ציר זמן"
      />

      <div className="hidden shrink-0 gap-3 font-mono text-[10px] text-slate-500 sm:flex">
        {ticks.map((i, idx) => (
          <span key={i} className={idx === ticks.length - 1 ? "text-slate-400" : ""}>
            {history[i] ? (idx === ticks.length - 1 && isLive ? "עכשיו" : formatClock(history[i].t)) : "--:--"}
          </span>
        ))}
      </div>
    </div>
  );
}
