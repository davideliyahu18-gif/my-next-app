"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { createAircraftIcon, markerTooltipHtml, bgnIcon } from "./AircraftMarker";
import MapControls from "./MapControls";
import { BGN_COORDS } from "@/lib/tlv-control/utils/geo";
import type { Aircraft } from "@/lib/tlv-control/types";

type LayerId = "dark" | "satellite";

// Esri's ArcGIS Online basemap tiles — free, no API key required.
const LAYERS: Record<LayerId, { url: string; attribution: string; maxZoom: number }> = {
  dark: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 16,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 18,
  },
};

const DEFAULT_ZOOM = 10;
type MarkerEntry = { marker: L.Marker; aircraft: Aircraft };

export default function LiveMap({
  aircraft,
  selectedId,
  onSelectAircraft,
}: {
  aircraft: Aircraft[];
  selectedId: string | null;
  onSelectAircraft: (id: string | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const onSelectRef = useRef(onSelectAircraft);
  const [layerId, setLayerId] = useState<LayerId>("dark");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelectAircraft;
  }, [onSelectAircraft]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [BGN_COORDS.lat, BGN_COORDS.lon],
      zoom: DEFAULT_ZOOM,
      minZoom: 5,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    });
    map.attributionControl.setPrefix(false);

    const tiles = L.tileLayer(LAYERS.dark.url, { attribution: LAYERS.dark.attribution, maxZoom: LAYERS.dark.maxZoom }).addTo(map);
    tileLayerRef.current = tiles;

    L.marker([BGN_COORDS.lat, BGN_COORDS.lon], { icon: bgnIcon(), interactive: false, keyboard: false }).addTo(map);

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
      tileLayerRef.current = null;
      markers.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;

    const seen = new Set<string>();
    for (const ac of aircraft) {
      seen.add(ac.id);
      const selected = ac.id === selectedId;
      const existing = markersRef.current.get(ac.id);

      if (existing) {
        existing.marker.setLatLng([ac.latitude, ac.longitude]);
        existing.marker.setIcon(createAircraftIcon(ac, selected));
        existing.marker.setZIndexOffset(selected ? 1000 : 0);
        existing.marker.unbindTooltip();
        existing.marker.bindTooltip(markerTooltipHtml(ac), { direction: "top", offset: [0, -10], className: "tlv-control-tooltip-wrap", opacity: 0.95 });
        existing.aircraft = ac;
      } else {
        const marker = L.marker([ac.latitude, ac.longitude], { icon: createAircraftIcon(ac, selected) });
        marker.bindTooltip(markerTooltipHtml(ac), { direction: "top", offset: [0, -10], className: "tlv-control-tooltip-wrap", opacity: 0.95 });
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectRef.current(ac.id);
        });
        marker.addTo(layer);
        markersRef.current.set(ac.id, { marker, aircraft: ac });
      }
    }

    for (const [id, entry] of markersRef.current) {
      if (!seen.has(id)) {
        layer.removeLayer(entry.marker);
        markersRef.current.delete(id);
      }
    }
  }, [aircraft, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileLayerRef.current) return;
    map.removeLayer(tileLayerRef.current);
    const def = LAYERS[layerId];
    const tiles = L.tileLayer(def.url, { attribution: def.attribution, maxZoom: def.maxZoom });
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
        onReset={() => mapRef.current?.flyTo([BGN_COORDS.lat, BGN_COORDS.lon], DEFAULT_ZOOM, { animate: true })}
        onFullscreen={() => {
          if (document.fullscreenElement) document.exitFullscreen();
          else wrapRef.current?.requestFullscreen().catch(() => undefined);
        }}
        onFitAircraft={() => {
          const map = mapRef.current;
          if (!map || aircraft.length === 0) return;
          const bounds = L.latLngBounds(aircraft.map((a) => [a.latitude, a.longitude] as L.LatLngExpression));
          if (bounds.isValid()) map.fitBounds(bounds.pad(0.2), { animate: true, maxZoom: 12 });
        }}
        onToggleLayer={() => setLayerId((prev) => (prev === "dark" ? "satellite" : "dark"))}
      />
    </div>
  );
}
