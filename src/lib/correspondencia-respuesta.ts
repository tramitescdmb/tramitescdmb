import { db } from "@/lib/db";
import { personaVacia, separarNombreCompleto, type DatosPersona } from "@/lib/datos-persona";
import { personaDesdeTercero } from "@/lib/terceros";

export type DatosRespuestaRecibida = {
  respondeAId: string;
  respondeALabel: string;
  asunto: string;
  contenido: string;
  destinatario: DatosPersona;
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

function personaDeComunicacion(r: {
  terceroTipo: "NATURAL" | "JURIDICA" | null;
  terceroTipoIdentificacion: string | null;
  terceroIdentificacion: string | null;
  terceroNombre: string | null;
  terceroEmail: string | null;
  terceroTelefono: string | null;
  terceroDireccion: string | null;
  terceroMunicipio: string | null;
  terceroDepartamento: string | null;
}): DatosPersona {
  const juridica = r.terceroTipo === "JURIDICA";
  const nombre = separarNombreCompleto(r.terceroNombre ?? "");
  return personaVacia({
    tipoPersona: juridica ? "JURIDICA" : "NATURAL",
    tipoIdentificacion: r.terceroTipoIdentificacion ?? (juridica ? "NIT" : "CC"),
    identificacion: r.terceroIdentificacion ?? "",
    nombres: juridica ? "" : nombre.nombres,
    apellidos: juridica ? "" : nombre.apellidos,
    razonSocial: juridica ? (r.terceroNombre ?? "") : "",
    email: r.terceroEmail ?? "",
    telefono: r.terceroTelefono ?? "",
    direccion: r.terceroDireccion ?? "",
    departamento: r.terceroDepartamento ?? "",
    ciudad: r.terceroMunicipio ?? "",
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
      tercero: true,
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
    destinatario: r.tercero ? personaDesdeTercero(r.tercero) : personaDeComunicacion(r),
    dependenciaOrigenId,
    serieId: clasificacionValida ? r.serieId ?? undefined : undefined,
    subserieId: clasificacionValida ? r.subserieId ?? undefined : undefined,
    respuestaPorNombre: r.respuestaPor?.nombre ?? undefined,
    documentosRespuesta: r.documentos.map((d) => d.nombre),
  };
}
