import type { EstadoSolicitudFirma, RolFirmante } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { claveMatriz, programarAvisos } from "@/lib/avisos-correo";
import { describirObjetivo, mensajeFirmaRecordada, moduloDeObjetivo, objetivoDeSolicitud, rutaDeFirma, type ObjetivoSolicitud } from "@/lib/solicitudes-firma";
import type { ModuloFirma } from "@/lib/jerarquia-firma";

/**
 * Firmas que esperan a otra persona: documentos que alguien envió a firma o que ya firmó, y en los que
 * otro firmante (cuyo turno ya llegó) no ha firmado ni dado visto bueno. Sirve para que quien solicitó
 * la firma y quienes ya firmaron sepan a quién se espera, y puedan recordárselo.
 */

const DIA = 86_400_000;

/** Días sin firmar, contados desde que le llegó el turno, a partir de los cuales se avisa a los interesados. */
export const DIAS_ESPERA_AVISO = 3;

/** Entre dos recordatorios manuales a la misma persona deben pasar al menos 4 horas. */
const ESPERA_ENTRE_RECORDATORIOS_MS = 4 * 60 * 60 * 1000;

type Hermana = {
  id: string;
  rol: RolFirmante;
  orden: number;
  estado: EstadoSolicitudFirma;
  asignadoEn: Date;
  completadoEn: Date | null;
  usuarioAsignadoId: string;
  asignadoPorId: string;
};

export function claveObjetivoFirma(s: { comunicacionId: string | null; documentoContratoId: string | null; documentoExpedienteId: string | null; documentoArchivoId: string | null }) {
  return s.comunicacionId ?? s.documentoContratoId ?? s.documentoExpedienteId ?? s.documentoArchivoId ?? "";
}

/** El turno de una firma empieza cuando se asigna, o cuando firma el último de los turnos anteriores. */
export function turnoDesde(solicitud: { orden: number; asignadoEn: Date }, hermanas: Pick<Hermana, "rol" | "orden" | "estado" | "completadoEn">[]): Date {
  let desde = solicitud.asignadoEn.getTime();
  for (const h of hermanas) {
    if (h.rol === "FIRMA" && h.orden < solicitud.orden && h.estado === "COMPLETADA" && h.completadoEn) desde = Math.max(desde, h.completadoEn.getTime());
  }
  return new Date(desde);
}

/** Ya es el turno: no hay firmas de turnos anteriores pendientes (la misma regla del buzón). */
export function esSuTurno(solicitud: { orden: number }, hermanas: Pick<Hermana, "rol" | "orden" | "estado">[]): boolean {
  return !hermanas.some((h) => h.rol === "FIRMA" && h.orden < solicitud.orden && h.estado === "PENDIENTE");
}

/** Quienes deben saber que la firma sigue pendiente: quien la solicitó y quienes ya firmaron o dieron visto bueno. */
export function interesadosEnFirma(solicitud: Pick<Hermana, "usuarioAsignadoId" | "asignadoPorId">, hermanas: Pick<Hermana, "rol" | "estado" | "usuarioAsignadoId">[]): string[] {
  const ids = new Set<string>([solicitud.asignadoPorId]);
  for (const h of hermanas) if (h.rol !== "LECTURA" && h.estado === "COMPLETADA") ids.add(h.usuarioAsignadoId);
  ids.delete(solicitud.usuarioAsignadoId);
  return [...ids];
}

export function diasDesde(desde: Date, ahora = new Date()): number {
  return Math.floor((ahora.getTime() - desde.getTime()) / DIA);
}

/** Documentos abiertos (no anulados, cerrados ni archivados): la misma condición de las alertas diarias. */
export const WHERE_OBJETIVO_VIGENTE = [
  { OR: [{ comunicacionId: null }, { comunicacion: { estado: { not: "ANULADA" as const } } }] },
  { OR: [{ documentoContratoId: null }, { documentoContrato: { expediente: { cerrado: false, eliminado: false } } }] },
  { OR: [{ documentoExpedienteId: null }, { documentoExpediente: { expediente: { archivado: false } } }] },
  { OR: [{ documentoArchivoId: null }, { documentoArchivo: { retiradoEn: null, expediente: { estado: "ABIERTO" as const } } }] },
];

const SELECT_HERMANA = {
  id: true,
  rol: true,
  orden: true,
  estado: true,
  asignadoEn: true,
  completadoEn: true,
  usuarioAsignadoId: true,
  asignadoPorId: true,
  comunicacionId: true,
  documentoContratoId: true,
  documentoExpedienteId: true,
  documentoArchivoId: true,
} as const;

export type FirmaEnEspera = {
  solicitudId: string;
  modulo: ModuloFirma;
  documento: string;
  referencia: string;
  ruta: string;
  pendiente: string;
  rol: RolFirmante;
  dias: number;
  turnoDesde: Date;
  recordadoEn: Date | null;
  usted: "solicito" | "firmo" | "ambos";
};

/**
 * Firmas pendientes de otra persona en documentos que el usuario envió a firma o ya firmó.
 * Solo cuentan las de turno ya habilitado (las demás todavía no pueden firmarse).
 */
export async function listarFirmasEnEspera(usuarioId: string, opciones: { minDias?: number } = {}): Promise<FirmaEnEspera[]> {
  const minDias = opciones.minDias ?? 0;
  const propias = await db.solicitudFirma.findMany({
    where: { OR: [{ asignadoPorId: usuarioId }, { usuarioAsignadoId: usuarioId, estado: "COMPLETADA", rol: { not: "LECTURA" } }] },
    select: { comunicacionId: true, documentoContratoId: true, documentoExpedienteId: true, documentoArchivoId: true },
    take: 5000,
    orderBy: { asignadoEn: "desc" },
  });
  const objetivos = new Map<string, ObjetivoSolicitud>();
  for (const p of propias) objetivos.set(claveObjetivoFirma(p), objetivoDeSolicitud(p));
  if (objetivos.size === 0) return [];
  const ids = (tipo: ObjetivoSolicitud["tipo"]) => [...objetivos.values()].filter((o) => o.tipo === tipo).map((o) => o.id);

  const pendientesExisten = await db.solicitudFirma.findMany({
    where: {
      estado: "PENDIENTE",
      rol: { not: "LECTURA" },
      usuarioAsignadoId: { not: usuarioId },
      OR: [
        { comunicacionId: { in: ids("comunicacion") } },
        { documentoContratoId: { in: ids("documentoContrato") } },
        { documentoExpedienteId: { in: ids("documentoExpediente") } },
        { documentoArchivoId: { in: ids("documentoArchivo") } },
      ],
      AND: WHERE_OBJETIVO_VIGENTE,
    },
    select: { comunicacionId: true, documentoContratoId: true, documentoExpedienteId: true, documentoArchivoId: true },
  });
  const conPendientes = new Set(pendientesExisten.map(claveObjetivoFirma));
  if (conPendientes.size === 0) return [];
  const idsCon = (tipo: ObjetivoSolicitud["tipo"]) => ids(tipo).filter((id) => conPendientes.has(id));

  const todas = await db.solicitudFirma.findMany({
    where: {
      OR: [
        { comunicacionId: { in: idsCon("comunicacion") } },
        { documentoContratoId: { in: idsCon("documentoContrato") } },
        { documentoExpedienteId: { in: idsCon("documentoExpediente") } },
        { documentoArchivoId: { in: idsCon("documentoArchivo") } },
      ],
    },
    select: { ...SELECT_HERMANA, recordadoEn: true, usuarioAsignado: { select: { nombre: true } } },
  });
  const porObjetivo = new Map<string, typeof todas>();
  for (const s of todas) porObjetivo.set(claveObjetivoFirma(s), [...(porObjetivo.get(claveObjetivoFirma(s)) ?? []), s]);

  const ahora = new Date();
  const resultado: FirmaEnEspera[] = [];
  const descripciones = new Map<string, Promise<{ nombre: string; referencia: string; ruta: string }>>();
  for (const [clave, hermanas] of porObjetivo) {
    for (const s of hermanas) {
      if (s.estado !== "PENDIENTE" || s.rol === "LECTURA" || s.usuarioAsignadoId === usuarioId) continue;
      if (!esSuTurno(s, hermanas)) continue;
      if (!interesadosEnFirma(s, hermanas).includes(usuarioId)) continue;
      const desde = turnoDesde(s, hermanas);
      const dias = diasDesde(desde, ahora);
      if (dias < minDias) continue;
      const objetivo = objetivoDeSolicitud(s);
      if (!descripciones.has(clave)) descripciones.set(clave, describirObjetivo(objetivo));
      const doc = await descripciones.get(clave)!;
      const solicito = s.asignadoPorId === usuarioId;
      const firmo = hermanas.some((h) => h.usuarioAsignadoId === usuarioId && h.estado === "COMPLETADA" && h.rol !== "LECTURA");
      resultado.push({
        solicitudId: s.id,
        modulo: moduloDeObjetivo(objetivo.tipo),
        documento: doc.nombre,
        referencia: doc.referencia,
        ruta: doc.ruta,
        pendiente: s.usuarioAsignado.nombre,
        rol: s.rol,
        dias,
        turnoDesde: desde,
        recordadoEn: s.recordadoEn,
        usted: solicito && firmo ? "ambos" : solicito ? "solicito" : "firmo",
      });
    }
  }
  return resultado.sort((a, b) => b.dias - a.dias);
}

export async function contarFirmasEnEspera(usuarioId: string): Promise<{ total: number; demoradas: number }> {
  const lista = await listarFirmasEnEspera(usuarioId);
  return { total: lista.length, demoradas: lista.filter((f) => f.dias >= DIAS_ESPERA_AVISO).length };
}

/**
 * Quien solicitó la firma, o quien ya firmó el mismo documento, le recuerda a un firmante pendiente
 * (cuyo turno ya llegó) que falta su firma. Le aparece en el buzón y le llega el correo «Firma recordada».
 */
export async function recordarFirmaPendiente(solicitudId: string, usuarioId: string, esAdmin = false): Promise<{ avisado: string | null; yaAvisado: string | null }> {
  const s = await db.solicitudFirma.findUnique({
    where: { id: solicitudId },
    select: { ...SELECT_HERMANA, recordadoEn: true, usuarioAsignado: { select: { nombre: true } } },
  });
  if (!s) throw new Error("La solicitud de firma no existe.");
  if (s.estado !== "PENDIENTE" || s.rol === "LECTURA") throw new Error("Esta firma ya fue resuelta.");
  const objetivo = objetivoDeSolicitud(s);
  const vigente = await db.solicitudFirma.count({ where: { id: s.id, AND: WHERE_OBJETIVO_VIGENTE } });
  if (!vigente) throw new Error("El documento ya no admite firmas (anulado, cerrado o archivado).");
  const campo = `${objetivo.tipo}Id` as "comunicacionId" | "documentoContratoId" | "documentoExpedienteId" | "documentoArchivoId";
  const hermanas = await db.solicitudFirma.findMany({ where: { [campo]: objetivo.id }, select: SELECT_HERMANA });
  if (!esAdmin && !interesadosEnFirma(s, hermanas).includes(usuarioId)) {
    throw new Error("Solo quien solicitó la firma o quien ya firmó este documento puede recordarla.");
  }
  if (!esSuTurno(s, hermanas)) throw new Error("Todavía no es el turno de esta persona: espera a un firmante anterior.");
  if (s.recordadoEn && s.recordadoEn.getTime() > Date.now() - ESPERA_ENTRE_RECORDATORIOS_MS) {
    return { avisado: null, yaAvisado: s.usuarioAsignado.nombre };
  }
  await db.solicitudFirma.update({ where: { id: s.id }, data: { recordadoEn: new Date(), recordadoPorId: usuarioId } });
  const modulo = moduloDeObjetivo(objetivo.tipo);
  const marca = Date.now();
  programarAvisos([claveMatriz(modulo, "FIRMA_RECORDADA")], async () => {
    const [doc, quien] = await Promise.all([describirObjetivo(objetivo), db.usuario.findUnique({ where: { id: usuarioId }, select: { nombre: true } })]);
    return {
      evento: "FIRMA_RECORDADA" as const,
      modulo,
      clave: `firma-recordada:${s.id}:${marca}`,
      usuarioIds: [s.usuarioAsignadoId],
      ...mensajeFirmaRecordada({ modulo, quien: quien?.nombre ?? "Un firmante", doc, ruta: rutaDeFirma(s.id, modulo, doc.ruta) }),
    };
  });
  return { avisado: s.usuarioAsignado.nombre, yaAvisado: null };
}
