import { db } from "@/lib/db";

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/**
 * Datos para /correspondencia/reportes (MoReq 4.4/4.5: herramientas de informes
 * con gráficos y tablas; 1.18: actividad de la TRD). Todo se calcula al vuelo —
 * no hay tablas de resumen propias, el volumen de este módulo no lo justifica.
 */
export async function obtenerReportesCorrespondencia() {
  const desde12Meses = new Date();
  desde12Meses.setMonth(desde12Meses.getMonth() - 11);
  desde12Meses.setDate(1);
  desde12Meses.setHours(0, 0, 0, 0);

  const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalComunicaciones,
    porTipo,
    porEstado,
    porDependenciaRaw,
    mensualRaw,
    expedientesTotal,
    expedientesAbiertos,
    documentosArchivoTotal,
    seriesVigentesTotal,
    subseriesVigentesTotal,
    intentosFallidosRecientes,
    tiempoRespuestaPorDependenciaRaw,
  ] = await Promise.all([
    db.comunicacion.count(),
    db.comunicacion.groupBy({ by: ["tipo"], _count: { _all: true } }),
    db.comunicacion.groupBy({ by: ["estado"], _count: { _all: true } }),
    db.comunicacion.groupBy({
      by: ["dependenciaDestinoId"],
      _count: { _all: true },
      where: { dependenciaDestinoId: { not: null } },
      orderBy: { _count: { dependenciaDestinoId: "desc" } },
      take: 8,
    }),
    db.$queryRaw<{ mes: Date; total: bigint }[]>`
      SELECT date_trunc('month', "fechaRadicacion") as mes, COUNT(*)::bigint as total
      FROM "Comunicacion"
      WHERE "fechaRadicacion" >= ${desde12Meses}
      GROUP BY 1
    `,
    db.expedienteDocumental.count(),
    db.expedienteDocumental.count({ where: { estado: "ABIERTO" } }),
    db.documentoArchivo.count(),
    db.serieDocumental.count({ where: { vigenteHasta: null } }),
    db.subserieDocumental.count({ where: { activo: true } }),
    db.registroAuditoria.count({ where: { tipo: "LOGIN_FALLIDO", createdAt: { gte: hace30Dias } } }),
    // Desempeño por dependencia (MoReq 7.9: "ver desempeño en tiempo real") — días corridos entre la
    // radicación de una RECIBIDA y la radicación formal de su respuesta (ENVIADA vía respondeAId). Solo
    // cuenta recibidas YA respondidas; las pendientes no tienen un tiempo de respuesta que medir todavía.
    db.$queryRaw<{ dependenciaId: string | null; promedioDias: number; total: bigint }[]>`
      SELECT r."dependenciaDestinoId" as "dependenciaId",
             AVG(EXTRACT(EPOCH FROM (e."fechaRadicacion" - r."fechaRadicacion")) / 86400)::float as "promedioDias",
             COUNT(*)::bigint as total
      FROM "Comunicacion" r
      JOIN "Comunicacion" e ON e."respondeAId" = r.id
      WHERE r.tipo = 'RECIBIDA'
      GROUP BY r."dependenciaDestinoId"
    `,
  ]);

  const dependencias = await db.dependencia.findMany({
    where: {
      id: {
        in: [
          ...porDependenciaRaw.map((p) => p.dependenciaDestinoId),
          ...tiempoRespuestaPorDependenciaRaw.map((t) => t.dependenciaId),
        ].filter((v): v is string => v !== null),
      },
    },
    select: { id: true, nombre: true },
  });
  const nombreDependencia = Object.fromEntries(dependencias.map((d) => [d.id, d.nombre]));

  const tiempoRespuestaPorDependencia = tiempoRespuestaPorDependenciaRaw
    .map((t) => ({ label: t.dependenciaId ? (nombreDependencia[t.dependenciaId] ?? "—") : "Sin asignar", value: Math.round(t.promedioDias * 10) / 10 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const totalRespondidas = tiempoRespuestaPorDependenciaRaw.reduce((acc, t) => acc + Number(t.total), 0);
  const promedioRespuestaGeneral =
    totalRespondidas > 0
      ? Math.round((tiempoRespuestaPorDependenciaRaw.reduce((acc, t) => acc + t.promedioDias * Number(t.total), 0) / totalRespondidas) * 10) / 10
      : null;

  const porDependencia = porDependenciaRaw
    .map((p) => ({ label: p.dependenciaDestinoId ? (nombreDependencia[p.dependenciaDestinoId] ?? "—") : "Sin asignar", value: p._count._all }))
    .sort((a, b) => b.value - a.value);

  const ETIQUETA_TIPO: Record<string, string> = { RECIBIDA: "Recibida", ENVIADA: "Enviada", INTERNA: "Interna" };
  const porTipoChart = porTipo.map((p) => ({ label: ETIQUETA_TIPO[p.tipo] ?? p.tipo, value: p._count._all })).sort((a, b) => b.value - a.value);

  const ETIQUETA_ESTADO: Record<string, string> = {
    RADICADA: "Radicada", EN_REPARTO: "En reparto", ASIGNADA: "Asignada", EN_TRAMITE: "En trámite",
    INFORMACION_ADICIONAL_REQUERIDA: "Información adicional requerida", RESPONDIDA: "Respondida",
    ARCHIVADA: "Archivada", ANULADA: "Anulada",
  };
  const porEstadoChart = porEstado.map((p) => ({ label: ETIQUETA_ESTADO[p.estado] ?? p.estado, value: p._count._all })).sort((a, b) => b.value - a.value);

  const serieMensual: { label: string; value: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(desde12Meses.getFullYear(), desde12Meses.getMonth() + i, 1);
    const fila = mensualRaw.find((m) => {
      const mesFecha = new Date(m.mes);
      return mesFecha.getFullYear() === d.getFullYear() && mesFecha.getMonth() === d.getMonth();
    });
    serieMensual.push({ label: MESES_CORTOS[d.getMonth()]!, value: fila ? Number(fila.total) : 0 });
  }

  return {
    totalComunicaciones,
    porTipoChart,
    porEstadoChart,
    porDependencia,
    serieMensual,
    expedientesTotal,
    expedientesAbiertos,
    expedientesCerrados: expedientesTotal - expedientesAbiertos,
    documentosArchivoTotal,
    seriesVigentesTotal,
    subseriesVigentesTotal,
    intentosFallidosRecientes,
    tiempoRespuestaPorDependencia,
    promedioRespuestaGeneral,
    totalRespondidas,
  };
}
