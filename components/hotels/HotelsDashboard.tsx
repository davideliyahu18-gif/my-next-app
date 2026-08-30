"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HOTELS_DEFAULT_CITY, HOTELS_DEFAULT_RADIUS_KM } from "@/lib/hotels/constants";
import type { HotelKind, HotelRecord, HotelsSnapshot } from "@/lib/hotels/types";
import {
  HOTEL_KIND_LABEL,
  buildBookingSearchUrl,
  defaultBookingDates,
  formatDistance,
  matchesHotelQuery,
  starsLabel,
} from "@/lib/hotels/utils";

const HotelsMap = dynamic(() => import("@/components/hotels/HotelsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center rounded-2xl bg-[#f3f0e8] text-sm text-[#7a5c2e] sm:h-[400px]">
      טוען מפה…
    </div>
  ),
});

const EMPTY_SNAPSHOT: HotelsSnapshot = {
  ok: true,
  query: HOTELS_DEFAULT_CITY,
  cityLabel: null,
  center: null,
  radiusKm: HOTELS_DEFAULT_RADIUS_KM,
  hotels: [],
  stats: {
    total: 0,
    withStars: 0,
    byKind: { hotel: 0, guest_house: 0, hostel: 0, motel: 0, apartment: 0 },
  },
  timestamp: new Date().toISOString(),
  source: "openstreetmap",
};

type KindFilter = "all" | HotelKind;

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: string;
}) {
  return (
    <div className="hotels-glass relative overflow-hidden rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-[#8a6d3b]">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-[#3b2410]">{value}</p>
          {hint ? <p className="mt-2 text-xs leading-relaxed text-[#8a6d3b]">{hint}</p> : null}
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#eadcc2] bg-[#fdf4e3] text-lg">
          {icon}
        </span>
      </div>
    </div>
  );
}

function HotelCard({
  hotel,
  selected,
  onSelect,
  cityLabel,
  checkIn,
  checkOut,
}: {
  hotel: HotelRecord;
  selected: boolean;
  onSelect: (id: string) => void;
  cityLabel: string;
  checkIn: string;
  checkOut: string;
}) {
  const bookingUrl = buildBookingSearchUrl({
    query: `${hotel.name} ${cityLabel}`.trim(),
    checkIn,
    checkOut,
  });

  return (
    <button
      type="button"
      onClick={() => onSelect(hotel.id)}
      className={`hotels-card w-full rounded-xl border p-4 text-right transition ${
        selected ? "border-[#b45309] bg-[#fdf4e3]" : "border-[#eadcc2] bg-white hover:border-[#b45309]/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-[#3b2410]">{hotel.name}</p>
          <p className="mt-0.5 text-xs text-[#8a6d3b]">
            {HOTEL_KIND_LABEL[hotel.kind]}
            {hotel.stars ? ` · ${starsLabel(hotel.stars)}` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[#eadcc2] bg-[#fdf4e3] px-2.5 py-1 text-[11px] font-bold text-[#b45309]">
          {formatDistance(hotel.distanceKm)}
        </span>
      </div>
      {hotel.address ? (
        <p className="mt-2 truncate text-xs text-[#8a6d3b]">📍 {hotel.address}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="rounded-lg bg-[#003580] px-3 py-1.5 font-black text-white transition hover:bg-[#00224f]"
        >
          מחיר ב-Booking.com
        </a>
        {hotel.website ? (
          <a
            href={hotel.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="font-semibold text-[#b45309] hover:underline"
          >
            אתר 🔗
          </a>
        ) : null}
        {hotel.phone ? <span className="text-[#8a6d3b]">📞 {hotel.phone}</span> : null}
      </div>
    </button>
  );
}

export function HotelsDashboard() {
  const [cityInput, setCityInput] = useState(HOTELS_DEFAULT_CITY);
  const [activeCity, setActiveCity] = useState(HOTELS_DEFAULT_CITY);
  const [snapshot, setSnapshot] = useState<HotelsSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [{ checkIn, checkOut }, setDates] = useState(defaultBookingDates());
  const requestIdRef = useRef(0);

  const loadHotels = useCallback(async (city: string, force = false) => {
    setLoading(true);
    const requestId = (requestIdRef.current += 1);
    try {
      const response = await fetch(
        `/api/hotels?city=${encodeURIComponent(city)}${force ? "&refresh=1" : ""}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as HotelsSnapshot;
      if (requestId === requestIdRef.current) {
        setSnapshot(data);
        setSelectedId(null);
      }
    } catch {
      if (requestId === requestIdRef.current) {
        setSnapshot((prev) => ({ ...prev, ok: false, error: "שגיאה בטעינת מלונות" }));
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHotels(activeCity);
  }, [activeCity, loadHotels]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const city = cityInput.trim();
    if (!city) return;
    if (city === activeCity) {
      void loadHotels(city, true);
    } else {
      setActiveCity(city);
    }
  };

  const visibleHotels = useMemo(() => {
    return snapshot.hotels
      .filter((hotel) => kindFilter === "all" || hotel.kind === kindFilter)
      .filter((hotel) => matchesHotelQuery(hotel, query));
  }, [snapshot.hotels, kindFilter, query]);

  const selectedHotel = visibleHotels.find((hotel) => hotel.id === selectedId) ?? null;
  const cityLabel = snapshot.cityLabel || activeCity;
  const cityBookingUrl = buildBookingSearchUrl({ query: cityLabel, checkIn, checkOut });

  return (
    <div dir="rtl" className="hotels-page relative min-h-screen font-sans">
      <header className="hotels-header relative z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-[#b45309] to-[#78350f] text-lg text-white shadow-md">
              🏨
            </span>
            <div>
              <p className="text-[10px] font-bold tracking-[0.22em] text-[#8a6d3b]">
                חיפוש חופשה
              </p>
              <h1 className="text-hotels-gradient text-xl font-black md:text-2xl">
                מלונות וטיסות
              </h1>
            </div>
          </div>
          <Link
            href="/flights"
            className="rounded-lg border border-[#eadcc2] bg-white px-4 py-2 text-xs font-bold text-[#3b2410] transition hover:border-[#b45309]/40"
          >
            ✈️ טיסות נתב״ג
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 md:px-8">
        <section className="hotels-glass rounded-2xl p-5 md:p-6">
          <h2 className="text-lg font-black text-[#3b2410]">לאן נוסעים?</h2>
          <p className="mt-1 text-sm text-[#8a6d3b]">
            חיפוש מלונות לפי עיר — נתונים חופשיים מ-OpenStreetMap.
          </p>
          <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={cityInput}
              onChange={(event) => setCityInput(event.target.value)}
              placeholder="שם עיר, למשל: אילת, ברצלונה, לונדון..."
              className="flex-1 rounded-lg border border-[#eadcc2] bg-white px-4 py-3 text-sm text-[#3b2410] outline-none transition focus:border-[#b45309] focus:ring-2 focus:ring-[#b45309]/15"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#b45309] px-6 py-3 text-sm font-black text-white transition hover:bg-[#92400e] disabled:opacity-50"
            >
              {loading ? "מחפש..." : "חיפוש"}
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-[#8a6d3b]">
              צ&apos;ק-אין
              <input
                type="date"
                value={checkIn}
                onChange={(event) => setDates((d) => ({ ...d, checkIn: event.target.value }))}
                className="rounded-lg border border-[#eadcc2] bg-white px-2 py-1.5 text-xs text-[#3b2410] outline-none focus:border-[#b45309]"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-[#8a6d3b]">
              צ&apos;ק-אאוט
              <input
                type="date"
                value={checkOut}
                onChange={(event) => setDates((d) => ({ ...d, checkOut: event.target.value }))}
                className="rounded-lg border border-[#eadcc2] bg-white px-2 py-1.5 text-xs text-[#3b2410] outline-none focus:border-[#b45309]"
              />
            </label>
            <a
              href={cityBookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mr-auto rounded-lg bg-[#003580] px-4 py-2 text-xs font-black text-white transition hover:bg-[#00224f]"
            >
              חפש את כל {cityLabel.split(",")[0]} ב-Booking.com
            </a>
          </div>

          {snapshot.cityLabel ? (
            <p className="mt-3 text-xs text-[#8a6d3b]">📍 {snapshot.cityLabel}</p>
          ) : null}
          {snapshot.error ? (
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {snapshot.error}
            </p>
          ) : null}
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-3">
          <StatCard label="מלונות באזור" value={snapshot.stats.total} icon="🏨" />
          <StatCard
            label="עם דירוג כוכבים"
            value={snapshot.stats.withStars}
            hint="מתוך הנתונים הפתוחים"
            icon="⭐"
          />
          <StatCard
            label="רדיוס חיפוש"
            value={`${snapshot.radiusKm} ק״מ`}
            hint="סביב מרכז העיר"
            icon="🗺️"
          />
        </section>

        <section className="mt-5">
          <HotelsMap
            center={snapshot.center}
            hotels={visibleHotels}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>

        <section className="hotels-glass mt-5 rounded-xl p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "הכל"],
                  ["hotel", "מלון"],
                  ["guest_house", "בית הארחה"],
                  ["hostel", "הוסטל"],
                  ["apartment", "דירת נופש"],
                  ["motel", "מוטל"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKindFilter(value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    kindFilter === value
                      ? "bg-[#3b2410] text-white"
                      : "border border-[#eadcc2] bg-white text-[#8a6d3b] hover:border-[#b45309]/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="חיפוש בשם, כתובת..."
              className="w-full rounded-lg border border-[#eadcc2] bg-white px-4 py-2.5 text-sm text-[#3b2410] outline-none transition focus:border-[#b45309] focus:ring-2 focus:ring-[#b45309]/15 lg:max-w-xs"
            />
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {loading && visibleHotels.length === 0 ? (
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="hotels-skeleton h-32 rounded-xl" />
            ))
          ) : visibleHotels.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-[#eadcc2] px-6 py-16 text-center">
              <p className="text-3xl">🏨</p>
              <p className="mt-4 text-sm text-[#8a6d3b]">
                {snapshot.hotels.length === 0
                  ? "לא נמצאו מלונות לעיר הזו."
                  : "אין תוצאות לחיפוש או לסינון הנוכחי."}
              </p>
            </div>
          ) : (
            visibleHotels.map((hotel) => (
              <HotelCard
                key={hotel.id}
                hotel={hotel}
                selected={hotel.id === selectedHotel?.id}
                onSelect={setSelectedId}
                cityLabel={cityLabel}
                checkIn={checkIn}
                checkOut={checkOut}
              />
            ))
          )}
        </section>

        <footer className="mt-10 rounded-xl border border-[#eadcc2] bg-white px-5 py-6 text-center text-xs leading-relaxed text-[#8a6d3b]">
          <p>
            מקור נתונים חופשי:{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#b45309] hover:underline"
            >
              © OpenStreetMap contributors
            </a>
          </p>
          <p className="mt-2">
            הנתונים מגיעים ממאגר קהילתי חופשי — ייתכן שחלק מהמלונות חסרים או לא מעודכנים.
            כפתורי &quot;Booking.com&quot; מובילים לחיפוש באתר שלהם — מחיר וזמינות אמיתיים,
            בלי חשבון API.
          </p>
        </footer>
      </main>
    </div>
  );
}
