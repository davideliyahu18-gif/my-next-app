"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createDemoTracks, LAUNCH_SITES, STATUS_LABEL } from "@/lib/rockets/data";
import { formatClock, statusFromProgress } from "@/lib/rockets/geo";
import type {
  RocketFeedItem,
  RocketsSnapshot,
  RocketTrack,
} from "@/lib/rockets/types";

const GeoMap = dynamic(() => import("@/components/rockets/GeoMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(68vh,640px)] items-center justify-center bg-[#dbe4ee] text-sm font-semibold text-slate-500">
      טוען מפה…
    </div>
  ),
});

function etaLabel(seconds: number): string {
  if (seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function statusTone(status: RocketTrack["status"]): string {
  switch (status) {
    case "boost":
      return "text-amber-700";
    case "midcourse":
      return "text-teal-700";
    case "terminal":
      return "text-orange-700";
    case "impact":
      return "text-slate-500";
    case "intercepted":
      return "text-emerald-700";
    default:
      return "text-slate-500";
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
    <span className="font-mono text-sm tabular-nums text-slate-800">
      {now || "—:—:—"}
    </span>
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
    <div
      dir="rtl"
      className="min-h-screen bg-[#e8eef4] text-slate-900"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 50% at 10% -10%, rgba(13,148,136,0.16), transparent), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(249,115,22,0.10), transparent), linear-gradient(180deg, #edf2f7 0%, #e2e8f0 100%)",
      }}
    >
      <header className="sticky top-0 z-30 border-b border-slate-300/70 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs font-semibold text-slate-500 transition hover:text-slate-800"
            >
              ← חזרה
            </Link>
            <div>
              <p className="text-[10px] font-black tracking-[0.28em] text-teal-700">
                SITUATION MAP
              </p>
              <h1 className="font-display text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
                מכ״ם שיגורים
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm sm:block">
              <p className="text-[10px] font-bold tracking-[0.18em] text-slate-400">
                שעון ישראל
              </p>
              <LiveClock />
            </div>
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${
                mode === "live"
                  ? "border-teal-300 bg-teal-50 text-teal-800"
                  : "border-amber-300 bg-amber-50 text-amber-800"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
              </span>
              <span className="text-xs font-bold">
                {mode === "live" ? "LIVE טלגרם" : "הדגמה"}
                {connected && mode === "live" ? " · מחובר" : ""}
              </span>
            </div>
            <div className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-800">
              {activeCount} פעילים
            </div>
            {mode === "demo" && (
              <button
                type="button"
                onClick={() => setRunning((v) => !v)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                {running ? "השהה" : "המשך"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setForceDemo((v) => !v)}
              className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 transition hover:bg-teal-100"
            >
              {forceDemo ? "חזרה ללייב" : "הדגמה"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-4 px-4 py-4 md:grid-cols-[1fr_340px] md:px-6 md:py-6">
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-300/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                מפת מצב · איראן ↔ ישראל
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {mode === "live"
                  ? "שכבת מסלולים מדיווחי טלגרם על מפה גאוגרפית"
                  : "מצב הדגמה על מפה גאוגרפית"}
              </p>
            </div>
            <p className="font-mono text-[11px] text-slate-400">
              {sources.map((s) => `@${s.username}`).join(" · ") ||
                "@newsil5 · @shigurimisrael"}
            </p>
          </div>

          <GeoMap
            tracks={tracks}
            sites={LAUNCH_SITES}
            selectedTrackId={selectedTrackId}
            selectedSiteId={selectedSiteId}
            onSelectTrack={(id) => {
              setSelectedTrackId(id);
              setSelectedSiteId(null);
            }}
            onSelectSite={(id) => {
              setSelectedSiteId(id);
              setSelectedTrackId(null);
            }}
          />

          <div className="border-t border-slate-200 px-5 py-3 text-xs leading-relaxed text-slate-500">
            מקורות:{" "}
            <a
              href="https://t.me/newsil5"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-teal-700 underline-offset-2 hover:underline"
            >
              @newsil5
            </a>
            {" · "}
            <a
              href="https://t.me/shigurimisrael"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-teal-700 underline-offset-2 hover:underline"
            >
              @shigurimisrael
            </a>
            . מיקומי משגר הם אזורים כלליים מהטקסט.
            {errors[0] ? ` · ${errors[0]}` : ""}
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-4 shadow-sm">
            <h3 className="mb-3 text-[11px] font-black tracking-[0.2em] text-slate-400">
              מסלולים
            </h3>
            {tracks.length === 0 ? (
              <p className="text-sm text-slate-500">אין מסלולים כרגע.</p>
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
                      className={`w-full rounded-2xl border px-3 py-3 text-right transition ${
                        selectedTrackId === track.id
                          ? "border-orange-300 bg-orange-50 shadow-sm"
                          : "border-slate-200 bg-slate-50/70 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {track.labelHe}
                        </span>
                        <span
                          className={`text-[11px] font-bold ${statusTone(track.status)}`}
                        >
                          {STATUS_LABEL[track.status]}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-l from-orange-500 to-teal-500 transition-[width] duration-300"
                          style={{
                            width: `${Math.round(track.progress * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between font-mono text-[10px] text-slate-500">
                        <span>{track.sourceHe}</span>
                        <span>ETA {etaLabel(track.etaSeconds)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-4 shadow-sm">
            <h3 className="mb-3 text-[11px] font-black tracking-[0.2em] text-slate-400">
              פרטים
            </h3>
            {selectedTrack ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">מקור</dt>
                  <dd className="font-bold">{selectedTrack.originLabelHe}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">יעד</dt>
                  <dd className="font-bold">{selectedTrack.targetLabelHe}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">סטטוס</dt>
                  <dd
                    className={`font-bold ${statusTone(selectedTrack.status)}`}
                  >
                    {STATUS_LABEL[selectedTrack.status]}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">סוג</dt>
                  <dd className="font-bold">{selectedTrack.speedHintHe}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">מקור מידע</dt>
                  <dd className="text-left text-xs">
                    {selectedTrack.sourceUrl ? (
                      <a
                        href={selectedTrack.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-teal-700 underline-offset-2 hover:underline"
                      >
                        {selectedTrack.sourceHe}
                      </a>
                    ) : (
                      selectedTrack.sourceHe
                    )}
                  </dd>
                </div>
                {selectedTrack.rawText ? (
                  <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                    {selectedTrack.rawText}
                  </p>
                ) : null}
              </dl>
            ) : selectedSite ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">אתר</dt>
                  <dd className="font-bold">{selectedSite.nameHe}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">אזור</dt>
                  <dd className="font-bold">{selectedSite.region}</dd>
                </div>
                <p className="text-xs leading-relaxed text-slate-600">
                  {selectedSite.noteHe}
                </p>
              </dl>
            ) : (
              <p className="text-sm text-slate-500">בחר מסלול או אתר במפה.</p>
            )}
          </div>

          <div className="rounded-[1.5rem] border border-teal-200 bg-teal-50/80 p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-black text-teal-900">פיד טלגרם</h3>
            {relatedFeed.length === 0 ? (
              <p className="text-xs text-teal-800/70">אין דיווחי שיגור אחרונים.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {relatedFeed.map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl border border-teal-200/80 bg-white/80 px-3 py-2 transition hover:border-teal-400"
                    >
                      <div className="mb-1 flex justify-between gap-2 text-[10px] text-slate-500">
                        <span>@{item.channel}</span>
                        <span className="font-mono">
                          {new Date(item.datetime).toLocaleTimeString("he-IL", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="line-clamp-3 text-xs leading-relaxed text-slate-700">
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
