import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederTramite, puedeAccederSeccion } from "@/lib/permisos";
import { sincaConfigurado } from "@/lib/sinca";
import { formatearFecha } from "@/lib/fecha";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";
import { SelectorPeriodo } from "@/components/SelectorPeriodo";
import { GeovisorTramites } from "@/components/GeovisorTramites";

export default async function GeovisorPage({ searchParams }: { searchParams: Promise<FiltrosPeriodo> }) {
  const sp = await searchParams;
  const { rango, etiqueta: etiquetaPeriodo } = resolverPeriodo(sp);

  const [todosLosTramites, session] = await Promise.all([
    db.tramiteTipo.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, codigo: true } }),
    getSession(),
  ]);
  const permisos = session ? await obtenerPermisosUsuario(session.userId) : null;
  const tramites = permisos ? todosLosTramites.filter((t) => puedeAccederTramite(permisos, t.id)) : todosLosTramites;
  const tramiteIdsPermitidos = permisos && !permisos.esAdmin ? Array.from(permisos.tramites.keys()) : null;

  const filtros: Prisma.ExpedienteWhereInput[] = [{ ubicacionLat: { not: null }, ubicacionLon: { not: null } }];
  if (tramiteIdsPermitidos) filtros.push({ tramiteTipoId: { in: tramiteIdsPermitidos } });
  if (rango) filtros.push({ fechaRadicacion: { gte: rango.desde, lt: rango.hasta } });
  const where: Prisma.ExpedienteWhereInput = { AND: filtros };

  const veSinca = sincaConfigurado() && (permisos ? puedeAccederSeccion(permisos, "SINCA_BASE") : false);
  const puntosSinca = veSinca
    ? await db.sincaResolucion.findMany({
        where: { lat: { not: null }, lon: { not: null } },
        orderBy: { fechaResolucion: "desc" },
        select: {
          nroSolicitud: true,
          numeroResolucion: true,
          tipoSolicitudNombre: true,
          tipoSolicitud: true,
          municipio: true,
          estado: true,
          fechaResolucion: true,
          lat: true,
          lon: true,
        },
      })
    : [];

  const expedientes = await db.expediente.findMany({
    where,
    orderBy: { fechaUltimoMovimiento: "desc" },
    take: 5000,
    select: {
      id: true,
      numero: true,
      tramiteTipoId: true,
      estado: true,
      municipio: true,
      solicitanteNombre: true,
      fechaRadicacion: true,
      ubicacionLat: true,
      ubicacionLon: true,
      tramiteTipo: { select: { nombre: true, codigo: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Visor de trámites</h2>
          <p className="text-sm text-stone-500">
            Trámites con ubicación registrada, sobre la jurisdicción de la CDMB
            {rango ? ` — radicados entre ${etiquetaPeriodo}` : ""}.
          </p>
        </div>
        <Link href="/expedientes" className="text-sm font-medium text-cdmb-700 hover:underline">
          Ver como lista →
        </Link>
      </div>

      <SelectorPeriodo desdeActual={sp.desde} hastaActual={sp.hasta} />

      <GeovisorTramites
        tramites={tramites}
        puntosSinca={puntosSinca.map((p) => ({
          nroSolicitud: p.nroSolicitud,
          numeroResolucion: p.numeroResolucion,
          tipo: p.tipoSolicitudNombre ?? p.tipoSolicitud,
          municipio: p.municipio,
          estado: p.estado,
          fecha: p.fechaResolucion ? formatearFecha(p.fechaResolucion) : null,
          lat: p.lat!,
          lon: p.lon!,
        }))}
        expedientes={expedientes.map((e) => ({
          id: e.id,
          numero: e.numero,
          tramiteTipoId: e.tramiteTipoId,
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
