"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { CENTROIDE_MUNICIPIO, CENTRO_CDMB_POR_DEFECTO, type MunicipioCdmb } from "@/lib/municipios";
import {
  desdeLatLon,
  desdePlanas,
  desdeCartesianas,
  esLatLonValido,
  esPlanaColombiaAprox,
  esCartesianaValida,
  type CoordenadasCompletas,
} from "@/lib/coordenadas";

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

  const [modo, setModo] = useState<"elipsoidales" | "planas" | "cartesianas">("elipsoidales");
  const [latTexto, setLatTexto] = useState("");
  const [lonTexto, setLonTexto] = useState("");
  const [planaXTexto, setPlanaXTexto] = useState("");
  const [planaYTexto, setPlanaYTexto] = useState("");
  const [cartXTexto, setCartXTexto] = useState("");
  const [cartYTexto, setCartYTexto] = useState("");
  const [cartZTexto, setCartZTexto] = useState("");
  const [errorCoords, setErrorCoords] = useState<string | null>(null);

  const centroide = CENTROIDE_MUNICIPIO[municipio as MunicipioCdmb] ?? CENTRO_CDMB_POR_DEFECTO;

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

  useEffect(() => {
    if (!punto && mapRef.current) {
      mapRef.current.setView(centroide, 13);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipio]);

  function sincronizarCampos(c: CoordenadasCompletas) {
    setLatTexto(c.lat.toFixed(6));
    setLonTexto(c.lon.toFixed(6));
    setPlanaXTexto(c.planaX.toFixed(2));
    setPlanaYTexto(c.planaY.toFixed(2));
    setCartXTexto(c.cartesianaX.toFixed(2));
    setCartYTexto(c.cartesianaY.toFixed(2));
    setCartZTexto(c.cartesianaZ.toFixed(2));
  }

  function colocarPunto(lat: number, lon: number) {
    setPunto({ lat, lon });
    sincronizarCampos(desdeLatLon(lat, lon));
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
    setPlanaXTexto("");
    setPlanaYTexto("");
    setCartXTexto("");
    setCartYTexto("");
    setCartZTexto("");
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
      setErrorBusqueda(err instanceof Error ? err.message : "No se pudo buscar — márcala tocando el mapa.");
    } finally {
      setBuscando(false);
    }
  }

  function usarElipsoidales() {
    const lat = parseFloat(latTexto.replace(",", "."));
    const lon = parseFloat(lonTexto.replace(",", "."));
    if (!esLatLonValido(lat, lon)) {
      setErrorCoords("Escribe latitud y longitud válidas (ej. 7.119300 y -73.122700).");
      return;
    }
    setErrorCoords(null);
    colocarPunto(lat, lon);
  }

  function usarPlanas() {
    const x = parseFloat(planaXTexto.replace(",", "."));
    const y = parseFloat(planaYTexto.replace(",", "."));
    if (!esPlanaColombiaAprox(x, y)) {
      setErrorCoords("Esas coordenadas planas no parecen estar dentro de Colombia — revisa que X e Y no estén invertidas.");
      return;
    }
    setErrorCoords(null);
    const c = desdePlanas(x, y);
    colocarPunto(c.lat, c.lon);
  }

  function usarCartesianas() {
    const x = parseFloat(cartXTexto.replace(",", "."));
    const y = parseFloat(cartYTexto.replace(",", "."));
    const z = parseFloat(cartZTexto.replace(",", "."));
    if (!esCartesianaValida(x, y, z)) {
      setErrorCoords("Escribe las tres coordenadas cartesianas (X, Y, Z) en metros.");
      return;
    }
    setErrorCoords(null);
    const c = desdeCartesianas(x, y, z);
    colocarPunto(c.lat, c.lon);
  }

  const planas = punto ? desdeLatLon(punto.lat, punto.lon) : null;

  const tabClase = (activa: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-medium ${activa ? "bg-cdmb-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="Buscar una dirección (ej. Carrera 27 # 15-20)"
          className="min-w-[200px] flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        />
        <button
          type="button"
          onClick={buscarDireccion}
          disabled={buscando}
          className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
        >
          {buscando ? "Buscando…" : "Buscar en el mapa"}
        </button>
      </div>
      {errorBusqueda && <p className="text-xs text-red-600">{errorBusqueda}</p>}

      <p className="text-xs text-stone-500">
        O toca directamente el punto exacto en el mapa. Si tienes las coordenadas de otra fuente (GPS,
        levantamiento topográfico, plano), pégalas abajo — acepta las tres formas en que puedan venir,
        no hace falta convertirlas antes.
      </p>

      <div className="flex gap-1.5">
        <button type="button" className={tabClase(modo === "elipsoidales")} onClick={() => setModo("elipsoidales")}>
          Latitud/Longitud
        </button>
        <button type="button" className={tabClase(modo === "planas")} onClick={() => setModo("planas")}>
          Coordenadas planas
        </button>
        <button type="button" className={tabClase(modo === "cartesianas")} onClick={() => setModo("cartesianas")}>
          Cartesianas (ECEF)
        </button>
      </div>

      {modo === "elipsoidales" && (
        <div className="flex flex-wrap items-end gap-2">
          <TextoCoord label="Latitud" placeholder="ej. 7.119300" value={latTexto} onChange={setLatTexto} />
          <TextoCoord label="Longitud" placeholder="ej. -73.122700" value={lonTexto} onChange={setLonTexto} />
          <BotonUsar onClick={usarElipsoidales} />
        </div>
      )}
      {modo === "planas" && (
        <div className="flex flex-wrap items-end gap-2">
          <TextoCoord label="X (planas)" placeholder="ej. 4986456.54" value={planaXTexto} onChange={setPlanaXTexto} />
          <TextoCoord label="Y (planas)" placeholder="ej. 2344673.53" value={planaYTexto} onChange={setPlanaYTexto} />
          <BotonUsar onClick={usarPlanas} />
          <span className="text-xs text-stone-400">MAGNA-SIRGAS Origen-Nacional (EPSG:9377), en metros.</span>
        </div>
      )}
      {modo === "cartesianas" && (
        <div className="flex flex-wrap items-end gap-2">
          <TextoCoord label="X" placeholder="ej. 1837814.89" value={cartXTexto} onChange={setCartXTexto} />
          <TextoCoord label="Y" placeholder="ej. -6057588.37" value={cartYTexto} onChange={setCartYTexto} />
          <TextoCoord label="Z" placeholder="ej. 785346.56" value={cartZTexto} onChange={setCartZTexto} />
          <BotonUsar onClick={usarCartesianas} />
          <span className="text-xs text-stone-400">Geocéntricas (ECEF), en metros.</span>
        </div>
      )}
      {punto && (
        <button type="button" onClick={quitarPunto} className="text-xs text-stone-400 hover:text-red-600">
          Quitar punto
        </button>
      )}
      {errorCoords && <p className="text-xs text-red-600">{errorCoords}</p>}

      <div ref={contenedorRef} className="h-64 w-full overflow-hidden rounded-lg border border-stone-200" />

      {punto && planas && (
        <div className="space-y-0.5 rounded-md bg-stone-50 px-3 py-2 text-xs text-stone-600">
          <p>
            <span className="font-medium">Elipsoidales (lat/lon, WGS84):</span> {planas.lat.toFixed(6)},{" "}
            {planas.lon.toFixed(6)}
          </p>
          <p>
            <span className="font-medium">Planas (MAGNA-SIRGAS Origen-Nacional):</span> X{" "}
            {planas.planaX.toLocaleString("es-CO")} m, Y {planas.planaY.toLocaleString("es-CO")} m
          </p>
          <p>
            <span className="font-medium">Cartesianas (ECEF):</span> X {planas.cartesianaX.toLocaleString("es-CO")} m,
            Y {planas.cartesianaY.toLocaleString("es-CO")} m, Z {planas.cartesianaZ.toLocaleString("es-CO")} m
          </p>
        </div>
      )}

      <input type="hidden" name="ubicacionLat" value={punto?.lat ?? ""} />
      <input type="hidden" name="ubicacionLon" value={punto?.lon ?? ""} />
    </div>
  );
}

function TextoCoord({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-stone-600">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-36 rounded-md border border-stone-300 px-2 py-1.5 text-sm"
      />
    </div>
  );
}

function BotonUsar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
      Usar
    </button>
  );
}
