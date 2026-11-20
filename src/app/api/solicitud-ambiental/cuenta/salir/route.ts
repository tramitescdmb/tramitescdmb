import { NextRequest, NextResponse } from "next/server";
import { origenPermitido } from "@/lib/cuenta-ciudadana";
import { cerrarSesionCiudadana } from "@/lib/cuenta-ciudadana-db";

export async function POST(req: NextRequest) {
  if (!origenPermitido(req.headers)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 403 });
  await cerrarSesionCiudadana();
  return NextResponse.json({ ok: true });
}
