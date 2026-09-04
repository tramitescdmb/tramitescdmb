import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verificarSesion as getSession } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";
import { sincronizarResoluciones } from "@/lib/sinca-sync";
import { sincaConfigurado } from "@/lib/sinca";
import { refrescarSnapshotNit } from "@/lib/sinca-nit-stats";

// La sincronización recorre ~6 páginas del API + un reemplazo por lotes + un
// pequeño lote de enriquecimiento. Se pide más que los 10 s por defecto; en el
// plan Hobby de Vercel el tope efectivo es menor y el enriquecimiento que no
// alcance se retoma en la siguiente corrida (es idempotente).
export const maxDuration = 300;

/**
 * GET  → lo llama el cron diario de Vercel. Se autoriza con el header
 *        `Authorization: Bearer <CRON_SECRET>` (Vercel lo agrega solo cuando
 *        existe la variable CRON_SECRET).
 * POST → botón "Sincronizar ahora" del panel /historico. Solo ADMIN.
 */
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  const autorizado = secreto && req.headers.get("authorization") === `Bearer ${secreto}`;
  if (!autorizado) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!sincaConfigurado()) {
    return NextResponse.json({ error: "SINCA 1.0 no está configurado." }, { status: 503 });
  }

  // No se invalida la caché de análisis aquí: el TTL de 1 h ya la mantiene
  // fresca y así el cron diario no obliga a recalcular (lento) en la siguiente
  // visita. El botón manual sí la invalida (ver POST).
  const resultado = await sincronizarResoluciones("cron");

  // Encadenado aquí (no un cron aparte en vercel.json) para que una resolución de fondo nueva
  // sobre un NIT ya existente quede vinculada el mismo día, justo después de traerla: el snapshot
  // de NIT/Terceros no se entera solo de datos nuevos, hay que recalcularlo (ver sinca-nit-stats.ts).
  // Si esto falla no se marca la sincronización de resoluciones (lo importante) como fallida — el
  // snapshot de NIT igual se recalcula solo en la próxima visita a /historico/nits (TTL de 12 h).
  let nit: { ok: boolean; error?: string } = { ok: true };
  try {
    await refrescarSnapshotNit();
  } catch (err) {
    nit = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json({ ...resultado, nit }, { status: resultado.ok ? 200 : 500 });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede sincronizar." }, { status: 403 });
  }

  const volver = new URL("/historico", req.url);
  if (!sincaConfigurado()) {
    volver.searchParams.set("error", "La conexión con SINCA 1.0 no está configurada en este servidor.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const resultado = await sincronizarResoluciones(`manual:${session.email}`);
  if (resultado.ok) revalidateTag("sinca-analitica");

  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: resultado.ok
      ? `${session.nombre} sincronizó el histórico de SINCA 1.0 (${resultado.totalApi} registros, ${resultado.creados} nuevos, ${resultado.eliminados} eliminados).`
      : `${session.nombre} intentó sincronizar SINCA 1.0 y falló: ${resultado.error}`,
    usuarioId: session.userId,
  });

  volver.searchParams.set(
    resultado.ok ? "ok" : "error",
    resultado.ok
      ? `Histórico actualizado: ${resultado.totalApi} registros (${resultado.creados} nuevos, ${resultado.actualizados} revisados, ${resultado.eliminados} retirados) en ${(resultado.duracionMs / 1000).toFixed(0)} s.`
      : `No se pudo sincronizar: ${resultado.error}`
  );
  return NextResponse.redirect(volver, { status: 303 });
}
