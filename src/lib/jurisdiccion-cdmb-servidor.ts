// Carga del GeoJSON de límites municipales desde disco — SOLO para código de servidor (usa `fs`).
// Los componentes cliente usan `cargarJurisdiccionCdmb()` de jurisdiccion-cdmb.ts (fetch del archivo
// público) en vez de este módulo, para no arrastrar `fs` al bundle del navegador.
import { readFileSync } from "node:fs";
import path from "node:path";
import { puntoDentroDeFeatures, type ColeccionPoligonos } from "@/lib/jurisdiccion-cdmb";

let cache: ColeccionPoligonos | null = null;

function cargarJurisdiccionCdmbServidor(): ColeccionPoligonos {
  cache ??= JSON.parse(readFileSync(path.join(process.cwd(), "public", "geo", "municipios_cdmb.geojson"), "utf8"));
  return cache!;
}

export function puntoEnJurisdiccionCdmb(lat: number, lon: number): boolean {
  return puntoDentroDeFeatures(lat, lon, cargarJurisdiccionCdmbServidor());
}
