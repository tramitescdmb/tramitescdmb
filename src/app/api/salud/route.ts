import fs from "fs/promises";
import { constants } from "fs";
import { NextResponse } from "next/server";
import { almacenLocal } from "@/lib/almacen";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Estado de la plataforma para la vigilancia externa (sin datos sensibles):
 * 200 si responden la base de datos y el NAS, 503 si falla alguno.
 */
export async function GET() {
  const estado = { baseDeDatos: false, almacenamiento: false };
  try {
    await db.$queryRaw`SELECT 1`;
    estado.baseDeDatos = true;
  } catch {
    /* queda en false */
  }
  try {
    const carpeta = almacenLocal();
    if (carpeta) {
      await fs.access(carpeta, constants.R_OK | constants.W_OK);
      estado.almacenamiento = true;
    }
  } catch {
    /* queda en false */
  }
  const ok = estado.baseDeDatos && estado.almacenamiento;
  return NextResponse.json({ ok, ...estado }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
