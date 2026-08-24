import type { PitchFormationView, PitchPlayerView } from "@/lib/football/match-center";

const PITCH_W = 360;
const PITCH_H = 220;
const PAD_X = 18;
const PAD_Y = 16;
const INNER_W = PITCH_W - PAD_X * 2;
const INNER_H = PITCH_H - PAD_Y * 2;

function playerCoords(player: PitchPlayerView): { x: number; y: number } {
  const line = player.fieldLine / 100;
  const side = player.fieldSide / 100;
  // Home attacks right, away attacks left
  const x =
    player.side === "home"
      ? PAD_X + line * (INNER_W * 0.46)
      : PAD_X + INNER_W - line * (INNER_W * 0.46);
  const y = PAD_Y + side * INNER_H;
  return { x, y };
}

function PlayerDot({ player }: { player: PitchPlayerView }) {
  const { x, y } = playerCoords(player);
  const fill = player.side === "home" ? "#d4af37" : "#38bdf8";
  const label = player.number != null ? String(player.number) : "·";
  const short =
    player.shortName.split(" ").slice(-1)[0]?.slice(0, 8) ||
    player.name.slice(0, 8);

  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={11}
        fill={fill}
        stroke="rgba(0,0,0,0.55)"
        strokeWidth={1.5}
      />
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#000"
        fontSize="9"
        fontWeight="800"
      >
        {label}
      </text>
      <text
        x={x}
        y={y + 18}
        textAnchor="middle"
        fill="rgba(255,255,255,0.92)"
        fontSize="7"
        fontWeight="700"
        style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.65)", strokeWidth: 2 }}
      >
        {short}
      </text>
    </g>
  );
}

export default function MatchPitch({
  lastEventLabel,
  lastEventTeam,
  minute,
  isLive,
  pitch,
  homeName,
  awayName,
}: {
  lastEventLabel: string | null;
  lastEventTeam: string | null;
  minute: string;
  isLive: boolean;
  pitch: PitchFormationView;
  homeName: string;
  awayName: string;
}) {
  const hasPlayers = pitch.players.length > 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-900/40 to-emerald-950/80">
      <div className="flex items-center justify-between gap-2 px-3 pt-3 text-[10px] font-bold">
        <span className="truncate text-gold">
          {homeName}
          {pitch.homeFormation ? ` · ${pitch.homeFormation}` : ""}
        </span>
        <span className="truncate text-sky-300">
          {awayName}
          {pitch.awayFormation ? ` · ${pitch.awayFormation}` : ""}
        </span>
      </div>

      <svg viewBox={`0 0 ${PITCH_W} ${PITCH_H}`} className="h-auto w-full" aria-hidden>
        <defs>
          <linearGradient id="pitch" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1a5f3f" />
            <stop offset="100%" stopColor="#0f3d28" />
          </linearGradient>
        </defs>
        <rect width={PITCH_W} height={PITCH_H} fill="url(#pitch)" rx="12" />
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

        {pitch.players.map((player) => (
          <PlayerDot key={player.id} player={player} />
        ))}
      </svg>

      {isLive && minute ? (
        <div className="absolute left-1/2 top-10 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-black text-white backdrop-blur">
          {minute}
        </div>
      ) : null}

      {!hasPlayers ? (
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-center backdrop-blur">
          <p className="text-sm font-bold text-white">מפת מגרש תתעדכן כשההרכב יפורסם</p>
        </div>
      ) : null}

      {lastEventLabel ? (
        <div className="absolute inset-x-4 bottom-3 rounded-xl border border-white/10 bg-black/75 px-4 py-2.5 text-center backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            אירוע אחרון
          </p>
          <p className="mt-0.5 text-sm font-black text-white">{lastEventLabel}</p>
          {lastEventTeam ? (
            <p className="text-xs text-zinc-400">{lastEventTeam}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
