import { NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { catalogoSeriesBuscablesCacheado } from "@/lib/trd-clasificacion";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const series = await catalogoSeriesBuscablesCacheado();
  return NextResponse.json({ series }, { headers: { "Cache-Control": "private, max-age=300" } });
}
