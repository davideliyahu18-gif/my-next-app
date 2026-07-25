"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ballisticPoint, trajectoryPoints } from "@/lib/rockets/geo";
import type { LaunchSite, RocketTrack } from "@/lib/rockets/types";

type Props = {
  tracks: RocketTrack[];
  sites: LaunchSite[];
  selectedTrackId: string | null;
  onSelectTrack: (id: string) => void;
};

const CENTER: L.LatLngExpression = [33.2, 42.5];
const DEFAULT_ZOOM = 5;

/** Hebrew place labels drawn on top of a no-label basemap. */
const HEBREW_LABELS: { name: string; lat: number; lng: number; kind: "country" | "city" }[] =
  [
    { name: "ישראל", lat: 31.5, lng: 34.85, kind: "country" },
    { name: "ירדן", lat: 31.2, lng: 36.5, kind: "country" },
    { name: "סוריה", lat: 35.0, lng: 38.5, kind: "country" },
    { name: "עיראק", lat: 33.2, lng: 44.0, kind: "country" },
    { name: "איראן", lat: 32.5, lng: 54.0, kind: "country" },
    { name: "תימן", lat: 15.5, lng: 47.5, kind: "country" },
    { name: "כווית", lat: 29.38, lng: 47.99, kind: "country" },
    { name: "בחריין", lat: 26.07, lng: 50.55, kind: "country" },
    { name: "תל אביב", lat: 32.0853, lng: 34.7818, kind: "city" },
    { name: "חיפה", lat: 32.794, lng: 34.9896, kind: "city" },
    { name: "ירושלים", lat: 31.7683, lng: 35.2137, kind: "city" },
    { name: "טהרן", lat: 35.69, lng: 51.39, kind: "city" },
    { name: "אספהאן", lat: 32.65, lng: 51.68, kind: "city" },
    { name: "שיראז", lat: 29.61, lng: 52.53, kind: "city" },
    { name: "בגדאד", lat: 33.3152, lng: 44.3661, kind: "city" },
    { name: "דמשק", lat: 33.5138, lng: 36.2765, kind: "city" },
    { name: "עמאן", lat: 31.9539, lng: 35.9106, kind: "city" },
    { name: "מפרץ פרסי", lat: 27.0, lng: 51.5, kind: "country" },
  ];

function heLabelIcon(name: string, kind: "country" | "city" | "site") {
  const cls =
    kind === "country"
      ? "rocket-he-label rocket-he-label--country"
      : kind === "site"
        ? "rocket-he-label rocket-he-label--site"
        : "rocket-he-label rocket-he-label--city";
  return L.divIcon({
    className: "rocket-he-label-wrap",
    html: `<span class="${cls}">${name}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export default function GeoMap({
  tracks,
  sites,
  selectedTrackId,
  onSelectTrack,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const labelsRef = useRef<L.LayerGroup | null>(null);
  const fittedKeyRef = useRef<string>("");
  const onSelectRef = useRef(onSelectTrack);
  onSelectRef.current = onSelectTrack;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 4,
      maxZoom: 11,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    });

    // Basemap without English labels — Hebrew labels drawn by us.
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 18,
      },
    ).addTo(map);

    L.control
      .zoom({
        position: "topleft",
        zoomInTitle: "התקרבות",
        zoomOutTitle: "התרחקות",
      })
      .addTo(map);

    labelsRef.current = L.layerGroup().addTo(map);
    for (const place of HEBREW_LABELS) {
      L.marker([place.lat, place.lng], {
        icon: heLabelIcon(place.name, place.kind),
        interactive: false,
        keyboard: false,
      }).addTo(labelsRef.current);
    }

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      labelsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;
    group.clearLayers();

    for (const site of sites) {
      L.circleMarker([site.position.lat, site.position.lng], {
        radius: 5,
        color: "#2563eb",
        weight: 2,
        fillColor: "#ffffff",
        fillOpacity: 1,
      })
        .bindTooltip(site.nameHe, {
          direction: "top",
          offset: [0, -6],
          className: "rocket-map-tooltip-he",
          opacity: 1,
        })
        .addTo(group);
    }

    for (const track of tracks) {
      const selected = track.id === selectedTrackId;
      const full = trajectoryPoints(track.origin, track.target, 56).map(
        (p) => [p.lat, p.lng] as L.LatLngExpression,
      );
      const flown = trajectoryPoints(track.origin, track.target, 64)
        .filter((_, i, arr) => i / (arr.length - 1) <= track.progress)
        .map((p) => [p.lat, p.lng] as L.LatLngExpression);
      const tip = ballisticPoint(track.origin, track.target, track.progress);

      L.polyline(full, {
        color: selected ? "#1d4ed8" : "#60a5fa",
        weight: selected ? 3 : 2,
        dashArray: "8 10",
        opacity: 0.95,
      })
        .on("click", () => onSelectRef.current(track.id))
        .addTo(group);

      if (flown.length > 1) {
        L.polyline(flown, {
          color: selected ? "#1e40af" : "#2563eb",
          weight: selected ? 4 : 3,
          opacity: 1,
          lineCap: "round",
        })
          .on("click", () => onSelectRef.current(track.id))
          .addTo(group);
      }

      L.circleMarker([track.origin.lat, track.origin.lng], {
        radius: 6,
        color: "#1d4ed8",
        weight: 2,
        fillColor: "#93c5fd",
        fillOpacity: 1,
      })
        .bindTooltip(`מקור: ${track.originLabelHe}`, {
          className: "rocket-map-tooltip-he",
          direction: "top",
        })
        .addTo(group);

      L.circleMarker([track.target.lat, track.target.lng], {
        radius: 6,
        color: selected ? "#1d4ed8" : "#64748b",
        weight: 2,
        fillColor: "transparent",
      })
        .bindTooltip(`יעד: ${track.targetLabelHe}`, {
          className: "rocket-map-tooltip-he",
          direction: "bottom",
        })
        .addTo(group);

      L.circleMarker([tip.lat, tip.lng], {
        radius: selected ? 8 : 6,
        color: "#ffffff",
        weight: 2,
        fillColor: "#2563eb",
        fillOpacity: 1,
      })
        .bindTooltip(track.labelHe, {
          permanent: selected,
          direction: "right",
          offset: [10, 0],
          className: "rocket-map-tooltip-he",
        })
        .on("click", () => onSelectRef.current(track.id))
        .addTo(group);
    }
  }, [tracks, sites, selectedTrackId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || tracks.length === 0) return;
    const key = tracks.map((t) => t.id).join("|");
    if (fittedKeyRef.current === key) return;
    fittedKeyRef.current = key;
    const bounds = L.latLngBounds([]);
    for (const track of tracks) {
      bounds.extend([track.origin.lat, track.origin.lng]);
      bounds.extend([track.target.lat, track.target.lng]);
    }
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.45), { animate: true, maxZoom: 6 });
    }
  }, [tracks]);

  return (
    <div className="relative h-[220px] w-full overflow-hidden rounded-2xl bg-[#f3f6f9] sm:h-[280px]">
      <div ref={containerRef} className="absolute inset-0 z-0 h-full w-full" />
      <div className="pointer-events-none absolute bottom-2 left-2 z-[450] rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-600 shadow">
        מפה בעברית
      </div>
    </div>
  );
}
