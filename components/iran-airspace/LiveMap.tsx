"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createAircraftIcon, markerTooltipHtml } from "./AircraftMarker";
import { buildTrailPolyline } from "./AircraftTrail";
import MapControls from "./MapControls";
import { REGION_CENTER, REGION_DEFAULT_ZOOM } from "@/lib/iran-airspace/constants";
import type { Aircraft, TrailPoint } from "@/lib/iran-airspace/types";

const HEBREW_LABELS: { name: string; lat: number; lon: number; kind: "country" | "sea" | "city" }[] = [
  { name: "איראן", lat: 32.4, lon: 53.7, kind: "country" },
  { name: "עיראק", lat: 33.0, lon: 43.2, kind: "country" },
  { name: "טורקיה", lat: 39.2, lon: 34.5, kind: "country" },
  { name: "כווית", lat: 29.35, lon: 47.6, kind: "country" },
  { name: "קטאר", lat: 25.35, lon: 51.15, kind: "country" },
  { name: "בחריין", lat: 26.05, lon: 50.5, kind: "country" },
  { name: "איחוד האמירויות", lat: 23.7, lon: 54.2, kind: "country" },
  { name: "עומאן", lat: 20.8, lon: 56.8, kind: "country" },
  { name: "ערב הסעודית", lat: 23.8, lon: 45.0, kind: "country" },
  { name: "פקיסטן", lat: 27.5, lon: 65.5, kind: "country" },
  { name: "ים הכספי", lat: 41.2, lon: 51.0, kind: "sea" },
  { name: "המפרץ הפרסי", lat: 26.7, lon: 51.8, kind: "sea" },
  { name: "ים עומאן", lat: 24.3, lon: 60.8, kind: "sea" },
  { name: "טהראן", lat: 35.69, lon: 51.39, kind: "city" },
  { name: "בגדאד", lat: 33.31, lon: 44.36, kind: "city" },
  { name: "אבו דאבי", lat: 24.45, lon: 54.37, kind: "city" },
  { name: "ריאד", lat: 24.7, lon: 46.7, kind: "city" },
  { name: "דוחה", lat: 25.3, lon: 51.5, kind: "city" },
  { name: "מוסקט", lat: 23.6, lon: 58.6, kind: "city" },
];

function labelIcon(name: string, kind: string): L.DivIcon {
  const cls = kind === "country" ? "text-[12px] font-bold text-slate-300/80" : kind === "sea" ? "text-[11px] italic text-sky-400/50" : "text-[10px] font-semibold text-slate-400/70";
  return L.divIcon({
    className: "iran-airspace-label-wrap",
    html: `<span class="${cls}" style="white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.9)">${name}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

type LayerId = "dark" | "satellite";

const LAYERS: Record<LayerId, { url: string; attribution: string; maxZoom: number }> = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; OpenStreetMap',
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 18,
  },
};

type MarkerEntry = { marker: L.Marker; aircraft: Aircraft };

export default function LiveMap({
  aircraft,
  selectedHex,
  onSelectAircraft,
  trail,
  showTrails,
  showLabels,
  focusRequest,
}: {
  aircraft: Aircraft[];
  selectedHex: string | null;
  onSelectAircraft: (hex: string | null) => void;
  trail: TrailPoint[];
  showTrails: boolean;
  showLabels: boolean;
  focusRequest: { hex: string; token: number } | null;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const labelLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const trailLayerRef = useRef<L.Polyline | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const onSelectRef = useRef(onSelectAircraft);
  const [layerId, setLayerId] = useState<LayerId>("dark");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastFocusToken = useRef<number>(-1);

  useEffect(() => {
    onSelectRef.current = onSelectAircraft;
  }, [onSelectAircraft]);

  // Mount map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: REGION_CENTER,
      zoom: REGION_DEFAULT_ZOOM,
      minZoom: 3,
      maxZoom: 12,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    });
    map.attributionControl.setPrefix(false);

    const tiles = L.tileLayer(LAYERS.dark.url, {
      attribution: LAYERS.dark.attribution,
      maxZoom: LAYERS.dark.maxZoom,
      subdomains: "abcd",
    }).addTo(map);
    tileLayerRef.current = tiles;

    const labelLayer = L.layerGroup().addTo(map);
    for (const place of HEBREW_LABELS) {
      L.marker([place.lat, place.lon], {
        icon: labelIcon(place.name, place.kind),
        interactive: false,
        keyboard: false,
      }).addTo(labelLayer);
    }
    labelLayerRef.current = labelLayer;

    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.on("click", () => onSelectRef.current(null));

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    const markers = markersRef.current;

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      labelLayerRef.current = null;
      tileLayerRef.current = null;
      markers.clear();
    };
  }, []);

  // Diff aircraft markers in place.
  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;

    const seen = new Set<string>();
    for (const ac of aircraft) {
      seen.add(ac.hex);
      const selected = ac.hex === selectedHex;
      const existing = markersRef.current.get(ac.hex);

      if (existing) {
        existing.marker.setLatLng([ac.lat, ac.lon]);
        existing.marker.setIcon(createAircraftIcon(ac, selected));
        existing.marker.setZIndexOffset(selected ? 1000 : 0);
        existing.marker.unbindTooltip();
        existing.marker.bindTooltip(markerTooltipHtml(ac), {
          permanent: showLabels,
          direction: "top",
          offset: [0, -10],
          className: "iran-airspace-tooltip-wrap",
          opacity: 0.95,
        });
        existing.aircraft = ac;
      } else {
        const marker = L.marker([ac.lat, ac.lon], {
          icon: createAircraftIcon(ac, selected),
        });
        marker.bindTooltip(markerTooltipHtml(ac), {
          permanent: showLabels,
          direction: "top",
          offset: [0, -10],
          className: "iran-airspace-tooltip-wrap",
          opacity: 0.95,
        });
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectRef.current(ac.hex);
        });
        marker.addTo(layer);
        markersRef.current.set(ac.hex, { marker, aircraft: ac });
      }
    }

    for (const [hex, entry] of markersRef.current) {
      if (!seen.has(hex)) {
        layer.removeLayer(entry.marker);
        markersRef.current.delete(hex);
      }
    }
  }, [aircraft, selectedHex, showLabels]);

  // Trail for the selected aircraft.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (trailLayerRef.current) {
      map.removeLayer(trailLayerRef.current);
      trailLayerRef.current = null;
    }
    if (!showTrails || !selectedHex || trail.length < 2) return;
    const selectedAircraft = markersRef.current.get(selectedHex)?.aircraft;
    const polyline = buildTrailPolyline(trail, selectedAircraft?.category ?? "civil");
    if (polyline) {
      polyline.addTo(map);
      trailLayerRef.current = polyline;
    }
  }, [trail, showTrails, selectedHex]);

  // Focus requests (from search / interesting-movements list).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusRequest || focusRequest.token === lastFocusToken.current) return;
    lastFocusToken.current = focusRequest.token;
    const target = markersRef.current.get(focusRequest.hex);
    if (target) {
      map.flyTo(target.marker.getLatLng(), Math.max(map.getZoom(), 7), { animate: true, duration: 0.8 });
    }
  }, [focusRequest]);

  // Layer switching.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileLayerRef.current) return;
    map.removeLayer(tileLayerRef.current);
    const def = LAYERS[layerId];
    const tiles = L.tileLayer(def.url, { attribution: def.attribution, maxZoom: def.maxZoom, subdomains: "abcd" });
    tiles.addTo(map);
    tiles.bringToBack();
    tileLayerRef.current = tiles;
  }, [layerId]);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setTimeout(() => mapRef.current?.invalidateSize(), 60);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-[#050b14]">
      <div ref={containerRef} className="absolute inset-0 z-0 h-full w-full" />
      <MapControls
        isFullscreen={isFullscreen}
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        onReset={() => mapRef.current?.flyTo(REGION_CENTER, REGION_DEFAULT_ZOOM, { animate: true })}
        onFullscreen={() => {
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            wrapRef.current?.requestFullscreen().catch(() => undefined);
          }
        }}
        onFitAircraft={() => {
          const map = mapRef.current;
          if (!map || aircraft.length === 0) return;
          const bounds = L.latLngBounds(aircraft.map((a) => [a.lat, a.lon] as L.LatLngExpression));
          if (bounds.isValid()) map.fitBounds(bounds.pad(0.2), { animate: true, maxZoom: 9 });
        }}
        onToggleLayer={() => setLayerId((prev) => (prev === "dark" ? "satellite" : "dark"))}
      />
    </div>
  );
}
