import { db } from "@/lib/db";
import { cargosEnTexto, normalizar } from "@/lib/cargos";

export type EstadoExp =
  | "RADICADO"
  | "EN_TRAMITE"
  | "INFORMACION_ADICIONAL_REQUERIDA"
  | "SUSPENDIDO"
  | "APROBADO"
  | "NEGADO"
  | "DESISTIDO"
  | "ARCHIVADO"
  | "RECHAZADO";

export const ESTADOS_TERMINALES: EstadoExp[] = ["APROBADO", "NEGADO", "DESISTIDO", "ARCHIVADO", "RECHAZADO"];

export type PasoPendientes = {
  numero: number;
  titulo: string;
  responsables: string[];
  documentos: string[];
  esDecision: boolean;
};

export type ExpedientePendientes = {
  id: string;
  numero: string;
  estado: EstadoExp;
  pasoActualNumero: number;
  tramiteNombre: string;
  pasos: PasoPendientes[];
  documentosCargados: { pasoNumero: number | null; descripcion: string | null; nombre: string }[];
  usuariosAsignadosIds: string[];
  cargosAsignadosNombres: string[];
};

export type SesionPendientes = {
  userId: string;
  rol: "ADMIN" | "FUNCIONARIO";
  cargos: string[];
};

export type ItemPendiente = {
  expedienteId: string;
  numero: string;
  tramiteNombre: string;
  pasoNumero: number;
  pasoTitulo: string;
  detalle?: string;
};

export type ResumenPendientes = {
  esAdmin: boolean;
  asignadosTotal: number;
  decisiones: ItemPendiente[];
  gestionPaso: ItemPendiente[];
  documentos: ItemPendiente[];
  informacionAdicional: ItemPendiente[];
  hayAlgo: boolean;
};

function clave(texto: string): string {
  return normalizar(texto).trim().replace(/\s+/g, " ");
}

export function clasificarPendientes(
  expedientes: ExpedientePendientes[],
  sesion: SesionPendientes
): ResumenPendientes {
  const esAdmin = sesion.rol === "ADMIN";
  const activos = expedientes.filter((e) => !ESTADOS_TERMINALES.includes(e.estado));

  const pasoActualDe = (e: ExpedientePendientes) =>
    e.pasos.find((p) => p.numero === e.pasoActualNumero) ?? null;

  const asignadoAlUsuario = (e: ExpedientePendientes) =>
    e.usuariosAsignadosIds.includes(sesion.userId) ||
    sesion.cargos.some((c) => e.cargosAsignadosNombres.includes(c));

  const leCorresponde = (e: ExpedientePendientes, paso: PasoPendientes) => {
    if (asignadoAlUsuario(e)) return true;
    if (sesion.cargos.length === 0) return false;
    const cargosDelPaso = cargosEnTexto(paso.responsables.join(" | "));
    return sesion.cargos.some((c) => cargosDelPaso.includes(c));
  };

  const item = (e: ExpedientePendientes, paso: PasoPendientes, detalle?: string): ItemPendiente => ({
    expedienteId: e.id,
    numero: e.numero,
    tramiteNombre: e.tramiteNombre,
    pasoNumero: paso.numero,
    pasoTitulo: paso.titulo,
    detalle,
  });

  const decisiones: ItemPendiente[] = [];
  const gestionPaso: ItemPendiente[] = [];
  const documentos: ItemPendiente[] = [];
  const informacionAdicional: ItemPendiente[] = [];
  let asignadosTotal = 0;

  for (const e of activos) {
    if (asignadoAlUsuario(e)) asignadosTotal++;

    const paso = pasoActualDe(e);
    if (!paso) continue;

    const mio = leCorresponde(e, paso);

    if (paso.esDecision) {
      if (esAdmin || mio) decisiones.push(item(e, paso));
    } else if (mio) {
      gestionPaso.push(item(e, paso));
    }

    if (mio) {
      for (const nombreDoc of paso.documentos) {
        const objetivo = clave(nombreDoc);
        const yaEsta = e.documentosCargados.some(
          (d) => (d.pasoNumero ?? 1) === paso.numero && clave(d.descripcion ?? d.nombre) === objetivo
        );
        if (!yaEsta) documentos.push(item(e, paso, nombreDoc));
      }
    }

    if (e.estado === "INFORMACION_ADICIONAL_REQUERIDA" && (esAdmin || mio)) {
      informacionAdicional.push(item(e, paso));
    }
  }

  const hayAlgo =
    asignadosTotal > 0 ||
    decisiones.length > 0 ||
    gestionPaso.length > 0 ||
    documentos.length > 0 ||
    informacionAdicional.length > 0;

  return { esAdmin, asignadosTotal, decisiones, gestionPaso, documentos, informacionAdicional, hayAlgo };
}

export async function getPendientes(sesion: SesionPendientes | null): Promise<ResumenPendientes | null> {
  if (!sesion) return null;

  const expedientes = await db.expediente.findMany({
    where: { estado: { notIn: ESTADOS_TERMINALES } },
    select: {
      id: true,
      numero: true,
      estado: true,
      pasoActualNumero: true,
      tramiteTipo: { select: { nombre: true } },
      flujo: {
        select: {
          pasos: {
            orderBy: { numero: "asc" },
            select: { numero: true, titulo: true, responsables: true, documentos: true, esDecision: true },
          },
        },
      },
      documentos: { select: { pasoNumero: true, descripcion: true, nombre: true } },
      usuariosAsignados: { select: { id: true } },
      cargosAsignados: { select: { nombre: true } },
    },
  });

  const normalizados: ExpedientePendientes[] = expedientes.map((e) => ({
    id: e.id,
    numero: e.numero,
    estado: e.estado as EstadoExp,
    pasoActualNumero: e.pasoActualNumero,
    tramiteNombre: e.tramiteTipo.nombre,
    pasos: e.flujo.pasos,
    documentosCargados: e.documentos,
    usuariosAsignadosIds: e.usuariosAsignados.map((u) => u.id),
    cargosAsignadosNombres: e.cargosAsignados.map((c) => c.nombre),
  }));

  return clasificarPendientes(normalizados, sesion);
}
