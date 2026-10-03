"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Feature, FeatureCollection } from "geojson";
import {
  SlidersHorizontal,
  Layers,
  Ruler,
  PanelLeftClose,
  PanelLeftOpen,
  Undo2,
  Trash2,
  Download,
  X,
  LocateFixed,
  Camera,
  HelpCircle,
  ExternalLink,
  Loader2,
  Link2,
  FileText,
} from "lucide-react";
import { CENTRO_CDMB_POR_DEFECTO, MUNICIPIOS_JURISDICCION_CDMB } from "@/lib/municipios";
import { ESTADOS_EXPEDIENTE } from "@/lib/estados-expediente";
import { estiloEstado, svgIconoEstado, svgPinEstado } from "@/lib/estados-expediente-estilo";
import { normalizar } from "@/lib/cargos";
import { csvTramites, geoJsonTramites, htmlReporte, parseZonaParam, zonaAParam, type CapaContextoReporte } from "@/lib/geovisor-exportar";

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

export type PuntoSinca = {
  nroSolicitud: number;
  numeroResolucion: string | null;
  tipo: string | null;
  municipio: string | null;
  estado: string | null;
  fecha: string | null;
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

type ElementoAgrupado = { nombre: string; features: Feature[]; props: Record<string, unknown> };

// Varias features pueden compartir nombre (p. ej. tramos del mismo río) — se agrupan en
// una sola fila de la lista, que al hacer zoom encuadra todas sus partes. Las features
// sin nombre (comunes en hidrografía) se excluyen de la lista aunque sigan en el mapa.
function agruparPorNombre(features: Feature[]): ElementoAgrupado[] {
  const grupos = new Map<string, Feature[]>();
  for (const f of features) {
    const nombre = (f.properties?.nombre as string | undefined)?.trim();
    if (!nombre) continue;
    const lista = grupos.get(nombre) ?? [];
    lista.push(f);
    grupos.set(nombre, lista);
  }
  return Array.from(grupos.entries())
    .map(([nombre, fs]) => ({ nombre, features: fs, props: fs[0]!.properties ?? {} }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function agruparVeredasPorMunicipio(features: Feature[]): [string, ElementoAgrupado[]][] {
  const porMunicipio = new Map<string, Feature[]>();
  for (const f of features) {
    const m = (f.properties?.municipio as string | undefined) ?? "(sin municipio)";
    const lista = porMunicipio.get(m) ?? [];
    lista.push(f);
    porMunicipio.set(m, lista);
  }
  return Array.from(porMunicipio.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "es"))
    .map(([m, fs]) => [m, agruparPorNombre(fs)]);
}

function subtituloElemento(props: Record<string, unknown>): string {
  const partes: string[] = [];
  if (typeof props.tipo === "string" && props.tipo) partes.push(props.tipo);
  if (typeof props.administra === "string" && props.administra) partes.push(props.administra);
  const hectareas = Number(props.hectareas);
  if (hectareas > 0) partes.push(`${props.hectareas} ha`);
  else if (typeof props.codigo === "string" && props.codigo) partes.push(props.codigo);
  return partes.join(" · ");
}

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

function circuloComoPoligono(centro: [number, number], radioM: number): [number, number][] {
  const n = 40;
  const latR = radioM / 111_320;
  const lonR = radioM / (111_320 * Math.cos((centro[0] * Math.PI) / 180));
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const ang = (2 * Math.PI * i) / n;
    out.push([centro[0] + latR * Math.sin(ang), centro[1] + lonR * Math.cos(ang)]);
  }
  return out;
}

// Anillos (lat,lon) de un Polygon/MultiPolygon — para probar si un vértice de
// la zona cae DENTRO de una capa de contexto (el caso típico: la zona medida
// es pequeña y queda adentro de un área protegida o un municipio mucho más
// grandes, así que ningún vértice de ESE polígono cae dentro de la zona).
function anillosDeGeometria(geom: Feature["geometry"]): [number, number][][] {
  if (!geom) return [];
  if (geom.type === "Polygon") return geom.coordinates.map((anillo) => anillo.map(([lon, lat]) => [lat, lon] as [number, number]));
  if (geom.type === "MultiPolygon") return geom.coordinates.flatMap((poli) => poli.map((anillo) => anillo.map(([lon, lat]) => [lat, lon] as [number, number])));
  return [];
}

function puntosDeGeometria(geom: Feature["geometry"]): [number, number][] {
  if (!geom) return [];
  if (geom.type === "Point") return [[geom.coordinates[1]!, geom.coordinates[0]!]];
  if (geom.type === "MultiPoint" || geom.type === "LineString") return geom.coordinates.map(([lon, lat]) => [lat!, lon!]);
  if (geom.type === "MultiLineString") return geom.coordinates.flat().map(([lon, lat]) => [lat!, lon!]);
  return anillosDeGeometria(geom).flat();
}

// "Toca" = algún punto de la capa cae dentro de la zona, o algún vértice de
// la zona cae dentro de uno de los anillos de la capa — sin esto último, una
// zona chica adentro de un polígono grande no se detectaría nunca.
function featureTocaPoligono(f: Feature, zona: [number, number][]): boolean {
  if (puntosDeGeometria(f.geometry).some((p) => puntoEnPoligono(p, zona))) return true;
  return anillosDeGeometria(f.geometry).some((anillo) => zona.some((p) => puntoEnPoligono(p, anillo)));
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

export function GeovisorTramites({
  expedientes,
  tramites,
  puntosSinca = [],
}: {
  expedientes: PuntoTramite[];
  tramites: TramiteOpcion[];
  puntosSinca?: PuntoSinca[];
}) {
  const searchParams = useSearchParams();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const puntoSincaInicial = useMemo(() => Number(searchParams.get("punto")) || null, []);
  const sincaCapaRef = useRef<import("leaflet").LayerGroup | null>(null);
  const [mapaListo, setMapaListo] = useState(false);
  const [capaSinca, setCapaSinca] = useState(() => searchParams.get("capa") === "sinca" && puntosSinca.length > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- solo se usa una vez, al montar (inicializador de useState)
  const zonaInicial = useMemo(() => parseZonaParam(searchParams.get("zona")), []);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const clusterRef = useRef<import("leaflet").MarkerClusterGroup | null>(null);
  const municipiosCapaRef = useRef<import("leaflet").GeoJSON | null>(null);
  const municipiosDatosRef = useRef<FeatureCollection | null>(null);
  const medicionCapaRef = useRef<import("leaflet").LayerGroup | null>(null);
  const miUbicacionCapaRef = useRef<import("leaflet").LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const capasContextoRef = useRef<Partial<Record<CapaContextoId, import("leaflet").GeoJSON>>>({});
  const modoRef = useRef<"medir" | "cerca" | null>(null);

  const [panelAbierto, setPanelAbierto] = useState(true);
  const [pestana, setPestana] = useState<Pestana>(zonaInicial.length >= 3 ? "medir" : "filtrar");
  const [zoomActual, setZoomActual] = useState(10);
  const [mensajeMapa, setMensajeMapa] = useState<string | null>(null);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);
  const [descargandoImagen, setDescargandoImagen] = useState(false);
  const [miUbicacion, setMiUbicacion] = useState<[number, number] | null>(null);

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

  const [modoMedir, setModoMedir] = useState(zonaInicial.length >= 3);
  const [medirArea, setMedirArea] = useState(true);
  const [medida, setMedida] = useState<[number, number][]>(zonaInicial);

  const [modoCerca, setModoCerca] = useState(false);
  const [puntoCerca, setPuntoCerca] = useState<[number, number] | null>(null);
  const [radioCerca, setRadioCerca] = useState(1000);

  useEffect(() => {
    modoRef.current = modoMedir ? "medir" : modoCerca ? "cerca" : null;
  }, [modoMedir, modoCerca]);

  function mostrarMensaje(texto: string) {
    setMensajeMapa(texto);
    setTimeout(() => setMensajeMapa((actual) => (actual === texto ? null : actual)), 4000);
  }

  const expedientesVisibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return expedientes.filter((e) => {
      if (municipioSel && e.municipio !== municipioSel) return false;
      if (tramiteSel && e.tramiteTipoId !== tramiteSel) return false;
      if (estadosOcultos.has(e.estado)) return false;
      if (q && !normalizar(e.numero).includes(q) && !normalizar(e.solicitanteNombre).includes(q)) return false;
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

  const tramitesCerca = useMemo(() => {
    if (!puntoCerca) return [];
    return expedientesVisibles
      .map((e) => ({ e, d: distanciaM(puntoCerca, [e.lat, e.lon]) }))
      .filter(({ d }) => d <= radioCerca)
      .sort((a, b) => a.d - b.d)
      .map(({ e, d }) => ({ ...e, distanciaM: d }));
  }, [expedientesVisibles, puntoCerca, radioCerca]);

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

      const map = L.map(contenedorRef.current, { fadeAnimation: false, zoomControl: false }).setView(CENTRO_CDMB_POR_DEFECTO, 10);
      // Zoom a la derecha: la izquierda ya tiene la barra de 4 botones propia (ocultar panel,
      // mi ubicación, descargar imagen, ayuda) y ambos quedaban encimados en la misma esquina.
      L.control.zoom({ position: "topright" }).addTo(map);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
        crossOrigin: true,
      }).addTo(map);

      // Pane propio con z-index por encima de las capas de contexto (overlayPane=400):
      // así el límite municipal nunca queda tapado por el relleno de otra capa.
      map.createPane("limites").style.zIndex = "450";

      const cluster = L.markerClusterGroup({ maxClusterRadius: 50 });
      map.addLayer(cluster);
      clusterRef.current = cluster;

      const medicion = L.layerGroup().addTo(map);
      medicionCapaRef.current = medicion;
      miUbicacionCapaRef.current = L.layerGroup().addTo(map);

      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        if (modoRef.current === "medir") {
          setMedida((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
        } else if (modoRef.current === "cerca") {
          setPuntoCerca([e.latlng.lat, e.latlng.lng]);
        }
      });
      map.on("zoomend", () => setZoomActual(map.getZoom()));

      sincaCapaRef.current = L.layerGroup();
      mapRef.current = map;
      setMapaListo(true);

      fetch("/geo/municipios_cdmb.geojson")
        .then((r) => r.json())
        .then((geojson: FeatureCollection) => {
          if (cancelado || !mapRef.current) return;
          municipiosDatosRef.current = geojson;
          const capa = L.geoJSON(geojson, {
            pane: "limites",
            style: { color: "#026b4d", weight: 2, fillColor: "#166534", fillOpacity: 0.05 },
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

  // Al abrir/cerrar el panel el contenedor del mapa cambia de ancho por CSS (transition-[width]),
  // pero Leaflet no se entera solo — sin este invalidateSize() el área recién liberada queda gris
  // (sin teselas) hasta el próximo pan/zoom manual. El retraso deja que la transición termine antes
  // de recalcular.
  useEffect(() => {
    const id = setTimeout(() => mapRef.current?.invalidateSize(), 250);
    return () => clearTimeout(id);
  }, [panelAbierto]);

  // --- capa de trámites: se repuebla cuando cambia el filtro visible ---
  useEffect(() => {
    const L = leafletRef.current;
    const cluster = clusterRef.current;
    if (!L || !cluster) return;
    cluster.clearLayers();
    for (const p of expedientesVisibles) {
      const marker = L.marker([p.lat, p.lon], { icon: iconoTramite(L, p.estado) });
      const estilo = estiloEstado(p.estado);
      const contenedor = document.createElement("div");
      contenedor.className = "text-xs leading-relaxed";
      contenedor.innerHTML = `
        <p class="font-mono font-semibold text-stone-800">${escapeHtml(p.numero)}</p>
        <p class="text-stone-700">${escapeHtml(p.tramiteCodigo)} — ${escapeHtml(p.tramiteNombre)}</p>
        <p class="text-stone-500">${escapeHtml(p.municipio)}</p>
        <p class="mt-0.5 flex items-center gap-1 font-medium" style="color:${estilo.color}">${svgIconoEstado(p.estado, 13)}${escapeHtml(estilo.etiqueta)}</p>
      `;
      const enlace = document.createElement("a");
      enlace.href = `/expedientes/${p.id}`;
      enlace.className = "mt-1 inline-block font-medium text-cdmb-700 hover:underline";
      enlace.textContent = "Ver expediente →";
      contenedor.appendChild(enlace);
      marker.bindPopup(contenedor);
      cluster.addLayer(marker);
    }
  }, [expedientesVisibles, mapaListo]);

  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    if (capaTramites) map.addLayer(cluster);
    else map.removeLayer(cluster);
  }, [capaTramites]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const capa = sincaCapaRef.current;
    if (!mapaListo || !L || !map || !capa) return;
    capa.clearLayers();
    if (!capaSinca) {
      map.removeLayer(capa);
      return;
    }
    let destacado: import("leaflet").Marker | null = null;
    for (const p of puntosSinca) {
      const marker = L.marker([p.lat, p.lon], { icon: iconoSinca(L), zIndexOffset: 500 });
      const contenedor = document.createElement("div");
      contenedor.className = "text-xs leading-relaxed";
      contenedor.innerHTML = `
        <p class="font-semibold text-stone-500">SINCA 1.0 · solicitud ${p.nroSolicitud}</p>
        <p class="font-mono font-semibold text-stone-800">Resolución ${escapeHtml(p.numeroResolucion ?? "—")}</p>
        <p class="text-stone-700">${escapeHtml(p.tipo ?? "Sin tipo")}</p>
        <p class="text-stone-500">${escapeHtml(p.municipio ?? "—")}${p.fecha ? ` · ${escapeHtml(p.fecha)}` : ""}${p.estado ? ` · ${escapeHtml(p.estado)}` : ""}</p>
      `;
      const enlace = document.createElement("a");
      enlace.href = `/historico/solicitudes/${p.nroSolicitud}`;
      enlace.className = "mt-1 inline-block font-medium text-cdmb-700 hover:underline";
      enlace.textContent = "Ver en SINCA 1.0 →";
      contenedor.appendChild(enlace);
      marker.bindPopup(contenedor);
      capa.addLayer(marker);
      if (puntoSincaInicial && p.nroSolicitud === puntoSincaInicial) destacado = marker;
    }
    map.addLayer(capa);
    if (destacado) {
      map.setView(destacado.getLatLng(), 16);
      destacado.openPopup();
    }
  }, [mapaListo, capaSinca, puntosSinca, puntoSincaInicial]);

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
            if (!nombre) return;
            if (cfg.id === "veredas") {
              layer.bindTooltip(nombre, { permanent: true, direction: "center", className: "etiqueta-vereda" });
            } else {
              layer.bindTooltip(nombre, { sticky: true, className: "text-xs" });
            }
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

  // --- nombres de vereda: solo visibles acercando el mapa, para no saturar ---
  useEffect(() => {
    const capa = capasContextoRef.current.veredas;
    if (!capa) return;
    const visible = zoomActual >= 13;
    capa.eachLayer((layer) => {
      const conTooltip = layer as import("leaflet").Layer & { getTooltip?: () => import("leaflet").Tooltip | undefined };
      conTooltip.getTooltip?.()?.getElement()?.style.setProperty("display", visible ? "" : "none");
    });
  }, [zoomActual, capas.veredas.datos]);

  function encuadrarElemento(grupo: ElementoAgrupado) {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    const fc: FeatureCollection = { type: "FeatureCollection", features: grupo.features };
    const bounds = L.geoJSON(fc).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] });
  }

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

  // --- trámites cerca de un punto: punto + radio sobre el mapa ---
  useEffect(() => {
    const L = leafletRef.current;
    const capa = medicionCapaRef.current;
    if (!L || !capa || modoRef.current !== "cerca") return;
    if (medida.length === 0) capa.clearLayers();
    if (!puntoCerca) return;
    L.circle(puntoCerca, { radius: radioCerca, color: "#b45309", weight: 1.5, fillColor: "#b45309", fillOpacity: 0.07 }).addTo(capa);
    L.circleMarker(puntoCerca, { radius: 5, color: "#b45309", weight: 3, fillColor: "#fff", fillOpacity: 1 }).addTo(capa);
  }, [puntoCerca, radioCerca, medida.length]);

  // --- mi ubicación: marcador propio ---
  useEffect(() => {
    const L = leafletRef.current;
    const capa = miUbicacionCapaRef.current;
    if (!L || !capa) return;
    capa.clearLayers();
    if (!miUbicacion) return;
    L.marker(miUbicacion, { icon: iconoPunto("#ea580c", L), zIndexOffset: 1000 }).addTo(capa);
  }, [miUbicacion]);

  function activarMedir(v: boolean) {
    setModoMedir(v);
    setMedida([]);
    if (v) {
      setModoCerca(false);
      setPuntoCerca(null);
    }
  }

  function activarCerca(v: boolean) {
    setModoCerca(v);
    if (v) {
      setModoMedir(false);
      setMedida([]);
    } else {
      setPuntoCerca(null);
    }
  }

  function miUbicacionAhora(): Promise<[number, number] | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        mostrarMensaje("Este navegador no admite geolocalización.");
        resolve(null);
        return;
      }
      setBuscandoUbicacion(true);
      let resuelto = false;
      const terminar = (p: [number, number] | null, mensaje?: string) => {
        if (resuelto) return;
        resuelto = true;
        if (mensaje) mostrarMensaje(mensaje);
        setBuscandoUbicacion(false);
        resolve(p);
      };
      // El `timeout` del navegador no cubre la espera del permiso (si el usuario nunca
      // responde al aviso, el callback de error tampoco llega) — sin este respaldo el
      // botón se queda girando indefinidamente.
      setTimeout(() => terminar(null, "No se pudo obtener su ubicación (tiempo agotado)."), 12_000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setMiUbicacion(p);
          mapRef.current?.setView(p, 13);
          terminar(p);
        },
        () => terminar(null, "No se pudo obtener su ubicación. Verifique el permiso del navegador."),
        { enableHighAccuracy: true, timeout: 10_000 },
      );
    });
  }

  async function usarMiUbicacionEnCerca() {
    const p = await miUbicacionAhora();
    if (p) {
      setModoCerca(true);
      setModoMedir(false);
      setMedida([]);
      setPuntoCerca(p);
    }
  }

  async function descargarImagenMapa() {
    if (!contenedorRef.current) return;
    setDescargandoImagen(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(contenedorRef.current, { useCORS: true, logging: false });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `visor_tramites_${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch {
      mostrarMensaje("No se pudo generar la imagen del mapa.");
    } finally {
      setDescargandoImagen(false);
    }
  }

  function contextoDeZona(zona: [number, number][]): CapaContextoReporte[] {
    if (zona.length < 3) return [];
    const resultado: CapaContextoReporte[] = [];
    for (const cfg of CAPAS_CONTEXTO) {
      const datos = capas[cfg.id].datos;
      if (!datos) continue;
      const nombres = new Set<string>();
      for (const f of datos.features) {
        const nombre = f.properties?.nombre as string | undefined;
        if (nombre && featureTocaPoligono(f, zona)) nombres.add(nombre);
      }
      if (nombres.size > 0) resultado.push({ titulo: cfg.etiqueta, elementos: [...nombres].sort((a, b) => a.localeCompare(b, "es")) });
    }
    return resultado;
  }

  function nombreArchivo(base: string, extension: string): string {
    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, "0")}${String(hoy.getDate()).padStart(2, "0")}`;
    return `${base}_${fecha}.${extension}`;
  }

  function descargarCerca() {
    if (!puntoCerca) return;
    const origen = window.location.origin;
    const zona = circuloComoPoligono(puntoCerca, radioCerca);
    const contenido = geoJsonTramites(tramitesCerca, {
      zona,
      areaM2: Math.PI * radioCerca ** 2,
      contexto: contextoDeZona(zona),
      origen,
    });
    descargarTexto(contenido, nombreArchivo("tramites_cerca", "geojson"), "application/geo+json;charset=utf-8");
  }

  function copiarEnlaceZona() {
    const z = zonaAParam(medida);
    if (!z) return;
    const url = `${window.location.origin}/geovisor?zona=${encodeURIComponent(z)}`;
    navigator.clipboard
      .writeText(url)
      .then(() => mostrarMensaje("Enlace de la zona copiado."))
      .catch(() => mostrarMensaje("No se pudo copiar el enlace."));
  }

  function descargarReporte() {
    const origen = window.location.origin;
    let contenido: string;
    if (medida.length >= 3) {
      contenido = htmlReporte({
        titulo: "Reporte de zona seleccionada",
        puntos: tramitesEnZona,
        zona: medida,
        areaM2: area,
        perimetroM: perimetro,
        contexto: contextoDeZona(medida),
        origen,
      });
    } else if (puntoCerca) {
      const zona = circuloComoPoligono(puntoCerca, radioCerca);
      contenido = htmlReporte({
        titulo: `Trámites a menos de ${fmtDist(radioCerca)} de un punto`,
        puntos: tramitesCerca,
        zona,
        areaM2: Math.PI * radioCerca ** 2,
        contexto: contextoDeZona(zona),
        origen,
      });
    } else {
      contenido = htmlReporte({
        titulo: municipioSel ? `Trámites de ${municipioSel}` : "Trámites — vista actual",
        puntos: expedientesVisibles,
        origen,
      });
    }
    descargarTexto(contenido, nombreArchivo("reporte_tramites", "html"), "text/html;charset=utf-8");
  }

  function descargarVisibles(csv: boolean) {
    const origen = window.location.origin;
    if (csv) {
      descargarTexto(csvTramites(expedientesVisibles, origen), nombreArchivo("tramites", "csv"), "text/csv;charset=utf-8");
    } else {
      descargarTexto(geoJsonTramites(expedientesVisibles, { origen }), nombreArchivo("tramites", "geojson"), "application/geo+json;charset=utf-8");
    }
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
    const contenido = geoJsonTramites(tramitesEnZona, {
      zona: medida,
      areaM2: area,
      perimetroM: perimetro,
      contexto: contextoDeZona(medida),
      origen: window.location.origin,
    });
    descargarTexto(contenido, nombreArchivo("zona_tramites", "geojson"), "application/geo+json;charset=utf-8");
  }

  function verTodo() {
    setMunicipioSel(null);
    setTramiteSel("");
    setEstadosOcultos(new Set());
    setBusqueda("");
  }

  const anchoPanel = panelAbierto ? "w-full max-w-xs shrink-0 sm:w-80" : "w-0";

  return (
    <div className="relative flex h-[calc(100vh-160px)] min-h-[760px] w-full overflow-hidden rounded-xl border border-stone-200 shadow-soft">
      <div className={`min-w-0 overflow-hidden border-stone-200 bg-white transition-[width] ${panelAbierto ? "border-r" : ""} ${anchoPanel}`}>
        <div className="flex h-full w-80 max-w-xs flex-col sm:w-80">
          <div className="flex items-center gap-2 border-b border-stone-100 px-3 py-2.5">
            <Layers className="h-4 w-4 text-cdmb-600" aria-hidden />
            <h3 className="flex-1 text-sm font-semibold text-stone-900">Visor de trámites</h3>
            <button
              type="button"
              onClick={() => setPanelAbierto(false)}
              title="Cerrar panel"
              className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
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
                capaSinca={capaSinca}
                onCapaSinca={setCapaSinca}
                totalSinca={puntosSinca.length}
                capaMunicipios={capaMunicipios}
                onCapaMunicipios={setCapaMunicipios}
                capaEtiquetas={capaEtiquetas}
                onCapaEtiquetas={setCapaEtiquetas}
                capas={capas}
                onToggleCapa={alternarCapaContexto}
                onZoomElemento={encuadrarElemento}
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
                modoCerca={modoCerca}
                onModoCerca={activarCerca}
                puntoCerca={puntoCerca}
                radioCerca={radioCerca}
                onRadioCerca={setRadioCerca}
                tramitesCerca={tramitesCerca}
                onUsarMiUbicacion={usarMiUbicacionEnCerca}
                buscandoUbicacion={buscandoUbicacion}
                onDescargarCerca={descargarCerca}
                onCopiarEnlace={copiarEnlaceZona}
                onDescargarReporte={descargarReporte}
                totalVisibles={expedientesVisibles.length}
                onDescargarVisibles={descargarVisibles}
              />
            )}
          </div>
        </div>
      </div>

      <div className="relative flex-1">
        <div ref={contenedorRef} className="h-full w-full" />
        <div className="absolute left-3 top-3 z-[550] flex flex-col gap-1.5">
          <BotonMapa
            icon={panelAbierto ? <PanelLeftClose className="h-4 w-4" aria-hidden /> : <PanelLeftOpen className="h-4 w-4" aria-hidden />}
            title={panelAbierto ? "Ocultar panel" : "Mostrar panel"}
            onClick={() => setPanelAbierto((v) => !v)}
          />
          <BotonMapa
            icon={buscandoUbicacion ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LocateFixed className="h-4 w-4" aria-hidden />}
            title="Mi ubicación"
            onClick={() => miUbicacionAhora()}
            disabled={buscandoUbicacion}
          />
          <BotonMapa
            icon={descargandoImagen ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
            title="Descargar imagen"
            onClick={descargarImagenMapa}
            disabled={descargandoImagen}
          />
          <BotonMapa icon={<HelpCircle className="h-4 w-4" aria-hidden />} title="Ayuda" onClick={() => setAyudaAbierta(true)} />
        </div>
        {mensajeMapa && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[550] flex justify-center">
            <p className="rounded-full bg-white px-3 py-1 text-xs text-stone-600 shadow">{mensajeMapa}</p>
          </div>
        )}
        {!mensajeMapa && expedientesVisibles.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[550] flex justify-center">
            <p className="rounded-full bg-white px-3 py-1 text-xs text-stone-500 shadow">
              {expedientes.length === 0 ? "Ningún trámite con este filtro tiene ubicación registrada." : "Ningún trámite coincide con el filtro actual."}
            </p>
          </div>
        )}
        {ayudaAbierta && <PanelAyuda onCerrar={() => setAyudaAbierta(false)} />}
      </div>
    </div>
  );
}

function BotonMapa({
  icon,
  title,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-700 shadow-sm hover:bg-stone-50 disabled:opacity-60"
    >
      {icon}
    </button>
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

function iconoTramite(L: typeof import("leaflet"), estado: string): import("leaflet").DivIcon {
  return L.divIcon({
    className: "",
    html: svgPinEstado(estado),
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -34],
  });
}

function iconoSinca(L: typeof import("leaflet")): import("leaflet").DivIcon {
  return L.divIcon({
    className: "",
    html:
      '<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="3" y="3" width="20" height="20" rx="3" transform="rotate(45 13 13)" fill="#20272a" stroke="#ffffff" stroke-width="1.5"/>' +
      '<text x="13" y="16.5" text-anchor="middle" font-family="Work Sans, sans-serif" font-size="9" font-weight="700" fill="#85c800">S1</text>' +
      "</svg>",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -12],
  });
}

function iconoPunto(color: string, L: typeof import("leaflet")): import("leaflet").DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#fff;border:3px solid ${color};box-shadow:0 1px 3px rgba(0,0,0,0.4)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
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
        activa ? "bg-menu-500 text-stone-900" : "text-stone-500 hover:bg-stone-100"
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
                  <span className="flex-none" aria-hidden dangerouslySetInnerHTML={{ __html: svgIconoEstado(e, 15) }} />
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: estiloEstado(e).color }} aria-hidden />
                  {estiloEstado(e).etiqueta}
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
  capaSinca,
  onCapaSinca,
  totalSinca,
  capaMunicipios,
  onCapaMunicipios,
  capaEtiquetas,
  onCapaEtiquetas,
  capas,
  onToggleCapa,
  onZoomElemento,
}: {
  capaTramites: boolean;
  onCapaTramites: (v: boolean) => void;
  totalTramites: number;
  capaSinca: boolean;
  onCapaSinca: (v: boolean) => void;
  totalSinca: number;
  capaMunicipios: boolean;
  onCapaMunicipios: (v: boolean) => void;
  capaEtiquetas: boolean;
  onCapaEtiquetas: (v: boolean) => void;
  capas: Record<CapaContextoId, EstadoCapa>;
  onToggleCapa: (id: CapaContextoId, on: boolean) => void;
  onZoomElemento: (grupo: ElementoAgrupado) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" checked={capaTramites} onChange={(e) => onCapaTramites(e.target.checked)} />
        Trámites ambientales 2.0 ({totalTramites})
      </label>
      {totalSinca > 0 && (
        <div>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={capaSinca} onChange={(e) => onCapaSinca(e.target.checked)} />
            <span className="inline-flex h-4 w-4 flex-none rotate-45 items-center justify-center rounded-sm bg-[#20272a]" aria-hidden />
            Trámites SINCA 1.0 ({totalSinca})
          </label>
          <p className="ml-6 text-[11px] text-stone-400">
            Resoluciones históricas de SINCA 1.0 que registraron coordenadas. Capa independiente: no se mezcla con los filtros,
            mediciones ni descargas de Trámites ambientales 2.0.
          </p>
        </div>
      )}
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
        <ul className="space-y-1">
          {CAPAS_CONTEXTO.map((cfg) => {
            const estado = capas[cfg.id];
            const n = estado.datos?.features.length;
            return (
              <li key={cfg.id}>
                <label className="flex items-center gap-2 text-xs text-stone-600">
                  <input type="checkbox" checked={estado.on} onChange={(e) => onToggleCapa(cfg.id, e.target.checked)} />
                  <span className="flex-1">
                    {cfg.etiqueta} <span className="text-stone-400">({cfg.fuente})</span>
                    {n !== undefined && <span className="text-stone-400"> ({n})</span>}
                  </span>
                  {estado.cargando && <span className="h-3 w-3 flex-none animate-spin rounded-full border-2 border-cdmb-500 border-t-transparent" />}
                </label>
                {estado.on && estado.datos && cfg.id !== "veredas" && (
                  <ListaElementos
                    grupos={agruparPorNombre(estado.datos.features)}
                    color={cfg.color}
                    conEnlace={cfg.id === "areas"}
                    onZoom={onZoomElemento}
                  />
                )}
                {estado.on && estado.datos && cfg.id === "veredas" && <ListaVeredas features={estado.datos.features} onZoom={onZoomElemento} />}
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

function ListaElementos({
  grupos,
  color,
  conEnlace,
  onZoom,
}: {
  grupos: ElementoAgrupado[];
  color: string;
  conEnlace: boolean;
  onZoom: (grupo: ElementoAgrupado) => void;
}) {
  if (grupos.length === 0) return null;
  return (
    <ul className="ml-6 mt-1 max-h-48 space-y-0.5 overflow-y-auto border-l border-stone-100 pl-2">
      {grupos.map((g) => (
        <FilaElemento key={g.nombre} grupo={g} color={color} conEnlace={conEnlace} onZoom={onZoom} />
      ))}
    </ul>
  );
}

function FilaElemento({
  grupo,
  color,
  conEnlace,
  onZoom,
}: {
  grupo: ElementoAgrupado;
  color: string;
  conEnlace: boolean;
  onZoom: (grupo: ElementoAgrupado) => void;
}) {
  const sub = subtituloElemento(grupo.props);
  const url = conEnlace && typeof grupo.props.url === "string" ? grupo.props.url : null;
  return (
    <li className="flex items-start gap-1.5 py-1">
      <button type="button" onClick={() => onZoom(grupo)} className="flex-1 text-left">
        <span className="flex items-start gap-1.5">
          <span className="mt-1 h-2 w-2 flex-none rounded-full" style={{ backgroundColor: color }} />
          <span>
            <span className="block text-[11.5px] font-medium leading-tight text-stone-700">{grupo.nombre}</span>
            {sub && <span className="block text-[10.5px] leading-tight text-stone-400">{sub}</span>}
          </span>
        </span>
      </button>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir ficha externa" className="mt-0.5 flex-none text-stone-400 hover:text-cdmb-600">
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      )}
    </li>
  );
}

function ListaVeredas({ features, onZoom }: { features: Feature[]; onZoom: (grupo: ElementoAgrupado) => void }) {
  const porMunicipio = useMemo(() => agruparVeredasPorMunicipio(features), [features]);
  return (
    <div className="ml-6 mt-1 max-h-56 space-y-0.5 overflow-y-auto border-l border-stone-100 pl-2">
      {porMunicipio.map(([municipio, grupos]) => (
        <details key={municipio} className="text-xs">
          <summary className="cursor-pointer select-none py-1 text-[11.5px] font-medium text-stone-600 hover:text-stone-800">
            {municipio} <span className="text-stone-400">({grupos.length})</span>
          </summary>
          <ul className="space-y-0.5 pb-1 pl-3">
            {grupos.map((g) => (
              <FilaElemento key={g.nombre} grupo={g} color="#8D6E63" conEnlace={false} onZoom={onZoom} />
            ))}
          </ul>
        </details>
      ))}
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
  modoCerca,
  onModoCerca,
  puntoCerca,
  radioCerca,
  onRadioCerca,
  tramitesCerca,
  onUsarMiUbicacion,
  buscandoUbicacion,
  onDescargarCerca,
  onCopiarEnlace,
  onDescargarReporte,
  totalVisibles,
  onDescargarVisibles,
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
  modoCerca: boolean;
  onModoCerca: (v: boolean) => void;
  puntoCerca: [number, number] | null;
  radioCerca: number;
  onRadioCerca: (v: number) => void;
  tramitesCerca: (PuntoTramite & { distanciaM: number })[];
  onUsarMiUbicacion: () => void;
  buscandoUbicacion: boolean;
  onDescargarCerca: () => void;
  onCopiarEnlace: () => void;
  onDescargarReporte: () => void;
  totalVisibles: number;
  onDescargarVisibles: (csv: boolean) => void;
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
              className={`flex-1 rounded px-2 py-1 ${!medirArea ? "bg-menu-500 text-stone-900" : "text-stone-600"}`}
            >
              Distancia
            </button>
            <button
              type="button"
              onClick={() => onMedirArea(true)}
              className={`flex-1 rounded px-2 py-1 ${medirArea ? "bg-menu-500 text-stone-900" : "text-stone-600"}`}
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
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-acento-600"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Descargar zona (GeoJSON)
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onCopiarEnlace}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-stone-200 px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                >
                  <Link2 className="h-3.5 w-3.5" aria-hidden />
                  Enlace de la zona
                </button>
                <button
                  type="button"
                  onClick={onDescargarReporte}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-stone-200 px-2 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  Reporte (HTML)
                </button>
              </div>
              <p className="text-[10.5px] text-stone-400">
                El GeoJSON incluye la zona y los trámites de adentro; se abre en QGIS, ArcGIS o Google Earth. El reporte es una página lista para
                imprimir o guardar como PDF.
              </p>
            </>
          )}
        </>
      )}

      <div className="border-t border-stone-100 pt-3">
        <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
          <input type="checkbox" checked={modoCerca} onChange={(e) => onModoCerca(e.target.checked)} />
          Trámites cerca de un punto
        </label>

        {modoCerca && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-stone-600">
                {puntoCerca ? `${tramitesCerca.length} trámite${tramitesCerca.length === 1 ? "" : "s"} a menos de ${fmtDist(radioCerca)}` : "Toque el mapa para elegir un punto."}
              </p>
              <button
                type="button"
                onClick={onUsarMiUbicacion}
                disabled={buscandoUbicacion}
                className="flex flex-none items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                {buscandoUbicacion ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <LocateFixed className="h-3 w-3" aria-hidden />}
                Mi ubicación
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[500, 1000, 2000, 5000].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRadioCerca(r)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    radioCerca === r ? "border-menu-500 bg-menu-500 text-stone-900" : "border-stone-200 text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {fmtDist(r)}
                </button>
              ))}
            </div>

            {puntoCerca && (
              <>
                {tramitesCerca.length > 0 && (
                  <ul className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-stone-100 bg-stone-50/60 p-2 text-[11px]">
                    {tramitesCerca.slice(0, 20).map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2">
                        <a href={`/expedientes/${t.id}`} className="truncate font-mono text-cdmb-700 hover:underline">
                          {t.numero}
                        </a>
                        <span className="flex-none text-stone-400">{fmtDist(t.distanciaM)}</span>
                      </li>
                    ))}
                    {tramitesCerca.length > 20 && <li className="text-stone-400">… y {tramitesCerca.length - 20} más</li>}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={onDescargarCerca}
                  disabled={tramitesCerca.length === 0}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Descargar (GeoJSON)
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-stone-100 pt-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">Descargar lo que se ve ahora</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onDescargarVisibles(false)}
            disabled={totalVisibles === 0}
            className="flex items-center gap-1.5 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            GeoJSON ({totalVisibles})
          </button>
          <button
            type="button"
            onClick={() => onDescargarVisibles(true)}
            disabled={totalVisibles === 0}
            className="flex items-center gap-1.5 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            CSV
          </button>
          <button
            type="button"
            onClick={onDescargarReporte}
            disabled={totalVisibles === 0}
            className="flex items-center gap-1.5 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Reporte
          </button>
        </div>
        <p className="mt-1.5 text-[10.5px] text-stone-400">Respeta los filtros activos de la pestaña Filtrar.</p>
      </div>
    </div>
  );
}

function PanelAyuda({ onCerrar }: { onCerrar: () => void }) {
  return (
    <div className="absolute inset-0 z-[600] flex justify-end">
      <button type="button" onClick={onCerrar} aria-label="Cerrar ayuda" className="absolute inset-0 bg-stone-900/30" />
      <div className="relative flex h-full w-full max-w-sm flex-col bg-white shadow-xl">
        <div className="flex items-center gap-2 bg-cdmb-700 px-4 py-3">
          <HelpCircle className="h-4 w-4 text-white" aria-hidden />
          <h4 className="flex-1 text-sm font-semibold text-white">Cómo usar el visor de trámites</h4>
          <button type="button" onClick={onCerrar} className="rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-xs text-stone-600">
          <SeccionAyuda titulo="¿Qué es?">
            <p>Muestra los trámites ambientales con ubicación registrada sobre el mapa de la jurisdicción de la CDMB, con capas oficiales de contexto (municipios, áreas protegidas, ríos).</p>
          </SeccionAyuda>
          <SeccionAyuda titulo="Moverse por el mapa">
            <p>Arrastre para desplazarse; use la rueda del mouse o los botones + / − para acercar y alejar.</p>
            <p>El botón de diana (&quot;Mi ubicación&quot;) centra el mapa donde usted está — el navegador pedirá permiso.</p>
            <p>El botón de cámara descarga una imagen PNG del mapa tal como se ve en pantalla.</p>
          </SeccionAyuda>
          <SeccionAyuda titulo='Pestaña "Filtrar"'>
            <p>Busque por número de expediente o solicitante. Filtre por trámite, por municipio (con el conteo de cada uno) o por estado.</p>
            <p>&quot;Ver todo&quot; quita todos los filtros activos.</p>
          </SeccionAyuda>
          <SeccionAyuda titulo='Pestaña "Capas"'>
            <p>Encienda o apague: los trámites, los límites municipales y las capas de contexto. Estas últimas vienen de la entidad externa que las produce, señalada entre paréntesis: áreas protegidas (RUNAP), páramos delimitados (MADS), veredas (DANE), hidrografía y subzonas hidrográficas (IDEAM), áreas de conservación de aves (Humboldt) y bosque seco tropical (MADS).</p>
            <p>Cada capa encendida muestra debajo la lista de sus elementos con nombre — toque uno para encuadrarlo en el mapa. Las veredas, al ser cerca de 400, van agrupadas por municipio.</p>
            <p>Los nombres de las veredas aparecen sobre el mapa al acercar lo suficiente.</p>
            <p>La leyenda al final explica qué significa cada color.</p>
          </SeccionAyuda>
          <SeccionAyuda titulo='Pestaña "Medir"'>
            <p>Marque &quot;Medir / seleccionar una zona&quot; y toque el mapa para poner puntos. Elija entre medir una DISTANCIA (línea) o una ZONA (polígono).</p>
            <p>Con 2 puntos ve la distancia. Con 3 o más se cierra la zona y ve el perímetro, el área y cuántos trámites caen dentro — descargable en GeoJSON.</p>
            <p>Otra herramienta: &quot;Trámites cerca de un punto&quot; — toque el mapa (o use su ubicación), elija un radio (500 m a 5 km) y vea la lista de trámites dentro de ese círculo, también descargable.</p>
            <p>&quot;Quitar punto&quot; borra el último; &quot;Limpiar&quot; empieza de nuevo.</p>
          </SeccionAyuda>
          <SeccionAyuda titulo="Fuentes">
            <p>Cartografía base: © OpenStreetMap. Capas de contexto: áreas protegidas — RUNAP; páramos delimitados y bosque seco tropical — MADS; veredas — DANE; hidrografía y subzonas hidrográficas — IDEAM; áreas de conservación de aves (AICA) — Instituto Humboldt. Datos de trámites: CDMB.</p>
            <p>El visor es informativo y no constituye cartografía oficial de linderos.</p>
          </SeccionAyuda>
        </div>
      </div>
    </div>
  );
}

function SeccionAyuda({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1 text-xs font-semibold text-stone-800">{titulo}</p>
      <div className="space-y-1.5 text-[11.5px] leading-relaxed text-stone-500">{children}</div>
    </div>
  );
}
