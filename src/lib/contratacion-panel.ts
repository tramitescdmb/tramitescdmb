import { CODIGO_ACTA_LIQUIDACION, estadoLiquidacion } from "@/lib/liquidacion";
import { resumirPendientesFirma } from "@/lib/calidad-firma";
import { db } from "@/lib/db";
import type { PermisosUsuario } from "@/lib/permisos";
import { construirWhereExpedienteContractual } from "@/lib/contratacion";
import { listarBuzon } from "@/lib/solicitudes-firma";
import { CODIGOS_FORMATO_POR_PERIODOS, calcularPeriodosInforme, etiquetaRangoPeriodo, periodosPorRadicar } from "@/lib/periodos-informe";
import { fechaArchivoColombia } from "@/lib/fecha";

export function hoyColombia(): Date {
  return new Date(`${fechaArchivoColombia()}T00:00:00Z`);
}

export type InformePorRadicar = {
  expedienteId: string;
  numero: string;
  objeto: string;
  numeroInforme: number;
  numeroContrato: string | null;
  codigoProceso: string | null;
  contratista: string | null;
  mes: string;
  periodoClave: string;
  rango: string;
  radicaDesde: Date;
  diasDeRetraso: number;
};

export async function obtenerTrabajoPendienteContratacion(userId: string, permisos: PermisosUsuario, verSinContratista: boolean) {
  const where = construirWhereExpedienteContractual({}, permisos);
  const hoy = hoyColombia();

  const gestiona = permisos.esAdmin || !permisos.rolesContratacion.has("CONTRATISTA");
  const [buzon, enEjecucion, sinContratista, terminados] = await Promise.all([
    listarBuzon(userId, "documentoContrato"),
    db.expedienteContractual.findMany({
      where: { AND: [where, { etapaActual: "CONTRACTUAL", cerrado: false, fechaInicio: { not: null }, fechaFinEstimada: { not: null } }] },
      take: 500,
      select: {
        id: true,
        numero: true,
        numeroContrato: true,
        codigoProceso: true,
        contratista: { select: { nombreORazonSocial: true } },
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
    gestiona
      ? db.expedienteContractual.findMany({
          where: { AND: [where, { cerrado: false, fechaFinEstimada: { lt: hoy } }] },
          take: 300,
          select: {
            id: true,
            numero: true,
            numeroContrato: true,
            codigoProceso: true,
            tipoContrato: true,
            terminadoAnticipadamente: true,
            fechaFinEstimada: true,
            documentos: { where: { requisito: { codigoFormato: { contains: CODIGO_ACTA_LIQUIDACION } } }, select: { id: true }, take: 1 },
          },
        })
      : Promise.resolve([]),
  ]);

  const liquidaciones = terminados
    .map((e) => ({
      expediente: e,
      estado: estadoLiquidacion({
        terminacion: e.fechaFinEstimada,
        tipoContrato: e.tipoContrato,
        terminadoAnticipadamente: e.terminadoAnticipadamente,
        liquidado: e.documentos.length > 0,
        hoy,
      }),
    }))
    .filter((l) => ["mutuo-acuerdo", "unilateral", "residual", "sin-competencia"].includes(l.estado.fase))
    .sort((a, b) => a.estado.dias - b.estado.dias);

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
        numeroContrato: e.numeroContrato,
        codigoProceso: e.codigoProceso,
        contratista: e.contratista?.nombreORazonSocial ?? null,
        mes: p.periodo.desde.toLocaleDateString("es-CO", { month: "long", timeZone: "UTC" }),
        periodoClave: p.periodo.clave,
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
      resumen: resumirPendientesFirma(firmas),
      lista: firmas.slice(0, 8),
    },
    informes: { total: informes.length, lista: informes.slice(0, 200) },
    liquidaciones,
    sinContratista,
  };
}

export async function obtenerResumenSistemaContratacion() {
  const [expedientes, contratistas, documentosPorValidar, usuariosConRol, eventos] = await Promise.all([
    db.expedienteContractual.count(),
    db.contratista.count(),
    db.documentoContrato.count({ where: { estadoValidacion: "PENDIENTE" } }),
    db.usuario.count({ where: { activo: true, rolesContratacion: { isEmpty: false } } }),
    db.eventoContratacion.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { expediente: { select: { id: true, numero: true } }, usuario: { select: { nombre: true } } },
    }),
  ]);
  return { expedientes, contratistas, documentosPorValidar, usuariosConRol, eventos };
}
