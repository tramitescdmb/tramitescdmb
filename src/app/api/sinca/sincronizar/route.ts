import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { verificarSesion as getSession } from "@/lib/permisos";
import { registrarAuditoria } from "@/lib/auditoria";
import { sincronizarResoluciones } from "@/lib/sinca-sync";
import { sincaConfigurado } from "@/lib/sinca";
import { refrescarSnapshotNit } from "@/lib/sinca-nit-stats";

export const maxDuration = 300;

const RUTAS_VOLVER = new Set(["/historico", "/historico/solicitudes"]);

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

  const form = await req.formData().catch(() => null);
  const volverRaw = String(form?.get("volver") || "/historico");
  const volver = new URL(RUTAS_VOLVER.has(volverRaw) ? volverRaw : "/historico", req.url);
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
