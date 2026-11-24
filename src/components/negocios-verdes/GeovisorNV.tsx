"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Download, Layers, Link2, Search } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { FeatureCollection } from "geojson";
import { colorCategoria, escribirVistaMapa, filtrarPuntos, leerVistaMapa, puntosCsv, puntosGeoJSON, type FiltroMapaNV, type PuntoMapaNV } from "@/lib/negocios-verdes-mapa";
import { MUNICIPIOS_NV } from "@/lib/negocios-verdes";

/** Capas de contexto: los mismos archivos del geovisor de trámites (public/geo), que vienen de la plataforma anterior. */
const CAPAS: readonly { id: string; etiqueta: string; fuente: string; archivo: string; color: string; soloContorno?: boolean }[] = [
  { id: "municipios", etiqueta: "Municipios de la jurisdicción", fuente: "OpenStreetMap", archivo: "/geo/municipios_cdmb.geojson", color: "#166534", soloContorno: true },
  { id: "areas", etiqueta: "Áreas protegidas", fuente: "RUNAP", archivo: "/geo/areas_protegidas_cdmb.geojson", color: "#1E6B3E" },
  { id: "paramos", etiqueta: "Páramos delimitados", fuente: "MADS", archivo: "/geo/paramos_cdmb.geojson", color: "#5E35B1" },
  { id: "veredas", etiqueta: "Veredas", fuente: "DANE", archivo: "/geo/veredas_cdmb.geojson", color: "#8D6E63", soloContorno: true },
  { id: "hidro", etiqueta: "Ríos y cuerpos de agua", fuente: "IDEAM", archivo: "/geo/hidrografia_cdmb.geojson", color: "#3D7EB8" },
  { id: "aicas", etiqueta: "Áreas de conservación de aves (AICA)", fuente: "Instituto Humboldt", archivo: "/geo/aicas_cdmb.geojson", color: "#00897B" },
  { id: "bosque_seco", etiqueta: "Bosque seco tropical", fuente: "MADS", archivo: "/geo/bosque_seco_cdmb.geojson", color: "#C17817" },
  { id: "subzonas", etiqueta: "Subzonas hidrográficas", fuente: "IDEAM", archivo: "/geo/subzonas_cdmb.geojson", color: "#1565C0", soloContorno: true },
];

const CENTRO: [number, number] = [7.12, -73.1];
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function descargar(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type VistaMapa = ReturnType<typeof leerVistaMapa>;

export function GeovisorNV({ puntos, categorias, sinUbicacion, inicial, embed = false }: { puntos: PuntoMapaNV[]; categorias: { slug: string; nombre: string }[]; sinUbicacion: number; inicial: VistaMapa; embed?: boolean }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<import("leaflet").Map | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const grupo = useRef<import("leaflet").MarkerClusterGroup | null>(null);
  const capas = useRef<Record<string, import("leaflet").GeoJSON>>({});
  const ubicacion = useRef<import("leaflet").Layer | null>(null);
  const [filtro, setFiltro] = useState<FiltroMapaNV>(inicial.filtro);
  const [activas, setActivas] = useState<string[]>(inicial.capas.length ? inicial.capas : ["municipios"]);
  const vistaInicial = useRef(inicial.vista);
  const [listo, setListo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [panel, setPanel] = useState<"filtrar" | "capas">("filtrar");
  const visibles = useMemo(() => filtrarPuntos(puntos, filtro), [puntos, filtro]);
  const destino = embed ? "_blank" : "_self";

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
      const m = Lmod.map(contenedor.current, { scrollWheelZoom: !embed, zoomControl: true });
      const v = vistaInicial.current;
      m.setView(v ? [v[0], v[1]] : CENTRO, v ? v[2] : 10);
      Lmod.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>', maxZoom: 19 }).addTo(m);
      grupo.current = Lmod.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 }).addTo(m);
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

  // Marcadores según el filtro.
  useEffect(() => {
    const Lmod = L.current;
    const g = grupo.current;
    if (!listo || !Lmod || !g) return;
    g.clearLayers();
    for (const p of visibles) {
      const color = colorCategoria(p.categoria?.slug);
      const icono = Lmod.divIcon({
        className: "",
        html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const sellos = [p.avalado && "Avalado", p.selloMarca && "Sello Marca", p.emprendimientoVerde && "Emprendimiento Verde"].filter(Boolean).join(" · ");
      const html = `<div style="min-width:200px;max-width:240px">
        ${p.fotoUrl ? `<img src="${esc(p.fotoUrl)}" alt="" style="width:100%;height:110px;object-fit:cover;border-radius:6px;margin-bottom:6px">` : ""}
        <strong style="font-size:14px">${esc(p.nombre)}</strong><br>
        <span style="color:#57534e">${esc(p.municipio)}${p.vereda ? ` · ${esc(p.vereda)}` : ""}</span><br>
        ${p.categoria ? `<span style="color:${color}">${esc(p.categoria.nombre)}</span><br>` : ""}
        ${sellos ? `<span style="color:#047857;font-size:12px">${esc(sellos)}</span><br>` : ""}
        <div style="margin-top:6px;display:flex;gap:10px">
          <a href="/negocios-verdes/negocio/${encodeURIComponent(p.slug)}" target="${destino}" style="color:#047857;font-weight:600">Ver ficha</a>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" rel="noopener" style="color:#047857">Cómo llegar</a>
        </div></div>`;
      Lmod.marker([p.lat, p.lng], { icon: icono, title: p.nombre }).bindPopup(html).addTo(g);
    }
  }, [visibles, listo, destino]);

  // Capas de contexto (se descargan al encenderlas).
  useEffect(() => {
    const Lmod = L.current;
    const m = mapa.current;
    if (!listo || !Lmod || !m) return;
    for (const c of CAPAS) {
      const on = activas.includes(c.id);
      const capa = capas.current[c.id];
      if (!on && capa) m.removeLayer(capa);
      if (on && capa && !m.hasLayer(capa)) capa.addTo(m);
      if (on && !capa) {
        fetch(c.archivo)
          .then((r) => r.json() as Promise<FeatureCollection>)
          .then((geo) => {
            if (capas.current[c.id]) return;
            const nueva = Lmod.geoJSON(geo, {
              interactive: c.id !== "municipios",
              style: { color: c.color, weight: c.soloContorno ? 1.2 : 1, fillColor: c.color, fillOpacity: c.soloContorno ? 0 : 0.18 },
              onEachFeature: (f, capa) => {
                const n = (f.properties as { nombre?: string } | null)?.nombre;
                if (n) capa.bindTooltip(`${esc(n)} <span style="color:#78716c">(${esc(c.fuente)})</span>`, { sticky: true });
              },
            });
            capas.current[c.id] = nueva;
            if (mapa.current) {
              nueva.addTo(mapa.current);
              nueva.bringToBack();
            }
          })
          .catch(() => setAviso(`No se pudo cargar la capa «${c.etiqueta}».`));
      }
    }
  }, [activas, listo]);

  // Al elegir un municipio, el mapa se acerca a sus negocios.
  const municipioAnterior = useRef(inicial.filtro.municipio);
  useEffect(() => {
    if (!listo || filtro.municipio === municipioAnterior.current) return;
    municipioAnterior.current = filtro.municipio;
    const m = mapa.current;
    const Lmod = L.current;
    if (!m || !Lmod) return;
    if (!filtro.municipio || visibles.length === 0) m.setView(CENTRO, 10);
    else m.fitBounds(Lmod.latLngBounds(visibles.map((p) => [p.lat, p.lng] as [number, number])).pad(0.15), { maxZoom: 14 });
  }, [filtro.municipio, visibles, listo]);

  const encuadrar = () => {
    const m = mapa.current;
    const Lmod = L.current;
    if (!m || !Lmod || visibles.length === 0) return;
    m.fitBounds(Lmod.latLngBounds(visibles.map((p) => [p.lat, p.lng] as [number, number])).pad(0.1), { maxZoom: 15 });
  };

  const miUbicacion = () => {
    if (!navigator.geolocation) return setAviso("Este navegador no permite conocer la ubicación.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const m = mapa.current;
        const Lmod = L.current;
        if (!m || !Lmod) return;
        if (ubicacion.current) m.removeLayer(ubicacion.current);
        ubicacion.current = Lmod.circleMarker([pos.coords.latitude, pos.coords.longitude], { radius: 8, color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }).bindTooltip("Usted está aquí").addTo(m);
        m.setView([pos.coords.latitude, pos.coords.longitude], 14);
      },
      () => setAviso("No se pudo obtener su ubicación (permiso denegado o sin señal)."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const enlace = async () => {
    const m = mapa.current;
    const c = m?.getCenter();
    const q = escribirVistaMapa(filtro, activas, c && m ? [c.lat, c.lng, m.getZoom()] : null);
    const url = `${window.location.origin}/negocios-verdes/geovisor${q ? `?${q}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      setAviso("Enlace de esta vista copiado.");
    } catch {
      setAviso(url);
    }
  };

  const set = (c: Partial<FiltroMapaNV>) => setFiltro((f) => ({ ...f, ...c }));
  const campo = "w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm";
  const boton = "inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50";

  return (
    <div className={`flex flex-col gap-3 ${embed ? "h-full" : "lg:flex-row"}`}>
      <aside className={`space-y-3 ${embed ? "" : "lg:w-80 lg:flex-none"}`}>
        {!embed && (
          <div className="flex gap-1 rounded-lg bg-stone-100 p-1 text-sm">
            {(["filtrar", "capas"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setPanel(t)} className={`flex-1 rounded-md px-3 py-1.5 font-medium ${panel === t ? "bg-white text-emerald-800 shadow-sm" : "text-stone-600"}`}>
                {t === "filtrar" ? "Filtrar" : "Capas"}
              </button>
            ))}
          </div>
        )}
        {(panel === "filtrar" || embed) && (
          <div className={`grid gap-2 ${embed ? "sm:grid-cols-4" : ""}`}>
            <label className="relative">
              <span className="sr-only">Buscar</span>
              <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-stone-400" aria-hidden />
              <input value={filtro.q} onChange={(e) => set({ q: e.target.value })} placeholder="Buscar negocio o producto" className={`${campo} pl-8`} />
            </label>
            <select value={filtro.municipio} onChange={(e) => set({ municipio: e.target.value })} className={campo} aria-label="Municipio">
              <option value="">Todos los municipios</option>
              {MUNICIPIOS_NV.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <select value={filtro.categoria} onChange={(e) => set({ categoria: e.target.value })} className={campo} aria-label="Categoría">
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <select value={filtro.reconocimiento} onChange={(e) => set({ reconocimiento: e.target.value as FiltroMapaNV["reconocimiento"] })} className={campo} aria-label="Reconocimiento">
              <option value="">Cualquier reconocimiento</option>
              <option value="avalado">Negocio Verde Avalado</option>
              <option value="sello">Sello Marca</option>
              <option value="emprendimiento">Emprendimiento Verde</option>
            </select>
          </div>
        )}
        {panel === "capas" && !embed && (
          <fieldset className="space-y-1.5">
            <legend className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-stone-800">
              <Layers className="h-4 w-4" aria-hidden /> Capas
            </legend>
            {CAPAS.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-stone-700">
                <input type="checkbox" checked={activas.includes(c.id)} onChange={(e) => setActivas((a) => (e.target.checked ? [...a, c.id] : a.filter((x) => x !== c.id)))} />
                <span className="h-3 w-3 flex-none rounded-sm" style={{ background: c.color }} aria-hidden />
                <span className="flex-1">{c.etiqueta}</span>
                <span className="text-xs text-stone-400">{c.fuente}</span>
              </label>
            ))}
            <p className="pt-1 text-xs text-stone-500">Capas de referencia, no cartografía oficial de la CDMB.</p>
          </fieldset>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
          <span>
            <strong className="text-stone-900">{visibles.length}</strong> de {puntos.length} negocios en el mapa
          </span>
          {Object.values(filtro).some(Boolean) && (
            <button type="button" onClick={() => setFiltro({ q: "", municipio: "", categoria: "", reconocimiento: "" })} className="text-emerald-700 hover:underline">
              Quitar filtros
            </button>
          )}
        </div>
        {!embed && (
          <>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={encuadrar} className={boton}>Ver todos</button>
              <button type="button" onClick={miUbicacion} className={boton}>
                <Crosshair className="h-3.5 w-3.5" aria-hidden /> Mi ubicación
              </button>
              <button type="button" onClick={enlace} className={boton}>
                <Link2 className="h-3.5 w-3.5" aria-hidden /> Copiar enlace
              </button>
              <button type="button" onClick={() => descargar("negocios-verdes.csv", puntosCsv(visibles, window.location.origin), "text/csv;charset=utf-8")} className={boton}>
                <Download className="h-3.5 w-3.5" aria-hidden /> CSV
              </button>
              <button type="button" onClick={() => descargar("negocios-verdes.geojson", puntosGeoJSON(visibles, window.location.origin), "application/geo+json")} className={boton}>
                <Download className="h-3.5 w-3.5" aria-hidden /> GeoJSON
              </button>
            </div>
            <ul className="space-y-1 text-xs text-stone-600">
              {[
                ["bioproductos", "Bioproductos y servicios sostenibles"],
                ["ecoproductos", "Ecoproductos industriales"],
                ["calidad-ambiental", "Calidad ambiental"],
                ["", "Otra o sin clasificar"],
              ].map(([s, n]) => (
                <li key={n} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-white shadow" style={{ background: colorCategoria(s || undefined) }} aria-hidden />
                  {n}
                </li>
              ))}
            </ul>
            {sinUbicacion > 0 && <p className="text-xs text-stone-500">{sinUbicacion} negocios publicados aún no tienen ubicación en el mapa; aparecen en el buscador.</p>}
          </>
        )}
        {aviso && (
          <p role="status" className="break-all rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {aviso}
          </p>
        )}
      </aside>
      <div ref={contenedor} className={`z-0 w-full overflow-hidden rounded-xl border border-stone-200 ${embed ? "min-h-[360px] flex-1" : "h-[70vh] min-h-[420px]"}`} role="region" aria-label="Mapa de negocios verdes" />
    </div>
  );
}
