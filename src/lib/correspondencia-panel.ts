import type { EstadoComunicacion, TipoComunicacion } from "@prisma/client";
import { db } from "@/lib/db";
import type { PermisosUsuario } from "@/lib/permisos";
import { puedeDistribuir } from "@/lib/permisos";

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

export const TIPOS_CORRESPONDENCIA: { tipo: TipoComunicacion | "PQRSD"; etiqueta: string }[] = [
  { tipo: "RECIBIDA", etiqueta: "Recibidas" },
  { tipo: "ENVIADA", etiqueta: "Enviadas" },
  { tipo: "INTERNA", etiqueta: "Memorandos" },
  { tipo: "PQRSD", etiqueta: "PQRSD" },
];

/**
 * Primer día del mes actual + `offset`, en UTC. Se trabaja en UTC a propósito:
 * `date_trunc` de Postgres devuelve medianoche UTC y en zona horaria Colombia
 * `new Date(...).getMonth()` lo corre al mes anterior. La clave de mes ("YYYY-MM")
 * y estos límites usan UTC en los dos extremos para que coincidan.
 */
function inicioDeMesUTC(offset = 0): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
}
const claveMes = (d: Date) => d.toISOString().slice(0, 7);

/**
 * Datos del Panel del SGDEA (/correspondencia/panel). Combina el trabajo
 * personal del funcionario con el panorama de la organización, en formas
 * legibles (barras y área apilada).
 */
export async function obtenerPanelCorrespondencia(userId: string, permisos: PermisosUsuario) {
  const ahora = new Date();
  const en3DiasHabiles = new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000);
  const desde6Meses = inicioDeMesUTC(-5);
  const inicioMes = inicioDeMesUTC(0);

  const [
    misDistribuciones,
    porEstadoRaw,
    porTipoActivoRaw,
    pendientesProcesoRecibidas,
    evolucionRaw,
    recibidasMes,
    enviadasMes,
    internasMes,
    pqrsdMes,
    expedientesAbiertos,
    vencidasGlobal,
    porVencerGlobal,
  ] = await Promise.all([
    // Radicados asignados a mí que siguen abiertos (para "Mis pendientes").
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
    db.comunicacion.groupBy({ by: ["estado"], _count: { _all: true }, where: { estado: { in: ESTADOS_ACTIVOS } } }),
    db.comunicacion.groupBy({ by: ["tipo"], _count: { _all: true }, where: { estado: { in: ESTADOS_ACTIVOS } } }),
    // "Pendientes de proceso": SOLO recibidas — entraron por ventanilla y nadie
    // las ha distribuido. Una enviada/memorando queda definitiva al radicarse
    // (no necesita reparto), así que ahí "sin distribución" es lo normal.
    db.comunicacion.count({
      where: { tipo: "RECIBIDA", estado: { in: ["RADICADA", "EN_REPARTO"] }, distribuciones: { none: {} } },
    }),
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
    db.expedienteDocumental.count({ where: { estado: "ABIERTO" } }),
    db.comunicacion.count({ where: { estado: { in: ESTADOS_ACTIVOS }, fechaVencimiento: { lt: ahora } } }),
    db.comunicacion.count({ where: { estado: { in: ESTADOS_ACTIVOS }, fechaVencimiento: { gte: ahora, lt: en3DiasHabiles } } }),
  ]);

  // --- Mis pendientes (dedup por comunicación, la distribución más reciente gana) ---
  const vistas = new Set<string>();
  const misPendientes: { id: string; radicado: string; asunto: string; estado: EstadoComunicacion; tipo: TipoComunicacion; fechaVencimiento: Date | null; sinResponder: boolean }[] = [];
  for (const d of misDistribuciones) {
    const c = d.comunicacion;
    if (vistas.has(c.id)) continue;
    vistas.add(c.id);
    misPendientes.push({
      id: c.id,
      radicado: c.radicado,
      asunto: c.asunto,
      estado: c.estado,
      tipo: c.tipo,
      fechaVencimiento: c.fechaVencimiento,
      sinResponder: !c.respuestaTexto,
    });
  }
  const misVencidas = misPendientes.filter((c) => c.fechaVencimiento && c.fechaVencimiento < ahora).length;
  const misPorVencer = misPendientes.filter((c) => c.fechaVencimiento && c.fechaVencimiento >= ahora && c.fechaVencimiento < en3DiasHabiles).length;
  const misPorResponder = misPendientes.filter((c) => c.sinResponder).length;

  // --- Activos por estado (barras) ---
  const porEstado = ESTADOS_ACTIVOS.map((e) => ({
    label: ETIQUETA_ESTADO_PANEL[e],
    value: porEstadoRaw.find((r) => r.estado === e)?._count._all ?? 0,
  })).filter((r) => r.value > 0);

  // --- Activos por tipo (%) ---
  const contarTipo = (t: TipoComunicacion) => porTipoActivoRaw.find((r) => r.tipo === t)?._count._all ?? 0;
  const totalActivos = porTipoActivoRaw.reduce((acc, r) => acc + r._count._all, 0);
  const porTipoActivo = (["RECIBIDA", "ENVIADA", "INTERNA"] as TipoComunicacion[])
    .map((t) => ({ tipo: t, value: contarTipo(t) }))
    .filter((r) => r.value > 0);

  // --- Pendientes de proceso (recibidas sin distribuir en ventanilla) ---
  const totalPendientesProceso = pendientesProcesoRecibidas;

  // --- Evolución 6 meses por tipo (área apilada) ---
  const meses: { key: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = inicioDeMesUTC(-5 + i);
    meses.push({ key: claveMes(d), label: MESES_CORTOS[d.getUTCMonth()]! });
  }
  const tipoDeFila = (t: string): TipoComunicacion => (t === "ENVIADA" || t === "INTERNA" ? (t as TipoComunicacion) : "RECIBIDA");
  const evolucion = meses.map(({ key, label }) => {
    const enMes = (t: TipoComunicacion) =>
      evolucionRaw
        .filter((r) => claveMes(new Date(r.mes)) === key && tipoDeFila(r.tipo) === t)
        .reduce((acc, r) => acc + Number(r.total), 0);
    return { label, RECIBIDA: enMes("RECIBIDA"), ENVIADA: enMes("ENVIADA"), INTERNA: enMes("INTERNA") };
  });

  return {
    mis: { total: misPendientes.length, porResponder: misPorResponder, porVencer: misPorVencer, vencidas: misVencidas, lista: misPendientes.slice(0, 8) },
    global: { vencidas: vencidasGlobal, porVencer: porVencerGlobal },
    mes: { recibidas: recibidasMes, enviadas: enviadasMes, internas: internasMes, pqrsd: pqrsdMes, expedientesAbiertos },
    porEstado,
    porTipoActivo,
    totalActivos,
    totalPendientesProceso,
    evolucion,
    puedeDistribuir: puedeDistribuir(permisos),
  };
}
