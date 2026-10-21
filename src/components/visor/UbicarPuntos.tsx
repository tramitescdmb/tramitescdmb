"use client";

import { useRef, useState } from "react";
import type { Feature, FeatureCollection } from "geojson";
import { Search, Loader2, MapPin, Plus, Info } from "lucide-react";
import { normalizar } from "@/lib/cargos";
import { puntoEnGeometria, type GeometriaPoligono } from "@/lib/jurisdiccion-cdmb";
import { interpretarPuntos } from "@/lib/puntos-entrada";

type Resultado = { clave: string; nombre: string; detalle: string; punto: [number, number] };

function puntoRepresentativo(geom: GeometriaPoligono): [number, number] | null {
  const anillos = geom.type === "Polygon" ? [geom.coordinates[0]] : geom.coordinates.map((p) => p[0]);
  const mayor = anillos.filter(Boolean).sort((a, b) => b!.length - a!.length)[0];
  if (!mayor || mayor.length === 0) return null;
  const lon = mayor.reduce((s, c) => s + c[0]!, 0) / mayor.length;
  const lat = mayor.reduce((s, c) => s + c[1]!, 0) / mayor.length;
  if (puntoEnGeometria(lat, lon, geom)) return [lat, lon];
  const lons = mayor.map((c) => c[0]!);
  const lats = mayor.map((c) => c[1]!);
  const centro: [number, number] = [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lons) + Math.max(...lons)) / 2];
  if (puntoEnGeometria(centro[0], centro[1], geom)) return centro;
  const [a, b] = [mayor[0]!, mayor[Math.floor(mayor.length / 2)]!];
  return [(a[1]! + b[1]!) / 2, (a[0]! + b[0]!) / 2];
}

let veredasCache: Promise<Feature[]> | null = null;
function cargarVeredas(): Promise<Feature[]> {
  veredasCache ??= fetch("/geo/veredas_cdmb.geojson")
    .then((r) => r.json() as Promise<FeatureCollection>)
    .then((fc) => fc.features)
    .catch(() => {
      veredasCache = null;
      return [];
    });
  return veredasCache;
}

export function UbicarPuntos({
  destino,
  municipios,
  onAgregar,
}: {
  destino: "medir" | "cerca";
  municipios: FeatureCollection | null;
  onAgregar: (puntos: [number, number][]) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const turno = useRef(0);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const q = consulta.trim();
    if (q.length < 3) return;
    const mio = ++turno.current;
    setBuscando(true);
    setAviso(null);
    const n = normalizar(q);
    const coincide = (f: Feature) => normalizar(String(f.properties?.nombre ?? "")).includes(n);
    const [veredas, externos] = await Promise.all([
      cargarVeredas(),
      fetch(`/api/geocodificar?lista=1&q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { resultados: [] }))
        .then((b: { resultados?: { lat: number; lon: number; nombre: string }[] }) => b.resultados ?? [])
        .catch(() => []),
    ]);
    if (mio !== turno.current) return;
    const locales: Resultado[] = [];
    for (const [tipo, lista] of [
      ["Municipio", municipios?.features ?? []],
      ["Vereda", veredas],
    ] as const) {
      for (const f of lista.filter(coincide).slice(0, 8)) {
        const punto = f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") ? puntoRepresentativo(f.geometry as GeometriaPoligono) : null;
        if (!punto) continue;
        const municipio = f.properties?.municipio ? ` · ${f.properties.municipio}` : "";
        locales.push({ clave: `${tipo}-${f.properties?.codigo ?? f.properties?.nombre}-${locales.length}`, nombre: String(f.properties?.nombre), detalle: `${tipo}${municipio}`, punto });
      }
    }
    const enJurisdiccion = (lat: number, lon: number) =>
      !municipios || municipios.features.some((f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") && puntoEnGeometria(lat, lon, f.geometry as GeometriaPoligono));
    const direcciones: Resultado[] = externos.filter((r) => enJurisdiccion(r.lat, r.lon)).map((r, i) => {
      const [nombre, ...resto] = r.nombre.split(",");
      return { clave: `dir-${i}`, nombre: nombre!.trim(), detalle: resto.slice(0, 3).join(",").trim(), punto: [r.lat, r.lon] };
    });
    setResultados([...locales, ...direcciones]);
    setBuscando(false);
  }

  function agregarTexto() {
    const lineas = interpretarPuntos(texto);
    const validos = lineas.filter((l) => l.punto).map((l) => l.punto!);
    const malas = lineas.filter((l) => !l.punto).map((l) => l.linea);
    if (validos.length === 0) {
      setAviso({ ok: false, texto: "No se reconoció ninguna coordenada dentro de la jurisdicción." });
      return;
    }
    onAgregar(destino === "cerca" ? [validos[validos.length - 1]!] : validos);
    setAviso({
      ok: malas.length === 0,
      texto: `${validos.length} punto${validos.length === 1 ? "" : "s"} agregado${validos.length === 1 ? "" : "s"}${malas.length ? `; líneas no reconocidas: ${malas.join(", ")}` : ""}.`,
    });
    if (malas.length === 0) setTexto("");
  }

  return (
    <div className="space-y-2 rounded-md border border-stone-200 bg-stone-50/60 p-2">
      <form onSubmit={buscar} className="flex gap-1">
        <input
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Dirección, vereda o municipio"
          className="min-w-0 flex-1 rounded border border-stone-300 bg-white px-2 py-1 text-xs"
        />
        <button type="submit" disabled={buscando || consulta.trim().length < 3} title="Buscar" aria-label="Buscar" className="rounded border border-stone-300 bg-white px-2 text-stone-600 hover:bg-stone-100 disabled:opacity-40">
          {buscando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Search className="h-3.5 w-3.5" aria-hidden />}
        </button>
      </form>

      {resultados && (
        <ul className="max-h-40 overflow-y-auto rounded border border-stone-200 bg-white text-[11px]">
          {resultados.length === 0 && <li className="px-2 py-1.5 text-stone-400">Sin resultados.</li>}
          {resultados.map((r) => (
            <li key={r.clave}>
              <button
                type="button"
                onClick={() => {
                  onAgregar([r.punto]);
                  setAviso({ ok: true, texto: `Punto agregado: ${r.nombre}.` });
                }}
                className="flex w-full items-start gap-1.5 px-2 py-1.5 text-left hover:bg-stone-50"
              >
                <MapPin className="mt-0.5 h-3 w-3 flex-none text-acento-600" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-stone-700">{r.nombre}</span>
                  {r.detalle && <span className="block truncate text-stone-400">{r.detalle}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-stone-500">
          Coordenadas{destino === "medir" ? " (una por línea)" : ""}
          <span
            className="cursor-help text-stone-400"
            title={"Formatos aceptados:\n7.1193, -73.1227 (decimales)\n7°07'09\"N 73°07'22\"W\nNorte Este planas MAGNA (origen Bogotá o nacional): 1277000 1105000\nSe puede anteponer un nombre: P1; 7.1193; -73.1227"}
          >
            <Info className="h-3 w-3" aria-hidden />
          </span>
        </div>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={destino === "medir" ? 3 : 1}
          placeholder={destino === "medir" ? "7.1193, -73.1227\n7.1250, -73.1180" : "7.1193, -73.1227"}
          className="w-full resize-y rounded border border-stone-300 bg-white px-2 py-1 font-mono text-[11px]"
        />
        <button
          type="button"
          onClick={agregarTexto}
          disabled={!texto.trim()}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {destino === "medir" ? "Agregar puntos" : "Ubicar punto"}
        </button>
      </div>

      {aviso && <p className={`text-[11px] ${aviso.ok ? "text-emerald-700" : "text-amber-700"}`}>{aviso.texto}</p>}
    </div>
  );
}
