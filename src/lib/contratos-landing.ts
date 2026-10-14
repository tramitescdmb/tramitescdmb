import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { puedeGestionarContratistas, tieneRolContratacion, type PermisosUsuario } from "@/lib/permisos";
import { listarBuzon } from "@/lib/solicitudes-firma";
import { hoyColombia } from "@/lib/contratacion-panel";
import { construirWhereExpedienteContractual } from "@/lib/contratacion";
import { CODIGOS_FORMATO_POR_PERIODOS, calcularPeriodosInforme, etiquetaRangoPeriodo } from "@/lib/periodos-informe";

const MS_DIA = 24 * 60 * 60 * 1000;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export type EstadoPeriodo = "radicado" | "pendiente" | "en-curso" | "futuro";
export type EstadoContrato = "Por iniciar" | "En ejecución" | "Plazo vencido" | "En liquidación";

export type PeriodoLanding = {
  clave: string;
  numero: number;
  mes: string;
  rango: string;
  estado: EstadoPeriodo;
  diasDeRetraso: number;
  radicaDesde: Date;
  link: string | null;
};

export type ContratoLanding = {
  id: string;
  numero: string;
  numeroContrato: string | null;
  codigoProceso: string | null;
  objeto: string;
  estado: EstadoContrato;
  relacion: "CONTRATISTA" | "SUPERVISOR";
  contratista: string | null;
  supervisores: string[];
  valor: number | null;
  inicio: Date | null;
  terminacion: Date | null;
  prorrogas: number;
  ejecucion: number | null;
  diasParaTerminar: number | null;
  periodos: PeriodoLanding[];
  firmas: { id: string; documento: string; rol: string; puedeActuar: boolean }[];
  siguiente: { texto: string; detalle: string; link: string } | null;
};

export type FilaSeguimiento = {
  id: string;
  numero: string;
  numeroContrato: string | null;
  codigoProceso: string | null;
  contratista: string | null;
  terminacion: Date | null;
  diasParaTerminar: number | null;
  informesPorRadicar: number;
  maxRetraso: number;
  firmasPendientes: number;
  periodos: PeriodoLanding[];
  link: string;
};

const SELECT_CONTRATO = {
  id: true,
  numero: true,
  numeroContrato: true,
  codigoProceso: true,
  objeto: true,
  etapaActual: true,
  contratistaId: true,
  valor: true,
  fechaInicio: true,
  fechaFinEstimada: true,
  contratista: { select: { nombreORazonSocial: true } },
  supervisores: { select: { usuario: { select: { nombre: true } } } },
  modificaciones: { select: { tipo: true } },
  documentos: {
    where: { periodoMes: { not: null }, requisito: { codigoFormato: { in: CODIGOS_FORMATO_POR_PERIODOS } } },
    select: { id: true, periodoMes: true },
  },
} satisfies Prisma.ExpedienteContractualSelect;

type ExpedienteLanding = Prisma.ExpedienteContractualGetPayload<{ select: typeof SELECT_CONTRATO }>;

function periodosDe(e: Pick<ExpedienteLanding, "id" | "documentos" | "fechaInicio" | "fechaFinEstimada">, hoy: Date): PeriodoLanding[] {
  const base = `/contratacion/expedientes/${e.id}`;
  const docPorMes = new Map(e.documentos.map((d) => [d.periodoMes!, d.id]));
  return calcularPeriodosInforme(e.fechaInicio, e.fechaFinEstimada).map((p, i) => {
    const doc = docPorMes.get(p.clave);
    const estado: EstadoPeriodo = doc ? "radicado" : p.radicaDesde <= hoy ? "pendiente" : p.desde <= hoy ? "en-curso" : "futuro";
    return {
      clave: p.clave,
      numero: i + 1,
      mes: MESES[p.desde.getUTCMonth()]!,
      rango: etiquetaRangoPeriodo(p),
      estado,
      diasDeRetraso: estado === "pendiente" ? Math.floor((hoy.getTime() - p.radicaDesde.getTime()) / MS_DIA) : 0,
      radicaDesde: p.radicaDesde,
      link: estado === "pendiente" ? `${base}?periodo=${p.clave}#periodo-${p.clave}` : doc ? `${base}#documento-${doc}` : null,
    };
  });
}

function estadoDe(e: ExpedienteLanding, hoy: Date): EstadoContrato {
  if (e.etapaActual === "POSTCONTRACTUAL") return "En liquidación";
  if (e.fechaInicio && e.fechaInicio > hoy) return "Por iniciar";
  if (e.fechaFinEstimada && e.fechaFinEstimada < hoy) return "Plazo vencido";
  return "En ejecución";
}

export async function obtenerContratosLanding(userId: string, permisos: PermisosUsuario): Promise<{ contratos: ContratoLanding[]; terminados: number }> {
  const supervisa = [...permisos.supervisaExpedientes];
  if (!permisos.contratistaId && supervisa.length === 0) return { contratos: [], terminados: 0 };
  const hoy = hoyColombia();
  const mios: Prisma.ExpedienteContractualWhereInput = {
    eliminado: false,
    OR: [
      ...(permisos.contratistaId ? [{ contratistaId: permisos.contratistaId, etapaActual: { not: "PRECONTRACTUAL" as const } }] : []),
      ...(supervisa.length ? [{ id: { in: supervisa } }] : []),
    ],
  };
  const vigentes: Prisma.ExpedienteContractualWhereInput = {
    cerrado: false,
    etapaActual: { not: "POSTCONTRACTUAL" },
    OR: [{ fechaFinEstimada: null }, { fechaFinEstimada: { gte: hoy } }],
  };
  const inicioAnio = new Date(Date.UTC(hoy.getUTCFullYear(), 0, 1));

  const [expedientes, buzon, terminados] = await Promise.all([
    db.expedienteContractual.findMany({
      where: { AND: [mios, vigentes] },
      orderBy: [{ fechaFinEstimada: "asc" }, { createdAt: "desc" }],
      take: 12,
      select: SELECT_CONTRATO,
    }),
    listarBuzon(userId, "documentoContrato"),
    db.expedienteContractual.count({ where: { AND: [mios, { NOT: vigentes }, { fechaFinEstimada: { gte: inicioAnio } }] } }),
  ]);

  const contratos: ContratoLanding[] = expedientes.map((e) => {
    const periodos = periodosDe(e, hoy);
    let ejecucion: number | null = null;
    let diasParaTerminar: number | null = null;
    if (e.fechaInicio && e.fechaFinEstimada) {
      const total = Math.max(1, e.fechaFinEstimada.getTime() - e.fechaInicio.getTime());
      ejecucion = Math.min(100, Math.max(0, Math.round(((hoy.getTime() - e.fechaInicio.getTime()) / total) * 100)));
      diasParaTerminar = Math.ceil((e.fechaFinEstimada.getTime() - hoy.getTime()) / MS_DIA);
    }

    const firmas = buzon
      .filter((s) => s.documentoContrato?.expedienteId === e.id)
      .map((s) => ({ id: s.id, documento: s.documentoContrato?.nombre ?? "Documento", rol: s.rol, puedeActuar: s.puedeActuar }));
    const firmaLista = firmas.find((f) => f.puedeActuar);
    const pendiente = periodos.find((p) => p.estado === "pendiente");

    return {
      id: e.id,
      numero: e.numero,
      numeroContrato: e.numeroContrato,
      codigoProceso: e.codigoProceso,
      objeto: e.objeto,
      estado: estadoDe(e, hoy),
      relacion: permisos.contratistaId && e.contratistaId === permisos.contratistaId ? "CONTRATISTA" : "SUPERVISOR",
      contratista: e.contratista?.nombreORazonSocial ?? null,
      supervisores: e.supervisores.map((s) => s.usuario.nombre),
      valor: e.valor !== null ? Number(e.valor) : null,
      inicio: e.fechaInicio,
      terminacion: e.fechaFinEstimada,
      prorrogas: e.modificaciones.filter((m) => m.tipo === "PRORROGA" || m.tipo === "PRORROGA_Y_ADICION").length,
      ejecucion,
      diasParaTerminar,
      periodos,
      firmas,
      siguiente: firmaLista
        ? { texto: firmaLista.rol === "VISTO_BUENO" ? "Dar visto bueno" : "Firmar documento", detalle: firmaLista.documento, link: `/contratacion/firmar/${firmaLista.id}` }
        : pendiente
          ? {
              texto: `Radicar informe de ${pendiente.mes}`,
              detalle: pendiente.diasDeRetraso > 0 ? `${pendiente.rango} · ${pendiente.diasDeRetraso} día(s) de retraso` : pendiente.rango,
              link: pendiente.link!,
            }
          : null,
    };
  });
  return { contratos, terminados };
}

export function veSeguimientoContratos(permisos: PermisosUsuario): boolean {
  return puedeGestionarContratistas(permisos) || tieneRolContratacion(permisos, "FUNCIONARIO_CONTRATACION");
}

const SELECT_SEGUIMIENTO = {
  id: true,
  numero: true,
  numeroContrato: true,
  codigoProceso: true,
  fechaInicio: true,
  fechaFinEstimada: true,
  contratista: { select: { nombreORazonSocial: true } },
  documentos: SELECT_CONTRATO.documentos,
} satisfies Prisma.ExpedienteContractualSelect;

export type SeguimientoContratos = {
  filas: FilaSeguimiento[];
  total: number;
  enEjecucion: number;
  informes: number;
  firmas: number;
  porTerminar: number;
};

export async function obtenerSeguimientoContratos(permisos: PermisosUsuario, limite = 8): Promise<SeguimientoContratos> {
  const hoy = hoyColombia();
  const where: Prisma.ExpedienteContractualWhereInput = {
    AND: [construirWhereExpedienteContractual({}, permisos), { etapaActual: "CONTRACTUAL", cerrado: false }],
  };
  const [expedientes, firmas] = await Promise.all([
    db.expedienteContractual.findMany({ where, take: 500, select: SELECT_SEGUIMIENTO }),
    db.solicitudFirma.findMany({
      where: { estado: "PENDIENTE", documentoContrato: { expediente: where } },
      select: { documentoContrato: { select: { expedienteId: true } } },
    }),
  ]);
  const firmasPorExpediente = new Map<string, number>();
  for (const f of firmas) {
    const exp = f.documentoContrato?.expedienteId;
    if (exp) firmasPorExpediente.set(exp, (firmasPorExpediente.get(exp) ?? 0) + 1);
  }

  const filas = expedientes
    .map((e) => {
      const periodos = periodosDe(e, hoy);
      const pendientes = periodos.filter((p) => p.estado === "pendiente");
      const masAtrasado = pendientes[0];
      return {
        id: e.id,
        numero: e.numero,
        numeroContrato: e.numeroContrato,
        codigoProceso: e.codigoProceso,
        contratista: e.contratista?.nombreORazonSocial ?? null,
        terminacion: e.fechaFinEstimada,
        diasParaTerminar: e.fechaFinEstimada ? Math.ceil((e.fechaFinEstimada.getTime() - hoy.getTime()) / MS_DIA) : null,
        informesPorRadicar: pendientes.length,
        maxRetraso: masAtrasado?.diasDeRetraso ?? 0,
        firmasPendientes: firmasPorExpediente.get(e.id) ?? 0,
        periodos,
        link: masAtrasado?.link ?? `/contratacion/expedientes/${e.id}`,
      };
    })
    .filter((f) => f.informesPorRadicar > 0 || f.firmasPendientes > 0 || (f.diasParaTerminar !== null && f.diasParaTerminar <= 15))
    .sort((a, b) => b.maxRetraso - a.maxRetraso || (a.diasParaTerminar ?? 9999) - (b.diasParaTerminar ?? 9999));

  return {
    filas: filas.slice(0, limite),
    total: filas.length,
    enEjecucion: expedientes.length,
    informes: filas.reduce((a, f) => a + f.informesPorRadicar, 0),
    firmas: filas.reduce((a, f) => a + f.firmasPendientes, 0),
    porTerminar: filas.filter((f) => f.diasParaTerminar !== null && f.diasParaTerminar >= 0 && f.diasParaTerminar <= 15).length,
  };
}
