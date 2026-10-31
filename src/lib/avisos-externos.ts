import type { TipoPQRSD } from "@prisma/client";
import { ETIQUETA_TIPO_PQRSD } from "@/lib/pqrsd";
import { avisarEnSegundoPlano, escaparHtml, negrita, parrafos } from "@/lib/avisos-correo";

const PIE_CIUDADANO = "Este correo es una constancia automática; las respuestas se emiten por los canales oficiales de la Corporación.";

function fechaColombia(d: Date): string {
  return d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "long", year: "numeric" });
}

export function avisarRadicadoPqrsd(c: {
  id: string;
  radicado: string;
  asunto: string;
  tipoPqrsd: TipoPQRSD | null;
  terceroNombre: string | null;
  terceroEmail: string | null;
  fechaRadicacion: Date;
  fechaVencimiento: Date | null;
}) {
  if (!c.tipoPqrsd || !c.terceroEmail) return;
  avisarEnSegundoPlano({
    evento: "PQRSD_RADICADO",
    clave: `pqrsd-radicado:${c.id}`,
    correos: [c.terceroEmail],
    asunto: `Radicado ${c.radicado} · CDMB`,
    titulo: `Su ${ETIQUETA_TIPO_PQRSD[c.tipoPqrsd].toLowerCase()} quedó radicada`,
    cuerpoHtml: parrafos(
      c.terceroNombre ? `Señor(a) ${negrita(c.terceroNombre)}:` : null,
      `La Corporación recibió su solicitud el ${fechaColombia(c.fechaRadicacion)} con el radicado ${negrita(c.radicado)}.`,
      `Asunto: ${escaparHtml(c.asunto.slice(0, 300))}`,
      c.fechaVencimiento ? `El término legal de respuesta vence el ${fechaColombia(c.fechaVencimiento)}.` : null,
      "Conserve el número de radicado para consultar el estado de su solicitud.",
      PIE_CIUDADANO
    ),
    enlace: { texto: "Consultar el estado", ruta: "/pqrsd/consultar" },
  });
}

export function avisarRespuestaPqrsd(datos: {
  oficioId: string;
  oficioRadicado: string;
  solicitudRadicado: string;
  asunto: string;
  nombre: string | null;
  correos: (string | null | undefined)[];
  medio: string;
}) {
  avisarEnSegundoPlano({
    evento: "PQRSD_RESPUESTA",
    clave: `pqrsd-respuesta:${datos.oficioId}`,
    correos: datos.correos,
    asunto: `Respuesta a su radicado ${datos.solicitudRadicado} · CDMB`,
    titulo: "Se emitió la respuesta a su solicitud",
    cuerpoHtml: parrafos(
      datos.nombre ? `Señor(a) ${negrita(datos.nombre)}:` : null,
      `La Corporación emitió la respuesta a su solicitud con radicado ${negrita(datos.solicitudRadicado)} mediante el oficio ${negrita(datos.oficioRadicado)}.`,
      `Asunto: ${escaparHtml(datos.asunto.slice(0, 300))}`,
      `Medio de entrega: ${escaparHtml(datos.medio)}.`,
      PIE_CIUDADANO
    ),
    enlace: { texto: "Consultar el estado", ruta: "/pqrsd/consultar" },
  });
}

export function avisarRadicadoTramite(e: { id: string; numero: string; tramite: string; solicitante: string; correo: string | null; fecha: Date }) {
  if (!e.correo) return;
  avisarEnSegundoPlano({
    evento: "TRAMITE_RADICADO",
    clave: `tramite-radicado:${e.id}`,
    correos: [e.correo],
    asunto: `Expediente ${e.numero} · CDMB`,
    titulo: "Su trámite ambiental quedó radicado",
    cuerpoHtml: parrafos(
      `Señor(a) ${negrita(e.solicitante)}:`,
      `El ${fechaColombia(e.fecha)} se radicó su solicitud de ${negrita(e.tramite)} con el número de expediente ${negrita(e.numero)}.`,
      "Cite este número en cualquier comunicación relacionada con el trámite.",
      PIE_CIUDADANO
    ),
  });
}
