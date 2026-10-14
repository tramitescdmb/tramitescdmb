import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { construirWhereExpedienteContractual } from "@/lib/contratacion";
import { ETIQUETA_MODALIDAD } from "@/lib/contratacion-etiquetas";
import { ETIQUETA_TIPO_CONTRATO, type TipoContrato } from "@/lib/tipo-contrato";
import { hoyColombia } from "@/lib/contratacion-panel";
import { CODIGO_ACTA_LIQUIDACION, estadoLiquidacion } from "@/lib/liquidacion";
import type { PermisosUsuario } from "@/lib/permisos";

const MS_DIA = 24 * 60 * 60 * 1000;

type Barra = { label: string; value: number };

export type FilaContrato = {
  id: string;
  codigo: string;
  numeroContrato: string | null;
  contratista: string | null;
  valor: number;
  pagado: number;
  terminacion: Date | null;
  diasParaTerminar: number | null;
  porcentajePagado: number | null;
  porcentajePlazo: number | null;
};

export type TableroContratos = {
  vigencias: number[];
  totales: {
    contratos: number;
    enEjecucion: number;
    precontractual: number;
    terminados: number;
    porLiquidar: number;
    valorContratado: number;
    valorFacturado: number;
    valorPagado: number;
    pendientePago: number;
    ejecucionFinanciera: number | null;
    contratistas: number;
    personasNaturales: number;
    personasJuridicas: number;
    enlazadosSecop: number;
  };
  valorPorModalidad: Barra[];
  valorPorDependencia: Barra[];
  valorPorTipo: Barra[];
  valorPorOrigen: Barra[];
  valorPorDestino: Barra[];
  contratosPorEstadoSecop: Barra[];
  topContratistas: Barra[];
  porTerminar: FilaContrato[];
  rezagados: FilaContrato[];
};

const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const texto = (v: unknown) => (typeof v === "string" && v.trim() && !/^no definido$/i.test(v.trim()) ? v.trim() : null);

function sumarPor(mapa: Map<string, number>, clave: string, valor: number) {
  mapa.set(clave, (mapa.get(clave) ?? 0) + valor);
}

function barras(mapa: Map<string, number>, limite = 10): Barra[] {
  return [...mapa.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([label, value]) => ({ label, value }));
}

export async function obtenerTableroContratos(permisos: PermisosUsuario, vigencia: number | null): Promise<TableroContratos> {
  const hoy = hoyColombia();
  const base = construirWhereExpedienteContractual({}, permisos);
  const where: Prisma.ExpedienteContractualWhereInput = vigencia
    ? {
        AND: [
          base,
          {
            OR: [
              { fechaSuscripcion: { gte: new Date(Date.UTC(vigencia, 0, 1)), lt: new Date(Date.UTC(vigencia + 1, 0, 1)) } },
              { fechaSuscripcion: null, createdAt: { gte: new Date(Date.UTC(vigencia, 0, 1)), lt: new Date(Date.UTC(vigencia + 1, 0, 1)) } },
            ],
          },
        ],
      }
    : base;

  const [expedientes, todos] = await Promise.all([
    db.expedienteContractual.findMany({
      where,
      take: 2000,
      select: {
        id: true,
        numero: true,
        codigoProceso: true,
        numeroContrato: true,
        etapaActual: true,
        cerrado: true,
        valor: true,
        fechaInicio: true,
        fechaFinEstimada: true,
        modalidadSeleccion: true,
        tipoContrato: true,
        terminadoAnticipadamente: true,
        idContratoSecop: true,
        dependenciaSolicitante: { select: { nombre: true } },
        contratista: { select: { id: true, nombreORazonSocial: true, tipoPersona: true } },
        secop: { select: { datos: true } },
        documentos: { where: { requisito: { codigoFormato: { contains: CODIGO_ACTA_LIQUIDACION } } }, select: { id: true }, take: 1 },
      },
    }),
    db.expedienteContractual.findMany({ where: base, select: { fechaSuscripcion: true, createdAt: true } }),
  ]);

  const vigencias = [...new Set(todos.map((e) => (e.fechaSuscripcion ?? e.createdAt).getUTCFullYear()))].sort((a, b) => b - a);
  const porModalidad = new Map<string, number>();
  const porDependencia = new Map<string, number>();
  const porTipo = new Map<string, number>();
  const porOrigen = new Map<string, number>();
  const porDestino = new Map<string, number>();
  const porEstado = new Map<string, number>();
  const porContratista = new Map<string, number>();
  const contratistas = new Map<string, string>();
  const filas: FilaContrato[] = [];
  let valorContratado = 0;
  let valorFacturado = 0;
  let valorPagado = 0;
  let pendientePago = 0;
  let enEjecucion = 0;
  let precontractual = 0;
  let terminados = 0;
  let porLiquidar = 0;
  let enlazados = 0;

  for (const e of expedientes) {
    const d = (e.secop?.datos ?? null) as Record<string, unknown> | null;
    const valor = d ? numero(d.valor_del_contrato) : numero(e.valor);
    const pagado = d ? numero(d.valor_pagado) : 0;
    valorContratado += valor;
    valorPagado += pagado;
    if (d) {
      enlazados++;
      valorFacturado += numero(d.valor_facturado);
      pendientePago += numero(d.valor_pendiente_de_pago);
      sumarPor(porOrigen, texto(d.origen_de_los_recursos) ?? "Sin dato", valor);
      sumarPor(porDestino, texto(d.destino_gasto) ?? "Sin dato", valor);
      sumarPor(porEstado, texto(d.estado_contrato) ?? "Sin dato", 1);
    } else {
      sumarPor(porEstado, "Sin enlazar con SECOP II", 1);
    }
    sumarPor(porModalidad, ETIQUETA_MODALIDAD[e.modalidadSeleccion], valor);
    sumarPor(porDependencia, e.dependenciaSolicitante.nombre, valor);
    sumarPor(porTipo, ETIQUETA_TIPO_CONTRATO[e.tipoContrato as TipoContrato] ?? e.tipoContrato, valor);
    if (e.contratista) {
      contratistas.set(e.contratista.id, e.contratista.tipoPersona);
      sumarPor(porContratista, e.contratista.nombreORazonSocial, valor);
    }

    const terminado = e.cerrado || e.etapaActual === "POSTCONTRACTUAL" || (e.fechaFinEstimada !== null && e.fechaFinEstimada < hoy);
    if (e.etapaActual === "PRECONTRACTUAL" && !e.cerrado) precontractual++;
    else if (terminado) terminados++;
    else enEjecucion++;
    const liq = estadoLiquidacion({
      terminacion: e.fechaFinEstimada,
      tipoContrato: e.tipoContrato,
      terminadoAnticipadamente: e.terminadoAnticipadamente,
      liquidado: e.cerrado || e.documentos.length > 0,
      hoy,
    });
    if (["mutuo-acuerdo", "unilateral", "residual", "sin-competencia"].includes(liq.fase)) porLiquidar++;

    const porcentajePlazo =
      e.fechaInicio && e.fechaFinEstimada
        ? Math.min(100, Math.max(0, Math.round(((hoy.getTime() - e.fechaInicio.getTime()) / Math.max(1, e.fechaFinEstimada.getTime() - e.fechaInicio.getTime())) * 100)))
        : null;
    filas.push({
      id: e.id,
      codigo: e.codigoProceso ?? e.numero,
      numeroContrato: e.numeroContrato,
      contratista: e.contratista?.nombreORazonSocial ?? null,
      valor,
      pagado,
      terminacion: e.fechaFinEstimada,
      diasParaTerminar: e.fechaFinEstimada ? Math.ceil((e.fechaFinEstimada.getTime() - hoy.getTime()) / MS_DIA) : null,
      porcentajePagado: valor > 0 && d ? Math.round((pagado / valor) * 100) : null,
      porcentajePlazo,
    });
  }

  const tipos = [...contratistas.values()];
  return {
    vigencias,
    totales: {
      contratos: expedientes.length,
      enEjecucion,
      precontractual,
      terminados,
      porLiquidar,
      valorContratado,
      valorFacturado,
      valorPagado,
      pendientePago,
      ejecucionFinanciera: valorContratado > 0 && enlazados > 0 ? Math.round((valorPagado / valorContratado) * 1000) / 10 : null,
      contratistas: contratistas.size,
      personasNaturales: tipos.filter((t) => t === "NATURAL").length,
      personasJuridicas: tipos.filter((t) => t === "JURIDICA").length,
      enlazadosSecop: enlazados,
    },
    valorPorModalidad: barras(porModalidad),
    valorPorDependencia: barras(porDependencia),
    valorPorTipo: barras(porTipo),
    valorPorOrigen: barras(porOrigen),
    valorPorDestino: barras(porDestino),
    contratosPorEstadoSecop: barras(porEstado),
    topContratistas: barras(porContratista),
    porTerminar: filas
      .filter((f) => f.diasParaTerminar !== null && f.diasParaTerminar >= 0 && f.diasParaTerminar <= 30)
      .sort((a, b) => a.diasParaTerminar! - b.diasParaTerminar!),
    rezagados: filas
      .filter((f) => f.porcentajePagado !== null && f.porcentajePlazo !== null && f.porcentajePlazo - f.porcentajePagado >= 25)
      .sort((a, b) => b.porcentajePlazo! - b.porcentajePagado! - (a.porcentajePlazo! - a.porcentajePagado!)),
  };
}
