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
import { NOMBRE_TRAMITE_VITAL } from "@/lib/vital";
import { puntoDesdeCampos } from "@/lib/coordenadas-texto";
import type { CapaExterna } from "@/lib/geovisor-capas-externas";

function recortar(texto: string, max: number): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length > max ? `${limpio.slice(0, max - 1)}…` : limpio;
}

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
  const [puntosSinca, solicitudesVital] = await Promise.all([
    veSinca
      ? db.sincaResolucion.findMany({
          where: { lat: { not: null }, lon: { not: null } },
          orderBy: { fechaResolucion: "desc" },
          select: {
            nroSolicitud: true,
            numeroResolucion: true,
            tipoSolicitudNombre: true,
            tipoSolicitud: true,
            proyecto: true,
            municipio: true,
            estado: true,
            fechaResolucion: true,
            lat: true,
            lon: true,
          },
        })
      : [],
    veVital
      ? db.solicitudVital.findMany({
          orderBy: { fechaRadicacion: "desc" },
          select: { id: true, idVital: true, idTramiteVital: true, nombreActividad: true, solicitanteNombre: true, fechaRadicacion: true, camposTramite: true },
        })
      : [],
  ]);

  const capasExternas: CapaExterna[] = [];
  if (veSinca) {
    capasExternas.push({
      id: "sinca",
      nombre: "SINCA 1.0",
      descripcion: "Resoluciones históricas de SINCA 1.0 con coordenadas registradas, clasificadas por tipo de trámite. Capa independiente de Trámites ambientales 2.0.",
      puntos: puntosSinca.map((p) => ({
        clave: String(p.nroSolicitud),
        numero: p.numeroResolucion ? `Res. ${p.numeroResolucion}` : `Solicitud ${p.nroSolicitud}`,
        tipo: p.tipoSolicitudNombre ?? p.tipoSolicitud ?? "Sin tipo",
        detalle: p.proyecto ? recortar(p.proyecto, 140) : null,
        municipio: p.municipio,
        estado: p.estado,
        fecha: p.fechaResolucion ? formatearFecha(p.fechaResolucion) : null,
        lat: p.lat!,
        lon: p.lon!,
        enlace: `/historico/solicitudes/${p.nroSolicitud}`,
      })),
    });
  }
  if (veVital) {
    capasExternas.push({
      id: "vital",
      nombre: "VITAL",
      descripcion: "Solicitudes radicadas en VITAL (MinAmbiente) cuyo formulario trae coordenadas, clasificadas por tipo de trámite. Capa independiente de Trámites ambientales 2.0 y de SINCA 1.0.",
      puntos: solicitudesVital.flatMap((s) => {
        const punto = puntoDesdeCampos(s.camposTramite);
        if (!punto) return [];
        return [
          {
            clave: s.idVital,
            numero: s.idVital,
            tipo: NOMBRE_TRAMITE_VITAL[s.idTramiteVital] ?? `Trámite ${s.idTramiteVital}`,
            detalle: [s.nombreActividad, s.solicitanteNombre].filter(Boolean).join(" · ") || null,
            municipio: null,
            estado: null,
            fecha: s.fechaRadicacion ? formatearFecha(s.fechaRadicacion) : null,
            lat: punto.lat,
            lon: punto.lon,
            enlace: `/vital/${s.id}`,
          },
        ];
      }),
    });
  }

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
