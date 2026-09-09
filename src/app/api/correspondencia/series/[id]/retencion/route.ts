import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

/**
 * Config de retención/tomos de una serie: desde cuándo cuenta la retención
 * (MoReq 2.6) y el máximo de folios por tomo (MoReq 1.43).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(req.headers.get("referer") || "/correspondencia/expedientes", req.url);
  volver.search = "";
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    await registrarAccesoDenegadoAccion("configurar retención de una serie", id, session, req.headers);
    volver.searchParams.set("error", "No tiene permiso para administrar el archivo.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const serie = await db.serieDocumental.findUnique({ where: { id }, select: { codigo: true } });
  if (!serie) {
    volver.searchParams.set("error", "La serie no existe.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const desde = String(form.get("retencionDesde") || "RADICACION") === "CIERRE_EXPEDIENTE" ? "CIERRE_EXPEDIENTE" : "RADICACION";
  const maxRaw = Number(form.get("maxFoliosPorTomo"));
  const maxFoliosPorTomo = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.round(maxRaw) : null;

  await db.serieDocumental.update({ where: { id }, data: { retencionDesde: desde, maxFoliosPorTomo } });

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "SerieDocumental",
    entidadId: id,
    accion: "MODIFICA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Serie ${serie.codigo}: retención desde ${desde}${maxFoliosPorTomo ? `, tomos de ${maxFoliosPorTomo} folios` : ""}`,
  }).catch((err) => console.error("registrarAuditoriaDoc (retencion) falló:", err));

  volver.searchParams.set("ok", "Configuración de retención de la serie actualizada.");
  return NextResponse.redirect(volver, { status: 303 });
}
