"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CircleHelp, Crosshair, Download, Layers, LayersIcon, Link2, MapPin, Minus, Plus, Ruler, Search, SlidersHorizontal, Undo2, X, Trash2, ScanSearch } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { escribirVistaMapa, filtrarPuntos, leerVistaMapa, puntosCsv, puntosGeoJSON, type FiltroMapaNV, type PuntoMapaNV } from "@/lib/negocios-verdes-mapa";
import { MUNICIPIOS_NV, normalizarTexto } from "@/lib/negocios-verdes";
import { areaPoligonoM2, distanciaM, formatoArea, formatoDistancia, puntoEnPoligono } from "@/lib/negocios-verdes-medir";
import { htmlAvisoNV, htmlGrupoNV } from "@/components/negocios-verdes/sitio/MapaResultadosNV";

/** Capas de contexto: los mismos archivos de la plataforma anterior (public/geo), cada una con su fuente. */
const CAPAS: readonly { id: string; etiqueta: string; fuente: string; archivo: string; color: string; soloContorno?: boolean }[] = [
  { id: "areas", etiqueta: "Áreas protegidas", fuente: "RUNAP", archivo: "/geo/areas_protegidas_cdmb.geojson", color: "#1E6B3E" },
  { id: "paramos", etiqueta: "Páramos delimitados", fuente: "MADS", archivo: "/geo/paramos_cdmb.geojson", color: "#5E35B1" },
  { id: "veredas", etiqueta: "Veredas", fuente: "DANE", archivo: "/geo/veredas_cdmb.geojson", color: "#8D6E63", soloContorno: true },
  { id: "hidro", etiqueta: "Hidrografía (ríos y cuerpos de agua)", fuente: "IDEAM", archivo: "/geo/hidrografia_cdmb.geojson", color: "#3D7EB8" },
  { id: "aicas", etiqueta: "Áreas de conservación de aves (AICA)", fuente: "Humboldt", archivo: "/geo/aicas_cdmb.geojson", color: "#00897B" },
  { id: "bosque_seco", etiqueta: "Bosque seco tropical", fuente: "MADS", archivo: "/geo/bosque_seco_cdmb.geojson", color: "#C17817" },
  { id: "subzonas", etiqueta: "Subzonas hidrográficas", fuente: "IDEAM", archivo: "/geo/subzonas_cdmb.geojson", color: "#1565C0", soloContorno: true },
];

const LEYENDA = [
  ["#026b4d", "Municipio"],
  ["#ff8623", "Municipio / zona seleccionada"],
  ["#1E6B3E", "Área protegida"],
  ["#5E35B1", "Páramo delimitado (MADS)"],
  ["#8D6E63", "Vereda (DANE)"],
  ["#3D7EB8", "Ríos y cuerpos de agua"],
] as const;

const CENTRO: [number, number] = [7.12, -73.1];
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const PUNTO = '<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#01bd32;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>';

function descargar(nombre: string, contenido: string | Blob, tipo: string) {
  const url = URL.createObjectURL(contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 mt-4 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-nv-texto">{children}</p>;
}

type VistaMapa = ReturnType<typeof leerVistaMapa>;
type Pestana = "filtrar" | "capas" | "medir";

/**
 * Geovisor público con la distribución de la plataforma anterior: panel lateral (Filtrar, Capas,
 * Medir), herramientas a la izquierda del mapa (panel, mi ubicación, imagen, ayuda), zoom a la
 * derecha, límites municipales con su nombre y grupos de negocios en verde oscuro.
 */
export function GeovisorNV({ puntos, categorias, sinUbicacion, inicial, embed = false }: { puntos: PuntoMapaNV[]; categorias: { slug: string; nombre: string }[]; sinUbicacion: number; inicial: VistaMapa; embed?: boolean }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<import("leaflet").Map | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const grupo = useRef<import("leaflet").MarkerClusterGroup | null>(null);
  const municipios = useRef<import("leaflet").GeoJSON | null>(null);
  const capas = useRef<Record<string, import("leaflet").GeoJSON>>({});
  const extra = useRef<import("leaflet").LayerGroup | null>(null);
  const medida = useRef<import("leaflet").LayerGroup | null>(null);
  const marcadores = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const vistaInicial = useRef(inicial.vista);
  const medidaActiva = useRef(false);

  const [filtro, setFiltro] = useState<FiltroMapaNV>(inicial.filtro);
  const [activas, setActivas] = useState<string[]>(inicial.capas.filter((c) => CAPAS.some((x) => x.id === c)));
  const [verNegocios, setVerNegocios] = useState(true);
  const [verLimites, setVerLimites] = useState(true);
  const [verEtiquetas, setVerEtiquetas] = useState(true);
  const [listo, setListo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>("filtrar");
  const [panel, setPanel] = useState(!embed);
  const [ayuda, setAyuda] = useState(false);
  const [limites, setLimites] = useState<[number, number, number, number] | null>(null);
  const [midiendo, setMidiendo] = useState(false);
  const [modoZona, setModoZona] = useState(false);
  const [vertices, setVertices] = useState<[number, number][]>([]);
  const [lugar, setLugar] = useState<string | null>(null);

  const visibles = useMemo(() => filtrarPuntos(puntos, filtro), [puntos, filtro]);
  const enVista = useMemo(() => (limites ? visibles.filter((p) => p.lat >= limites[0] && p.lat <= limites[2] && p.lng >= limites[1] && p.lng <= limites[3]) : visibles), [visibles, limites]);
  const destino = embed ? "_blank" : "_self";
  const hayFiltro = Boolean(filtro.q || filtro.municipio || filtro.categoria || filtro.reconocimiento);

  const avisar = (t: string) => {
    setAviso(t);
    setTimeout(() => setAviso((a) => (a === t ? null : a)), 3500);
  };

  // Mapa (una sola vez).
  useEffect(() => {
    let cancelado = false;
    (async () => {
      // markercluster se registra sobre window.L; se usa el objeto exportado (ver GeovisorTramites).
      const mod = await import("leaflet");
      const Lmod = (mod as unknown as { default?: typeof mod }).default ?? mod;
      (window as unknown as { L: typeof Lmod }).L = Lmod;
      await import("leaflet.markercluster");
      if (cancelado || !contenedor.current || mapa.current) return;
      const m = Lmod.map(contenedor.current, { scrollWheelZoom: !embed, zoomControl: false, attributionControl: true });
      const v = vistaInicial.current;
      m.setView(v ? [v[0], v[1]] : CENTRO, v ? v[2] : 10);
      Lmod.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "Base © OpenStreetMap · Capas externas: RUNAP, MADS, DANE, IDEAM", maxZoom: 19, crossOrigin: true }).addTo(m);
      grupo.current = Lmod.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        iconCreateFunction: (c) => {
          const n = c.getChildCount();
          const t = n < 10 ? 34 : n < 100 ? 40 : 46;
          return Lmod.divIcon({ className: "", html: htmlGrupoNV(n), iconSize: [t, t] });
        },
      }).addTo(m);
      extra.current = Lmod.layerGroup().addTo(m);
      medida.current = Lmod.layerGroup().addTo(m);
      const actualizar = () => {
        const b = m.getBounds();
        setLimites([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]);
      };
      m.on("moveend", actualizar);
      actualizar();
      L.current = Lmod;
      mapa.current = m;
      setListo(true);
    })();
    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
    };
  }, [embed]);

  // Límites municipales con su nombre (el elegido, en naranja).
  useEffect(() => {
    const Lmod = L.current;
    const m = mapa.current;
    if (!listo || !Lmod || !m) return;
    let vivo = true;
    const pintar = (capa: import("leaflet").GeoJSON) => {
      capa.eachLayer((l) => {
        const nombre = ((l as import("leaflet").GeoJSON).feature as Feature | undefined)?.properties?.nombre as string | undefined;
        const sel = nombre === filtro.municipio;
        (l as import("leaflet").Path).setStyle({ color: sel ? "#ff8623" : "#026b4d", weight: sel ? 3 : 1.4, fillColor: sel ? "#ff8623" : "#038f67", fillOpacity: 0.07 });
        const t = (l as import("leaflet").Layer).getTooltip();
        if (t) t.setOpacity(verEtiquetas ? 1 : 0);
      });
    };
    if (!municipios.current) {
      fetch("/geo/municipios_cdmb.geojson")
        .then((r) => r.json() as Promise<FeatureCollection>)
        .then((geo) => {
          if (!vivo || municipios.current) return;
          const capa = Lmod.geoJSON(geo, {
            onEachFeature: (f, l) => {
              const nombre = (f.properties as { nombre?: string } | null)?.nombre;
              if (!nombre) return;
              l.bindTooltip(esc(nombre), { permanent: true, direction: "center", className: "nv-etiqueta-municipio" });
              l.on("click", () => {
                if (medidaActiva.current) return;
                setFiltro((x) => ({ ...x, municipio: x.municipio === nombre ? "" : nombre }));
              });
            },
          });
          municipios.current = capa;
          if (verLimites) capa.addTo(m).bringToBack();
          pintar(capa);
        })
        .catch(() => avisar("No se pudieron cargar los límites municipales."));
    } else {
      if (verLimites && !m.hasLayer(municipios.current)) municipios.current.addTo(m).bringToBack();
      if (!verLimites && m.hasLayer(municipios.current)) m.removeLayer(municipios.current);
      pintar(municipios.current);
    }
    return () => {
      vivo = false;
    };
  }, [listo, verLimites, verEtiquetas, filtro.municipio]);

  // Negocios según el filtro.
  useEffect(() => {
    const Lmod = L.current;
    const g = grupo.current;
    const m = mapa.current;
    if (!listo || !Lmod || !g || !m) return;
    g.clearLayers();
    marcadores.current.clear();
    if (!verNegocios) return;
    for (const p of visibles) {
      const mk = Lmod.marker([p.lat, p.lng], { icon: Lmod.divIcon({ className: "", html: PUNTO, iconSize: [14, 14], iconAnchor: [7, 7] }), title: p.nombre }).bindPopup(htmlAvisoNV(p, destino));
      marcadores.current.set(p.slug, mk);
      mk.addTo(g);
    }
  }, [visibles, listo, destino, verNegocios]);

  // Enlace a un negocio (?negocio=slug): se acerca y abre su aviso.
  const abierto = useRef(false);
  useEffect(() => {
    if (!listo || abierto.current || !inicial.negocio) return;
    const mk = marcadores.current.get(inicial.negocio);
    const g = grupo.current;
    if (!mk || !g) return;
    abierto.current = true;
    g.zoomToShowLayer(mk, () => mk.openPopup());
  }, [listo, visibles, inicial.negocio]);

  // Capas de contexto (se descargan al encenderlas).
  useEffect(() => {
    const Lmod = L.current;
    const m = mapa.current;
    if (!listo || !Lmod || !m) return;
    for (const c of CAPAS) {
      const on = activas.includes(c.id);
      const capa = capas.current[c.id];
      if (!on && capa) m.removeLayer(capa);
      if (on && capa && !m.hasLayer(capa)) capa.addTo(m).bringToBack();
      if (on && !capa) {
        fetch(c.archivo)
          .then((r) => r.json() as Promise<FeatureCollection>)
          .then((geo) => {
            if (capas.current[c.id]) return;
            const nueva = Lmod.geoJSON(geo, {
              style: { color: c.color, weight: c.soloContorno ? 1.2 : 1, fillColor: c.color, fillOpacity: c.soloContorno ? 0 : 0.18 },
              onEachFeature: (f, capa) => {
                const n = (f.properties as { nombre?: string } | null)?.nombre;
                if (n) capa.bindTooltip(`${esc(n)} <span style="color:#78716c">(${esc(c.fuente)})</span>`, { sticky: true });
              },
            });
            capas.current[c.id] = nueva;
            if (mapa.current) nueva.addTo(mapa.current).bringToBack();
          })
          .catch(() => avisar(`No se pudo cargar la capa «${c.etiqueta}».`));
      }
    }
  }, [activas, listo]);

  // Al elegir un municipio, el mapa se acerca a él.
  const municipioAnterior = useRef(inicial.filtro.municipio);
  useEffect(() => {
    if (!listo || filtro.municipio === municipioAnterior.current) return;
    municipioAnterior.current = filtro.municipio;
    const m = mapa.current;
    if (!m) return;
    let capaMun: import("leaflet").Polygon | null = null;
    municipios.current?.eachLayer((l) => {
      if (((l as import("leaflet").GeoJSON).feature as Feature | undefined)?.properties?.nombre === filtro.municipio) capaMun = l as import("leaflet").Polygon;
    });
    if (filtro.municipio && capaMun) m.fitBounds((capaMun as import("leaflet").Polygon).getBounds(), { padding: [20, 20] });
    else if (!filtro.municipio) m.setView(CENTRO, 10);
  }, [filtro.municipio, listo]);

  // Medir: cada clic agrega un punto; con 2 se ve la distancia, con 3 o más (zona) el área.
  useEffect(() => {
    medidaActiva.current = midiendo;
    const m = mapa.current;
    if (!listo || !m) return;
    const clic = (e: import("leaflet").LeafletMouseEvent) => setVertices((v) => [...v, [e.latlng.lat, e.latlng.lng]]);
    if (midiendo) {
      m.on("click", clic);
      m.getContainer().style.cursor = "crosshair";
    }
    return () => {
      m.off("click", clic);
      m.getContainer().style.cursor = "";
    };
  }, [midiendo, listo]);

  useEffect(() => {
    const Lmod = L.current;
    const capa = medida.current;
    if (!listo || !Lmod || !capa) return;
    capa.clearLayers();
    vertices.forEach((v, i) =>
      Lmod.marker(v, { icon: Lmod.divIcon({ className: "", html: `<span style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:9999px;background:#ff8623;color:#fff;font-size:11px;font-weight:700;border:2px solid #fff">${i + 1}</span>`, iconSize: [20, 20] }) }).addTo(capa)
    );
    if (vertices.length >= 3 && modoZona) Lmod.polygon(vertices, { color: "#ff8623", weight: 2, fillOpacity: 0.12 }).addTo(capa);
    else if (vertices.length >= 2) Lmod.polyline(vertices, { color: "#ff8623", weight: 3, dashArray: "6 6" }).addTo(capa);
  }, [vertices, modoZona, listo]);

  const distanciaLinea = vertices.reduce((s, v, i) => (i ? s + distanciaM(vertices[i - 1]!, v) : 0), 0);
  const esZona = modoZona && vertices.length >= 3;
  const perimetro = esZona ? distanciaLinea + distanciaM(vertices[vertices.length - 1]!, vertices[0]!) : 0;
  const enZona = useMemo(() => (esZona ? visibles.filter((p) => puntoEnPoligono([p.lat, p.lng], vertices)) : []), [esZona, visibles, vertices]);

  const porMunicipio = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of visibles) c.set(p.municipio, (c.get(p.municipio) ?? 0) + 1);
    return MUNICIPIOS_NV.map((m) => [m, c.get(m) ?? 0] as const).sort((a, b) => b[1] - a[1]);
  }, [visibles]);
  const porCategoria = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of enVista) {
      const k = p.categoria && p.categorias.length ? p.categoria.nombre : "Sin clasificar";
      c.set(k, (c.get(k) ?? 0) + 1);
    }
    return [...c].sort((a, b) => b[1] - a[1]);
  }, [enVista]);
  const maxCat = porCategoria[0]?.[1] ?? 0;
  const sugerencias = useMemo(() => {
    const w = normalizarTexto(filtro.q);
    return w.length >= 2 ? visibles.slice(0, 6) : [];
  }, [filtro.q, visibles]);

  const set = (c: Partial<FiltroMapaNV>) => setFiltro((f) => ({ ...f, ...c }));

  const irANegocio = (p: PuntoMapaNV) => {
    const mk = marcadores.current.get(p.slug);
    if (mk && grupo.current) grupo.current.zoomToShowLayer(mk, () => mk.openPopup());
  };

  const buscarLugar = async () => {
    const texto = filtro.q.trim();
    const Lmod = L.current;
    const m = mapa.current;
    if (!texto || !Lmod || !m) return;
    try {
      const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=co&bounded=1&viewbox=-73.6,7.9,-72.4,6.5&q=${encodeURIComponent(texto)}`;
      const r = (await (await fetch(u, { headers: { "Accept-Language": "es" } })).json()) as { lat: string; lon: string; display_name: string }[];
      if (!r.length) return avisar(`No se encontró «${texto}» en la jurisdicción.`);
      const ll: [number, number] = [Number(r[0]!.lat), Number(r[0]!.lon)];
      extra.current?.clearLayers();
      if (extra.current) Lmod.circleMarker(ll, { radius: 9, color: "#fff", weight: 2, fillColor: "#ff8623", fillOpacity: 1 }).bindTooltip(esc(r[0]!.display_name)).addTo(extra.current);
      m.setView(ll, 14);
      setLugar(r[0]!.display_name.split(",")[0] ?? texto);
      set({ q: "" });
    } catch {
      avisar("El buscador de lugares no respondió.");
    }
  };

  const miUbicacion = () => {
    if (!navigator.geolocation) return avisar("Este navegador no permite conocer la ubicación.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const m = mapa.current;
        const Lmod = L.current;
        if (!m || !Lmod || !extra.current) return;
        const ll: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        if (midiendo) setVertices((v) => [...v, ll]);
        Lmod.circleMarker(ll, { radius: 8, color: "#fff", weight: 2, fillColor: "#1A73E8", fillOpacity: 1 }).bindTooltip("Usted está aquí").addTo(extra.current);
        m.setView(ll, 14);
      },
      () => avisar("No se pudo obtener su ubicación (permiso denegado o sin señal)."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const imagen = async () => {
    const el = contenedor.current;
    if (!el) return;
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const lienzo = await html2canvas(el, { useCORS: true, logging: false, ignoreElements: (n) => n.classList?.contains("leaflet-control-container") });
      lienzo.toBlob((b) => b && descargar("geovisor-negocios-verdes.png", b, "image/png"));
    } catch {
      avisar("No se pudo generar la imagen (el navegador bloqueó la captura del mapa).");
    }
  };

  const enlace = async () => {
    const m = mapa.current;
    const c = m?.getCenter();
    const q = escribirVistaMapa(filtro, activas, c && m ? [c.lat, c.lng, m.getZoom()] : null);
    const url = `${window.location.origin}/negocios-verdes/geovisor${q ? `?${q}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      avisar("Enlace de esta vista copiado.");
    } catch {
      setAviso(url);
    }
  };

  const zonaGeoJSON = () => {
    const anillo = [...vertices, vertices[0]!].map(([la, ln]) => [ln, la]);
    const base = window.location.origin;
    const fc = JSON.parse(puntosGeoJSON(enZona, base)) as FeatureCollection;
    fc.features.unshift({ type: "Feature", geometry: { type: "Polygon", coordinates: [anillo] } as Geometry, properties: { tipo: "zona", area_m2: Math.round(areaPoligonoM2(vertices)), perimetro_m: Math.round(perimetro), negocios: enZona.length } });
    descargar("zona-negocios-verdes.geojson", JSON.stringify(fc), "application/geo+json");
  };

  const pestanaBtn = (t: Pestana, Icono: typeof Ruler, texto: string) => (
    <button key={t} type="button" onClick={() => setPestana(t)} aria-pressed={pestana === t} className={`flex flex-1 items-center justify-center gap-1.5 border-nv-texto2/60 px-2 py-1.5 text-[13px] first:rounded-l-full last:rounded-r-full [&:not(:first-child)]:border-l ${pestana === t ? "bg-nv-claro" : "bg-white hover:bg-stone-50"}`}>
      <Icono className="h-4 w-4" aria-hidden /> {texto}
    </button>
  );
  const herramienta = "flex h-10 w-10 items-center justify-center rounded-[8px] border-2 border-nv-oscuro bg-white text-nv-oscuro shadow hover:bg-nv-claro";
  const accion = "inline-flex items-center gap-1.5 rounded-[8px] border border-nv-vivo bg-white px-3 py-1.5 text-xs font-semibold text-nv-vivo hover:bg-nv-claro disabled:opacity-40";
  const check = (etiqueta: React.ReactNode, valor: boolean, cambiar: (v: boolean) => void) => (
    <label className="flex items-center gap-2 py-1 text-[13px]">
      <input type="checkbox" checked={valor} onChange={(e) => cambiar(e.target.checked)} className="h-4 w-4 accent-nv-primario" /> {etiqueta}
    </label>
  );

  return (
    <div className={`relative flex w-full ${embed ? "h-full" : "h-[calc(100dvh-110px)] min-h-[520px]"}`}>
      {panel && (
        <aside className="absolute inset-y-0 left-0 z-[1001] flex w-[300px] max-w-[85vw] flex-col border-r border-nv-borde bg-white md:static md:z-auto">
          <div className="flex items-center gap-2 px-3.5 pb-2 pt-3">
            <ScanSearch className="h-5 w-5 text-nv-oscuro" aria-hidden />
            <h1 className="flex-1 text-base font-semibold">Geovisor</h1>
            <button type="button" onClick={() => setPanel(false)} aria-label="Ocultar panel" className="rounded-full p-1 hover:bg-stone-100">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="mx-3.5 flex overflow-hidden rounded-full border border-nv-texto2/60" role="tablist">
            {pestanaBtn("filtrar", SlidersHorizontal, "Filtrar")}
            {pestanaBtn("capas", LayersIcon, "Capas")}
            {pestanaBtn("medir", Ruler, "Medir")}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-4 pt-3">
            {pestana === "filtrar" && (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-nv-texto2" aria-hidden />
                  <input
                    value={filtro.q}
                    onChange={(e) => set({ q: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (visibles.length === 1) irANegocio(visibles[0]!);
                        else if (visibles.length === 0) void buscarLugar();
                      }
                    }}
                    placeholder="Buscar un negocio o un lugar…"
                    aria-label="Buscar un negocio o un lugar"
                    className="w-full rounded-[8px] border border-nv-borde py-2.5 pl-9 pr-3 text-sm outline-none focus:border-nv-primario"
                  />
                </div>
                {sugerencias.length > 0 && (
                  <ul className="mt-1 overflow-hidden rounded-[8px] border border-nv-borde text-xs">
                    {sugerencias.map((p) => (
                      <li key={p.slug}>
                        <button type="button" onClick={() => irANegocio(p)} className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-nv-claro">
                          <MapPin className="h-3.5 w-3.5 flex-none text-nv-primario" aria-hidden />
                          <span className="truncate">
                            {p.nombre} · {p.municipio}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {filtro.q.trim().length >= 3 && (
                  <button type="button" onClick={() => void buscarLugar()} className="mt-1 flex w-full items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-left text-xs text-nv-primario hover:bg-nv-claro">
                    <Search className="h-3.5 w-3.5" aria-hidden /> Buscar «{filtro.q.trim()}» como lugar en el mapa
                  </button>
                )}
                {lugar && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-nv-texto2">
                    <MapPin className="h-3.5 w-3.5 text-nv-acento" aria-hidden /> Lugar: {lugar}
                    <button type="button" onClick={() => { extra.current?.clearLayers(); setLugar(null); }} aria-label="Quitar lugar" className="ml-auto">
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </p>
                )}

                {enVista.length > 0 && (
                  <>
                    <Rotulo>{enVista.length} negocios en la vista · por categoría</Rotulo>
                    {porCategoria.map(([k, v]) => (
                      <div key={k} className="flex items-center gap-1 py-0.5 text-[10.5px]">
                        <span className="w-24 truncate">{k}</span>
                        <span className="relative h-3 flex-1 bg-nv-borde/40">
                          <span className="absolute inset-y-0 left-0" style={{ width: `${maxCat ? (v / maxCat) * 100 : 0}%`, background: k === "Sin clasificar" ? "#5b6b60" : "#038f67" }} />
                        </span>
                        <span className="w-7 text-right font-semibold">{v}</span>
                      </div>
                    ))}
                  </>
                )}
                {hayFiltro && (
                  <button type="button" onClick={() => setFiltro({ q: "", municipio: "", categoria: "", reconocimiento: "" })} className={`${accion} mt-3`}>
                    <Undo2 className="h-3.5 w-3.5" aria-hidden /> Ver todo (quitar filtros)
                  </button>
                )}

                <div className="mt-3 border-t border-nv-borde" />
                <Rotulo>Por municipio</Rotulo>
                <ul>
                  {porMunicipio.map(([m, n]) => (
                    <li key={m}>
                      <button type="button" onClick={() => set({ municipio: filtro.municipio === m ? "" : m })} aria-pressed={filtro.municipio === m} className={`flex w-full items-center gap-2 rounded-[6px] px-1.5 py-1.5 text-left text-xs ${filtro.municipio === m ? "bg-nv-claro font-semibold" : "hover:bg-stone-50"}`}>
                        <MapPin className={`h-4 w-4 ${filtro.municipio === m ? "text-nv-acento" : "text-nv-texto2"}`} aria-hidden />
                        <span className="flex-1">{m}</span>
                        <span className="text-nv-texto2">{n}</span>
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 border-t border-nv-borde" />
                <Rotulo>Por categoría</Rotulo>
                <ul>
                  {categorias.map((c) => {
                    const n = visibles.filter((p) => p.categorias.includes(c.slug)).length;
                    const sel = filtro.categoria === c.slug;
                    return (
                      <li key={c.slug}>
                        <button type="button" onClick={() => set({ categoria: sel ? "" : c.slug })} aria-pressed={sel} className={`flex w-full items-center gap-2 rounded-[6px] px-1.5 py-1.5 text-left text-xs ${sel ? "bg-nv-claro font-semibold" : "hover:bg-stone-50"}`}>
                          <span className={`h-1.5 w-5 rounded-full ${sel ? "bg-nv-acento" : "bg-nv-vivo"}`} aria-hidden />
                          <span className="flex-1">{c.nombre}</span>
                          <span className="text-nv-texto2">{n}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <Rotulo>Reconocimiento</Rotulo>
                <select value={filtro.reconocimiento} onChange={(e) => set({ reconocimiento: e.target.value as FiltroMapaNV["reconocimiento"] })} aria-label="Reconocimiento" className="w-full rounded-[8px] border border-nv-borde bg-white px-2.5 py-2 text-[13px]">
                  <option value="">Todos los reconocimientos</option>
                  <option value="emprendimiento">Emprendimiento Verde</option>
                  <option value="avalado">Negocio Verde Avalado</option>
                  <option value="sello">Sello Marca</option>
                </select>

                <button type="button" onClick={enlace} className={`${accion} mt-4`}>
                  <Link2 className="h-3.5 w-3.5" aria-hidden /> Copiar enlace de esta vista
                </button>
                {sinUbicacion > 0 && <p className="mt-3 text-[11px] text-nv-texto2">{sinUbicacion} negocios publicados aún no tienen ubicación en el mapa; aparecen en el buscador.</p>}
              </>
            )}

            {pestana === "capas" && (
              <>
                {check(`Negocios verdes (${visibles.length})`, verNegocios, setVerNegocios)}
                {check("Límites municipales", verLimites, setVerLimites)}
                <div className="pl-6">{check("Etiquetas de municipio", verEtiquetas, setVerEtiquetas)}</div>
                <div className="mt-3 border-t border-nv-borde" />
                <Rotulo>Capas de contexto</Rotulo>
                <p className="mb-1 text-[11px] text-nv-texto2">Cada capa viene de la entidad externa que la produce (entre paréntesis) y solo trae lo que toca la jurisdicción.</p>
                {CAPAS.map((c) =>
                  check(
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 flex-none rounded-sm" style={{ background: c.color }} aria-hidden />
                      {c.etiqueta} <span className="text-[11px] text-nv-texto2">({c.fuente})</span>
                    </span>,
                    activas.includes(c.id),
                    (v) => setActivas((a) => (v ? [...a, c.id] : a.filter((x) => x !== c.id)))
                  )
                )}
                <div className="mt-3 border-t border-nv-borde" />
                <Rotulo>Leyenda</Rotulo>
                <ul className="space-y-1 text-xs">
                  <li className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full border-2 border-white bg-nv-vivo shadow" aria-hidden /> Negocio verde
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-nv-oscuro text-[8px] font-bold text-white" aria-hidden>
                      3
                    </span>
                    Grupo de negocios (acérquese para verlos)
                  </li>
                  {LEYENDA.map(([color, t]) => (
                    <li key={t} className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm border-2" style={{ borderColor: color, background: `${color}22` }} aria-hidden /> {t}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {pestana === "medir" && (
              <>
                <Rotulo>Herramientas</Rotulo>
                {check("Medir / seleccionar una zona", midiendo, (v) => { setMidiendo(v); if (!v) setVertices([]); })}
                {midiendo && (
                  <>
                    <div className="mt-2 flex overflow-hidden rounded-full border border-nv-texto2/60 text-[13px]">
                      {[false, true].map((z) => (
                        <button key={String(z)} type="button" onClick={() => setModoZona(z)} aria-pressed={modoZona === z} className={`flex-1 py-1.5 ${z ? "border-l border-nv-texto2/60" : ""} ${modoZona === z ? "bg-nv-claro" : "bg-white"}`}>
                          {z ? "Zona / área" : "Distancia"}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-nv-texto2">
                      {modoZona ? "Toque el mapa para marcar puntos. Con 3 o más se cierra la zona y se ven el perímetro, el área y los negocios de adentro." : "Toque el mapa para marcar el recorrido a medir (una vía, un lindero)."}
                    </p>
                    {vertices.length >= 2 && (
                      <p className="mt-2 whitespace-pre-line rounded-[8px] bg-nv-claro px-3 py-2 text-[13px] font-semibold text-nv-oscuro">
                        {esZona
                          ? `Perímetro: ${formatoDistancia(perimetro)}\nÁrea: ${formatoArea(areaPoligonoM2(vertices))}\nNegocios verdes dentro: ${enZona.length}`
                          : `Distancia total: ${formatoDistancia(distanciaLinea)}`}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" disabled={!vertices.length} onClick={() => setVertices((v) => v.slice(0, -1))} className={accion}>
                        <Undo2 className="h-3.5 w-3.5" aria-hidden /> Quitar punto
                      </button>
                      <button type="button" disabled={!vertices.length} onClick={() => setVertices([])} className={accion}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden /> Limpiar
                      </button>
                    </div>
                    {vertices.length > 0 && (
                      <>
                        <Rotulo>Puntos (lat, lng)</Rotulo>
                        <ol className="space-y-0.5 text-[11px] text-nv-texto2">
                          {vertices.map(([a, b], i) => (
                            <li key={i}>
                              {i + 1}. {a.toFixed(5)}, {b.toFixed(5)}
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                    {esZona && (
                      <>
                        {enZona.length > 0 && (
                          <ul className="mt-2 max-h-40 overflow-y-auto text-xs">
                            {enZona.map((p) => (
                              <li key={p.slug}>
                                <button type="button" onClick={() => irANegocio(p)} className="w-full truncate py-0.5 text-left hover:underline">
                                  · {p.nombre} · {p.municipio}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <button type="button" onClick={zonaGeoJSON} className={`${accion} mt-2`}>
                          <Download className="h-3.5 w-3.5" aria-hidden /> Descargar zona (GeoJSON)
                        </button>
                      </>
                    )}
                  </>
                )}
                <div className="mt-4 border-t border-nv-borde" />
                <Rotulo>Descargar lo que se ve ahora</Rotulo>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => descargar("negocios-verdes.geojson", puntosGeoJSON(visibles, window.location.origin), "application/geo+json")} className={accion}>
                    <Download className="h-3.5 w-3.5" aria-hidden /> GeoJSON ({visibles.length})
                  </button>
                  <button type="button" onClick={() => descargar("negocios-verdes.csv", puntosCsv(visibles, window.location.origin), "text/csv;charset=utf-8")} className={accion}>
                    <Download className="h-3.5 w-3.5" aria-hidden /> CSV
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-nv-texto2">Respeta los filtros activos (municipio, categoría, reconocimiento y búsqueda).</p>
              </>
            )}
          </div>
        </aside>
      )}

      <div className="relative min-w-0 flex-1">
        <div ref={contenedor} className="z-0 h-full w-full bg-[#e5e3df]" role="region" aria-label="Mapa de negocios verdes" />
        <div className="absolute left-3 top-3 z-[1000] flex flex-col gap-1.5">
          <button type="button" onClick={() => setPanel((v) => !v)} title={panel ? "Ocultar panel" : "Mostrar panel"} aria-label={panel ? "Ocultar panel" : "Mostrar panel"} className={herramienta}>
            <Layers className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={miUbicacion} title="Mi ubicación" aria-label="Mi ubicación" className={herramienta}>
            <Crosshair className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={() => void imagen()} title="Descargar imagen" aria-label="Descargar imagen" className={herramienta}>
            <Camera className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={() => setAyuda(true)} title="Ayuda" aria-label="Ayuda" className={herramienta}>
            <CircleHelp className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-1.5">
          <button type="button" onClick={() => mapa.current?.zoomIn()} aria-label="Acercar" className={herramienta}>
            <Plus className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={() => mapa.current?.zoomOut()} aria-label="Alejar" className={herramienta}>
            <Minus className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {aviso && (
          <p role="status" className="absolute bottom-8 left-1/2 z-[1000] max-w-[90%] -translate-x-1/2 break-all rounded-[8px] bg-nv-neutro px-4 py-2 text-sm text-white shadow-lg">
            {aviso}
          </p>
        )}
        {embed && (
          <a href="/negocios-verdes/geovisor" target="_blank" rel="noopener" className="absolute bottom-6 right-3 z-[1000] rounded-[8px] bg-white/90 px-2 py-1 text-[11px] text-nv-oscuro shadow hover:underline">
            Abrir el geovisor completo
          </a>
        )}
      </div>

      {ayuda && (
        <div role="dialog" aria-modal="true" aria-label="Cómo usar el geovisor" className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4" onClick={() => setAyuda(false)}>
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[16px] bg-white p-5 font-nv" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <CircleHelp className="h-5 w-5 text-nv-oscuro" aria-hidden />
              <h2 className="flex-1 text-lg font-semibold">Cómo usar el geovisor</h2>
              <button type="button" onClick={() => setAyuda(false)} aria-label="Cerrar ayuda">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {[
              ["¿Qué es?", ["Muestra los negocios verdes registrados por la CDMB sobre el mapa, con capas oficiales de contexto (municipios, áreas protegidas, ríos). No hay que registrarse."]],
              ["Moverse por el mapa", ["Arrastre para desplazarse; use la rueda del mouse o los botones + / − para acercar y alejar.", "El botón de diana («Mi ubicación») centra el mapa donde usted está (el navegador pedirá permiso).", "El botón de cámara descarga una imagen PNG del mapa."]],
              ["Pestaña «Filtrar»", ["Escriba el nombre de un negocio para saltar a él. Si escribe un lugar («Girón», «Vetas») aparece la opción de buscarlo como lugar en el mapa.", "Filtre por municipio, categoría y reconocimiento. Arriba, un mini gráfico muestra cómo se reparten los negocios de la vista.", "«Ver todo» quita los filtros. «Copiar enlace de esta vista» da un enlace que abre el geovisor con los mismos filtros."]],
              ["Pestaña «Capas»", ["Encienda o apague los negocios, los límites municipales y las capas de contexto. Estas vienen de la entidad externa que las produce, señalada entre paréntesis: áreas protegidas (RUNAP), páramos (MADS), veredas (DANE), hidrografía y subzonas (IDEAM), áreas de aves (Humboldt) y bosque seco (MADS).", "La leyenda al final explica cada color."]],
              ["Pestaña «Medir»", ["Marque «Medir / seleccionar una zona» y toque el mapa para poner puntos. Elija entre medir una distancia (línea) o una zona (polígono).", "Con 2 puntos ve la distancia. Con 3 o más se cierra la zona y ve el perímetro, el área y los negocios verdes de adentro, que puede descargar en GeoJSON."]],
            ].map(([t, ps]) => (
              <div key={t as string} className="mb-3">
                <h3 className="text-sm font-semibold text-nv-oscuro">{t as string}</h3>
                {(ps as string[]).map((p) => (
                  <p key={p} className="mt-1 text-[13px] text-nv-texto2">
                    {p}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
