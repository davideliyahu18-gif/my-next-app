export default function MatchPitch({
  lastEventLabel,
  lastEventTeam,
  minute,
  isLive,
}: {
  lastEventLabel: string | null;
  lastEventTeam: string | null;
  minute: string;
  isLive: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-900/40 to-emerald-950/80">
      <svg
        viewBox="0 0 360 220"
        className="h-auto w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="pitch" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1a5f3f" />
            <stop offset="100%" stopColor="#0f3d28" />
          </linearGradient>
        </defs>
        <rect width="360" height="220" fill="url(#pitch)" rx="12" />
        <rect
          x="8"
          y="8"
          width="344"
          height="204"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
          rx="4"
        />
        <line
          x1="180"
          y1="8"
          x2="180"
          y2="212"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
        />
        <circle
          cx="180"
          cy="110"
          r="28"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
        />
        <circle cx="180" cy="110" r="3" fill="rgba(255,255,255,0.5)" />
        <rect
          x="8"
          y="62"
          width="56"
          height="96"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
        />
        <rect
          x="296"
          y="62"
          width="56"
          height="96"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
        />
      </svg>

      {isLive && minute ? (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-black text-white backdrop-blur">
          {minute}
        </div>
      ) : null}

      {lastEventLabel ? (
        <div className="absolute inset-x-4 bottom-4 rounded-xl border border-white/10 bg-black/75 px-4 py-3 text-center backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            אירוע אחרון
          </p>
          <p className="mt-1 text-sm font-black text-white">{lastEventLabel}</p>
          {lastEventTeam ? (
            <p className="mt-0.5 text-xs text-zinc-400">{lastEventTeam}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
