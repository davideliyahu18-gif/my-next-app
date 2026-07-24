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
  selectedSiteId: string | null;
  onSelectTrack: (id: string) => void;
  onSelectSite: (id: string) => void;
};

const CENTER: L.LatLngExpression = [32.2, 45.5];
const DEFAULT_ZOOM = 5;

function trackColor(selected: boolean): string {
  return selected ? "#ff5a36" : "#ff8f6b";
}

export default function GeoMap({
  tracks,
  sites,
  selectedTrackId,
  selectedSiteId,
  onSelectTrack,
  onSelectSite,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fittedKeyRef = useRef<string>("");
  const callbacksRef = useRef({ onSelectTrack, onSelectSite });
  callbacksRef.current = { onSelectTrack, onSelectSite };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 4,
      maxZoom: 10,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 18,
      },
    ).addTo(map);

    // Soft dusk wash over the basemap
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        opacity: 0.55,
        pane: "overlayPane",
      },
    ).addTo(map);

    L.control.zoom({ position: "bottomleft" }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
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
      const selected = site.id === selectedSiteId;
      const marker = L.circleMarker([site.position.lat, site.position.lng], {
        radius: selected ? 10 : 7,
        color: selected ? "#0f766e" : "#115e59",
        weight: 2,
        fillColor: selected ? "#2dd4bf" : "#14b8a6",
        fillOpacity: 0.85,
      });
      marker.bindTooltip(site.nameHe, {
        direction: "top",
        offset: [0, -8],
        className: "rocket-map-tooltip",
      });
      marker.on("click", () => callbacksRef.current.onSelectSite(site.id));
      marker.addTo(group);
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
        color: selected ? "rgba(15,23,42,0.35)" : "rgba(15,23,42,0.2)",
        weight: selected ? 3 : 2,
        dashArray: "6 8",
        interactive: true,
      })
        .on("click", () => callbacksRef.current.onSelectTrack(track.id))
        .addTo(group);

      if (flown.length > 1) {
        L.polyline(flown, {
          color: trackColor(selected),
          weight: selected ? 5 : 3.5,
          opacity: 0.95,
          lineCap: "round",
          interactive: true,
        })
          .on("click", () => callbacksRef.current.onSelectTrack(track.id))
          .addTo(group);
      }

      L.circleMarker([track.origin.lat, track.origin.lng], {
        radius: 5,
        color: "#0f766e",
        weight: 2,
        fillColor: "#fbbf24",
        fillOpacity: 1,
      }).addTo(group);

      L.circleMarker([track.target.lat, track.target.lng], {
        radius: 6,
        color: trackColor(selected),
        weight: 2,
        fillColor: "transparent",
        fillOpacity: 0,
      }).addTo(group);

      const tipMarker = L.circleMarker([tip.lat, tip.lng], {
        radius: selected ? 9 : 7,
        color: "#fff7ed",
        weight: 2,
        fillColor: trackColor(selected),
        fillOpacity: 1,
      });
      tipMarker.bindTooltip(track.labelHe, {
        permanent: selected,
        direction: "right",
        offset: [12, 0],
        className: "rocket-map-tooltip",
      });
      tipMarker.on("click", () =>
        callbacksRef.current.onSelectTrack(track.id),
      );
      tipMarker.addTo(group);
    }
  }, [tracks, sites, selectedTrackId, selectedSiteId]);

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
      map.fitBounds(bounds.pad(0.35), { animate: true, maxZoom: 6 });
    }
  }, [tracks]);

  return (
    <div className="relative h-[min(68vh,640px)] w-full overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 z-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 z-[400] bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(15,23,42,0.28)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[450] h-16 bg-gradient-to-b from-[#0b1220]/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[450] h-20 bg-gradient-to-t from-[#0b1220]/55 to-transparent" />
    </div>
  );
}
