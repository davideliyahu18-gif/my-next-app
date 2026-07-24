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

export default function GeoMap({
  tracks,
  sites,
  selectedTrackId,
  onSelectTrack,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
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

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 18,
      },
    ).addTo(map);

    L.control.zoom({ position: "topleft" }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
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
      }).addTo(group);
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
      }).addTo(group);

      L.circleMarker([tip.lat, tip.lng], {
        radius: selected ? 8 : 6,
        color: "#ffffff",
        weight: 2,
        fillColor: "#2563eb",
        fillOpacity: 1,
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
    </div>
  );
}
