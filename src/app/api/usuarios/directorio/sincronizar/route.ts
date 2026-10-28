import { NextRequest, NextResponse } from "next/server";
import { sincronizarDirectorioNocturno } from "@/lib/directorio-usuarios";
import { registrarEjecucion } from "@/lib/procesos-programados";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return NextResponse.json(await registrarEjecucion("directorio", "programado", null, () => sincronizarDirectorioNocturno()));
}
