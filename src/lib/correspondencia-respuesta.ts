import { db } from "@/lib/db";

export type DatosRespuestaRecibida = {
  respondeAId: string;
  respondeALabel: string;
  asunto: string;
  contenido: string;
  destinatarioTipo?: "NATURAL" | "JURIDICA";
  destinatarioTipoIdentificacion?: string;
  destinatarioIdentificacion?: string;
  destinatarioNombre?: string;
  destinatarioEmail?: string;
  destinatarioTelefono?: string;
  destinatarioDireccion?: string;
  destinatarioMunicipio?: string;
  destinatarioDepartamento?: string;
  dependenciaOrigenId?: string;
  serieId?: string;
  subserieId?: string;
  respuestaPorNombre?: string;
  documentosRespuesta: string[];
};

export async function respuestasListasParaRadicar() {
  return db.comunicacion.findMany({
    where: {
      tipo: "RECIBIDA",
      respuestaEn: { not: null },
      estado: { notIn: ["RESPONDIDA", "ARCHIVADA", "ANULADA"] },
      respuestas: { none: {} },
    },
    orderBy: { respuestaEn: "asc" },
    take: 50,
    select: {
      id: true,
      radicado: true,
      asunto: true,
      terceroNombre: true,
      respuestaEn: true,
      respuestaPor: { select: { nombre: true } },
    },
  });
}

export async function datosRespuestaRecibida(id: string): Promise<DatosRespuestaRecibida | null> {
  const r = await db.comunicacion.findUnique({
    where: { id },
    select: {
      id: true,
      tipo: true,
      radicado: true,
      asunto: true,
      respuestaTexto: true,
      terceroTipo: true,
      terceroTipoIdentificacion: true,
      terceroIdentificacion: true,
      terceroNombre: true,
      terceroEmail: true,
      terceroTelefono: true,
      terceroDireccion: true,
      terceroMunicipio: true,
      terceroDepartamento: true,
      dependenciaDestinoId: true,
      serieId: true,
      subserieId: true,
      serie: { select: { dependenciaId: true } },
      respuestaPor: { select: { nombre: true, dependenciaId: true } },
      documentos: { where: { esRespuesta: true }, select: { nombre: true } },
    },
  });
  if (!r || r.tipo !== "RECIBIDA") return null;
  const dependenciaOrigenId = r.respuestaPor?.dependenciaId ?? r.dependenciaDestinoId ?? undefined;
  const clasificacionValida = Boolean(r.serieId && r.serie?.dependenciaId && r.serie.dependenciaId === dependenciaOrigenId);
  return {
    respondeAId: r.id,
    respondeALabel: `${r.radicado} — ${r.asunto.slice(0, 60)}${r.terceroNombre ? ` (${r.terceroNombre})` : ""}`,
    asunto: `Respuesta a ${r.radicado} — ${r.asunto}`,
    contenido: r.respuestaTexto ?? "",
    destinatarioTipo: r.terceroTipo ?? undefined,
    destinatarioTipoIdentificacion: r.terceroTipoIdentificacion ?? undefined,
    destinatarioIdentificacion: r.terceroIdentificacion ?? undefined,
    destinatarioNombre: r.terceroNombre ?? undefined,
    destinatarioEmail: r.terceroEmail ?? undefined,
    destinatarioTelefono: r.terceroTelefono ?? undefined,
    destinatarioDireccion: r.terceroDireccion ?? undefined,
    destinatarioMunicipio: r.terceroMunicipio ?? undefined,
    destinatarioDepartamento: r.terceroDepartamento ?? undefined,
    dependenciaOrigenId,
    serieId: clasificacionValida ? r.serieId ?? undefined : undefined,
    subserieId: clasificacionValida ? r.subserieId ?? undefined : undefined,
    respuestaPorNombre: r.respuestaPor?.nombre ?? undefined,
    documentosRespuesta: r.documentos.map((d) => d.nombre),
  };
}
