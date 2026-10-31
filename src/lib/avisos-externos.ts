import type { TipoPQRSD } from "@prisma/client";
import { ETIQUETA_TIPO_PQRSD } from "@/lib/pqrsd";
import { avisarEnSegundoPlano, escaparHtml, negrita, parrafos, type Mensaje } from "@/lib/avisos-correo";

const PIE_CIUDADANO = "Este correo es una constancia automática; las respuestas se emiten por los canales oficiales de la Corporación.";

function fechaColombia(d: Date): string {
  return d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "long", year: "numeric" });
}

export type DatosRadicadoPqrsd = {
  radicado: string;
  asunto: string;
  tipoPqrsd: TipoPQRSD;
  terceroNombre: string | null;
  fechaRadicacion: Date;
  fechaVencimiento: Date | null;
};

export function mensajeRadicadoPqrsd(c: DatosRadicadoPqrsd): Mensaje {
  return {
    asunto: `Radicado ${c.radicado} · CDMB`,
    titulo: "Su solicitud quedó radicada",
    cuerpoHtml: parrafos(
      c.terceroNombre ? `Señor(a) ${negrita(c.terceroNombre)}:` : null,
      `La Corporación recibió su solicitud el ${fechaColombia(c.fechaRadicacion)} con el radicado ${negrita(c.radicado)}.`,
      `Tipo de solicitud: ${escaparHtml(ETIQUETA_TIPO_PQRSD[c.tipoPqrsd])}`,
      `Asunto: ${escaparHtml(c.asunto.slice(0, 300))}`,
      c.fechaVencimiento ? `El término legal de respuesta vence el ${fechaColombia(c.fechaVencimiento)}.` : null,
      "Conserve el número de radicado para consultar el estado de su solicitud.",
      PIE_CIUDADANO
    ),
    enlace: { texto: "Consultar el estado", ruta: "/pqrsd/consultar" },
  };
}

export function avisarRadicadoPqrsd(c: Omit<DatosRadicadoPqrsd, "tipoPqrsd"> & { id: string; tipoPqrsd: TipoPQRSD | null; terceroEmail: string | null }) {
  if (!c.tipoPqrsd || !c.terceroEmail) return;
  avisarEnSegundoPlano({
    evento: "PQRSD_RADICADO",
    modulo: "SGDEA",
    clave: `pqrsd-radicado:${c.id}`,
    correos: [c.terceroEmail],
    ...mensajeRadicadoPqrsd({ ...c, tipoPqrsd: c.tipoPqrsd }),
  });
}

export type DatosRespuestaPqrsd = { oficioRadicado: string; solicitudRadicado: string; asunto: string; nombre: string | null; medio: string };

export function mensajeRespuestaPqrsd(d: DatosRespuestaPqrsd): Mensaje {
  return {
    asunto: `Respuesta a su radicado ${d.solicitudRadicado} · CDMB`,
    titulo: "Se emitió la respuesta a su solicitud",
    cuerpoHtml: parrafos(
      d.nombre ? `Señor(a) ${negrita(d.nombre)}:` : null,
      `La Corporación emitió la respuesta a su solicitud con radicado ${negrita(d.solicitudRadicado)} mediante el oficio ${negrita(d.oficioRadicado)}.`,
      `Asunto: ${escaparHtml(d.asunto.slice(0, 300))}`,
      `Medio de entrega: ${escaparHtml(d.medio)}.`,
      PIE_CIUDADANO
    ),
    enlace: { texto: "Consultar el estado", ruta: "/pqrsd/consultar" },
  };
}

export function avisarRespuestaPqrsd(datos: DatosRespuestaPqrsd & { oficioId: string; correos: (string | null | undefined)[] }) {
  avisarEnSegundoPlano({
    evento: "PQRSD_RESPUESTA",
    modulo: "SGDEA",
    clave: `pqrsd-respuesta:${datos.oficioId}`,
    correos: datos.correos,
    ...mensajeRespuestaPqrsd(datos),
  });
}

export type DatosRadicadoTramite = { numero: string; tramite: string; solicitante: string; fecha: Date };

export function mensajeRadicadoTramite(e: DatosRadicadoTramite): Mensaje {
  return {
    asunto: `Expediente ${e.numero} · CDMB`,
    titulo: "Su trámite ambiental quedó radicado",
    cuerpoHtml: parrafos(
      `Señor(a) ${negrita(e.solicitante)}:`,
      `El ${fechaColombia(e.fecha)} se radicó su solicitud de ${negrita(e.tramite)} con el número de expediente ${negrita(e.numero)}.`,
      "Cite este número en cualquier comunicación relacionada con el trámite.",
      PIE_CIUDADANO
    ),
  };
}

export function avisarRadicadoTramite(e: DatosRadicadoTramite & { id: string; correo: string | null }) {
  if (!e.correo) return;
  avisarEnSegundoPlano({
    evento: "TRAMITE_RADICADO",
    modulo: "TRAMITES",
    clave: `tramite-radicado:${e.id}`,
    correos: [e.correo],
    ...mensajeRadicadoTramite(e),
  });
}
