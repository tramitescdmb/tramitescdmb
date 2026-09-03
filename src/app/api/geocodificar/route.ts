import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";

/**
 * Proxy a Nominatim (buscador de OpenStreetMap, gratis, sin API key). Se
 * hace desde el servidor y no directo desde el navegador porque Nominatim
 * pide identificarse con un User-Agent — un fetch() del navegador no puede
 * fijar ese header (el navegador lo controla), así que el servidor sí puede.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Falta el parámetro q." }, { status: 400 });

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "co");

  const res = await fetch(url, {
    headers: { "User-Agent": "tramitescdmb-app/1.0 (uso interno CDMB)" },
  });
  if (!res.ok) {
    return NextResponse.json({ error: "El buscador de direcciones no respondió." }, { status: 502 });
  }

  const resultados = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (resultados.length === 0) {
    return NextResponse.json({ error: "No se encontró esa dirección." }, { status: 404 });
  }

  const primero = resultados[0];
  return NextResponse.json({
    lat: Number(primero.lat),
    lon: Number(primero.lon),
    nombre: primero.display_name,
  });
}
