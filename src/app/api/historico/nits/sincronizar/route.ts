import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";
import { refrescarSnapshotNit } from "@/lib/sinca-nit-stats";
import { sincaConfigurado } from "@/lib/sinca";

// Recorre TODO /presinca/nit (33k+ filas, per_page=-1) y lo reagrupa — ver sinca-nit-stats.ts.
export const maxDuration = 300;

/**
 * GET  → cron diario de Vercel (Authorization: Bearer <CRON_SECRET>). Es la única forma en que
 *        un NIT o una vinculación nueva en SINCA 1.0 (ej. una resolución de fondo nueva sobre un
 *        NIT ya existente) queda reflejada aquí: el snapshot no "se entera" solo, hay que
 *        recalcularlo — por eso hace falta este cron y no basta con que el dato ya exista en SINCA 1.0.
 * POST → botón "Sincronizar" del panel /historico/nits. Solo ADMIN.
 */
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!sincaConfigurado()) {
    return NextResponse.json({ error: "SINCA 1.0 no está configurado." }, { status: 503 });
  }

  try {
    const snapshot = await refrescarSnapshotNit();
    return NextResponse.json({ ok: true, entidades: snapshot.entidades.length, vinculaciones: snapshot.totalVinculaciones });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede sincronizar." }, { status: 403 });
  }

  const volver = new URL("/historico/nits", req.url);
  if (!sincaConfigurado()) {
    volver.searchParams.set("error", "La conexión con SINCA 1.0 no está configurada en este servidor.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  try {
    const snapshot = await refrescarSnapshotNit();
    await registrarAuditoria({
      tipo: "CONFIGURACION_ACTUALIZADA",
      descripcion: `${session.nombre} sincronizó NIT / Terceros de SINCA 1.0 (${snapshot.entidades.length} terceros, ${snapshot.totalVinculaciones} vinculaciones).`,
      usuarioId: session.userId,
    });
    volver.searchParams.set("ok", `Actualizado: ${snapshot.entidades.length} terceros, ${snapshot.totalVinculaciones} vinculaciones.`);
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo sincronizar con SINCA 1.0.");
  }
  return NextResponse.redirect(volver, { status: 303 });
}
