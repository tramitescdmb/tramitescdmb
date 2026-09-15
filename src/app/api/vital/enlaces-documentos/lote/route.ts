import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario } from "@/lib/permisos";

/**
 * Guarda de una vez varios enlaces de VITAL/SILPA con los adjuntos (uno por línea) — mismo campo que
 * `POST /api/vital/[id]/enlace-documentos`, pero para pegar el resultado de una sesión completa en
 * SILAM (varias solicitudes de una vez) en lugar de una por una. Cada línea se identifica sola por su
 * `NumSilpa` (=`idVital`) — no hace falta indicar a qué solicitud corresponde cada una.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/vital", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });

  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!permisos.esAdmin) {
    volver.searchParams.set("error", "Solo un administrador puede guardar estos enlaces.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const lineas = String(form.get("enlaces") || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let guardados = 0;
  const noEncontrados: string[] = [];
  const invalidos: string[] = [];

  for (const linea of lineas) {
    let url: URL;
    try {
      url = new URL(linea);
    } catch {
      invalidos.push(linea.slice(0, 60));
      continue;
    }
    if (url.hostname !== "vital.minambiente.gov.co") {
      invalidos.push(linea.slice(0, 60));
      continue;
    }
    const numSilpa = url.searchParams.get("NumSilpa");
    if (!numSilpa) {
      invalidos.push(linea.slice(0, 60));
      continue;
    }
    const solicitud = await db.solicitudVital.findUnique({ where: { idVital: numSilpa }, select: { id: true } });
    if (!solicitud) {
      noEncontrados.push(numSilpa);
      continue;
    }
    await db.solicitudVital.update({ where: { id: solicitud.id }, data: { enlaceDocumentosSilpa: linea } });
    guardados++;
  }

  const partes = [`${guardados} enlace(s) guardado(s).`];
  if (noEncontrados.length) partes.push(`No están sincronizadas todavía: ${noEncontrados.join(", ")}.`);
  if (invalidos.length) partes.push(`Líneas no reconocidas (no son una URL de vital.minambiente.gov.co con NumSilpa): ${invalidos.length}.`);
  volver.searchParams.set("ok", partes.join("\n"));
  return NextResponse.redirect(volver, { status: 303 });
}
