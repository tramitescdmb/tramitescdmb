import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { listarResoluciones, obtenerResolucionDetalle, type SincaResolucionApi } from "@/lib/sinca";

/**
 * Sincroniza la tabla espejo `SincaResolucion` con el API de SINCA 1.0.
 *
 * El endpoint solo tiene ~5.163 registros y admite páginas grandes, así que
 * cada corrida trae TODO (unas 6 peticiones, segundos) y hace upsert. Es más
 * simple y más robusto que un incremental: los históricos casi no cambian,
 * pero a veces les agregan/ajustan la resolución, y así siempre quedan al día.
 *
 * Las filas que ya no aparecen en el API se eliminan (es un espejo, no una
 * fuente propia).
 */

const POR_PAGINA = 500;

function parseTipo(tipo: string | null) {
  if (!tipo) return { codigo: null as string | null, nombre: null as string | null };
  const m = tipo.match(/^\(([^)]+)\)\s*(.*)$/);
  if (!m) return { codigo: null, nombre: tipo.trim() || null };
  return { codigo: m[1].trim() || null, nombre: m[2].trim() || null };
}

function parseFecha(valor: string | null): Date | null {
  if (!valor) return null;
  // "2026-07-03 00:00:00" o "2026-07-03"
  const iso = valor.includes(" ") ? valor.replace(" ", "T") : valor;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // SINCA 1.0 tiene fechas con typos ("0201-...", "2502-...", "10-..."). Se
  // descartan las de años imposibles para que no ensucien el dashboard.
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
    return { lon: c[0], lat: c[1] }; // GeoJSON: [lon, lat]
  }
  return { lat: null, lon: null };
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
  duracionMs: number;
  error?: string;
};

function diffDias(desde: Date | null, hasta: Date | null): number | null {
  if (!desde || !hasta) return null;
  const d = Math.round((hasta.getTime() - desde.getTime()) / 86_400_000);
  return d >= 0 && d <= 4000 ? d : null;
}

/**
 * Trae el detalle (`GET /presinca/resoluciones/{n}`) de las filas sin enriquecer
 * y completa `fechaRecibido`, `diasResolucion` y los datos del solicitante.
 * `limite` acota cuántas por corrida (el cron va completando de a poco);
 * sin límite recorre todas (script `sinca:enrich`).
 */
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
        } catch {
          /* se reintenta en la próxima corrida */
        }
      })
    );
  }
  return hechos;
}

export async function sincronizarResoluciones(disparadoPor: string): Promise<ResultadoSincronizacion> {
  const inicio = Date.now();
  const registro = await db.sincaSincronizacion.create({ data: { disparadoPor } });

  try {
    // Enriquecimiento existente (fechaRecibido, días, solicitante) — solo lo entrega
    // el endpoint de detalle, así que hay que conservarlo al reconstruir el espejo.
    const previos = await db.sincaResolucion.findMany({
      select: {
        nroSolicitud: true,
        fechaRecibido: true,
        diasResolucion: true,
        solicitanteNit: true,
        solicitanteNombre: true,
        enriquecidoEn: true,
      },
    });
    const idsExistentes = new Set(previos.map((r) => r.nroSolicitud));
    const enriquecimientoPrevio = new Map(previos.map((r) => [r.nroSolicitud, r]));

    // 1. Traer TODAS las páginas del API.
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
        filasPorId.set(row.nrosolicitud_sol, fila);
      }
      if (pagina.data.length === 0) break;
      page++;
    } while (page <= ultimaPagina);

    const filas = [...filasPorId.values()];
    if (filas.length === 0) {
      throw new Error("El API no devolvió ningún registro; se aborta para no vaciar el espejo.");
    }

    // 2. Reemplazo atómico (es un espejo): borrar todo y volver a insertar por lotes.
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

    // 3. Enriquecer (detalle) un lote pequeño de las que aún no lo están — para
    //    mantener al día lo nuevo sin arriesgar el límite de tiempo de la función
    //    serverless. El backfill completo (5.000+) se hace una sola vez con
    //    `npm run sinca:enrich` desde una máquina, no aquí.
    const enriquecidos = await enriquecerResoluciones({ limite: 150 });

    const resultado: ResultadoSincronizacion = {
      ok: true,
      totalApi,
      creados,
      actualizados,
      eliminados,
      enriquecidos,
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
