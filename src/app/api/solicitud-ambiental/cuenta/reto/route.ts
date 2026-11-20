import { NextResponse } from "next/server";
import { DIFICULTAD_RETO_BITS, crearReto } from "@/lib/cuenta-ciudadana";

export const dynamic = "force-dynamic";

/** Reto de la prueba anti-robots que el navegador resuelve antes de pedir un código de ingreso. */
export async function GET() {
  return NextResponse.json({ reto: crearReto(), dificultad: DIFICULTAD_RETO_BITS }, { headers: { "Cache-Control": "no-store" } });
}
