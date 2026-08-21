"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { CENTROIDE_MUNICIPIO, CENTRO_CDMB_POR_DEFECTO, type MunicipioCdmb } from "@/lib/municipios";
import { latLonAPlanas, esLatLonValido } from "@/lib/coordenadas";

type Punto = { lat: number; lon: number };

export function MapaUbicacion({ municipio }: { municipio: string }) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  const [punto, setPunto] = useState<Punto | null>(null);
  const [direccion, setDireccion] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [latTexto, setLatTexto] = useState("");
  const [lonTexto, setLonTexto] = useState("");
  const [errorCoords, setErrorCoords] = useState<string | null>(null);

  const centroide = CENTROIDE_MUNICIPIO[municipio as MunicipioCdmb] ?? CENTRO_CDMB_POR_DEFECTO;

  // Inicializa el mapa una sola vez (Leaflet toca `window`, por eso el import es dinámico y dentro de useEffect)
  useEffect(() => {
    let cancelado = false;
    import("leaflet").then((L) => {
      if (cancelado || !contenedorRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(contenedorRef.current).setView(centroide, 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        colocarPunto(e.latlng.lat, e.latlng.lng);
      });
      mapRef.current = map;
    });
    return () => {
      cancelado = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si cambia el municipio y todavía no hay punto marcado, recentra el mapa
  useEffect(() => {
    if (!punto && mapRef.current) {
      mapRef.current.setView(centroide, 13);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipio]);

  function colocarPunto(lat: number, lon: number) {
    setPunto({ lat, lon });
    setLatTexto(lat.toFixed(6));
    setLonTexto(lon.toFixed(6));
    setErrorCoords(null);
    setErrorBusqueda(null);

    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      const icono = L.divIcon({
        html: '<div style="font-size:28px;line-height:1;transform:translateY(-4px)">📍</div>',
        className: "",
        iconSize: [28, 28],
        iconAnchor: [14, 24],
      });
      markerRef.current = L.marker([lat, lon], { icon: icono }).addTo(map);
    }
    map.setView([lat, lon], Math.max(map.getZoom(), 15));
  }

  function quitarPunto() {
    setPunto(null);
    setLatTexto("");
    setLonTexto("");
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }

  async function buscarDireccion() {
    if (!direccion.trim()) {
      setErrorBusqueda("Escribe una dirección para buscarla.");
      return;
    }
    setBuscando(true);
    setErrorBusqueda(null);
    try {
      const consulta = `${direccion.trim()}, ${municipio}, Santander, Colombia`;
      const res = await fetch(`/api/geocodificar?q=${encodeURIComponent(consulta)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se encontró esa dirección.");
      colocarPunto(data.lat, data.lon);
    } catch (err) {
      setErrorBusqueda(
        err instanceof Error ? err.message : "No se pudo buscar — márcala tocando el mapa."
      );
    } finally {
      setBuscando(false);
    }
  }

  function usarCoordenadasEscritas() {
    const lat = parseFloat(latTexto.replace(",", "."));
    const lon = parseFloat(lonTexto.replace(",", "."));
    if (!esLatLonValido(lat, lon)) {
      setErrorCoords("Escribe latitud y longitud válidas (ej. 7.119300 y -73.122700).");
      return;
    }
    setErrorCoords(null);
    colocarPunto(lat, lon);
  }

  const planas = punto ? latLonAPlanas(punto.lat, punto.lon) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="Buscar una dirección (ej. Carrera 27 # 15-20)"
          className="min-w-[200px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        />
        <button
          type="button"
          onClick={buscarDireccion}
          disabled={buscando}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {buscando ? "Buscando…" : "Buscar en el mapa"}
        </button>
      </div>
      {errorBusqueda && <p className="text-xs text-red-600">{errorBusqueda}</p>}

      <p className="text-xs text-gray-500">
        O toca directamente el punto exacto en el mapa. Si no hay una dirección real (kilómetro de vía,
        finca), pega las coordenadas de Google Maps abajo (clic derecho sobre el punto → clic en los
        números).
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Latitud</label>
          <input
            value={latTexto}
            onChange={(e) => setLatTexto(e.target.value)}
            placeholder="ej. 7.119300"
            className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Longitud</label>
          <input
            value={lonTexto}
            onChange={(e) => setLonTexto(e.target.value)}
            placeholder="ej. -73.122700"
            className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={usarCoordenadasEscritas}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Usar
        </button>
        {punto && (
          <button type="button" onClick={quitarPunto} className="text-xs text-gray-400 hover:text-red-600">
            Quitar punto
          </button>
        )}
      </div>
      {errorCoords && <p className="text-xs text-red-600">{errorCoords}</p>}

      <div ref={contenedorRef} className="h-64 w-full overflow-hidden rounded-lg border border-gray-200" />

      {punto && planas && (
        <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <p>
            <span className="font-medium">Lat/Lon (WGS84):</span> {punto.lat.toFixed(6)}, {punto.lon.toFixed(6)}
          </p>
          <p>
            <span className="font-medium">Coordenadas planas (MAGNA-SIRGAS Origen-Nacional):</span> X{" "}
            {planas.x.toLocaleString("es-CO")} m, Y {planas.y.toLocaleString("es-CO")} m
          </p>
        </div>
      )}

      <input type="hidden" name="ubicacionLat" value={punto?.lat ?? ""} />
      <input type="hidden" name="ubicacionLon" value={punto?.lon ?? ""} />
      <input type="hidden" name="ubicacionPlanaX" value={planas?.x ?? ""} />
      <input type="hidden" name="ubicacionPlanaY" value={planas?.y ?? ""} />
    </div>
  );
}
