import { db } from "@/lib/db";
import type { PermisosUsuario } from "@/lib/permisos";
import { construirWhereExpedienteContractual } from "@/lib/contratacion";
import { listarBuzon } from "@/lib/solicitudes-firma";
import { CODIGOS_FORMATO_POR_PERIODOS, calcularPeriodosInforme, etiquetaRangoPeriodo, periodosPorRadicar } from "@/lib/periodos-informe";
import { fechaArchivoColombia } from "@/lib/fecha";

/** Día calendario de hoy en Colombia, como medianoche UTC (así se comparan las fechas-sin-hora del contrato). */
export function hoyColombia(): Date {
  return new Date(`${fechaArchivoColombia()}T00:00:00Z`);
}

export type InformePorRadicar = {
  expedienteId: string;
  numero: string;
  objeto: string;
  numeroInforme: number;
  rango: string;
  radicaDesde: Date;
  diasDeRetraso: number;
};

/**
 * Lo que espera al usuario en SIGEC: documentos por firmar y los informes de supervisión que ya se
 * podían radicar (el periodo cerró) y siguen sin cargarse, dentro de los expedientes que el usuario
 * puede ver (el propio contratista ve los suyos; el supervisor, los que supervisa).
 */
export async function obtenerTrabajoPendienteContratacion(userId: string, permisos: PermisosUsuario, verSinContratista: boolean) {
  const where = construirWhereExpedienteContractual({}, permisos);
  const hoy = hoyColombia();

  const [buzon, enEjecucion, sinContratista] = await Promise.all([
    listarBuzon(userId, "documentoContrato"),
    db.expedienteContractual.findMany({
      where: { AND: [where, { etapaActual: "CONTRACTUAL", cerrado: false, fechaInicio: { not: null }, fechaFinEstimada: { not: null } }] },
      take: 500,
      select: {
        id: true,
        numero: true,
        objeto: true,
        fechaInicio: true,
        fechaFinEstimada: true,
        documentos: {
          where: { periodoMes: { not: null }, requisito: { codigoFormato: { in: CODIGOS_FORMATO_POR_PERIODOS } } },
          select: { periodoMes: true },
        },
      },
    }),
    verSinContratista
      ? db.expedienteContractual.count({ where: { AND: [where, { contratistaId: null, cerrado: false }] } })
      : Promise.resolve(0),
  ]);

  const firmas = buzon.filter((s) => s.rol === "FIRMA" || s.rol === "VISTO_BUENO");

  const informes: InformePorRadicar[] = [];
  for (const e of enEjecucion) {
    const claves = new Set(e.documentos.map((d) => d.periodoMes!));
    for (const p of periodosPorRadicar(calcularPeriodosInforme(e.fechaInicio, e.fechaFinEstimada), claves, hoy)) {
      informes.push({
        expedienteId: e.id,
        numero: e.numero,
        objeto: e.objeto,
        numeroInforme: p.numero,
        rango: etiquetaRangoPeriodo(p.periodo),
        radicaDesde: p.periodo.radicaDesde,
        diasDeRetraso: p.diasDeRetraso,
      });
    }
  }
  informes.sort((a, b) => b.diasDeRetraso - a.diasDeRetraso);

  return {
    firmas: {
      total: firmas.length,
      listos: firmas.filter((s) => s.puedeActuar).length,
      lista: firmas.slice(0, 8),
    },
    informes: { total: informes.length, lista: informes.slice(0, 10) },
    sinContratista,
  };
}

/** Resumen técnico del módulo para el administrador: volumen, pendientes de revisión y actividad reciente. */
export async function obtenerResumenSistemaContratacion() {
  const [expedientes, contratistas, documentosPorValidar, usuariosConRol, eventos] = await Promise.all([
    db.expedienteContractual.count(),
    db.contratista.count(),
    db.documentoContrato.count({ where: { estadoValidacion: "PENDIENTE" } }),
    db.usuario.count({ where: { activo: true, rolContratacion: { not: null } } }),
    db.eventoContratacion.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { expediente: { select: { id: true, numero: true } }, usuario: { select: { nombre: true } } },
    }),
  ]);
  return { expedientes, contratistas, documentosPorValidar, usuariosConRol, eventos };
}
