"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/** Mapa de solo consulta: un pin fijo en lat/lon, sin controles de edición ni búsqueda. */
export function MapaSoloLectura({ lat, lon }: { lat: number; lon: number }) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    let cancelado = false;
    import("leaflet").then((L) => {
      if (cancelado || !contenedorRef.current || mapRef.current) return;
      const map = L.map(contenedorRef.current, { scrollWheelZoom: false }).setView([lat, lon], 15);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      const icono = L.divIcon({
        html: '<div style="font-size:28px;line-height:1;transform:translateY(-4px)">📍</div>',
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 24],
      });
      L.marker([lat, lon], { icon: icono }).addTo(map);
      mapRef.current = map;
    });
    return () => {
      cancelado = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lon]);

  return <div ref={contenedorRef} className="h-56 w-full overflow-hidden rounded-lg border border-stone-200" />;
}
