import type { EstadoComunicacion, TipoComunicacion } from "@prisma/client";
import { db } from "@/lib/db";
import type { PermisosUsuario } from "@/lib/permisos";
import { puedeDistribuir, puedeAdministrarArchivo } from "@/lib/permisos";

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Estados en los que un radicado sigue "vivo" (ni respondido, ni archivado, ni anulado). */
export const ESTADOS_ACTIVOS: EstadoComunicacion[] = [
  "RADICADA",
  "EN_REPARTO",
  "ASIGNADA",
  "EN_TRAMITE",
  "INFORMACION_ADICIONAL_REQUERIDA",
];

export const ETIQUETA_ESTADO_PANEL: Record<EstadoComunicacion, string> = {
  RADICADA: "Radicada",
  EN_REPARTO: "En reparto",
  ASIGNADA: "Asignada",
  EN_TRAMITE: "En trámite",
  INFORMACION_ADICIONAL_REQUERIDA: "Info. adicional requerida",
  RESPONDIDA: "Respondida",
  ARCHIVADA: "Archivada",
  ANULADA: "Anulada",
};

/**
 * Primer día del mes actual + `offset`, en UTC. `date_trunc` de Postgres devuelve
 * medianoche UTC y en zona horaria Colombia `new Date(...).getMonth()` la corre al
 * mes anterior — la clave de mes y estos límites usan UTC en los dos extremos.
 */
function inicioDeMesUTC(offset = 0): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
}
const claveMes = (d: Date) => d.toISOString().slice(0, 7);

/**
 * Datos del tablero del SGDEA (/correspondencia/panel). Un solo lugar, ordenado
 * por: mi trabajo pendiente → correspondencia → expedientes y archivo → sistema
 * (esta última solo para quien administra el archivo). Absorbe lo que antes vivía
 * en una pestaña "Reportes" separada.
 */
export async function obtenerPanelCorrespondencia(userId: string, permisos: PermisosUsuario) {
  const esAdmin = puedeAdministrarArchivo(permisos);
  const ahora = new Date();
  const en3DiasHabiles = new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000);
  const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
  const desde6Meses = inicioDeMesUTC(-5);
  const inicioMes = inicioDeMesUTC(0);

  const [
    misDistribuciones,
    totalComunicaciones,
    porEstadoRaw,
    porTipoActivoRaw,
    pendientesProcesoRecibidas,
    sinClasificar,
    evolucionRaw,
    recibidasMes,
    enviadasMes,
    internasMes,
    pqrsdMes,
    vencidasGlobal,
    porVencerGlobal,
    // --- expedientes y archivo ---
    expedientesAbiertos,
    expedientesTotal,
    documentosArchivoTotal,
    conPrestamoActivo,
    seriesVigentesTotal,
    subseriesVigentesTotal,
    transferenciasTotal,
    transferenciasConfirmadas,
    // --- sistema (solo admin) ---
    accesosFallidos30,
    carguesFallidos30,
    erroresEjecucion30,
    // --- desempeño (solo admin) ---
    topDependenciasRaw,
    tiempoRespuestaRaw,
  ] = await Promise.all([
    db.distribucion.findMany({
      where: { usuarioId: userId, comunicacion: { estado: { in: ESTADOS_ACTIVOS } } },
      select: {
        fechaAsignacion: true,
        comunicacion: {
          select: { id: true, radicado: true, asunto: true, estado: true, tipo: true, fechaVencimiento: true, respuestaTexto: true },
        },
      },
      orderBy: { fechaAsignacion: "desc" },
    }),
    db.comunicacion.count(),
    db.comunicacion.groupBy({ by: ["estado"], _count: { _all: true }, where: { estado: { in: ESTADOS_ACTIVOS } } }),
    db.comunicacion.groupBy({ by: ["tipo"], _count: { _all: true }, where: { estado: { in: ESTADOS_ACTIVOS } } }),
    db.comunicacion.count({
      where: { tipo: "RECIBIDA", estado: { in: ["RADICADA", "EN_REPARTO"] }, distribuciones: { none: {} } },
    }),
    db.comunicacion.count({ where: { estado: { not: "ANULADA" }, OR: [{ serieId: null }, { subserieId: null }] } }),
    db.$queryRaw<{ mes: Date; tipo: string; total: bigint }[]>`
      SELECT date_trunc('month', "fechaRadicacion") AS mes, tipo, COUNT(*)::bigint AS total
      FROM "Comunicacion"
      WHERE "fechaRadicacion" >= ${desde6Meses} AND estado = ANY(${ESTADOS_ACTIVOS}::"EstadoComunicacion"[])
      GROUP BY 1, 2
    `,
    db.comunicacion.count({ where: { tipo: "RECIBIDA", tipoPqrsd: null, fechaRadicacion: { gte: inicioMes } } }),
    db.comunicacion.count({ where: { tipo: "ENVIADA", fechaRadicacion: { gte: inicioMes } } }),
    db.comunicacion.count({ where: { tipo: "INTERNA", fechaRadicacion: { gte: inicioMes } } }),
    db.comunicacion.count({ where: { tipo: "RECIBIDA", tipoPqrsd: { not: null }, fechaRadicacion: { gte: inicioMes } } }),
    db.comunicacion.count({ where: { estado: { in: ESTADOS_ACTIVOS }, fechaVencimiento: { lt: ahora } } }),
    db.comunicacion.count({ where: { estado: { in: ESTADOS_ACTIVOS }, fechaVencimiento: { gte: ahora, lt: en3DiasHabiles } } }),
    db.expedienteDocumental.count({ where: { estado: "ABIERTO" } }),
    db.expedienteDocumental.count(),
    db.documentoArchivo.count(),
    db.prestamoExpediente.count({ where: { fechaDevolucionReal: null } }),
    db.serieDocumental.count({ where: { vigenteHasta: null } }),
    db.subserieDocumental.count({ where: { activo: true } }),
    db.comunicacion.count({ where: { transferidaCentralEn: { not: null } } }),
    db.comunicacion.count({ where: { transferenciaConfirmadaEn: { not: null } } }),
    esAdmin ? db.registroAuditoria.count({ where: { tipo: "LOGIN_FALLIDO", createdAt: { gte: hace30Dias } } }) : Promise.resolve(0),
    esAdmin ? db.auditoriaDoc.count({ where: { accion: "CARGA_FALLIDA", createdAt: { gte: hace30Dias } } }) : Promise.resolve(0),
    esAdmin ? db.auditoriaDoc.count({ where: { accion: "ERROR_EJECUCION", createdAt: { gte: hace30Dias } } }) : Promise.resolve(0),
    esAdmin
      ? db.comunicacion.groupBy({
          by: ["dependenciaDestinoId"],
          _count: { _all: true },
          where: { dependenciaDestinoId: { not: null } },
          orderBy: { _count: { dependenciaDestinoId: "desc" } },
          take: 8,
        })
      : Promise.resolve([] as { dependenciaDestinoId: string | null; _count: { _all: number } }[]),
    esAdmin
      ? db.$queryRaw<{ dependenciaId: string | null; promedioDias: number; total: bigint }[]>`
          SELECT r."dependenciaDestinoId" as "dependenciaId",
                 AVG(EXTRACT(EPOCH FROM (e."fechaRadicacion" - r."fechaRadicacion")) / 86400)::float as "promedioDias",
                 COUNT(*)::bigint as total
          FROM "Comunicacion" r
          JOIN "Comunicacion" e ON e."respondeAId" = r.id
          WHERE r.tipo = 'RECIBIDA'
          GROUP BY r."dependenciaDestinoId"
        `
      : Promise.resolve([] as { dependenciaId: string | null; promedioDias: number; total: bigint }[]),
  ]);

  // --- Nombres de dependencia para las tablas de admin ---
  const idsDep = [
    ...topDependenciasRaw.map((p) => p.dependenciaDestinoId),
    ...tiempoRespuestaRaw.map((t) => t.dependenciaId),
  ].filter((v): v is string => v !== null);
  const dependencias = idsDep.length
    ? await db.dependencia.findMany({ where: { id: { in: idsDep } }, select: { id: true, nombre: true } })
    : [];
  const nombreDep = Object.fromEntries(dependencias.map((d) => [d.id, d.nombre]));

  // --- Mi trabajo pendiente (dedup por comunicación) ---
  const vistas = new Set<string>();
  const misPendientes: { id: string; radicado: string; asunto: string; estado: EstadoComunicacion; tipo: TipoComunicacion; fechaVencimiento: Date | null; sinResponder: boolean }[] = [];
  for (const d of misDistribuciones) {
    const c = d.comunicacion;
    if (vistas.has(c.id)) continue;
    vistas.add(c.id);
    misPendientes.push({ id: c.id, radicado: c.radicado, asunto: c.asunto, estado: c.estado, tipo: c.tipo, fechaVencimiento: c.fechaVencimiento, sinResponder: !c.respuestaTexto });
  }
  const misVencidas = misPendientes.filter((c) => c.fechaVencimiento && c.fechaVencimiento < ahora).length;
  const misPorVencer = misPendientes.filter((c) => c.fechaVencimiento && c.fechaVencimiento >= ahora && c.fechaVencimiento < en3DiasHabiles).length;
  const misPorResponder = misPendientes.filter((c) => c.sinResponder).length;

  // --- Correspondencia: activos ---
  const porEstado = ESTADOS_ACTIVOS.map((e) => ({
    label: ETIQUETA_ESTADO_PANEL[e],
    value: porEstadoRaw.find((r) => r.estado === e)?._count._all ?? 0,
  })).filter((r) => r.value > 0);
  const totalActivos = porTipoActivoRaw.reduce((acc, r) => acc + r._count._all, 0);
  const porTipoActivo = (["RECIBIDA", "ENVIADA", "INTERNA"] as TipoComunicacion[])
    .map((t) => ({ tipo: t, value: porTipoActivoRaw.find((r) => r.tipo === t)?._count._all ?? 0 }))
    .filter((r) => r.value > 0);

  // --- Evolución 6 meses por tipo (área apilada) ---
  const meses: { key: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = inicioDeMesUTC(-5 + i);
    meses.push({ key: claveMes(d), label: MESES_CORTOS[d.getUTCMonth()]! });
  }
  const tipoDeFila = (t: string): TipoComunicacion => (t === "ENVIADA" || t === "INTERNA" ? (t as TipoComunicacion) : "RECIBIDA");
  const evolucion = meses.map(({ key, label }) => {
    const enMes = (t: TipoComunicacion) =>
      evolucionRaw.filter((r) => claveMes(new Date(r.mes)) === key && tipoDeFila(r.tipo) === t).reduce((acc, r) => acc + Number(r.total), 0);
    return { label, RECIBIDA: enMes("RECIBIDA"), ENVIADA: enMes("ENVIADA"), INTERNA: enMes("INTERNA") };
  });

  // --- Desempeño (admin) ---
  const topDependencias = topDependenciasRaw
    .map((p) => ({ label: p.dependenciaDestinoId ? (nombreDep[p.dependenciaDestinoId] ?? "—") : "Sin asignar", value: p._count._all }))
    .sort((a, b) => b.value - a.value);
  const tiempoRespuestaPorDependencia = tiempoRespuestaRaw
    .map((t) => ({ label: t.dependenciaId ? (nombreDep[t.dependenciaId] ?? "—") : "Sin asignar", value: Math.round(t.promedioDias * 10) / 10 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const totalRespondidas = tiempoRespuestaRaw.reduce((acc, t) => acc + Number(t.total), 0);
  const promedioRespuestaGeneral =
    totalRespondidas > 0
      ? Math.round((tiempoRespuestaRaw.reduce((acc, t) => acc + t.promedioDias * Number(t.total), 0) / totalRespondidas) * 10) / 10
      : null;

  return {
    esAdmin,
    puedeDistribuir: puedeDistribuir(permisos),

    mis: { total: misPendientes.length, porResponder: misPorResponder, porVencer: misPorVencer, vencidas: misVencidas, lista: misPendientes.slice(0, 8) },
    global: { vencidas: vencidasGlobal, porVencer: porVencerGlobal },

    correspondencia: {
      totalHistorico: totalComunicaciones,
      mes: { recibidas: recibidasMes, enviadas: enviadasMes, internas: internasMes, pqrsd: pqrsdMes },
      activos: { total: totalActivos, porEstado, porTipo: porTipoActivo },
      pendientesProceso: pendientesProcesoRecibidas,
      sinClasificar,
      evolucion,
      topDependencias,
      tiempoRespuesta: { general: promedioRespuestaGeneral, totalRespondidas, porDependencia: tiempoRespuestaPorDependencia },
    },

    expedientes: {
      abiertos: expedientesAbiertos,
      cerrados: expedientesTotal - expedientesAbiertos,
      total: expedientesTotal,
      documentos: documentosArchivoTotal,
      conPrestamoActivo,
      transferencias: {
        total: transferenciasTotal,
        confirmadas: transferenciasConfirmadas,
        sinConfirmar: transferenciasTotal - transferenciasConfirmadas,
      },
      trd: { seriesVigentes: seriesVigentesTotal, subseriesActivas: subseriesVigentesTotal },
    },

    sistema: esAdmin ? { accesosFallidos30, carguesFallidos30, erroresEjecucion30 } : null,
  };
}
