"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { HotelRecord } from "@/lib/hotels/types";
import { HOTEL_KIND_LABEL, starsLabel } from "@/lib/hotels/utils";

type Props = {
  center: { lat: number; lng: number } | null;
  hotels: HotelRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const DEFAULT_CENTER: L.LatLngExpression = [32.0853, 34.7818];
const DEFAULT_ZOOM = 13;

function hotelIcon(selected: boolean) {
  return L.divIcon({
    className: "hotels-map-icon-wrap",
    html: `<span class="hotels-map-icon${selected ? " hotels-map-icon--selected" : ""}">🏨</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 26],
  });
}

export default function HotelsMap({ center, hotels, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const fittedKeyRef = useRef("");

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors © CARTO",
    }).addTo(map);

    L.control
      .zoom({ position: "topleft", zoomInTitle: "התקרבות", zoomOutTitle: "התרחקות" })
      .addTo(map);

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

    if (center) {
      L.circleMarker([center.lat, center.lng], {
        radius: 6,
        color: "#b45309",
        weight: 2,
        fillColor: "#fbbf24",
        fillOpacity: 1,
      })
        .bindTooltip("מרכז החיפוש", { className: "hotels-map-tooltip", direction: "top" })
        .addTo(group);
    }

    for (const hotel of hotels) {
      const selected = hotel.id === selectedId;
      L.marker([hotel.lat, hotel.lng], { icon: hotelIcon(selected) })
        .bindTooltip(
          `${hotel.name} · ${HOTEL_KIND_LABEL[hotel.kind]}${hotel.stars ? ` · ${starsLabel(hotel.stars)}` : ""}`,
          {
            className: "hotels-map-tooltip",
            direction: "top",
            offset: [0, -22],
            permanent: selected,
          },
        )
        .on("click", () => onSelectRef.current(hotel.id))
        .addTo(group);
    }
  }, [hotels, center, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    const key = `${center.lat},${center.lng}`;
    if (fittedKeyRef.current === key) return;
    fittedKeyRef.current = key;

    if (hotels.length > 0) {
      const bounds = L.latLngBounds([[center.lat, center.lng]]);
      for (const hotel of hotels) bounds.extend([hotel.lat, hotel.lng]);
      map.fitBounds(bounds.pad(0.2), { animate: true, maxZoom: 15 });
    } else {
      map.flyTo([center.lat, center.lng], DEFAULT_ZOOM, { animate: true });
    }
  }, [center, hotels]);

  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-2xl bg-[#f3f0e8] sm:h-[400px]">
      <div ref={containerRef} className="absolute inset-0 z-0 h-full w-full" />
    </div>
  );
}
