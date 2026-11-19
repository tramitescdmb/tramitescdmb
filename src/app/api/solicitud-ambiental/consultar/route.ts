import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarLimiteEnvio } from "@/lib/anti-abuso";
import { datosPeticion, registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import { nombreFlujo } from "@/lib/flujo-nombre";
import { ESTADO_PUBLICO, normalizarIdentificacion, normalizarNumeroSolicitud } from "@/lib/solicitud-ambiental";

/** Mismo mensaje para cualquier dato errado: no revela si el número de solicitud existe. */
const NO_ENCONTRADA = "No encontramos una solicitud con esos datos. Verifique la cédula o el NIT y el número de solicitud.";
const ESTADOS_TERMINADOS = new Set(["APROBADO", "NEGADO", "RECHAZADO", "DESISTIDO", "ARCHIVADO"]);

/**
 * Seguimiento público de una solicitud ambiental radicada en línea. Exige las dos cosas: la cédula
 * o el NIT del solicitante Y el número de solicitud. Devuelve solo el estado, la etapa y las fechas.
 */
export async function POST(req: NextRequest) {
  const { ip, userAgent } = datosPeticion(req.headers);
  const limite = await verificarLimiteEnvio(ip, "solicitud-ambiental:consultar", { porHora: 10, porDia: 40 });
  if (!limite.permitido) return NextResponse.json({ error: limite.motivo }, { status: 429 });

  const body = await req.json().catch(() => null);
  const numeroTexto = typeof body?.numeroSolicitud === "string" ? body.numeroSolicitud.slice(0, 40) : "";
  const identificacionTexto = typeof body?.identificacion === "string" ? body.identificacion.slice(0, 40) : "";
  if (!numeroTexto.trim() || !identificacionTexto.trim()) {
    return NextResponse.json({ error: "Indique la cédula o el NIT y el número de solicitud: se necesitan los dos." }, { status: 400 });
  }

  const numeroSolicitud = normalizarNumeroSolicitud(numeroTexto);
  const identificacion = normalizarIdentificacion(identificacionTexto);
  if (!numeroSolicitud || identificacion.length < 4) return NextResponse.json({ error: NO_ENCONTRADA }, { status: 404 });

  const e = await db.expediente.findFirst({
    where: { codigoSolicitudPublica: numeroSolicitud },
    select: {
      id: true,
      numero: true,
      estado: true,
      pasoActualNumero: true,
      solicitanteIdentificacion: true,
      fechaRadicacion: true,
      fechaUltimoMovimiento: true,
      fechaCierre: true,
      tramiteTipo: { select: { nombre: true } },
      flujo: { select: { nombre: true, pasos: { select: { numero: true, titulo: true }, orderBy: { numero: "asc" } } } },
    },
  });

  const soloDigitos = (t: string) => t.replace(/\D/g, "");
  const coincide =
    e && (normalizarIdentificacion(e.solicitanteIdentificacion) === identificacion || soloDigitos(e.solicitanteIdentificacion) === soloDigitos(identificacionTexto));
  if (!e || !coincide) {
    return NextResponse.json({ error: NO_ENCONTRADA }, { status: 404 });
  }

  await registrarAuditoriaDoc({
    entidad: "Expediente",
    entidadId: e.id,
    accion: "LEE",
    usuarioId: null,
    ip,
    userAgent,
    detalle: `Consulta pública de estado de la solicitud ${numeroSolicitud} (${e.numero})`,
  });

  const estado = ESTADO_PUBLICO[e.estado] ?? { etiqueta: "En trámite", explicacion: "La CDMB está gestionando su solicitud." };
  const terminado = ESTADOS_TERMINADOS.has(e.estado);
  const pasos = e.flujo.pasos;
  const indice = pasos.findIndex((p) => p.numero === e.pasoActualNumero);
  const etapa = !terminado && indice >= 0 ? { posicion: indice + 1, total: pasos.length, titulo: pasos[indice]!.titulo } : null;

  return NextResponse.json({
    numeroSolicitud,
    numeroExpediente: e.numero,
    tramite: e.tramiteTipo.nombre,
    tipoSolicitud: nombreFlujo(e.flujo.nombre),
    estado: estado.etiqueta,
    explicacion: estado.explicacion,
    etapa,
    fechaRadicacion: e.fechaRadicacion,
    fechaUltimoMovimiento: e.fechaUltimoMovimiento,
    fechaCierre: e.fechaCierre,
  });
}
