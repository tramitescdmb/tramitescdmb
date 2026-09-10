import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parsePorPagina } from "@/lib/vista-lista";

/**
 * Lecturas del Fondo Documental histórico (SOLO CONSULTA). Toda la escritura
 * pasa por /api/fondo-historico/ingest; aquí solo se lee.
 */

export interface FiltrosFondo {
  q?: string;
  serie?: string;
  anio?: string;
  desde?: string; // "YYYY-MM-DD"
  hasta?: string; // "YYYY-MM-DD"
  imagen?: string; // "si" | "no"
  page?: string;
  vista?: string;
}

function fechaValida(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function whereDe(fondo: string, f: FiltrosFondo): Prisma.FondoDocumentoWhereInput {
  const w: Prisma.FondoDocumentoWhereInput = { fondo };
  const q = f.q?.trim();
  if (q) {
    w.OR = [
      { asunto: { contains: q, mode: "insensitive" } },
      { razonSocial: { contains: q, mode: "insensitive" } },
      { destinatario: { contains: q, mode: "insensitive" } },
      { numero: { contains: q, mode: "insensitive" } },
      { numeroEntrada: { contains: q, mode: "insensitive" } },
      { numeroSalida: { contains: q, mode: "insensitive" } },
      { refId: q },
    ];
  }
  const serie = Number(f.serie);
  if (Number.isFinite(serie) && f.serie) w.serieId = serie;

  // Rango de fechas (sobre `fecha`). `anio` se mantiene por compatibilidad de enlaces.
  const desde = fechaValida(f.desde);
  const hasta = fechaValida(f.hasta);
  if (desde || hasta) {
    w.fecha = {};
    if (desde) w.fecha.gte = desde;
    if (hasta) {
      const fin = new Date(hasta);
      fin.setDate(fin.getDate() + 1); // inclusivo hasta el final del día
      w.fecha.lt = fin;
    }
  } else {
    const anio = Number(f.anio);
    if (Number.isFinite(anio) && f.anio) w.anio = anio;
  }

  if (f.imagen === "si") w.tieneImagen = true;
  if (f.imagen === "no") w.tieneImagen = false;
  return w;
}

export async function getFondoListado(fondo: string, f: FiltrosFondo) {
  const { porPagina, vista } = parsePorPagina(f.vista);
  const page = Math.max(1, Number(f.page) || 1);
  const where = whereDe(fondo, f);

  const [total, filas] = await Promise.all([
    db.fondoDocumento.count({ where }),
    db.fondoDocumento.findMany({
      where,
      orderBy: [{ fecha: { sort: "desc", nulls: "last" } }, { refId: "desc" }],
      skip: (page - 1) * porPagina,
      take: porPagina,
      select: {
        id: true,
        refId: true,
        serieNombre: true,
        numero: true,
        numeroEntrada: true,
        numeroSalida: true,
        fecha: true,
        asunto: true,
        razonSocial: true,
        destinatario: true,
        oficina: true,
        tieneImagen: true,
        numArchivos: true,
        rutaOriginal: true,
      },
    }),
  ]);

  return {
    filas,
    total,
    page,
    porPagina,
    vista,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}

export async function getFondoDocumento(fondo: string, refId: string) {
  return db.fondoDocumento.findUnique({ where: { fondo_refId: { fondo, refId } } });
}

export async function getFondoOpciones(fondo: string) {
  const [series, anios] = await Promise.all([
    db.fondoDocumento.groupBy({
      by: ["serieId", "serieNombre"],
      where: { fondo, serieId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { serieId: "desc" } },
    }),
    db.fondoDocumento.groupBy({
      by: ["anio"],
      where: { fondo, anio: { not: null } },
      _count: { _all: true },
      orderBy: { anio: "desc" },
    }),
  ]);
  return {
    series: series
      .filter((s) => s.serieId != null)
      .map((s) => ({ id: s.serieId as number, nombre: s.serieNombre ?? `Serie ${s.serieId}`, total: s._count._all })),
    anios: anios.filter((a) => a.anio != null).map((a) => ({ anio: a.anio as number, total: a._count._all })),
  };
}

export async function getFondoPanel(fondo: string) {
  const [total, conImagen, rango, ultimaSync, opciones] = await Promise.all([
    db.fondoDocumento.count({ where: { fondo } }),
    db.fondoDocumento.count({ where: { fondo, tieneImagen: true } }),
    db.fondoDocumento.aggregate({ where: { fondo, fecha: { not: null } }, _min: { fecha: true }, _max: { fecha: true } }),
    db.fondoSincronizacion.findFirst({ where: { fondo }, orderBy: { iniciadoEn: "desc" } }),
    getFondoOpciones(fondo),
  ]);
  return {
    total,
    conImagen,
    desde: rango._min.fecha ?? null,
    hasta: rango._max.fecha ?? null,
    ultimaSync,
    series: opciones.series,
    anios: opciones.anios,
  };
}
