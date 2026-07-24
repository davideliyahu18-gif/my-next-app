"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
    <div className="flex h-[220px] items-center justify-center rounded-2xl bg-[#eef2f6] text-sm text-slate-400 sm:h-[280px]">
      טוען מפה…
    </div>
  ),
});

type RegionRow = {
  id: string;
  nameHe: string;
  icon: string;
  count: number;
  hint: string;
};

function relativeHe(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  return `לפני ${Math.floor(hours / 24)} ימים`;
}

function formatStamp(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function formatFeedTime(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function countMentions(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function buildRegions(tracks: RocketTrack[], feed: RocketFeedItem[]): RegionRow[] {
  const corpus = [
    ...tracks.map((t) => `${t.labelHe} ${t.originLabelHe} ${t.rawText ?? ""}`),
    ...feed.map((f) => f.text),
  ].join("\n");

  const rows: RegionRow[] = [
    {
      id: "jordan",
      nameHe: "ירדן",
      icon: "🛡️",
      count: 0,
      hint: "מסדרון / יירוט",
    },
    {
      id: "syria",
      nameHe: "סוריה",
      icon: "✈️",
      count: 0,
      hint: "מרחב אווירי",
    },
    {
      id: "iraq",
      nameHe: "עיראק",
      icon: "📍",
      count: 0,
      hint: "פעילות מדווחת",
    },
    {
      id: "yemen",
      nameHe: "תימן",
      icon: "📌",
      count: 0,
      hint: "שיגורים / כטב״מ",
    },
  ];

  const matchers: Record<string, RegExp[]> = {
    jordan: [/ירדן/, /עקבה/],
    syria: [/סוריה/],
    iraq: [/עיראק/, /בגדאד/],
    yemen: [/תימן/, /סעדה/, /חות/],
  };

  for (const row of rows) {
    let count = 0;
    for (const track of tracks) {
      const blob = `${track.labelHe} ${track.originLabelHe} ${track.rawText ?? ""}`;
      if (countMentions(blob, matchers[row.id])) count += 1;
    }
    for (const item of feed.slice(0, 20)) {
      if (item.related && countMentions(item.text, matchers[row.id])) count += 1;
    }
    // soft signal from broader corpus so empty doesn't look broken
    if (count === 0 && countMentions(corpus, matchers[row.id])) count = 1;
    row.count = count;
  }

  return rows;
}

export default function RocketTrackingMap() {
  const [tracks, setTracks] = useState<RocketTrack[]>([]);
  const [feed, setFeed] = useState<RocketFeedItem[]>([]);
  const [mode, setMode] = useState<RocketsSnapshot["mode"]>("live");
  const [errors, setErrors] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [autoAlerts, setAutoAlerts] = useState(false);
  const [forceDemo, setForceDemo] = useState(false);
  const [running, setRunning] = useState(true);
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
        setUpdatedAt(snapshot.timestamp);
        const current = selectedTrackIdRef.current;
        if (
          snapshot.tracks.length > 0 &&
          (!current || !snapshot.tracks.some((t) => t.id === current))
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

  const activeTracks = tracks.filter((t) => t.progress < 1);
  const launchFeed = feed.filter((f) => f.related);
  const regions = useMemo(() => buildRegions(tracks, feed), [tracks, feed]);
  const waiting = activeTracks.length === 0 && launchFeed.length === 0;

  return (
    <div dir="rtl" className="min-h-screen bg-[#eef1f5] text-slate-900">
      {/* Dash header */}
      <header className="bg-[#2f6fed] text-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link href="/" className="text-xs font-medium text-white/80">
            ← בית
          </Link>
          <h1 className="text-base font-black tracking-tight">Dash - דאש</h1>
          <button
            type="button"
            onClick={() => setForceDemo((v) => !v)}
            className="text-[11px] font-semibold text-white/85"
          >
            {forceDemo ? "LIVE" : "Demo"}
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-lg flex-col gap-3 px-3 py-3 pb-10">
        {/* Live Tracking */}
        <section className="overflow-hidden rounded-3xl border border-white bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800">Live Tracking</h2>
              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                Live
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              {formatClock()}
            </span>
          </div>
          <div className="px-3 pb-3">
            <GeoMap
              tracks={tracks}
              sites={LAUNCH_SITES}
              selectedTrackId={selectedTrackId}
              onSelectTrack={setSelectedTrackId}
            />
          </div>
        </section>

        {/* Launches status */}
        <section className="rounded-3xl border border-white bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="text-base">🚀</span>
            <h2 className="text-sm font-bold text-slate-800">
              שיגורים לעבר ישראל
            </h2>
          </div>

          <div
            className={`rounded-2xl px-4 py-5 text-center ${
              waiting
                ? "bg-[#d8f5c8]"
                : "bg-gradient-to-b from-orange-100 to-amber-50"
            }`}
          >
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-white/70 text-3xl shadow-sm">
              🚀
            </div>
            {waiting ? (
              <>
                <p className="text-base font-black text-slate-800">
                  ממתינים לדיווחים מעודכנים
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  אין שיגור פעיל כרגע בפיד
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-black text-slate-800">
                  {activeTracks.length > 0
                    ? `${activeTracks.length} מסלולים פעילים`
                    : `${launchFeed.length} דיווחי שיגור אחרונים`}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {tracks[0]?.labelHe ?? launchFeed[0]?.text.slice(0, 48)}
                </p>
              </>
            )}
            <p className="mt-3 text-[11px] font-medium text-slate-500">
              Last updated: {formatStamp(updatedAt)}
            </p>
          </div>

          {selectedTrackId && tracks.find((t) => t.id === selectedTrackId) ? (
            <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div className="flex justify-between gap-2">
                <span className="font-bold text-slate-800">
                  {tracks.find((t) => t.id === selectedTrackId)?.labelHe}
                </span>
                <span>
                  {
                    STATUS_LABEL[
                      tracks.find((t) => t.id === selectedTrackId)!.status
                    ]
                  }
                </span>
              </div>
            </div>
          ) : null}
        </section>

        {/* Regions */}
        <section className="overflow-hidden rounded-3xl border border-white bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <ul className="divide-y divide-slate-100">
            {regions.map((region) => (
              <li
                key={region.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-lg">
                    {region.icon}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {region.nameHe}
                    </p>
                    <p className="text-[11px] text-slate-400">{region.hint}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="font-mono text-sm font-bold text-slate-800">
                    {region.count}
                  </p>
                  <p className="text-[10px] text-slate-400">דיווחים</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Auto alerts */}
        <section className="rounded-3xl border border-white bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-base">📢</span>
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  השמעת התרעות אוטומטית
                </h2>
                <p className="text-[11px] text-slate-400">
                  אופציה להפעיל התרעות
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoAlerts}
              onClick={() => setAutoAlerts((v) => !v)}
              className={`relative h-7 w-12 rounded-full transition ${
                autoAlerts ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  autoAlerts ? "right-0.5" : "right-[1.35rem]"
                }`}
              />
            </button>
          </div>
          {autoAlerts ? (
            <p className="mt-2 text-[11px] text-emerald-700">
              כשתיכנס התראת שיגור חדשה — תוצג כאן התראה במסך.
            </p>
          ) : null}
          {mode === "demo" ? (
            <button
              type="button"
              onClick={() => setRunning((v) => !v)}
              className="mt-2 text-[11px] font-semibold text-blue-600"
            >
              {running ? "השהה הדגמה" : "המשך הדגמה"}
            </button>
          ) : null}
        </section>

        {/* Telegram feed */}
        <section className="overflow-hidden rounded-3xl border border-white bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-800">Telegram Feed</h2>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                connected
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {connected ? "Connected" : "Connecting…"}
            </span>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
            {feed.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
                ממתינים להודעות מטלגרם…
              </p>
            ) : (
              feed.slice(0, 30).map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-2xl bg-[#f3f5f8] transition hover:bg-[#e9eef5]"
                >
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-32 w-full object-cover"
                    />
                  ) : null}
                  <div className="px-3 py-2.5">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-500">
                        @{item.channel}
                        {item.related ? (
                          <span className="mr-1 rounded bg-red-100 px-1.5 py-0.5 font-bold text-red-600">
                            שיגור
                          </span>
                        ) : null}
                      </span>
                      <span>{formatFeedTime(item.datetime)}</span>
                    </div>
                    <p className="line-clamp-4 text-[13px] leading-relaxed text-slate-700">
                      {item.text}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {relativeHe(item.datetime)}
                    </p>
                  </div>
                </a>
              ))
            )}
          </div>

          {errors[0] ? (
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-red-600">
              {errors[0]}
            </p>
          ) : (
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
              מקורות: @newsil5 · @shigurimisrael
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
