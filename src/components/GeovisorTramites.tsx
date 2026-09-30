"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Feature, FeatureCollection } from "geojson";
import { SlidersHorizontal, Layers, Ruler, PanelLeftClose, PanelLeftOpen, Undo2, Trash2, Download } from "lucide-react";
import { CENTRO_CDMB_POR_DEFECTO, MUNICIPIOS_JURISDICCION_CDMB } from "@/lib/municipios";
import { ESTADOS_EXPEDIENTE } from "@/lib/estados-expediente";

export type PuntoTramite = {
  id: string;
  numero: string;
  tramiteTipoId: string;
  tramiteNombre: string;
  tramiteCodigo: string;
  estado: string;
  municipio: string;
  solicitanteNombre: string;
  fechaRadicacion: string;
  lat: number;
  lon: number;
};

type TramiteOpcion = { id: string; nombre: string; codigo: string };
type Pestana = "filtrar" | "capas" | "medir";
type CapaContextoId = "areas" | "paramos" | "veredas" | "hidro" | "aicas" | "bosque_seco" | "subzonas";

const CAPAS_CONTEXTO: { id: CapaContextoId; etiqueta: string; fuente: string; archivo: string; color: string; soloContorno?: boolean }[] = [
  { id: "areas", etiqueta: "Áreas protegidas", fuente: "RUNAP", archivo: "/geo/areas_protegidas_cdmb.geojson", color: "#1E6B3E" },
  { id: "paramos", etiqueta: "Páramos delimitados", fuente: "MADS", archivo: "/geo/paramos_cdmb.geojson", color: "#5E35B1" },
  { id: "veredas", etiqueta: "Veredas", fuente: "DANE", archivo: "/geo/veredas_cdmb.geojson", color: "#8D6E63", soloContorno: true },
  { id: "hidro", etiqueta: "Hidrografía (ríos y cuerpos de agua)", fuente: "IDEAM", archivo: "/geo/hidrografia_cdmb.geojson", color: "#3D7EB8" },
  { id: "aicas", etiqueta: "Áreas de conservación de aves (AICA)", fuente: "Humboldt", archivo: "/geo/aicas_cdmb.geojson", color: "#00897B" },
  { id: "bosque_seco", etiqueta: "Bosque seco tropical", fuente: "MADS", archivo: "/geo/bosque_seco_cdmb.geojson", color: "#C17817" },
  { id: "subzonas", etiqueta: "Subzonas hidrográficas", fuente: "IDEAM", archivo: "/geo/subzonas_cdmb.geojson", color: "#1565C0", soloContorno: true },
];

type EstadoCapa = { on: boolean; cargando: boolean; datos: FeatureCollection | null };
const capaVacia = (): EstadoCapa => ({ on: false, cargando: false, datos: null });

const RADIO_TIERRA_M = 6_371_000;

function distanciaM(a: [number, number], b: [number, number]): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(h));
}

function areaM2(puntos: [number, number][]): number {
  if (puntos.length < 3) return 0;
  const lat0 = (puntos.reduce((a, p) => a + p[0], 0) / puntos.length) * (Math.PI / 180);
  const mPorGrado = 111_320;
  const x = (p: [number, number]) => p[1] * mPorGrado * Math.cos(lat0);
  const y = (p: [number, number]) => p[0] * mPorGrado;
  let s = 0;
  for (let i = 0; i < puntos.length; i++) {
    const a = puntos[i]!;
    const b = puntos[(i + 1) % puntos.length]!;
    s += x(a) * y(b) - x(b) * y(a);
  }
  return Math.abs(s) / 2;
}

function puntoEnPoligono(p: [number, number], poly: [number, number][]): boolean {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i]!;
    const [yj, xj] = poly[j]!;
    if (yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function fmtDist(m: number): string {
  return m < 1000 ? `${m.toFixed(0)} m` : `${(m / 1000).toFixed(2)} km`;
}

function fmtArea(m2: number): string {
  if (m2 < 10_000) return `${m2.toFixed(0)} m²`;
  const ha = m2 / 10_000;
  if (ha < 100) return `${ha.toFixed(1)} ha`;
  return `${(m2 / 1e6).toFixed(2)} km² (${ha.toFixed(0)} ha)`;
}

function descargarTexto(contenido: string, nombreArchivo: string, tipoMime: string) {
  const blob = new Blob([contenido], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

export function GeovisorTramites({ expedientes, tramites }: { expedientes: PuntoTramite[]; tramites: TramiteOpcion[] }) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const clusterRef = useRef<import("leaflet").MarkerClusterGroup | null>(null);
  const municipiosCapaRef = useRef<import("leaflet").GeoJSON | null>(null);
  const municipiosDatosRef = useRef<FeatureCollection | null>(null);
  const medicionCapaRef = useRef<import("leaflet").LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const capasContextoRef = useRef<Partial<Record<CapaContextoId, import("leaflet").GeoJSON>>>({});
  const modoMedirRef = useRef(false);

  const [panelAbierto, setPanelAbierto] = useState(true);
  const [pestana, setPestana] = useState<Pestana>("filtrar");

  const [capaTramites, setCapaTramites] = useState(true);
  const [capaMunicipios, setCapaMunicipios] = useState(true);
  const [capaEtiquetas, setCapaEtiquetas] = useState(true);
  const [capas, setCapas] = useState<Record<CapaContextoId, EstadoCapa>>({
    areas: capaVacia(),
    paramos: capaVacia(),
    veredas: capaVacia(),
    hidro: capaVacia(),
    aicas: capaVacia(),
    bosque_seco: capaVacia(),
    subzonas: capaVacia(),
  });

  const [busqueda, setBusqueda] = useState("");
  const [municipioSel, setMunicipioSel] = useState<string | null>(null);
  const [tramiteSel, setTramiteSel] = useState<string>("");
  const [estadosOcultos, setEstadosOcultos] = useState<Set<string>>(new Set());

  const [modoMedir, setModoMedir] = useState(false);
  const [medirArea, setMedirArea] = useState(true);
  const [medida, setMedida] = useState<[number, number][]>([]);

  useEffect(() => {
    modoMedirRef.current = modoMedir;
  }, [modoMedir]);

  const expedientesVisibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return expedientes.filter((e) => {
      if (municipioSel && e.municipio !== municipioSel) return false;
      if (tramiteSel && e.tramiteTipoId !== tramiteSel) return false;
      if (estadosOcultos.has(e.estado)) return false;
      if (q && !e.numero.toLowerCase().includes(q) && !e.solicitanteNombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [expedientes, municipioSel, tramiteSel, estadosOcultos, busqueda]);

  const conteoMunicipio = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expedientes) m.set(e.municipio, (m.get(e.municipio) ?? 0) + 1);
    return m;
  }, [expedientes]);

  const conteoEstado = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expedientesVisibles) m.set(e.estado, (m.get(e.estado) ?? 0) + 1);
    return m;
  }, [expedientesVisibles]);

  const hayFiltro = Boolean(municipioSel || tramiteSel || estadosOcultos.size > 0 || busqueda.trim());

  const tramitesEnZona = useMemo(() => {
    if (medida.length < 3) return [];
    return expedientesVisibles.filter((e) => puntoEnPoligono([e.lat, e.lon], medida));
  }, [expedientesVisibles, medida]);

  const distanciaLinea = useMemo(() => {
    let t = 0;
    for (let i = 0; i < medida.length - 1; i++) t += distanciaM(medida[i]!, medida[i + 1]!);
    return t;
  }, [medida]);
  const perimetro = medida.length >= 3 ? distanciaLinea + distanciaM(medida[medida.length - 1]!, medida[0]!) : distanciaLinea;
  const area = useMemo(() => areaM2(medida), [medida]);

  // --- inicialización del mapa (una sola vez) ---
  useEffect(() => {
    let cancelado = false;
    import("leaflet").then(async (L) => {
      (window as unknown as { L: typeof L }).L = L;
      await import("leaflet.markercluster");
      if (cancelado || !contenedorRef.current || mapRef.current) return;
      leafletRef.current = L;

      const map = L.map(contenedorRef.current, { fadeAnimation: false }).setView(CENTRO_CDMB_POR_DEFECTO, 10);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const cluster = L.markerClusterGroup({ maxClusterRadius: 50 });
      map.addLayer(cluster);
      clusterRef.current = cluster;

      const medicion = L.layerGroup().addTo(map);
      medicionCapaRef.current = medicion;

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        if (!modoMedirRef.current) return;
        setMedida((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
      });

      mapRef.current = map;

      fetch("/geo/municipios_cdmb.geojson")
        .then((r) => r.json())
        .then((geojson: FeatureCollection) => {
          if (cancelado || !mapRef.current) return;
          municipiosDatosRef.current = geojson;
          const capa = L.geoJSON(geojson, {
            style: { color: "#166534", weight: 1.4, fillColor: "#166534", fillOpacity: 0.04 },
            onEachFeature: (feature, layer) => {
              const nombre = feature.properties?.nombre;
              if (nombre) layer.bindTooltip(nombre, { sticky: true, className: "text-xs" });
            },
          });
          municipiosCapaRef.current = capa;
          capa.addTo(mapRef.current);
        })
        .catch(() => {});
    });
    return () => {
      cancelado = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // --- capa de trámites: se repuebla cuando cambia el filtro visible ---
  useEffect(() => {
    const L = leafletRef.current;
    const cluster = clusterRef.current;
    if (!L || !cluster) return;
    cluster.clearLayers();
    for (const p of expedientesVisibles) {
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
  }, [expedientesVisibles]);

  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    if (capaTramites) map.addLayer(cluster);
    else map.removeLayer(cluster);
  }, [capaTramites]);

  useEffect(() => {
    const map = mapRef.current;
    const capa = municipiosCapaRef.current;
    if (!map || !capa) return;
    if (capaMunicipios) capa.addTo(map);
    else map.removeLayer(capa);
  }, [capaMunicipios]);

  useEffect(() => {
    const capa = municipiosCapaRef.current;
    if (!capa) return;
    capa.eachLayer((layer) => {
      const conTooltip = layer as import("leaflet").Layer & { getTooltip?: () => import("leaflet").Tooltip | undefined };
      const tt = conTooltip.getTooltip?.();
      if (tt) tt.getElement()?.style.setProperty("display", capaEtiquetas ? "" : "none");
    });
  }, [capaEtiquetas]);

  // --- capas de contexto: se cargan (una vez) al encenderlas ---
  function alternarCapaContexto(id: CapaContextoId, on: boolean) {
    setCapas((prev) => ({ ...prev, [id]: { ...prev[id], on } }));
    const actual = capas[id];
    if (on && !actual.datos && !actual.cargando) {
      setCapas((prev) => ({ ...prev, [id]: { ...prev[id], cargando: true } }));
      const cfg = CAPAS_CONTEXTO.find((c) => c.id === id)!;
      fetch(cfg.archivo)
        .then((r) => r.json())
        .then((datos: FeatureCollection) => {
          setCapas((prev) => ({ ...prev, [id]: { on: true, cargando: false, datos } }));
        })
        .catch(() => {
          setCapas((prev) => ({ ...prev, [id]: { ...prev[id], cargando: false } }));
        });
    }
  }

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    for (const cfg of CAPAS_CONTEXTO) {
      const estado = capas[cfg.id];
      const existente = capasContextoRef.current[cfg.id];
      if (estado.on && estado.datos && !existente) {
        const capa = L.geoJSON(estado.datos, {
          style: (feature?: Feature) => estiloCapaContexto(cfg, feature),
          onEachFeature: (feature, layer) => {
            const nombre = feature.properties?.nombre;
            if (nombre) layer.bindTooltip(nombre, { sticky: true, className: "text-xs" });
          },
        });
        capa.addTo(map);
        capasContextoRef.current[cfg.id] = capa;
      } else if (!estado.on && existente) {
        map.removeLayer(existente);
        delete capasContextoRef.current[cfg.id];
      } else if (estado.on && existente && !map.hasLayer(existente)) {
        existente.addTo(map);
      }
    }
  }, [capas]);

  // --- herramienta de medición ---
  useEffect(() => {
    const L = leafletRef.current;
    const capa = medicionCapaRef.current;
    if (!L || !capa) return;
    capa.clearLayers();
    if (medida.length === 0) return;
    const cerrar = medirArea && medida.length >= 3;
    L.polyline(cerrar ? [...medida, medida[0]!] : medida, { color: "#b45309", weight: 2 }).addTo(capa);
    if (cerrar) {
      L.polygon(medida, { color: "#b45309", weight: 2, fillColor: "#b45309", fillOpacity: 0.12 }).addTo(capa);
    }
    for (const p of medida) {
      L.circleMarker(p, { radius: 5, color: "#b45309", weight: 3, fillColor: "#fff", fillOpacity: 1 }).addTo(capa);
    }
  }, [medida, medirArea]);

  function activarMedir(v: boolean) {
    setModoMedir(v);
    if (!v) setMedida([]);
  }

  function zoomAMunicipio(nombre: string) {
    const L = leafletRef.current;
    const map = mapRef.current;
    const datos = municipiosDatosRef.current;
    if (!L || !map || !datos) return;
    const feature = datos.features.find((f) => f.properties?.nombre === nombre);
    if (!feature) return;
    const bounds = L.geoJSON(feature).getBounds();
    map.fitBounds(bounds, { padding: [24, 24] });
  }

  function seleccionarMunicipio(nombre: string) {
    setMunicipioSel((actual) => (actual === nombre ? null : nombre));
    if (municipioSel !== nombre) zoomAMunicipio(nombre);
  }

  function descargarZona() {
    const geojson: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { tipo: "zona-medida", area_m2: Math.round(area), perimetro_m: Math.round(perimetro), tramites_dentro: tramitesEnZona.length },
          geometry: { type: "Polygon", coordinates: [[...medida, medida[0]!].map(([lat, lon]) => [lon, lat])] },
        },
        ...tramitesEnZona.map((t) => ({
          type: "Feature" as const,
          properties: { numero: t.numero, tramite: t.tramiteNombre, solicitante: t.solicitanteNombre, estado: t.estado, municipio: t.municipio },
          geometry: { type: "Point" as const, coordinates: [t.lon, t.lat] },
        })),
      ],
    };
    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, "0")}${String(hoy.getDate()).padStart(2, "0")}`;
    descargarTexto(JSON.stringify(geojson, null, 2), `zona_tramites_${fecha}.geojson`, "application/geo+json;charset=utf-8");
  }

  function verTodo() {
    setMunicipioSel(null);
    setTramiteSel("");
    setEstadosOcultos(new Set());
    setBusqueda("");
  }

  const anchoPanel = panelAbierto ? "w-full max-w-xs shrink-0 sm:w-80" : "w-0";

  return (
    <div className="flex h-[700px] w-full overflow-hidden rounded-xl border border-stone-200 shadow-soft">
      <div className={`overflow-hidden border-stone-200 bg-white transition-[width] ${panelAbierto ? "border-r" : ""} ${anchoPanel}`}>
        <div className="flex h-full w-80 max-w-xs flex-col sm:w-80">
          <div className="flex items-center gap-2 border-b border-stone-100 px-3 py-2.5">
            <Layers className="h-4 w-4 text-cdmb-600" aria-hidden />
            <h3 className="flex-1 text-sm font-semibold text-stone-900">Visor de trámites</h3>
          </div>
          <div className="flex gap-1 border-b border-stone-100 p-2">
            <BotonPestana activa={pestana === "filtrar"} onClick={() => setPestana("filtrar")} icon={<SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />} label="Filtrar" />
            <BotonPestana activa={pestana === "capas"} onClick={() => setPestana("capas")} icon={<Layers className="h-3.5 w-3.5" aria-hidden />} label="Capas" />
            <BotonPestana activa={pestana === "medir"} onClick={() => setPestana("medir")} icon={<Ruler className="h-3.5 w-3.5" aria-hidden />} label="Medir" />
          </div>
          <div className="flex-1 overflow-y-auto p-3 text-sm">
            {pestana === "filtrar" && (
              <PanelFiltrar
                busqueda={busqueda}
                onBusqueda={setBusqueda}
                hayFiltro={hayFiltro}
                onVerTodo={verTodo}
                tramites={tramites}
                tramiteSel={tramiteSel}
                onTramiteSel={setTramiteSel}
                municipioSel={municipioSel}
                onMunicipioSel={seleccionarMunicipio}
                conteoMunicipio={conteoMunicipio}
                estadosOcultos={estadosOcultos}
                onToggleEstado={(e) =>
                  setEstadosOcultos((prev) => {
                    const next = new Set(prev);
                    if (next.has(e)) next.delete(e);
                    else next.add(e);
                    return next;
                  })
                }
                conteoEstado={conteoEstado}
              />
            )}
            {pestana === "capas" && (
              <PanelCapas
                capaTramites={capaTramites}
                onCapaTramites={setCapaTramites}
                totalTramites={expedientesVisibles.length}
                capaMunicipios={capaMunicipios}
                onCapaMunicipios={setCapaMunicipios}
                capaEtiquetas={capaEtiquetas}
                onCapaEtiquetas={setCapaEtiquetas}
                capas={capas}
                onToggleCapa={alternarCapaContexto}
              />
            )}
            {pestana === "medir" && (
              <PanelMedir
                modoMedir={modoMedir}
                onModoMedir={activarMedir}
                medirArea={medirArea}
                onMedirArea={setMedirArea}
                medida={medida}
                onQuitarPunto={() => setMedida((prev) => prev.slice(0, -1))}
                onLimpiar={() => setMedida([])}
                distanciaLinea={distanciaLinea}
                perimetro={perimetro}
                area={area}
                tramitesEnZona={tramitesEnZona}
                onDescargarZona={descargarZona}
              />
            )}
          </div>
        </div>
      </div>

      <div className="relative flex-1">
        <div ref={contenedorRef} className="h-full w-full" />
        <button
          type="button"
          onClick={() => setPanelAbierto((v) => !v)}
          title={panelAbierto ? "Ocultar panel" : "Mostrar panel"}
          className="absolute left-3 top-3 z-[550] flex h-9 w-9 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-700 shadow-sm hover:bg-stone-50"
        >
          {panelAbierto ? <PanelLeftClose className="h-4 w-4" aria-hidden /> : <PanelLeftOpen className="h-4 w-4" aria-hidden />}
        </button>
        {expedientesVisibles.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[550] flex justify-center">
            <p className="rounded-full bg-white px-3 py-1 text-xs text-stone-500 shadow">
              {expedientes.length === 0 ? "Ningún trámite con este filtro tiene ubicación registrada." : "Ningún trámite coincide con el filtro actual."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function estiloCapaContexto(cfg: (typeof CAPAS_CONTEXTO)[number], feature?: Feature): import("leaflet").PathOptions {
  if (cfg.id === "areas") {
    const cdmb = feature?.properties?.administra === "CDMB";
    const color = cdmb ? "#1E6B3E" : "#556B2F";
    return { color, weight: 1.2, fillColor: color, fillOpacity: 0.16 };
  }
  if (cfg.id === "hidro") {
    const esRio = feature?.properties?.tipo === "río";
    const esLinea = feature?.geometry?.type === "LineString" || feature?.geometry?.type === "MultiLineString";
    return { color: "#2E6DA4", weight: esLinea ? 1.5 : 0.6, fillColor: "#3D7EB8", fillOpacity: esLinea ? 0 : esRio ? 0.75 : 0.5 };
  }
  if (cfg.soloContorno) return { color: cfg.color, weight: 1.4, fillOpacity: 0 };
  return { color: cfg.color, weight: 1.1, fillColor: cfg.color, fillOpacity: 0.14 };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function BotonPestana({ activa, onClick, icon, label }: { activa: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
        activa ? "bg-cdmb-600 text-white" : "text-stone-500 hover:bg-stone-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function PanelFiltrar({
  busqueda,
  onBusqueda,
  hayFiltro,
  onVerTodo,
  tramites,
  tramiteSel,
  onTramiteSel,
  municipioSel,
  onMunicipioSel,
  conteoMunicipio,
  estadosOcultos,
  onToggleEstado,
  conteoEstado,
}: {
  busqueda: string;
  onBusqueda: (v: string) => void;
  hayFiltro: boolean;
  onVerTodo: () => void;
  tramites: TramiteOpcion[];
  tramiteSel: string;
  onTramiteSel: (v: string) => void;
  municipioSel: string | null;
  onMunicipioSel: (nombre: string) => void;
  conteoMunicipio: Map<string, number>;
  estadosOcultos: Set<string>;
  onToggleEstado: (estado: string) => void;
  conteoEstado: Map<string, number>;
}) {
  return (
    <div className="space-y-3">
      <input
        value={busqueda}
        onChange={(e) => onBusqueda(e.target.value)}
        placeholder="Buscar por número o solicitante…"
        className="w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-sm"
      />
      <select value={tramiteSel} onChange={(e) => onTramiteSel(e.target.value)} className="w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-sm">
        <option value="">Todos los trámites</option>
        {tramites.map((t) => (
          <option key={t.id} value={t.id}>
            {t.codigo} — {t.nombre}
          </option>
        ))}
      </select>
      {hayFiltro && (
        <button type="button" onClick={onVerTodo} className="w-full rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
          Ver todo (quitar filtros)
        </button>
      )}

      <div className="border-t border-stone-100 pt-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">Por municipio</p>
        <ul className="space-y-0.5">
          {MUNICIPIOS_JURISDICCION_CDMB.map((m) => (
            <li key={m}>
              <button
                type="button"
                onClick={() => onMunicipioSel(m)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs ${
                  municipioSel === m ? "bg-cdmb-50 font-medium text-cdmb-800" : "text-stone-600 hover:bg-stone-50"
                }`}
              >
                <span>{m}</span>
                <span className="text-stone-400">{conteoMunicipio.get(m) ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-stone-100 pt-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">Por estado</p>
        <ul className="space-y-1">
          {ESTADOS_EXPEDIENTE.map((e) => (
            <li key={e}>
              <label className="flex items-center justify-between gap-2 text-xs text-stone-600">
                <span className="flex items-center gap-1.5">
                  <input type="checkbox" checked={!estadosOcultos.has(e)} onChange={() => onToggleEstado(e)} />
                  {e.replaceAll("_", " ")}
                </span>
                <span className="text-stone-400">{conteoEstado.get(e) ?? 0}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PanelCapas({
  capaTramites,
  onCapaTramites,
  totalTramites,
  capaMunicipios,
  onCapaMunicipios,
  capaEtiquetas,
  onCapaEtiquetas,
  capas,
  onToggleCapa,
}: {
  capaTramites: boolean;
  onCapaTramites: (v: boolean) => void;
  totalTramites: number;
  capaMunicipios: boolean;
  onCapaMunicipios: (v: boolean) => void;
  capaEtiquetas: boolean;
  onCapaEtiquetas: (v: boolean) => void;
  capas: Record<CapaContextoId, EstadoCapa>;
  onToggleCapa: (id: CapaContextoId, on: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" checked={capaTramites} onChange={(e) => onCapaTramites(e.target.checked)} />
        Trámites ({totalTramites})
      </label>
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" checked={capaMunicipios} onChange={(e) => onCapaMunicipios(e.target.checked)} />
        Límites municipales
      </label>
      {capaMunicipios && (
        <label className="ml-6 flex items-center gap-2 text-xs text-stone-500">
          <input type="checkbox" checked={capaEtiquetas} onChange={(e) => onCapaEtiquetas(e.target.checked)} />
          Etiquetas de municipio
        </label>
      )}

      <div className="border-t border-stone-100 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Capas de contexto</p>
        <p className="mb-2 mt-0.5 text-[11px] text-stone-400">Cada capa viene de la entidad externa que la produce (entre paréntesis) y se carga al encenderla.</p>
        <ul className="space-y-2">
          {CAPAS_CONTEXTO.map((cfg) => {
            const estado = capas[cfg.id];
            return (
              <li key={cfg.id}>
                <label className="flex items-center gap-2 text-xs text-stone-600">
                  <input type="checkbox" checked={estado.on} onChange={(e) => onToggleCapa(cfg.id, e.target.checked)} />
                  <span>
                    {cfg.etiqueta} <span className="text-stone-400">({cfg.fuente})</span>
                  </span>
                  {estado.cargando && <span className="h-3 w-3 flex-none animate-spin rounded-full border-2 border-cdmb-500 border-t-transparent" />}
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-stone-100 pt-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">Leyenda</p>
        <ul className="space-y-1 text-[11px] text-stone-600">
          <FilaLeyenda color="#166534" texto="Municipio" />
          <FilaLeyenda color="#1E6B3E" texto="Área protegida administrada por CDMB" />
          <FilaLeyenda color="#556B2F" texto="Área protegida de otra entidad" />
          <FilaLeyenda color="#5E35B1" texto="Páramo delimitado (MADS)" />
          <FilaLeyenda color="#8D6E63" texto="Vereda (DANE)" />
          <FilaLeyenda color="#3D7EB8" texto="Ríos y cuerpos de agua" />
          <FilaLeyenda color="#00897B" texto="Área de conservación de aves (AICA)" />
          <FilaLeyenda color="#C17817" texto="Bosque seco tropical" />
          <FilaLeyenda color="#1565C0" texto="Subzonas hidrográficas" />
        </ul>
      </div>
    </div>
  );
}

function FilaLeyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="h-3 w-4 flex-none rounded-sm border" style={{ backgroundColor: `${color}33`, borderColor: color }} />
      {texto}
    </li>
  );
}

function PanelMedir({
  modoMedir,
  onModoMedir,
  medirArea,
  onMedirArea,
  medida,
  onQuitarPunto,
  onLimpiar,
  distanciaLinea,
  perimetro,
  area,
  tramitesEnZona,
  onDescargarZona,
}: {
  modoMedir: boolean;
  onModoMedir: (v: boolean) => void;
  medirArea: boolean;
  onMedirArea: (v: boolean) => void;
  medida: [number, number][];
  onQuitarPunto: () => void;
  onLimpiar: () => void;
  distanciaLinea: number;
  perimetro: number;
  area: number;
  tramitesEnZona: PuntoTramite[];
  onDescargarZona: () => void;
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
        <input type="checkbox" checked={modoMedir} onChange={(e) => onModoMedir(e.target.checked)} />
        Medir / seleccionar una zona
      </label>

      {modoMedir && (
        <>
          <div className="flex rounded-md border border-stone-200 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => onMedirArea(false)}
              className={`flex-1 rounded px-2 py-1 ${!medirArea ? "bg-cdmb-600 text-white" : "text-stone-600"}`}
            >
              Distancia
            </button>
            <button
              type="button"
              onClick={() => onMedirArea(true)}
              className={`flex-1 rounded px-2 py-1 ${medirArea ? "bg-cdmb-600 text-white" : "text-stone-600"}`}
            >
              Zona / área
            </button>
          </div>
          <p className="text-[11px] text-stone-400">
            {medirArea
              ? "Haga clic en el mapa para marcar puntos. Con 3 o más se cierra la zona y se puede descargar."
              : "Haga clic en el mapa para marcar el recorrido a medir."}
          </p>

          {medida.length >= 2 && (
            <p className="text-xs font-semibold text-stone-700">
              {!medirArea || medida.length < 3 ? (
                <>Distancia total: {fmtDist(distanciaLinea)}</>
              ) : (
                <>
                  Perímetro: {fmtDist(perimetro)}
                  <br />
                  Área: {fmtArea(area)}
                  <br />
                  Trámites dentro: {tramitesEnZona.length}
                </>
              )}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onQuitarPunto}
              disabled={medida.length === 0}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-stone-200 px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden />
              Quitar punto
            </button>
            <button
              type="button"
              onClick={onLimpiar}
              disabled={medida.length === 0}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-stone-200 px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Limpiar
            </button>
          </div>

          {medida.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-400">Puntos (lat, lon)</p>
              <ul className="max-h-28 space-y-0.5 overflow-y-auto text-[11px] text-stone-500">
                {medida.map((p, i) => (
                  <li key={i}>
                    {i + 1}. {p[0].toFixed(6)}, {p[1].toFixed(6)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {medirArea && medida.length >= 3 && (
            <>
              {tramitesEnZona.length > 0 && (
                <ul className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-stone-100 bg-stone-50/60 p-2 text-[11px]">
                  {tramitesEnZona.map((t) => (
                    <li key={t.id}>
                      <a href={`/expedientes/${t.id}`} className="font-mono text-cdmb-700 hover:underline">
                        {t.numero}
                      </a>{" "}
                      — {t.tramiteCodigo}
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={onDescargarZona}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Descargar zona (GeoJSON)
              </button>
              <p className="text-[10.5px] text-stone-400">El GeoJSON incluye la zona y los trámites de adentro; se abre en QGIS, ArcGIS o Google Earth.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
