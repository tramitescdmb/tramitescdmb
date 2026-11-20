import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarLimiteEnvio } from "@/lib/anti-abuso";
import { datosPeticion, registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import { origenPermitido } from "@/lib/cuenta-ciudadana";
import { cuentaEnSesion } from "@/lib/cuenta-ciudadana-db";
import { normalizarIdentificacion, normalizarNumeroSolicitud } from "@/lib/solicitud-ambiental";

/** Mismo mensaje para todo: no revela si el número existe ni a quién pertenece. */
const NO_VINCULADA =
  "No encontramos una solicitud con ese número a nombre de la cédula o el NIT de su cuenta. Verifique el número que recibió al radicar.";

/**
 * Agrega a «Mis solicitudes» una solicitud radicada en línea antes de tener cuenta. Exige el número
 * de solicitud (aleatorio, solo lo conoce quien radicó) y que el solicitante tenga la cédula o el NIT
 * de la cuenta: la misma prueba que pide la consulta pública.
 */
export async function POST(req: NextRequest) {
  if (!origenPermitido(req.headers)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 403 });
  const cuenta = await cuentaEnSesion();
  if (!cuenta) return NextResponse.json({ error: "Su sesión terminó. Ingrese de nuevo." }, { status: 401 });
  if (!cuenta.completa || !cuenta.identificacion) return NextResponse.json({ error: "Complete primero los datos de su cuenta." }, { status: 400 });

  const { ip, userAgent } = datosPeticion(req.headers);
  const limite = await verificarLimiteEnvio(ip, "solicitud-ambiental:vincular", { porHora: 10, porDia: 30 });
  if (!limite.permitido) return NextResponse.json({ error: limite.motivo }, { status: 429 });

  const body = await req.json().catch(() => null);
  const numero = normalizarNumeroSolicitud(typeof body?.numeroSolicitud === "string" ? body.numeroSolicitud.slice(0, 40) : "");
  if (!numero) return NextResponse.json({ error: NO_VINCULADA }, { status: 404 });

  const e = await db.expediente.findFirst({
    where: { codigoSolicitudPublica: numero },
    select: { id: true, numero: true, solicitanteIdentificacion: true, cuentaCiudadanaId: true },
  });
  const coincide = e && normalizarIdentificacion(e.solicitanteIdentificacion) === cuenta.identificacion;
  if (!e || !coincide || (e.cuentaCiudadanaId && e.cuentaCiudadanaId !== cuenta.id)) {
    return NextResponse.json({ error: NO_VINCULADA }, { status: 404 });
  }
  if (!e.cuentaCiudadanaId) {
    const r = await db.expediente.updateMany({ where: { id: e.id, cuentaCiudadanaId: null }, data: { cuentaCiudadanaId: cuenta.id } });
    if (r.count !== 1) return NextResponse.json({ error: NO_VINCULADA }, { status: 404 });
    await registrarAuditoriaDoc({
      entidad: "Expediente",
      entidadId: e.id,
      accion: "MODIFICA",
      usuarioId: null,
      ip,
      userAgent,
      detalle: `El solicitante vinculó la solicitud ${numero} (${e.numero}) a su cuenta ciudadana ${cuenta.correo}`,
    });
  }
  return NextResponse.json({ ok: true, id: e.id });
}
