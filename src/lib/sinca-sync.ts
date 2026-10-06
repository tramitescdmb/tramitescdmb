import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { listarResoluciones, listarSolicitudes, obtenerResolucionDetalle, type SincaResolucionApi, type SincaSolicitudApi } from "@/lib/sinca";
import { dentroDeZonaCdmb, puntoDesdeNorteEste, puntoDesdeTexto } from "@/lib/coordenadas-texto";

const POR_PAGINA = 500;

function parseTipo(tipo: string | null) {
  if (!tipo) return { codigo: null as string | null, nombre: null as string | null };
  const m = tipo.match(/^\(([^)]+)\)\s*(.*)$/);
  if (!m) return { codigo: null, nombre: tipo.trim() || null };
  return { codigo: m[1].trim() || null, nombre: m[2].trim() || null };
}

function parseFecha(valor: string | null): Date | null {
  if (!valor) return null;
  const iso = valor.includes(" ") ? valor.replace(" ", "T") : valor;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const anio = d.getUTCFullYear();
  if (anio < 1980 || anio > new Date().getUTCFullYear() + 1) return null;
  return d;
}

function parseEntero(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined) return 0;
  const n = typeof valor === "number" ? valor : parseInt(valor, 10);
  return Number.isFinite(n) ? n : 0;
}

function coordenadas(row: SincaResolucionApi): { lat: number | null; lon: number | null } {
  const c = row.geojson_GMS?.coordinates;
  if (Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
    return { lon: c[0], lat: c[1] };
  }
  const delTexto = puntoDesdeTexto(row.proyecto_sol);
  if (delTexto) return { lat: delTexto.lat, lon: delTexto.lon };
  return { lat: null, lon: null };
}

function numeroCampo(valor: unknown): number | null {
  if (valor === null || valor === undefined || String(valor).trim() === "") return null;
  const n = Number(String(valor).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function puntoDeSolicitud(row: SincaSolicitudApi): { lat: number; lon: number } | null {
  const geo = row.geojson_GMS as { coordinates?: unknown } | null | undefined;
  const c = geo?.coordinates;
  if (Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
    return { lon: c[0] as number, lat: c[1] as number };
  }
  const norte = numeroCampo(row.coordx_sol);
  const este = numeroCampo(row.coordy_sol);
  if (norte && este) {
    const p = puntoDesdeNorteEste(String(norte), String(este));
    if (p && p.origen !== "geograficas") return { lat: p.lat, lon: p.lon };
  }
  const latG = numeroCampo(row.latgrados_sol);
  const lonG = numeroCampo(row.longrados_sol);
  if (latG && lonG) {
    const lat = Math.abs(latG) + (numeroCampo(row.latmin_sol) ?? 0) / 60 + (numeroCampo(row.latseg_sol) ?? 0) / 3600;
    const lon = -(Math.abs(lonG) + (numeroCampo(row.longmin_sol) ?? 0) / 60 + (numeroCampo(row.longseg_sol) ?? 0) / 3600);
    if (dentroDeZonaCdmb(lat, lon)) return { lat, lon };
  }
  const delTexto = puntoDesdeTexto(typeof row.proyecto_sol === "string" ? row.proyecto_sol : null);
  return delTexto ? { lat: delTexto.lat, lon: delTexto.lon } : null;
}

async function paginaSolicitudes(
  page: number,
  porPagina: number,
  order: "ASC" | "DESC"
): Promise<{ filas: SincaSolicitudApi[]; ultima: number | null; omitidas: number }> {
  try {
    const p = await listarSolicitudes({ perPage: porPagina, page, order });
    return { filas: p.data, ultima: p.last_page, omitidas: 0 };
  } catch {
    if (porPagina <= 5) return { filas: [], ultima: null, omitidas: porPagina };
    const menor = porPagina > 50 ? 50 : 5;
    const factor = porPagina / menor;
    const filas: SincaSolicitudApi[] = [];
    let omitidas = 0;
    for (let sub = (page - 1) * factor + 1; sub <= page * factor; sub++) {
      const parte = await paginaSolicitudes(sub, menor, order);
      filas.push(...parte.filas);
      omitidas += parte.omitidas;
    }
    return { filas, ultima: null, omitidas };
  }
}

export async function completarCoordenadasDesdeSolicitudes(
  opts: { soloNros?: number[] } = {}
): Promise<{ actualizados: number; omitidas: number }> {
  const sinPunto = new Set(
    (
      await db.sincaResolucion.findMany({
        where: { OR: [{ lat: null }, { lon: null }], ...(opts.soloNros ? { nroSolicitud: { in: opts.soloNros } } : {}) },
        select: { nroSolicitud: true },
      })
    ).map((r) => r.nroSolicitud)
  );
  if (sinPunto.size === 0) return { actualizados: 0, omitidas: 0 };

  const POR_PAGINA_SOLICITUDES = 500;
  const menor = Math.min(...sinPunto);
  const puntos = new Map<number, { lat: number; lon: number }>();
  let omitidas = 0;
  let page = 1;
  let ultima = 1;
  do {
    const p = await paginaSolicitudes(page, POR_PAGINA_SOLICITUDES, "DESC");
    if (p.ultima !== null) ultima = p.ultima;
    else if (page === 1) ultima = Number.MAX_SAFE_INTEGER;
    omitidas += p.omitidas;
    if (p.filas.length === 0) break;
    let minimoPagina = Number.POSITIVE_INFINITY;
    for (const row of p.filas) {
      const nro = Number(row.nrosolicitud_sol);
      if (Number.isFinite(nro)) minimoPagina = Math.min(minimoPagina, nro);
      if (!sinPunto.has(nro) || puntos.has(nro)) continue;
      const punto = puntoDeSolicitud(row);
      if (punto) puntos.set(nro, punto);
    }
    if (minimoPagina < menor) break;
    page++;
  } while (page <= ultima);

  const cambios = [...puntos.entries()];
  for (let i = 0; i < cambios.length; i += 200) {
    await db.$transaction(
      cambios.slice(i, i + 200).map(([nroSolicitud, p]) => db.sincaResolucion.update({ where: { nroSolicitud }, data: { lat: p.lat, lon: p.lon } }))
    );
  }
  return { actualizados: cambios.length, omitidas };
}

function aFila(row: SincaResolucionApi): Prisma.SincaResolucionCreateManyInput {
  const { codigo, nombre } = parseTipo(row.tipo_solicitud);
  const fechaResolucion = parseFecha(row.fecha_documento);
  const { lat, lon } = coordenadas(row);
  return {
    nroSolicitud: row.nrosolicitud_sol,
    numeroResolucion: row.numero_resolucion ?? null,
    fechaResolucion,
    anioResolucion: fechaResolucion ? fechaResolucion.getUTCFullYear() : null,
    fechaRecibido: parseFecha(row.fecharecibido_sol ?? null),
    proyecto: (row.proyecto_sol ?? "").trim(),
    tipoSolicitud: row.tipo_solicitud ?? null,
    tipoSolicitudCodigo: codigo,
    tipoSolicitudNombre: nombre,
    indTipoSolicitud: row.indtiposol_sol?.label ?? null,
    estado: row.estado_sol?.label ?? null,
    origen: row.origen_sol?.label ?? null,
    expediente: row.expediente_sol ?? null,
    departamento: row.departamento ?? null,
    municipio: row.municipio ?? null,
    barrio: row.barrio ?? null,
    correo: row.correo_sol ?? null,
    representanteLegal: row.replegal_sol ?? null,
    idRepresentante: row.idreplegal_sol != null ? String(row.idreplegal_sol) : null,
    cantidadDocumentos: parseEntero(row.cantidad_emision_documentos),
    cantidadInteresados: parseEntero(row.cantidad_interesado),
    lat,
    lon,
    raw: row as unknown as Prisma.InputJsonValue,
    sincronizadoEn: new Date(),
  };
}

export type ResultadoSincronizacion = {
  ok: boolean;
  totalApi: number;
  creados: number;
  actualizados: number;
  eliminados: number;
  enriquecidos?: number;
  coordenadasCompletadas?: number;
  duracionMs: number;
  error?: string;
};

function diffDias(desde: Date | null, hasta: Date | null): number | null {
  if (!desde || !hasta) return null;
  const d = Math.round((hasta.getTime() - desde.getTime()) / 86_400_000);
  return d >= 0 && d <= 4000 ? d : null;
}

export async function enriquecerResoluciones(opts: { limite?: number; concurrencia?: number } = {}): Promise<number> {
  const concurrencia = opts.concurrencia ?? 4;
  const pendientes = await db.sincaResolucion.findMany({
    where: { enriquecidoEn: null },
    select: { nroSolicitud: true, fechaResolucion: true },
    orderBy: { nroSolicitud: "desc" },
    ...(opts.limite ? { take: opts.limite } : {}),
  });

  let hechos = 0;
  for (let i = 0; i < pendientes.length; i += concurrencia) {
    const lote = pendientes.slice(i, i + concurrencia);
    await Promise.all(
      lote.map(async ({ nroSolicitud, fechaResolucion }) => {
        try {
          const d = await obtenerResolucionDetalle(nroSolicitud);
          const fechaRecibido = parseFecha(d?.fecharecibido_sol ?? null);
          const nit = d?.interesado?.[0]?.nit as Record<string, unknown> | undefined;
          const solicitanteNit = nit?.numero_nit != null ? String(nit.numero_nit) : null;
          const solicitanteNombre =
            (nit?.razon_soc_nit as string) ||
            [nit?.primer_nom_nit, nit?.segundo_nom_nit, nit?.primer_ape_nit, nit?.segundo_ape_nit].filter(Boolean).join(" ") ||
            (nit?.nombre_nit as string) ||
            null;
          await db.sincaResolucion.update({
            where: { nroSolicitud },
            data: {
              fechaRecibido,
              diasResolucion: diffDias(fechaRecibido, fechaResolucion),
              solicitanteNit,
              solicitanteNombre: solicitanteNombre?.trim() || null,
              enriquecidoEn: new Date(),
            },
          });
          hechos++;
        } catch {}
      })
    );
  }
  return hechos;
}

export async function sincronizarResoluciones(disparadoPor: string): Promise<ResultadoSincronizacion> {
  const inicio = Date.now();
  const registro = await db.sincaSincronizacion.create({ data: { disparadoPor } });

  try {
    const previos = await db.sincaResolucion.findMany({
      select: {
        nroSolicitud: true,
        fechaRecibido: true,
        diasResolucion: true,
        solicitanteNit: true,
        solicitanteNombre: true,
        enriquecidoEn: true,
        lat: true,
        lon: true,
      },
    });
    const idsExistentes = new Set(previos.map((r) => r.nroSolicitud));
    const enriquecimientoPrevio = new Map(previos.map((r) => [r.nroSolicitud, r]));

    const filasPorId = new Map<number, Prisma.SincaResolucionCreateManyInput>();
    let page = 1;
    let totalApi = 0;
    let ultimaPagina = 1;
    do {
      const pagina = await listarResoluciones({ perPage: POR_PAGINA, page, column: "nrosolicitud_sol", order: "ASC" });
      totalApi = pagina.total;
      ultimaPagina = pagina.last_page;
      for (const row of pagina.data) {
        if (!row?.nrosolicitud_sol) continue;
        const fila = aFila(row);
        const prev = enriquecimientoPrevio.get(row.nrosolicitud_sol);
        if (prev?.enriquecidoEn) {
          fila.fechaRecibido = prev.fechaRecibido;
          fila.diasResolucion = prev.diasResolucion;
          fila.solicitanteNit = prev.solicitanteNit;
          fila.solicitanteNombre = prev.solicitanteNombre;
          fila.enriquecidoEn = prev.enriquecidoEn;
        }
        if ((fila.lat == null || fila.lon == null) && prev?.lat != null && prev.lon != null) {
          fila.lat = prev.lat;
          fila.lon = prev.lon;
        }
        filasPorId.set(row.nrosolicitud_sol, fila);
      }
      if (pagina.data.length === 0) break;
      page++;
    } while (page <= ultimaPagina);

    const filas = [...filasPorId.values()];
    if (filas.length === 0) {
      throw new Error("El API no devolvió ningún registro; se aborta para no vaciar el espejo.");
    }

    const LOTE = 1000;
    const lotes: Prisma.SincaResolucionCreateManyInput[][] = [];
    for (let i = 0; i < filas.length; i += LOTE) lotes.push(filas.slice(i, i + LOTE));

    await db.$transaction([
      db.sincaResolucion.deleteMany({}),
      ...lotes.map((lote) => db.sincaResolucion.createMany({ data: lote })),
    ]);

    const creados = filas.filter((f) => !idsExistentes.has(f.nroSolicitud)).length;
    const eliminados = [...idsExistentes].filter((id) => !filasPorId.has(id)).length;
    const actualizados = filas.length - creados;

    let coordenadasCompletadas = 0;
    try {
      const nuevos = filas.filter((f) => !idsExistentes.has(f.nroSolicitud)).map((f) => f.nroSolicitud);
      if (nuevos.length > 0) coordenadasCompletadas = (await completarCoordenadasDesdeSolicitudes({ soloNros: nuevos })).actualizados;
    } catch {}

    const enriquecidos = await enriquecerResoluciones({ limite: 150 });

    const resultado: ResultadoSincronizacion = {
      ok: true,
      totalApi,
      creados,
      actualizados,
      eliminados,
      enriquecidos,
      coordenadasCompletadas,
      duracionMs: Date.now() - inicio,
    };
    await db.sincaSincronizacion.update({
      where: { id: registro.id },
      data: { terminadoEn: new Date(), ok: true, totalApi, creados, actualizados, eliminados },
    });
    return resultado;
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    await db.sincaSincronizacion.update({
      where: { id: registro.id },
      data: { terminadoEn: new Date(), ok: false, mensajeError: mensaje },
    });
    return { ok: false, totalApi: 0, creados: 0, actualizados: 0, eliminados: 0, duracionMs: Date.now() - inicio, error: mensaje };
  }
}
