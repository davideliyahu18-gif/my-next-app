"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createDemoTracks, LAUNCH_SITES, STATUS_LABEL } from "@/lib/rockets/data";
import {
  ballisticPoint,
  DEFAULT_BOUNDS,
  formatClock,
  project,
  statusFromProgress,
  trajectoryPoints,
} from "@/lib/rockets/geo";
import type {
  LaunchSite,
  RocketFeedItem,
  RocketsSnapshot,
  RocketTrack,
} from "@/lib/rockets/types";

const MAP_W = 1000;
const MAP_H = 620;

const LANDMARKS: { label: string; lat: number; lng: number }[] = [
  { label: "ישראל", lat: 31.5, lng: 34.85 },
  { label: "ירדן", lat: 31.2, lng: 36.5 },
  { label: "עיראק", lat: 33.2, lng: 44.0 },
  { label: "איראן", lat: 32.5, lng: 54.0 },
  { label: "סוריה", lat: 35.0, lng: 38.5 },
  { label: "מפרץ פרסי", lat: 27.0, lng: 51.5 },
];

function pathD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

function etaLabel(seconds: number): string {
  if (seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function statusTone(status: RocketTrack["status"]): string {
  switch (status) {
    case "boost":
      return "text-amber-300";
    case "midcourse":
      return "text-sky-300";
    case "terminal":
      return "text-rose-300";
    case "impact":
      return "text-zinc-400";
    case "intercepted":
      return "text-emerald-300";
    default:
      return "text-zinc-400";
  }
}

function LiveClock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const tick = () => setNow(formatClock());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-sm tabular-nums text-zinc-200">
      {now || "—:—:—"}
    </span>
  );
}

function SiteMarker({
  site,
  selected,
  onSelect,
}: {
  site: LaunchSite;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const p = project(site.position, MAP_W, MAP_H);
  return (
    <g
      className="cursor-pointer"
      onClick={() => onSelect(site.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(site.id);
      }}
    >
      <circle
        cx={p.x}
        cy={p.y}
        r={selected ? 16 : 12}
        className="fill-amber-500/15 stroke-amber-400/70"
        strokeWidth={1.5}
      >
        <animate
          attributeName="r"
          values={selected ? "14;18;14" : "10;14;10"}
          dur="2.4s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx={p.x} cy={p.y} r={3.5} className="fill-amber-300" />
      <text
        x={p.x + 10}
        y={p.y - 10}
        className="fill-zinc-200 text-[11px] font-semibold"
        style={{ fontFamily: "var(--font-heebo), sans-serif" }}
      >
        {site.nameHe}
      </text>
    </g>
  );
}

function TrackLayer({
  track,
  selected,
  onSelect,
}: {
  track: RocketTrack;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const full = useMemo(
    () =>
      trajectoryPoints(track.origin, track.target).map((pt) =>
        project(pt, MAP_W, MAP_H),
      ),
    [track.origin, track.target],
  );
  const flown = useMemo(
    () =>
      trajectoryPoints(track.origin, track.target, 64)
        .filter((_, i, arr) => i / (arr.length - 1) <= track.progress)
        .map((pt) => project(pt, MAP_W, MAP_H)),
    [track.origin, track.target, track.progress],
  );
  const tip = project(
    ballisticPoint(track.origin, track.target, track.progress),
    MAP_W,
    MAP_H,
  );
  const origin = project(track.origin, MAP_W, MAP_H);
  const target = project(track.target, MAP_W, MAP_H);

  return (
    <g
      className="cursor-pointer"
      onClick={() => onSelect(track.id)}
      opacity={selected ? 1 : 0.72}
    >
      <path
        d={pathD(full)}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray="4 6"
      />
      <path
        d={pathD(flown)}
        fill="none"
        stroke={selected ? "#f87171" : "#fb7185"}
        strokeWidth={selected ? 3 : 2}
        strokeLinecap="round"
      />
      <circle cx={origin.x} cy={origin.y} r={4} className="fill-amber-400" />
      <circle
        cx={target.x}
        cy={target.y}
        r={5}
        className="fill-transparent stroke-rose-400/80"
        strokeWidth={1.5}
      />
      <g transform={`translate(${tip.x}, ${tip.y})`}>
        <circle r={7} className="fill-rose-500/30 stroke-rose-300" strokeWidth={1}>
          <animate
            attributeName="r"
            values="5;9;5"
            dur="1.2s"
            repeatCount="indefinite"
          />
        </circle>
        <circle r={2.8} className="fill-white" />
      </g>
    </g>
  );
}

export default function RocketTrackingMap() {
  const [tracks, setTracks] = useState<RocketTrack[]>([]);
  const [feed, setFeed] = useState<RocketFeedItem[]>([]);
  const [mode, setMode] = useState<RocketsSnapshot["mode"]>("live");
  const [errors, setErrors] = useState<string[]>([]);
  const [sources, setSources] = useState<RocketsSnapshot["sources"]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [running, setRunning] = useState(true);
  const [forceDemo, setForceDemo] = useState(false);
  const [connected, setConnected] = useState(false);
  const lastTs = useRef<number | null>(null);
  const selectedTrackIdRef = useRef<string | null>(null);
  selectedTrackIdRef.current = selectedTrackId;

  useEffect(() => {
    if (forceDemo) {
      const demo = createDemoTracks();
      setTracks(demo);
      setMode("demo");
      setSelectedTrackId(demo[0]?.id ?? null);
      setConnected(false);
      return;
    }

    let closed = false;
    const source = new EventSource("/api/rockets/stream");

    source.onopen = () => {
      if (!closed) setConnected(true);
    };

    source.onmessage = (event) => {
      if (closed) return;
      try {
        const snapshot = JSON.parse(event.data) as RocketsSnapshot;
        setTracks(snapshot.tracks);
        setFeed(snapshot.feed);
        setMode(snapshot.mode);
        setErrors(snapshot.errors);
        setSources(snapshot.sources);
        const current = selectedTrackIdRef.current;
        if (
          snapshot.tracks.length > 0 &&
          (!current || !snapshot.tracks.some((track) => track.id === current))
        ) {
          setSelectedTrackId(snapshot.tracks[0].id);
        }
        setConnected(true);
      } catch {
        // ignore malformed chunks
      }
    };

    source.onerror = () => {
      if (!closed) setConnected(false);
    };

    return () => {
      closed = true;
      source.close();
    };
  }, [forceDemo]);

  useEffect(() => {
    if (!running || mode === "live") {
      lastTs.current = null;
      return;
    }
    let frame = 0;
    const loop = (ts: number) => {
      if (lastTs.current == null) lastTs.current = ts;
      const dt = (ts - lastTs.current) / 1000;
      lastTs.current = ts;
      setTracks((prev) =>
        prev.map((track) => {
          if (track.progress >= 1) return track;
          const progress = Math.min(1, track.progress + dt * 0.008);
          const etaSeconds = Math.max(0, Math.round(track.etaSeconds - dt));
          return {
            ...track,
            progress,
            etaSeconds,
            status: statusFromProgress(progress),
          };
        }),
      );
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [running, mode]);

  const selectedTrack =
    tracks.find((t) => t.id === selectedTrackId) ?? tracks[0] ?? null;
  const selectedSite =
    LAUNCH_SITES.find((s) => s.id === selectedSiteId) ?? null;
  const activeCount = tracks.filter((t) => t.progress < 1).length;
  const relatedFeed = feed.filter((item) => item.related).slice(0, 8);

  return (
    <div dir="rtl" className="min-h-screen bg-[#07090d] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(245,158,11,0.12),transparent_45%),radial-gradient(ellipse_at_80%_20%,rgba(244,63,94,0.08),transparent_40%),linear-gradient(180deg,#07090d_0%,#0c1118_100%)]" />

      <header className="relative z-10 border-b border-white/8 bg-black/30 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs font-semibold text-zinc-400 transition hover:text-zinc-200"
            >
              ← חזרה
            </Link>
            <div>
              <p className="text-[10px] font-bold tracking-[0.28em] text-amber-400/90">
                ROCKET TRACK
              </p>
              <h1 className="text-xl font-black tracking-tight md:text-2xl">
                מכ״ם שיגורים
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <div className="hidden text-left sm:block">
              <p className="text-[10px] font-bold tracking-[0.18em] text-zinc-500">
                שעון ישראל
              </p>
              <LiveClock />
            </div>
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${
                mode === "live"
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-amber-500/30 bg-amber-500/10"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                    mode === "live" ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    mode === "live" ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
              </span>
              <span
                className={`text-xs font-bold ${
                  mode === "live" ? "text-emerald-200" : "text-amber-200"
                }`}
              >
                {mode === "live" ? "LIVE טלגרם" : "הדגמה"}
                {connected && mode === "live" ? " · מחובר" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5">
              <span className="text-xs font-bold text-rose-200">
                {activeCount} פעילים
              </span>
            </div>
            {mode === "demo" && (
              <button
                type="button"
                onClick={() => setRunning((v) => !v)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-200 transition hover:bg-white/10"
              >
                {running ? "השהה" : "המשך"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setForceDemo((v) => !v)}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-500/20"
            >
              {forceDemo ? "חזרה ללייב" : "הדגמה"}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-[1400px] gap-4 px-4 py-4 md:grid-cols-[1fr_340px] md:px-6 md:py-6">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1017]/80 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-100">
                תאטרון איראן → ישראל
              </h2>
              <p className="text-xs text-zinc-500">
                {mode === "live"
                  ? "מסלולים מדיווחי טלגרם פומביים · לא רדאר צבאי"
                  : "מצב הדגמה · אין דיווח שיגור פעיל או נבחר ידנית"}
              </p>
            </div>
            <p className="font-mono text-[10px] text-zinc-500">
              {sources.map((s) => `@${s.username}`).join(" · ") ||
                `@newsil5 · bounds ${DEFAULT_BOUNDS.west}-${DEFAULT_BOUNDS.east}E`}
            </p>
          </div>

          <div className="relative w-full overflow-hidden bg-[#080c12]">
            <svg
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              className="h-auto w-full"
              role="img"
              aria-label="מפת מעקב שיגורים מאיראן לישראל"
            >
              <defs>
                <pattern
                  id="grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="rgba(255,255,255,0.04)"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>

              <rect width={MAP_W} height={MAP_H} fill="#080c12" />
              <rect width={MAP_W} height={MAP_H} fill="url(#grid)" />

              <ellipse
                cx={project({ lat: 32.5, lng: 54 }, MAP_W, MAP_H).x}
                cy={project({ lat: 32.5, lng: 54 }, MAP_W, MAP_H).y}
                rx="210"
                ry="160"
                fill="rgba(245,158,11,0.06)"
              />
              <ellipse
                cx={project({ lat: 31.5, lng: 35 }, MAP_W, MAP_H).x}
                cy={project({ lat: 31.5, lng: 35 }, MAP_W, MAP_H).y}
                rx="55"
                ry="70"
                fill="rgba(56,189,248,0.08)"
              />

              <path
                d={pathD([
                  project({ lat: 34.5, lng: 35 }, MAP_W, MAP_H),
                  project({ lat: 36, lng: 48 }, MAP_W, MAP_H),
                  project({ lat: 33, lng: 58 }, MAP_W, MAP_H),
                  project({ lat: 29, lng: 52 }, MAP_W, MAP_H),
                  project({ lat: 30.5, lng: 35 }, MAP_W, MAP_H),
                ])}
                fill="rgba(255,255,255,0.02)"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />

              {LANDMARKS.map((lm) => {
                const p = project(lm, MAP_W, MAP_H);
                return (
                  <text
                    key={lm.label}
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    className="fill-zinc-600 text-[12px] font-medium"
                    style={{ fontFamily: "var(--font-heebo), sans-serif" }}
                  >
                    {lm.label}
                  </text>
                );
              })}

              {LAUNCH_SITES.map((site) => (
                <SiteMarker
                  key={site.id}
                  site={site}
                  selected={selectedSiteId === site.id}
                  onSelect={(id) => {
                    setSelectedSiteId(id);
                    setSelectedTrackId(null);
                  }}
                />
              ))}

              {tracks.map((track) => (
                <TrackLayer
                  key={track.id}
                  track={track}
                  selected={selectedTrackId === track.id}
                  onSelect={(id) => {
                    setSelectedTrackId(id);
                    setSelectedSiteId(null);
                  }}
                />
              ))}
            </svg>
          </div>

          <div className="border-t border-white/8 px-4 py-3 text-xs leading-relaxed text-zinc-500">
            מקורות:{" "}
            <a
              href="https://t.me/newsil5"
              target="_blank"
              rel="noreferrer"
              className="text-amber-300/90 underline-offset-2 hover:underline"
            >
              @newsil5
            </a>
            {" · "}
            <a
              href="https://t.me/shigurimisrael"
              target="_blank"
              rel="noreferrer"
              className="text-amber-300/90 underline-offset-2 hover:underline"
            >
              @shigurimisrael
            </a>
            . מיקומי משגר הם אזורים כלליים מהטקסט — לא קואורדינטות מדויקות.
            {errors[0] ? ` · ${errors[0]}` : ""}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-white/10 bg-[#0b1017]/90 p-4">
            <h3 className="mb-3 text-xs font-bold tracking-[0.2em] text-zinc-500">
              מסלולים פעילים
            </h3>
            {tracks.length === 0 ? (
              <p className="text-sm text-zinc-500">אין מסלולים כרגע.</p>
            ) : (
              <ul className="space-y-2">
                {tracks.map((track) => (
                  <li key={track.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTrackId(track.id);
                        setSelectedSiteId(null);
                      }}
                      className={`w-full rounded-xl border px-3 py-3 text-right transition ${
                        selectedTrackId === track.id
                          ? "border-rose-400/40 bg-rose-500/10"
                          : "border-white/8 bg-white/[0.03] hover:border-white/15"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">{track.labelHe}</span>
                        <span
                          className={`text-[11px] font-semibold ${statusTone(track.status)}`}
                        >
                          {STATUS_LABEL[track.status]}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-l from-rose-400 to-amber-400 transition-[width] duration-300"
                          style={{
                            width: `${Math.round(track.progress * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between font-mono text-[10px] text-zinc-500">
                        <span>{track.sourceHe}</span>
                        <span>ETA {etaLabel(track.etaSeconds)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0b1017]/90 p-4">
            <h3 className="mb-3 text-xs font-bold tracking-[0.2em] text-zinc-500">
              פרטי בחירה
            </h3>
            {selectedTrack ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">מקור</dt>
                  <dd className="font-semibold">{selectedTrack.originLabelHe}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">יעד ויזואלי</dt>
                  <dd className="font-semibold">{selectedTrack.targetLabelHe}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">סטטוס</dt>
                  <dd
                    className={`font-semibold ${statusTone(selectedTrack.status)}`}
                  >
                    {STATUS_LABEL[selectedTrack.status]}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">סוג</dt>
                  <dd className="font-semibold">{selectedTrack.speedHintHe}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">מקור מידע</dt>
                  <dd className="text-left text-xs text-zinc-300">
                    {selectedTrack.sourceUrl ? (
                      <a
                        href={selectedTrack.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-300 underline-offset-2 hover:underline"
                      >
                        {selectedTrack.sourceHe}
                      </a>
                    ) : (
                      selectedTrack.sourceHe
                    )}
                  </dd>
                </div>
                {selectedTrack.rawText ? (
                  <p className="pt-1 text-xs leading-relaxed text-zinc-400">
                    {selectedTrack.rawText}
                  </p>
                ) : null}
              </dl>
            ) : selectedSite ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">אתר</dt>
                  <dd className="font-semibold">{selectedSite.nameHe}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-500">אזור</dt>
                  <dd className="font-semibold">{selectedSite.region}</dd>
                </div>
                <p className="pt-1 text-xs leading-relaxed text-zinc-400">
                  {selectedSite.noteHe}
                </p>
              </dl>
            ) : (
              <p className="text-sm text-zinc-500">בחר מסלול או אתר שיגור במפה.</p>
            )}
          </div>

          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
            <h3 className="mb-2 text-sm font-bold text-sky-200">פיד טלגרם</h3>
            {relatedFeed.length === 0 ? (
              <p className="text-xs text-zinc-500">אין דיווחי שיגור אחרונים.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {relatedFeed.map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border border-white/8 bg-black/20 px-3 py-2 transition hover:border-sky-400/30"
                    >
                      <div className="mb-1 flex justify-between gap-2 text-[10px] text-zinc-500">
                        <span>@{item.channel}</span>
                        <span className="font-mono">
                          {new Date(item.datetime).toLocaleTimeString("he-IL", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="line-clamp-3 text-xs leading-relaxed text-zinc-300">
                        {item.text}
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
