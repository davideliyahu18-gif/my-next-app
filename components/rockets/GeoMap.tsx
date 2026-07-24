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

const CENTER: L.LatLngExpression = [32.4, 44.8];
const DEFAULT_ZOOM = 5;

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
      maxZoom: 11,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    });

    // Clean white / light gray basemap
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
        subdomains: "abcd",
        maxZoom: 18,
      },
    ).addTo(map);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        opacity: 0.7,
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
        radius: selected ? 9 : 6,
        color: "#111827",
        weight: selected ? 2.5 : 1.5,
        fillColor: selected ? "#111827" : "#ffffff",
        fillOpacity: 1,
      });
      marker.bindTooltip(site.nameHe, {
        direction: "top",
        offset: [0, -8],
        className: "rocket-map-tooltip-light",
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
      const ink = selected ? "#dc2626" : "#111827";

      L.polyline(full, {
        color: "#94a3b8",
        weight: selected ? 2.5 : 1.5,
        dashArray: "2 10",
        opacity: 0.9,
      })
        .on("click", () => callbacksRef.current.onSelectTrack(track.id))
        .addTo(group);

      if (flown.length > 1) {
        L.polyline(flown, {
          color: ink,
          weight: selected ? 4.5 : 3,
          opacity: 1,
          lineCap: "round",
        })
          .on("click", () => callbacksRef.current.onSelectTrack(track.id))
          .addTo(group);
      }

      L.circleMarker([track.origin.lat, track.origin.lng], {
        radius: 5,
        color: "#111827",
        weight: 2,
        fillColor: "#ffffff",
        fillOpacity: 1,
      }).addTo(group);

      L.circleMarker([track.target.lat, track.target.lng], {
        radius: 7,
        color: ink,
        weight: 2,
        fillColor: "transparent",
      }).addTo(group);

      const tipMarker = L.circleMarker([tip.lat, tip.lng], {
        radius: selected ? 8 : 6,
        color: "#ffffff",
        weight: 3,
        fillColor: ink,
        fillOpacity: 1,
      });
      tipMarker.bindTooltip(track.labelHe, {
        permanent: selected,
        direction: "right",
        offset: [12, 0],
        className: "rocket-map-tooltip-light",
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
      map.fitBounds(bounds.pad(0.4), { animate: true, maxZoom: 6 });
    }
  }, [tracks]);

  return (
    <div className="relative h-[min(70vh,680px)] w-full overflow-hidden bg-white">
      <div ref={containerRef} className="absolute inset-0 z-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 z-[400] ring-1 ring-inset ring-black/5" />
    </div>
  );
}
