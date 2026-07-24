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
    <div className="flex h-[min(70vh,680px)] items-center justify-center bg-white text-sm font-medium text-neutral-400">
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

function relativeHe(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
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
    <span className="font-mono text-sm tabular-nums text-neutral-900">
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
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [running, setRunning] = useState(true);
  const [forceDemo, setForceDemo] = useState(false);
  const [connected, setConnected] = useState(false);
  const [feedFilter, setFeedFilter] = useState<"all" | "launch">("all");
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
        setUpdatedAt(snapshot.timestamp);
        const current = selectedTrackIdRef.current;
        if (
          snapshot.tracks.length > 0 &&
          (!current || !snapshot.tracks.some((track) => track.id === current))
        ) {
          setSelectedTrackId(snapshot.tracks[0].id);
        }
        setConnected(true);
      } catch {
        // ignore
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
          return {
            ...track,
            progress,
            etaSeconds: Math.max(0, Math.round(track.etaSeconds - dt)),
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

  const visibleFeed =
    feedFilter === "launch" ? feed.filter((item) => item.related) : feed;

  return (
    <div dir="rtl" className="min-h-screen bg-white text-neutral-900">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-5">
            <Link
              href="/"
              className="text-xs font-medium text-neutral-400 transition hover:text-neutral-700"
            >
              ← חזרה
            </Link>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-neutral-400">
                White Map
              </p>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                מכ״ם שיגורים
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden text-left sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Israel
              </p>
              <LiveClock />
            </div>
            <div className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700">
              {connected ? "מחובר" : "מתחבר…"}
              {updatedAt ? ` · ${relativeHe(updatedAt)}` : ""}
            </div>
            <div className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white">
              {mode === "live" ? "LIVE" : "DEMO"} · {activeCount} פעילים
            </div>
            {mode === "demo" && (
              <button
                type="button"
                onClick={() => setRunning((v) => !v)}
                className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold"
              >
                {running ? "השהה" : "המשך"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setForceDemo((v) => !v)}
              className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50"
            >
              {forceDemo ? "חזרה ללייב" : "הדגמה"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-5 md:px-8 md:py-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-tight md:text-2xl">
              מפה לבנה · מסדרון איראן–ישראל
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              שכבת מסלולים על בסיס דיווחי טלגרם מעודכנים
            </p>
          </div>
          <p className="text-xs text-neutral-400">
            {sources.map((s) => `@${s.username}`).join("  ·  ") ||
              "@newsil5 · @shigurimisrael"}
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.9fr]">
          <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]">
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

            <div className="grid gap-0 border-t border-neutral-200 md:grid-cols-2">
              <div className="border-b border-neutral-200 p-4 md:border-b-0 md:border-l">
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
                  מסלולים
                </h3>
                {tracks.length === 0 ? (
                  <p className="text-sm text-neutral-400">אין מסלולים כרגע.</p>
                ) : (
                  <ul className="max-h-56 space-y-2 overflow-y-auto">
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
                              ? "border-neutral-900 bg-neutral-900 text-white"
                              : "border-neutral-200 hover:border-neutral-400"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold">
                              {track.labelHe}
                            </span>
                            <span
                              className={`text-[11px] font-semibold ${
                                selectedTrackId === track.id
                                  ? "text-neutral-300"
                                  : "text-neutral-500"
                              }`}
                            >
                              {STATUS_LABEL[track.status]}
                            </span>
                          </div>
                          <div
                            className={`mt-2 h-1 overflow-hidden rounded-full ${
                              selectedTrackId === track.id
                                ? "bg-white/20"
                                : "bg-neutral-100"
                            }`}
                          >
                            <div
                              className={`h-full rounded-full ${
                                selectedTrackId === track.id
                                  ? "bg-white"
                                  : "bg-neutral-900"
                              }`}
                              style={{
                                width: `${Math.round(track.progress * 100)}%`,
                              }}
                            />
                          </div>
                          <div
                            className={`mt-2 flex justify-between font-mono text-[10px] ${
                              selectedTrackId === track.id
                                ? "text-neutral-400"
                                : "text-neutral-400"
                            }`}
                          >
                            <span>{track.sourceHe}</span>
                            <span>ETA {etaLabel(track.etaSeconds)}</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-4">
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
                  פרטים
                </h3>
                {selectedTrack ? (
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-400">מקור</dt>
                      <dd className="font-semibold">
                        {selectedTrack.originLabelHe}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-400">יעד</dt>
                      <dd className="font-semibold">
                        {selectedTrack.targetLabelHe}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-400">סוג</dt>
                      <dd className="font-semibold">
                        {selectedTrack.speedHintHe}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-neutral-400">קישור</dt>
                      <dd>
                        {selectedTrack.sourceUrl ? (
                          <a
                            href={selectedTrack.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold underline underline-offset-2"
                          >
                            {selectedTrack.sourceHe}
                          </a>
                        ) : (
                          selectedTrack.sourceHe
                        )}
                      </dd>
                    </div>
                    {selectedTrack.rawText ? (
                      <p className="rounded-2xl bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-600">
                        {selectedTrack.rawText}
                      </p>
                    ) : null}
                  </dl>
                ) : selectedSite ? (
                  <div className="text-sm">
                    <p className="font-bold">{selectedSite.nameHe}</p>
                    <p className="text-neutral-500">{selectedSite.region}</p>
                    <p className="mt-2 text-xs leading-relaxed text-neutral-600">
                      {selectedSite.noteHe}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400">בחר מסלול במפה.</p>
                )}
                {errors[0] ? (
                  <p className="mt-3 text-xs text-red-600">{errors[0]}</p>
                ) : null}
              </div>
            </div>
          </section>

          <aside className="flex min-h-[70vh] flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50">
            <div className="border-b border-neutral-200 bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black tracking-tight">
                    פיד טלגרם
                  </h3>
                  <p className="text-xs text-neutral-500">
                    מתעדכן אוטומטית · {feed.length} הודעות
                  </p>
                </div>
                <div className="flex rounded-full border border-neutral-200 bg-neutral-50 p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setFeedFilter("all")}
                    className={`rounded-full px-3 py-1 ${
                      feedFilter === "all"
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-500"
                    }`}
                  >
                    הכל
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedFilter("launch")}
                    className={`rounded-full px-3 py-1 ${
                      feedFilter === "launch"
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-500"
                    }`}
                  >
                    שיגורים
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {visibleFeed.length === 0 ? (
                <p className="p-4 text-sm text-neutral-400">
                  אין הודעות בפיד כרגע.
                </p>
              ) : (
                visibleFeed.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-neutral-400"
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-36 w-full object-cover"
                      />
                    ) : null}
                    <div className="p-3">
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-neutral-900">
                          @{item.channel}
                          {item.related ? (
                            <span className="mr-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                              שיגור
                            </span>
                          ) : null}
                        </span>
                        <span className="text-neutral-400">
                          {relativeHe(item.datetime)}
                        </span>
                      </div>
                      <p className="line-clamp-4 text-sm leading-relaxed text-neutral-700">
                        {item.text}
                      </p>
                    </div>
                  </a>
                ))
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
