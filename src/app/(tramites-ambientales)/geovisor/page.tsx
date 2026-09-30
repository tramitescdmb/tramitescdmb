import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederTramite } from "@/lib/permisos";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";
import { SelectorPeriodo } from "@/components/SelectorPeriodo";
import { MUNICIPIOS_JURISDICCION_CDMB } from "@/lib/municipios";
import { GeovisorTramites } from "@/components/GeovisorTramites";
import { ESTADOS_EXPEDIENTE } from "@/lib/estados-expediente";

export default async function GeovisorPage({
  searchParams,
}: {
  searchParams: Promise<FiltrosPeriodo & { estado?: string; tramite?: string; municipio?: string }>;
}) {
  const sp = await searchParams;
  const { estado, tramite, municipio } = sp;
  const { rango } = resolverPeriodo(sp);

  const [todosLosTramites, session] = await Promise.all([
    db.tramiteTipo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, codigo: true } }),
    getSession(),
  ]);
  const permisos = session ? await obtenerPermisosUsuario(session.userId) : null;
  const tramites = permisos ? todosLosTramites.filter((t) => puedeAccederTramite(permisos, t.id)) : todosLosTramites;
  const tramiteIdsPermitidos = permisos && !permisos.esAdmin ? Array.from(permisos.tramites.keys()) : null;

  const filtros: Prisma.ExpedienteWhereInput[] = [{ ubicacionLat: { not: null }, ubicacionLon: { not: null } }];
  if (tramiteIdsPermitidos) filtros.push({ tramiteTipoId: { in: tramiteIdsPermitidos } });
  if (estado) filtros.push({ estado: estado as (typeof ESTADOS_EXPEDIENTE)[number] });
  if (tramite) filtros.push({ tramiteTipoId: tramite });
  if (municipio) filtros.push({ municipio });
  if (rango) filtros.push({ fechaRadicacion: { gte: rango.desde, lt: rango.hasta } });
  const where: Prisma.ExpedienteWhereInput = { AND: filtros };

  const expedientes = await db.expediente.findMany({
    where,
    orderBy: { fechaUltimoMovimiento: "desc" },
    take: 2000,
    select: {
      id: true,
      numero: true,
      estado: true,
      municipio: true,
      solicitanteNombre: true,
      fechaRadicacion: true,
      ubicacionLat: true,
      ubicacionLon: true,
      tramiteTipo: { select: { nombre: true, codigo: true } },
    },
  });

  const conFiltro = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const actuales = { estado, tramite, municipio, desde: sp.desde, hasta: sp.hasta, ...extra };
    for (const [k, v] of Object.entries(actuales)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/expedientes?${qs}` : "/expedientes";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Geovisor</h2>
          <p className="text-sm text-stone-500">
            Trámites con ubicación registrada, sobre la jurisdicción de la CDMB. Mismo filtro que la lista de
            expedientes.
          </p>
        </div>
        <Link href={conFiltro({})} className="text-sm font-medium text-cdmb-700 hover:underline">
          Ver como lista →
        </Link>
      </div>

      <form action="/geovisor" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white shadow-soft p-4">
        {sp.desde && <input type="hidden" name="desde" value={sp.desde} />}
        {sp.hasta && <input type="hidden" name="hasta" value={sp.hasta} />}
        <div className="min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-stone-600">Trámite</label>
          <select name="tramite" defaultValue={tramite ?? ""} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500">
            <option value="">Todos los trámites</option>
            {tramites.map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo} — {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-stone-600">Municipio</label>
          <select name="municipio" defaultValue={municipio ?? ""} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500">
            <option value="">Todos</option>
            {MUNICIPIOS_JURISDICCION_CDMB.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px]">
          <label className="mb-1 block text-xs font-medium text-stone-600">Estado</label>
          <select name="estado" defaultValue={estado ?? ""} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500">
            <option value="">Todos</option>
            {ESTADOS_EXPEDIENTE.map((e) => (
              <option key={e} value={e}>
                {e.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
          Filtrar
        </button>
      </form>

      <SelectorPeriodo desdeActual={sp.desde} hastaActual={sp.hasta} />

      <GeovisorTramites
        expedientes={expedientes.map((e) => ({
          id: e.id,
          numero: e.numero,
          tramiteNombre: e.tramiteTipo.nombre,
          tramiteCodigo: e.tramiteTipo.codigo,
          estado: e.estado,
          municipio: e.municipio,
          solicitanteNombre: e.solicitanteNombre,
          fechaRadicacion: e.fechaRadicacion.toISOString(),
          lat: e.ubicacionLat!,
          lon: e.ubicacionLon!,
        }))}
      />
    </div>
  );
}
