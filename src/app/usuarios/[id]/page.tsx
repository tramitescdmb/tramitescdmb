import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { getCatalogoTramites } from "@/lib/tramites-data";
import { agruparTramitesPorCategoria } from "@/lib/tramite-categoria";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { estadoVigenciaPassword } from "@/lib/password-policy";
import { EditarUsuarioAccesoForm } from "@/components/EditarUsuarioAccesoForm";
import { personaDesdeUsuario } from "@/lib/usuarios-persona";
import { cargoParaSexo } from "@/lib/cargos";
import { denominacionParaFirma } from "@/lib/denominacion-empleo";
import { obtenerAgendaUsuario } from "@/lib/agenda-landing";
import { MiniPlaneador } from "@/components/inicio/MiniPlaneador";
import { MODULOS_USUARIO, type ModuloUsuario } from "@/lib/modulos-usuario";
import { ArrowLeft } from "lucide-react";
import type { EstadoCuenta } from "@prisma/client";

const ESTADOS: Record<EstadoCuenta, { etiqueta: string; punto: string; clase: string }> = {
  HABILITADA: { etiqueta: "Habilitada", punto: "bg-emerald-500", clase: "bg-emerald-50 text-emerald-700" },
  DESHABILITADA: { etiqueta: "Deshabilitada", punto: "bg-stone-400", clase: "bg-stone-100 text-stone-500" },
  BLOQUEADA: { etiqueta: "Bloqueada", punto: "bg-red-500", clase: "bg-red-50 text-red-700" },
  SUSPENDIDA: { etiqueta: "Suspendida", punto: "bg-amber-500", clase: "bg-amber-50 text-amber-700" },
};

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

export default async function EditarUsuarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") redirect("/");

  const { id } = await params;
  const { ok } = await searchParams;
  const [usuario, cargos, tramites, dependencias, config] = await Promise.all([
    db.usuario.findUnique({
      where: { id },
      include: {
        cargoAsignaciones: { include: { cargo: true } },
        tramitesAcceso: { select: { tramiteTipoId: true, nivel: true } },
        seccionesAcceso: { select: { seccion: true } },
      },
    }),
    db.cargo.findMany({ orderBy: { orden: "asc" } }),
    getCatalogoTramites(),
    listarDependenciasActivas(),
    getConfiguracionSitio(),
  ]);
  if (!usuario) notFound();
  const agenda = await obtenerAgendaUsuario(usuario.id, false);

  const tramitesPorCategoria = agruparTramitesPorCategoria(tramites).map((g) => ({
    etiqueta: g.etiqueta,
    claseBadge: g.clases.badge,
    claseBarra: g.clases.barra,
    items: g.items.map((t) => ({ id: t.id, codigo: t.codigo, nombre: t.nombre })),
  }));

  const estado = ESTADOS[usuario.estadoCuenta];
  const cargo =
    denominacionParaFirma(usuario.denominacionEmpleo, usuario.sexo, usuario.denominacionComplemento, usuario.denominacionEncargo) ??
    usuario.cargoAsignaciones.map((uc) => cargoParaSexo(uc.cargo.nombre, usuario.sexo, uc.encargo)).join(", ");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/usuarios" className="inline-flex items-center gap-1 text-sm text-cdmb-700 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Usuarios
      </Link>

      <header className="flex flex-wrap items-center gap-4 rounded-md border border-stone-200 bg-white px-5 py-4">
        <span
          className={`flex h-12 w-12 flex-none items-center justify-center rounded-full text-base font-semibold ${
            usuario.rol === "ADMIN" ? "bg-violet-100 text-violet-700" : "bg-cdmb-100 text-cdmb-800"
          }`}
        >
          {iniciales(usuario.nombre)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-stone-900">{usuario.nombre}</h1>
          <p className="truncate text-sm text-stone-500">
            {usuario.directorioActivo ? `Usuario de red: ${usuario.email}` : usuario.email}
            {cargo ? ` · ${cargo}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${estado.clase}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${estado.punto}`} aria-hidden />
            {estado.etiqueta}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${usuario.rol === "ADMIN" ? "bg-violet-50 text-violet-700" : "bg-stone-100 text-stone-600"}`}>
            {usuario.rol === "ADMIN" ? "Administrador" : "Funcionario"}
          </span>
          {usuario.directorioActivo && (
            <span className="rounded-full bg-cdmb-50 px-2.5 py-1 text-xs font-medium text-cdmb-700" title="Ingresa con las credenciales de la red CDMB, no con una contraseña local">
              Directorio activo
            </span>
          )}
        </div>
      </header>

      {ok && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</div>}

      <EditarUsuarioAccesoForm
        usuarioId={usuario.id}
        usuarioRed={usuario.email}
        personaActual={personaDesdeUsuario(usuario)}
        directorioActivo={usuario.directorioActivo}
        rolActual={usuario.rol}
        cargoActualIds={usuario.cargoAsignaciones.map((uc) => uc.cargo.id)}
        cargoEncargoIdsActuales={usuario.cargoAsignaciones.filter((uc) => uc.encargo).map((uc) => uc.cargo.id)}
        accesoActual={usuario.tramitesAcceso.map((a) => ({ tramiteTipoId: a.tramiteTipoId, nivel: a.nivel }))}
        seccionesActuales={usuario.seccionesAcceso.map((s) => s.seccion)}
        cargos={cargos.map((c) => ({ id: c.id, nombre: c.nombre }))}
        tramitesPorCategoria={tramitesPorCategoria}
        dependenciaActualId={usuario.dependenciaId}
        rolCorrespondenciaActual={usuario.rolCorrespondencia}
        rolCorrespondenciaVigenteHastaActual={usuario.rolCorrespondenciaVigenteHasta ? usuario.rolCorrespondenciaVigenteHasta.toISOString().slice(0, 10) : null}
        dependencias={dependencias.map((d) => ({ id: d.id, nombre: d.nombre }))}
        sexoActual={usuario.sexo}
        denominacionEmpleoActual={usuario.denominacionEmpleo}
        denominacionComplementoActual={usuario.denominacionComplemento}
        denominacionEncargoActual={usuario.denominacionEncargo}
        actoAdministrativoCargoActual={usuario.actoAdministrativoCargo}
        accesoFirmaActual={usuario.accesoFirma}
        politicaPassword={{ longitudMinima: config.passwordLongitudMinima, longitudMaxima: config.passwordLongitudMaxima }}
        vigenciaPassword={
          usuario.directorioActivo ? undefined : estadoVigenciaPassword(usuario.passwordCambiadaEn, config.passwordVigenciaDias)
        }
        estadoCuentaActual={usuario.estadoCuenta}
        rolesContratacionActuales={usuario.rolesContratacion}
        rolContratacionVigenteHastaActual={usuario.rolContratacionVigenteHasta ? usuario.rolContratacionVigenteHasta.toISOString().slice(0, 10) : null}
        modulosActuales={usuario.modulosAcceso}
        agendaVisitas={agenda ? <MiniPlaneador agenda={agenda} planificador={false} titulo="Visitas del funcionario" /> : undefined}
        visiblesGlobal={Object.fromEntries(MODULOS_USUARIO.map((m) => [m.id, config[m.campoGlobal]])) as Record<ModuloUsuario, boolean>}
      />
    </div>
  );
}
