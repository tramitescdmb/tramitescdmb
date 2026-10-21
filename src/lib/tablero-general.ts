import { db } from "@/lib/db";
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
  const [porEstado, recientes] = await Promise.all([
    db.comunicacion.groupBy({ by: ["estado"], where: { estado: { not: "ANULADA" } }, _count: { _all: true } }),
    db.comunicacion.findMany({ where: { estado: { not: "ANULADA" }, fechaRadicacion: { gte: desde } }, select: { tipo: true, fechaRadicacion: true } }),
  ]);
  const conteo = new Map<string, number[]>();
  const indice = { RECIBIDA: 0, ENVIADA: 1, INTERNA: 2 } as const;
  for (const c of recientes) {
    const k = claveMes(c.fechaRadicacion);
    const fila = conteo.get(k) ?? [0, 0, 0];
    fila[indice[c.tipo]] += 1;
    conteo.set(k, fila);
  }
  return {
    porEstado: porEstado.map((e) => ({ clave: e.estado as string, valor: e._count._all })),
    evolucion: meses.map((m) => ({ etiqueta: m.etiqueta, valores: conteo.get(m.clave) ?? [0, 0, 0] })),
  };
}
