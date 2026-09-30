"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { Layers, X } from "lucide-react";
import { CENTRO_CDMB_POR_DEFECTO } from "@/lib/municipios";

export type PuntoTramite = {
  id: string;
  numero: string;
  tramiteNombre: string;
  tramiteCodigo: string;
  estado: string;
  municipio: string;
  solicitanteNombre: string;
  fechaRadicacion: string;
  lat: number;
  lon: number;
};

export function GeovisorTramites({ expedientes }: { expedientes: PuntoTramite[] }) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const clusterRef = useRef<import("leaflet").MarkerClusterGroup | null>(null);
  const municipiosRef = useRef<import("leaflet").GeoJSON | null>(null);

  const [panelAbierto, setPanelAbierto] = useState(true);
  const [capaTramites, setCapaTramites] = useState(true);
  const [capaMunicipios, setCapaMunicipios] = useState(true);

  useEffect(() => {
    let cancelado = false;
    import("leaflet").then(async (L) => {
      // leaflet.markercluster espera `window.L` ya definido (es un plugin clásico, no un
      // módulo ES que importe leaflet por su cuenta) — sin esto revienta con "L is not defined".
      (window as unknown as { L: typeof L }).L = L;
      await import("leaflet.markercluster");
      if (cancelado || !contenedorRef.current || mapRef.current) return;
      const map = L.map(contenedorRef.current).setView(CENTRO_CDMB_POR_DEFECTO, 10);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const cluster = L.markerClusterGroup({ maxClusterRadius: 50 });
      map.addLayer(cluster);
      clusterRef.current = cluster;
      mapRef.current = map;

      fetch("/geo/municipios_cdmb.geojson")
        .then((r) => r.json())
        .then((geojson) => {
          if (cancelado || !mapRef.current) return;
          const capa = L.geoJSON(geojson, {
            style: { color: "#166534", weight: 1.4, fillColor: "#166534", fillOpacity: 0.04 },
            onEachFeature: (feature, layer) => {
              const nombre = feature.properties?.nombre;
              if (nombre) layer.bindTooltip(nombre, { sticky: true, className: "text-xs" });
            },
          });
          municipiosRef.current = capa;
          capa.addTo(mapRef.current);
        })
        .catch(() => {});

      poblarMarcadores(L, cluster, expedientes);
    });
    return () => {
      cancelado = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    if (capaTramites) map.addLayer(cluster);
    else map.removeLayer(cluster);
  }, [capaTramites]);

  useEffect(() => {
    const map = mapRef.current;
    const capa = municipiosRef.current;
    if (!map || !capa) return;
    if (capaMunicipios) capa.addTo(map);
    else map.removeLayer(capa);
  }, [capaMunicipios]);

  function poblarMarcadores(
    L: typeof import("leaflet"),
    cluster: import("leaflet").MarkerClusterGroup,
    puntos: PuntoTramite[]
  ) {
    cluster.clearLayers();
    for (const p of puntos) {
      const marker = L.marker([p.lat, p.lon]);
      const contenedor = document.createElement("div");
      contenedor.className = "text-xs leading-relaxed";
      contenedor.innerHTML = `
        <p class="font-mono font-semibold text-stone-800">${escapeHtml(p.numero)}</p>
        <p class="text-stone-700">${escapeHtml(p.tramiteCodigo)} — ${escapeHtml(p.tramiteNombre)}</p>
        <p class="text-stone-500">${escapeHtml(p.solicitanteNombre)} · ${escapeHtml(p.municipio)}</p>
        <p class="text-stone-500">${escapeHtml(p.estado.replaceAll("_", " "))}</p>
      `;
      const enlace = document.createElement("a");
      enlace.href = `/expedientes/${p.id}`;
      enlace.className = "mt-1 inline-block font-medium text-cdmb-700 hover:underline";
      enlace.textContent = "Ver expediente →";
      contenedor.appendChild(enlace);
      marker.bindPopup(contenedor);
      cluster.addLayer(marker);
    }
  }

  return (
    <div className="relative h-[600px] w-full overflow-hidden rounded-xl border border-stone-200 shadow-soft">
      <div ref={contenedorRef} className="h-full w-full" />

      <div className="absolute right-3 top-3 z-[550]">
        <button
          type="button"
          onClick={() => setPanelAbierto((v) => !v)}
          title={panelAbierto ? "Ocultar capas" : "Mostrar capas"}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-700 shadow-sm hover:bg-stone-50"
        >
          {panelAbierto ? <X className="h-4 w-4" aria-hidden /> : <Layers className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      {panelAbierto && (
        <div className="absolute right-3 top-14 z-[550] w-56 rounded-lg border border-stone-200 bg-white p-3 text-sm shadow-lg">
          <p className="mb-2 flex items-center gap-1.5 font-semibold text-stone-800">
            <Layers className="h-3.5 w-3.5" aria-hidden />
            Capas
          </p>
          <label className="flex items-center gap-2 py-1">
            <input type="checkbox" checked={capaTramites} onChange={(e) => setCapaTramites(e.target.checked)} />
            Trámites ({expedientes.length})
          </label>
          <label className="flex items-center gap-2 py-1">
            <input type="checkbox" checked={capaMunicipios} onChange={(e) => setCapaMunicipios(e.target.checked)} />
            Límites municipales
          </label>
        </div>
      )}

      {expedientes.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[550] flex justify-center">
          <p className="rounded-full bg-white px-3 py-1 text-xs text-stone-500 shadow">
            Ningún trámite con este filtro tiene ubicación registrada.
          </p>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
