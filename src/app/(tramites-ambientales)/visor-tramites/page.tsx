import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederTramite, puedeAccederSeccion } from "@/lib/permisos";
import { sincaConfigurado } from "@/lib/sinca";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";
import { SelectorPeriodo } from "@/components/SelectorPeriodo";
import { GeovisorTramites } from "@/components/GeovisorTramites";
import type { CapaExterna } from "@/lib/geovisor-capas-externas";
import { puntosSinca, puntosVital } from "@/lib/visor-puntos-externos";

export default async function GeovisorPage({ searchParams }: { searchParams: Promise<FiltrosPeriodo> }) {
  const sp = await searchParams;
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
  if (rango) filtros.push({ fechaRadicacion: { gte: rango.desde, lt: rango.hasta } });
  const where: Prisma.ExpedienteWhereInput = { AND: filtros };

  const veSinca = sincaConfigurado() && (permisos ? puedeAccederSeccion(permisos, "SINCA_BASE") : false);
  const veVital = permisos ? puedeAccederSeccion(permisos, "VITAL_BASE") : false;
  const [sinca, vital] = await Promise.all([veSinca ? puntosSinca() : null, veVital ? puntosVital() : null]);

  const capasExternas: CapaExterna[] = [];
  if (sinca) capasExternas.push({ id: "sinca", nombre: "SINCA 1.0", descripcion: "", ...sinca });
  if (vital) capasExternas.push({ id: "vital", nombre: "VITAL", descripcion: "", ...vital });

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
        <SelectorPeriodo desdeActual={sp.desde} hastaActual={sp.hasta} />
        <Link href="/expedientes" className="text-sm font-medium text-cdmb-700 hover:underline">
          Ver como lista →
        </Link>
      </div>

      <GeovisorTramites
        tramites={tramites}
        capasExternas={capasExternas}
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
