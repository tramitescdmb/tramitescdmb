import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { sincronizarResoluciones } from "@/lib/sinca-sync";
import { sincaConfigurado } from "@/lib/sinca";

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

  const resultado = await sincronizarResoluciones("cron");
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 500 });
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
