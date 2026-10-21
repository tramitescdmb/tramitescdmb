import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ETIQUETA_MODALIDAD } from "@/lib/contratacion-etiquetas";
import type { PermisosUsuario } from "@/lib/permisos";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function ultimosMeses(cantidad: number) {
  const hoy = new Date();
  const meses: { clave: string; etiqueta: string }[] = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ clave: `${d.getFullYear()}-${d.getMonth()}`, etiqueta: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` });
  }
  return meses;
}

const claveMes = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

export async function tableroTramites(permisos: PermisosUsuario) {
  const filtro = permisos.esAdmin ? {} : { tramiteTipoId: { in: Array.from(permisos.tramites.keys()) } };
  const meses = ultimosMeses(12);
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);

  const [porEstado, porTramite, recientes] = await Promise.all([
    db.expediente.groupBy({ by: ["estado"], where: filtro, _count: { _all: true } }),
    db.expediente.groupBy({ by: ["tramiteTipoId"], where: filtro, _count: { _all: true }, orderBy: { _count: { tramiteTipoId: "desc" } }, take: 6 }),
    db.expediente.findMany({
      where: { ...filtro, OR: [{ fechaRadicacion: { gte: desde } }, { fechaCierre: { gte: desde } }] },
      select: { fechaRadicacion: true, fechaCierre: true },
    }),
  ]);

  const radicados = new Map<string, number>();
  const cerrados = new Map<string, number>();
  for (const e of recientes) {
    if (e.fechaRadicacion >= desde) radicados.set(claveMes(e.fechaRadicacion), (radicados.get(claveMes(e.fechaRadicacion)) ?? 0) + 1);
    if (e.fechaCierre && e.fechaCierre >= desde) cerrados.set(claveMes(e.fechaCierre), (cerrados.get(claveMes(e.fechaCierre)) ?? 0) + 1);
  }

  const nombres = await db.tramiteTipo.findMany({
    where: { id: { in: porTramite.map((t) => t.tramiteTipoId) } },
    select: { id: true, nombre: true },
  });
  const nombre = new Map(nombres.map((n) => [n.id, n.nombre]));

  const cuenta = (estados: string[]) => porEstado.filter((e) => estados.includes(e.estado)).reduce((s, e) => s + e._count._all, 0);

  return {
    enCurso: cuenta(["RADICADO", "EN_TRAMITE"]),
    informacion: cuenta(["INFORMACION_ADICIONAL_REQUERIDA", "SUSPENDIDO"]),
    resueltos: cuenta(["APROBADO", "NEGADO"]),
    total: porEstado.reduce((s, e) => s + e._count._all, 0),
    evolucion: meses.map((m) => ({ etiqueta: m.etiqueta, valores: [radicados.get(m.clave) ?? 0, cerrados.get(m.clave) ?? 0] })),
    porEstado: porEstado.map((e) => ({ clave: e.estado as string, valor: e._count._all })).sort((a, b) => b.valor - a.valor),
    porTramite: porTramite.map((t) => ({ label: nombre.get(t.tramiteTipoId) ?? "Trámite", value: t._count._all })),
  };
}

export async function tableroContratos() {
  const porEtapa = await db.expedienteContractual.groupBy({
    by: ["etapaActual"],
    where: { eliminadoEn: null, fechaCierre: null },
    _count: { _all: true },
  });
  return porEtapa.map((e) => ({ clave: e.etapaActual as string, valor: e._count._all }));
}

export async function tableroCorrespondencia() {
  const meses = ultimosMeses(12);
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);
  const vigentes = { estado: { not: "ANULADA" as const } };
  const [porEstado, porTipo, porDependencia, recientes] = await Promise.all([
    db.comunicacion.groupBy({ by: ["estado"], where: vigentes, _count: { _all: true } }),
    db.comunicacion.groupBy({ by: ["tipo"], where: vigentes, _count: { _all: true } }),
    db.comunicacion.groupBy({
      by: ["dependenciaDestinoId"],
      where: { ...vigentes, dependenciaDestinoId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { dependenciaDestinoId: "desc" } },
      take: 8,
    }),
    db.comunicacion.findMany({ where: { ...vigentes, fechaRadicacion: { gte: desde } }, select: { fechaRadicacion: true } }),
  ]);
  const dependencias = await db.dependencia.findMany({
    where: { id: { in: porDependencia.map((d) => d.dependenciaDestinoId!) } },
    select: { id: true, nombre: true },
  });
  const nombreDependencia = new Map(dependencias.map((d) => [d.id, d.nombre]));
  const conteo = new Map<string, number>();
  for (const c of recientes) conteo.set(claveMes(c.fechaRadicacion), (conteo.get(claveMes(c.fechaRadicacion)) ?? 0) + 1);
  const ETIQUETA_TIPO: Record<string, string> = { RECIBIDA: "Recibidas", ENVIADA: "Enviadas", INTERNA: "Memorandos" };
  return {
    porEstado: porEstado.map((e) => ({ clave: e.estado as string, valor: e._count._all })).sort((a, b) => b.valor - a.valor),
    porTipo: porTipo.map((t) => ({ label: ETIQUETA_TIPO[t.tipo] ?? t.tipo, value: t._count._all })).sort((a, b) => b.value - a.value),
    porDependencia: porDependencia.map((d) => ({ label: nombreDependencia.get(d.dependenciaDestinoId!) ?? "—", value: d._count._all })),
    mensual: meses.map((m) => ({ label: m.etiqueta, value: conteo.get(m.clave) ?? 0 })),
  };
}

export async function tableroGecon(where: Prisma.ExpedienteContractualWhereInput) {
  const meses = ultimosMeses(12);
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);
  const [porEtapa, porModalidad, porDependencia, recientes] = await Promise.all([
    db.expedienteContractual.groupBy({ by: ["etapaActual"], where: { AND: [where, { cerrado: false }] }, _count: { _all: true } }),
    db.expedienteContractual.groupBy({ by: ["modalidadSeleccion"], where, _count: { _all: true } }),
    db.expedienteContractual.groupBy({
      by: ["dependenciaSolicitanteId"],
      where,
      _count: { _all: true },
      orderBy: { _count: { dependenciaSolicitanteId: "desc" } },
      take: 8,
    }),
    db.expedienteContractual.findMany({ where: { AND: [where, { createdAt: { gte: desde } }] }, select: { createdAt: true } }),
  ]);
  const dependencias = await db.dependencia.findMany({
    where: { id: { in: porDependencia.map((d) => d.dependenciaSolicitanteId) } },
    select: { id: true, nombre: true },
  });
  const nombreDependencia = new Map(dependencias.map((d) => [d.id, d.nombre]));
  const conteo = new Map<string, number>();
  for (const c of recientes) conteo.set(claveMes(c.createdAt), (conteo.get(claveMes(c.createdAt)) ?? 0) + 1);
  return {
    porEtapa: porEtapa.map((e) => ({ clave: e.etapaActual as string, valor: e._count._all })),
    porModalidad: porModalidad
      .map((m) => ({ label: ETIQUETA_MODALIDAD[m.modalidadSeleccion] ?? m.modalidadSeleccion, value: m._count._all }))
      .sort((a, b) => b.value - a.value),
    porDependencia: porDependencia.map((d) => ({ label: nombreDependencia.get(d.dependenciaSolicitanteId) ?? "—", value: d._count._all })),
    mensual: meses.map((m) => ({ label: m.etiqueta, value: conteo.get(m.clave) ?? 0 })),
  };
}
