import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/auditoria";
import { sincronizarTramite, tramitesASincronizar, descubrirTramitesNuevos, nombreTramiteVital, vitalConfigurado, listarSolicitudes } from "@/lib/vital";

// La sincronización recorre páginas de VITAL + descarga documentos; puede pasar
// del límite por defecto. En el plan Hobby el tope efectivo es menor y lo que no
// alcance se retoma en la siguiente corrida (los upserts son idempotentes).
export const maxDuration = 300;

const haceDias = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
// VITAL rechaza fecha_fin >= hoy ("no puede ser mayor a la fecha de consumo del servicio").
const ayer = () => haceDias(1);

/**
 * GET  → cron diario de Vercel. Autoriza con `Authorization: Bearer <CRON_SECRET>`.
 *        Sincroniza los trámites de VITAL_TRAMITES en una ventana móvil reciente.
 * POST → botón "Sincronizar" del panel /vital. Solo ADMIN, con rango de fechas.
 */
export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!vitalConfigurado()) {
    return NextResponse.json({ error: "VITAL no está configurado." }, { status: 503 });
  }

  // Ventana móvil por defecto; se puede ampliar con ?desde=&hasta= para un backfill.
  const fecha = /^\d{4}-\d{2}-\d{2}$/;
  const qDesde = req.nextUrl.searchParams.get("desde");
  const qHasta = req.nextUrl.searchParams.get("hasta");
  const desde = qDesde && fecha.test(qDesde) ? qDesde : haceDias(45);
  const hasta = qHasta && fecha.test(qHasta) ? qHasta : ayer();

  // ?tramites=1,2,4,5,41 permite forzar un conjunto (backfill / descubrir cuáles existen).
  const qTramites = req.nextUrl.searchParams.get("tramites");
  const tramites = qTramites
    ? qTramites.split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isFinite(n))
    : await tramitesASincronizar();

  // ?probe=1 → solo consulta la primera página de cada trámite (rápido, para
  // descubrir cuáles existen), sin traer detalle ni documentos.
  const probe = req.nextUrl.searchParams.get("probe") === "1";

  // Sin filtros manuales, el cron explora ids nuevos: si el ciudadano radica en
  // una categoría de VITAL que aún no conocemos, se detecta y se empieza a traer.
  let descubiertos: number[] = [];
  if (!qTramites && !probe) {
    try {
      descubiertos = await descubrirTramitesNuevos(15);
      for (const id of descubiertos) {
        await registrarAuditoria({
          tipo: "CONFIGURACION_ACTUALIZADA",
          descripcion: `VITAL: trámite nuevo detectado y agregado a la sincronización — ${nombreTramiteVital(id)}.`,
        });
      }
    } catch {
      /* la exploración no debe tumbar la sincronización */
    }
  }

  const resultados: Record<string, unknown> = {};
  let ok = true;
  for (const idTramite of [...new Set([...tramites, ...descubiertos])]) {
    try {
      if (probe) {
        const p = await listarSolicitudes({ idTramite, fechaInicio: desde, fechaFin: hasta, registrosPeticion: 5 });
        resultados[idTramite] = { existe: p.length > 0, muestra: p.length, actividades: [...new Set(p.map((x) => x.nombreActividad))] };
      } else {
        resultados[idTramite] = await sincronizarTramite({ idTramite, fechaInicio: desde, fechaFin: hasta });
      }
    } catch (err) {
      ok = false;
      resultados[idTramite] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return NextResponse.json({ ok, ventana: { desde, hasta }, descubiertos, resultados }, { status: ok ? 200 : 500 });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede sincronizar con VITAL." }, { status: 403 });
  }

  const form = await req.formData();
  const idTramite = Number(form.get("idTramite"));
  const fechaInicio = String(form.get("fechaInicio") || "");
  const fechaFin = String(form.get("fechaFin") || "");
  const volver = new URL("/vital", req.url);

  if (!vitalConfigurado()) {
    volver.searchParams.set("error", "La conexión con VITAL no está configurada en este servidor.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (!idTramite || !fechaInicio || !fechaFin) {
    volver.searchParams.set("error", "Faltan id_tramite, fecha de inicio o fecha de fin.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  try {
    const resultado = await sincronizarTramite({ idTramite, fechaInicio, fechaFin });
    await registrarAuditoria({
      tipo: "CONFIGURACION_ACTUALIZADA",
      descripcion: `${session.nombre} sincronizó VITAL (trámite ${idTramite}, ${fechaInicio}–${fechaFin}): ${resultado.total} solicitudes${resultado.errores.length ? `, ${resultado.errores.length} con error` : ""}.`,
      usuarioId: session.userId,
    });
    volver.searchParams.set("sincronizado", String(resultado.total));
    if (resultado.errores.length) volver.searchParams.set("errores", resultado.errores.slice(0, 5).join(" | "));
    return NextResponse.redirect(volver, { status: 303 });
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "Error inesperado al sincronizar con VITAL.");
    return NextResponse.redirect(volver, { status: 303 });
  }
}
