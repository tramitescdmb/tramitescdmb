import type { EstadoInstanciaFlujo } from "@prisma/client";
import { db } from "@/lib/db";
import { diasHabilesEntre, type CalendarioLaboral } from "@/lib/dias-habiles";
import { estadoTerminoPaso, objetivoDeInstancia, SELECT_OBJETIVO_FLUJO } from "@/lib/flujos";
import { AMBITOS_DE_MODULO, type ModuloFlujo } from "@/lib/flujos-modulos";

export type TiempoPaso = { veces: number; promedioDias: number; maximoDias: number; fueraDeTermino: number };

export function tiemposPorPaso(
  instancias: { iniciadoEn: Date; ejecuciones: { pasoId: string; completadoEn: Date }[] }[],
  terminoPorPaso: Map<string, number | null>,
  cal: CalendarioLaboral,
): Map<string, TiempoPaso> {
  const acumulado = new Map<string, { veces: number; total: number; maximo: number; fuera: number }>();
  for (const i of instancias) {
    let desde = i.iniciadoEn;
    for (const e of [...i.ejecuciones].sort((a, b) => a.completadoEn.getTime() - b.completadoEn.getTime())) {
      const dias = diasHabilesEntre(desde, e.completadoEn, cal);
      const termino = terminoPorPaso.get(e.pasoId) ?? null;
      const a = acumulado.get(e.pasoId) ?? { veces: 0, total: 0, maximo: 0, fuera: 0 };
      a.veces++;
      a.total += dias;
      a.maximo = Math.max(a.maximo, dias);
      if (termino && dias > termino) a.fuera++;
      acumulado.set(e.pasoId, a);
      desde = e.completadoEn;
    }
  }
  return new Map(
    [...acumulado].map(([pasoId, a]) => [pasoId, { veces: a.veces, promedioDias: Math.round((a.total / a.veces) * 10) / 10, maximoDias: a.maximo, fueraDeTermino: a.fuera }]),
  );
}

export function promedioDiasHabiles(rangos: { inicio: Date; fin: Date }[], cal: CalendarioLaboral): number | null {
  if (rangos.length === 0) return null;
  const total = rangos.reduce((s, r) => s + diasHabilesEntre(r.inicio, r.fin, cal), 0);
  return Math.round((total / rangos.length) * 10) / 10;
}

export async function indicadoresDeFlujo(flujoId: string, cal: CalendarioLaboral) {
  const [pasos, instancias] = await Promise.all([
    db.pasoFlujo.findMany({ where: { flujoId }, orderBy: { orden: "asc" }, select: { id: true, orden: true, nombre: true, tipo: true, slaDiasHabiles: true } }),
    db.instanciaFlujo.findMany({
      where: { flujoId },
      orderBy: { iniciadoEn: "desc" },
      take: 1000,
      select: {
        id: true,
        estado: true,
        iniciadoEn: true,
        finalizadoEn: true,
        pasoActualDesde: true,
        pasoActual: { select: { nombre: true, slaDiasHabiles: true } },
        ejecuciones: { select: { pasoId: true, completadoEn: true } },
        ...SELECT_OBJETIVO_FLUJO,
      },
    }),
  ]);
  const ahora = new Date();
  const porEstado: Record<EstadoInstanciaFlujo, number> = { EN_CURSO: 0, COMPLETADO: 0, CANCELADO: 0 };
  for (const i of instancias) porEstado[i.estado]++;
  const tiempos = tiemposPorPaso(instancias, new Map(pasos.map((p) => [p.id, p.slaDiasHabiles])), cal);
  const enCurso = instancias
    .filter((i) => i.estado === "EN_CURSO")
    .map((i) => ({
      id: i.id,
      objetivo: objetivoDeInstancia(i),
      paso: i.pasoActual?.nombre ?? "—",
      desde: i.pasoActualDesde,
      termino: estadoTerminoPaso(i.pasoActualDesde, i.pasoActual?.slaDiasHabiles ?? null, cal, ahora),
    }))
    .sort((a, b) => Number(Boolean(b.termino?.vencido)) - Number(Boolean(a.termino?.vencido)) || (a.desde?.getTime() ?? 0) - (b.desde?.getTime() ?? 0));
  return {
    porEstado,
    vencidos: enCurso.filter((i) => i.termino?.vencido).length,
    duracionPromedio: promedioDiasHabiles(
      instancias.filter((i) => i.estado === "COMPLETADO" && i.finalizadoEn).map((i) => ({ inicio: i.iniciadoEn, fin: i.finalizadoEn! })),
      cal,
    ),
    pasos: pasos.filter((p) => p.tipo !== "FIN").map((p) => ({ ...p, tiempo: tiempos.get(p.id) ?? null })),
    enCurso,
  };
}

export type ResumenUsoFlujo = { enCurso: number; vencidos: number; completados: number; cancelados: number };

export async function resumenUsoFlujos(modulo: ModuloFlujo, cal: CalendarioLaboral) {
  const [conteos, enCurso] = await Promise.all([
    db.instanciaFlujo.groupBy({ by: ["flujoId", "estado"], where: { flujo: { ambito: { in: AMBITOS_DE_MODULO[modulo] } } }, _count: { _all: true } }),
    db.instanciaFlujo.findMany({
      where: { estado: "EN_CURSO", pasoActual: { slaDiasHabiles: { not: null } }, flujo: { ambito: { in: AMBITOS_DE_MODULO[modulo] } } },
      select: { flujoId: true, pasoActualDesde: true, pasoActual: { select: { slaDiasHabiles: true } } },
    }),
  ]);
  const porFlujo = new Map<string, ResumenUsoFlujo>();
  const de = (id: string) => porFlujo.get(id) ?? porFlujo.set(id, { enCurso: 0, vencidos: 0, completados: 0, cancelados: 0 }).get(id)!;
  for (const c of conteos) {
    const r = de(c.flujoId);
    if (c.estado === "EN_CURSO") r.enCurso += c._count._all;
    else if (c.estado === "COMPLETADO") r.completados += c._count._all;
    else r.cancelados += c._count._all;
  }
  const ahora = new Date();
  for (const i of enCurso) {
    if (estadoTerminoPaso(i.pasoActualDesde, i.pasoActual?.slaDiasHabiles ?? null, cal, ahora)?.vencido) de(i.flujoId).vencidos++;
  }
  return porFlujo;
}

export function sumarUso(lista: (ResumenUsoFlujo | undefined)[]): ResumenUsoFlujo {
  return lista.reduce<ResumenUsoFlujo>(
    (s, r) => (r ? { enCurso: s.enCurso + r.enCurso, vencidos: s.vencidos + r.vencidos, completados: s.completados + r.completados, cancelados: s.cancelados + r.cancelados } : s),
    { enCurso: 0, vencidos: 0, completados: 0, cancelados: 0 },
  );
}
