import type { TipoPQRSD } from "@prisma/client";
import { ETIQUETA_TIPO_PQRSD } from "@/lib/pqrsd";
import { avisarEnSegundoPlano, type Mensaje } from "@/lib/avisos-correo";
import { componerMensaje, fechaEnLetras } from "@/lib/plantillas-correo-base";

export type DatosRadicadoPqrsd = {
  radicado: string;
  asunto: string;
  tipoPqrsd: TipoPQRSD;
  terceroNombre: string | null;
  fechaRadicacion: Date;
  fechaVencimiento: Date | null;
};

export function mensajeRadicadoPqrsd(c: DatosRadicadoPqrsd): Mensaje {
  return componerMensaje(
    "PQRSD_RADICADO",
    {
      RADICADO: c.radicado,
      NOMBRE: c.terceroNombre ?? "",
      FECHA_RADICACION: fechaEnLetras(c.fechaRadicacion),
      TIPO_PQRSD: ETIQUETA_TIPO_PQRSD[c.tipoPqrsd],
      ASUNTO: c.asunto.slice(0, 300),
      FECHA_VENCIMIENTO: c.fechaVencimiento ? fechaEnLetras(c.fechaVencimiento) : "",
    },
    "/pqrsd/consultar"
  );
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
  return componerMensaje(
    "PQRSD_RESPUESTA",
    { RADICADO: d.solicitudRadicado, OFICIO: d.oficioRadicado, NOMBRE: d.nombre ?? "", ASUNTO: d.asunto.slice(0, 300), MEDIO: d.medio },
    "/pqrsd/consultar"
  );
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
  return componerMensaje("TRAMITE_RADICADO", { EXPEDIENTE: e.numero, NOMBRE: e.solicitante, TRAMITE: e.tramite, FECHA_RADICACION: fechaEnLetras(e.fecha) });
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
