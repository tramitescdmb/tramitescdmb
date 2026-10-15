import { redirect } from "next/navigation";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import Link from "next/link";
import type { EstadoCuenta, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { NuevoUsuarioForm } from "@/components/NuevoUsuarioForm";
import { UserPlus, Pencil, ChevronDown, Search, AlertTriangle, Power, X, type LucideIcon, Users } from "lucide-react";
import { MODULOS_USUARIO, faltanteModulo, type ModuloUsuario } from "@/lib/modulos-usuario";
import { ICONOS_MODULO } from "@/lib/modulos-usuario-iconos";
import { getCatalogoTramites } from "@/lib/tramites-data";
import { agruparTramitesPorCategoria } from "@/lib/tramite-categoria";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { estadoVigenciaPassword } from "@/lib/password-policy";
import { Paginador } from "@/components/Paginador";
import { DescargarCsvBoton } from "@/components/DescargarCsvBoton";
import { formatearFecha } from "@/lib/fecha";
import { cargoParaSexo } from "@/lib/cargos";
import { denominacionParaFirma } from "@/lib/denominacion-empleo";
import { ETIQUETA_ROL_CONTRATACION } from "@/lib/contratacion";
import { CabeceraTablero } from "@/components/tablero";

const POR_PAGINA = 20;

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

type AccesoTramite = { tramiteTipoId: string; nivel: "VER" | "EDITAR" };

const ETIQUETAS_ROL_CORRESPONDENCIA: Record<string, string> = {
  OPERADOR_VENTANILLA: "Ventanilla",
  FUNCIONARIO_DEPENDENCIA: "Funcionario",
  JEFE_DEPENDENCIA: "Jefe de dependencia",
  ADMIN_ARCHIVO: "Administrador de archivo",
};

const ETIQUETAS_SECCION_CORTA: Record<string, string> = {
  VITAL_BASE: "VITAL: Solicitudes",
  VITAL_DASHBOARD: "VITAL: Dashboard",
  SINCA_BASE: "SINCA: Solicitudes",
  SINCA_DASHBOARD: "SINCA: Dashboard",
  SINCA_MINERIA: "SINCA: Minería",
};

const ESTADOS: Record<EstadoCuenta, { etiqueta: string; punto: string; texto: string }> = {
  HABILITADA: { etiqueta: "Habilitada", punto: "bg-emerald-500", texto: "text-stone-700" },
  DESHABILITADA: { etiqueta: "Deshabilitada", punto: "bg-stone-300", texto: "text-stone-400" },
  BLOQUEADA: { etiqueta: "Bloqueada", punto: "bg-red-500", texto: "text-red-700" },
  SUSPENDIDA: { etiqueta: "Suspendida", punto: "bg-amber-500", texto: "text-amber-700" },
};

const FILTROS: { id: string; etiqueta: string; where: Prisma.UsuarioWhereInput }[] = [
  { id: "todos", etiqueta: "Todos", where: {} },
  { id: "habilitados", etiqueta: "Habilitados", where: { estadoCuenta: "HABILITADA" } },
  { id: "inactivos", etiqueta: "Deshabilitados", where: { estadoCuenta: { in: ["DESHABILITADA", "SUSPENDIDA"] } } },
  { id: "bloqueados", etiqueta: "Bloqueados", where: { estadoCuenta: "BLOQUEADA" } },
  { id: "admin", etiqueta: "Administradores", where: { rol: "ADMIN" } },
];

function resumenTramitesTexto(accesos: AccesoTramite[], categoriaDeId: Map<string, string>, totalPorCategoria: Map<string, number>): string {
  if (accesos.length === 0) return "Sin trámites asignados";
  const porCategoria = new Map<string, number>();
  for (const a of accesos) {
    const cat = categoriaDeId.get(a.tramiteTipoId);
    if (cat) porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + 1);
  }
  const completas = [...porCategoria].filter(([cat, n]) => n === totalPorCategoria.get(cat)).map(([cat]) => cat);
  if (completas.length > 0 && completas.length === porCategoria.size) return completas.join(", ");
  const editar = accesos.filter((a) => a.nivel === "EDITAR").length;
  return `${accesos.length} trámite(s): ${editar} editar · ${accesos.length - editar} ver`;
}

type TonoModulo = "ok" | "pendiente" | "no";

const CLASE_TONO: Record<TonoModulo, string> = {
  ok: "bg-cdmb-50 text-cdmb-700",
  pendiente: "bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200",
  no: "bg-stone-50 text-stone-300",
};

function ModuloIcono({ icon: Icon, tono, alerta, titulo }: { icon: LucideIcon; tono: TonoModulo; alerta?: boolean; titulo: string }) {
  return (
    <span title={titulo} className={`relative flex h-7 w-7 items-center justify-center rounded-full ${CLASE_TONO[tono]}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {alerta && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" aria-hidden />}
      <span className="sr-only">{titulo}</span>
    </span>
  );
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; page?: string; q?: string; estado?: string; nuevo?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") return <AccesoRestringido titulo="Usuarios y roles" volverHref="/" volverLabel="Ir al inicio" />;

  const { error, ok, page: pageParam, q, estado, nuevo } = await searchParams;
  const pagina = Math.max(1, Number(pageParam) || 1);
  const busqueda = q?.trim();
  const filtro = FILTROS.find((f) => f.id === estado) ?? FILTROS[0]!;
  const whereBusqueda: Prisma.UsuarioWhereInput = busqueda
    ? {
        AND: busqueda
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 4)
          .map((p) => ({
            OR: [
              { nombre: { contains: p, mode: "insensitive" as const } },
              { email: { contains: p, mode: "insensitive" as const } },
              { cedulaONit: { contains: p, mode: "insensitive" as const } },
              { nombres: { contains: p, mode: "insensitive" as const } },
              { apellidos: { contains: p, mode: "insensitive" as const } },
              { razonSocial: { contains: p, mode: "insensitive" as const } },
            ],
          })),
      }
    : {};
  const where: Prisma.UsuarioWhereInput = { AND: [whereBusqueda, filtro.where] };

  const [conteos, usuarios, cargos, catalogo, config] = await Promise.all([
    Promise.all(FILTROS.map((f) => db.usuario.count({ where: { AND: [whereBusqueda, f.where] } }))),
    db.usuario.findMany({
      where,
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      include: {
        cargoAsignaciones: { include: { cargo: true } },
        tramitesAcceso: { select: { tramiteTipoId: true, nivel: true } },
        seccionesAcceso: { select: { seccion: true } },
      },
      take: POR_PAGINA,
      skip: (pagina - 1) * POR_PAGINA,
    }),
    db.cargo.findMany({ orderBy: { orden: "asc" } }),
    getCatalogoTramites(),
    getConfiguracionSitio(),
  ]);
  const total = conteos[FILTROS.indexOf(filtro)] ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const ahora = new Date();

  const categoriaDeId = new Map<string, string>();
  const totalPorCategoria = new Map<string, number>();
  for (const grupo of agruparTramitesPorCategoria(catalogo)) {
    totalPorCategoria.set(grupo.etiqueta, grupo.items.length);
    for (const t of grupo.items) categoriaDeId.set(t.id, grupo.etiqueta);
  }

  const href = (cambios: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const base = { q: busqueda, estado: filtro.id === "todos" ? undefined : filtro.id, ...cambios };
    for (const [k, v] of Object.entries(base)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/usuarios?${qs}` : "/usuarios";
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <CabeceraTablero
        icon={Users}
        titulo="Usuarios"
        contador={total}
        descripcion="Cuentas con acceso a los aplicativos de la CDMB."
        acciones={
          <>
            <DescargarCsvBoton href="/api/usuarios/exportar" />
            <Link
              href={`${href({ nuevo: "1" })}#nuevo-usuario`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-acento-500 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-acento-600"
            >
              <UserPlus className="h-4 w-4" aria-hidden />
              Nuevo usuario
            </Link>
          </>
        }
      />

      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {ok && <div className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</div>}

      {(conteos[3] ?? 0) > 0 && filtro.id !== "bloqueados" && (
        <Link
          href={href({ estado: "bloqueados", page: undefined })}
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 hover:bg-red-100"
        >
          <AlertTriangle className="h-4 w-4 flex-none" aria-hidden />
          {conteos[3] === 1 ? "1 cuenta bloqueada" : `${conteos[3]} cuentas bloqueadas`} por intentos fallidos de inicio de sesión. Ver cuentas
        </Link>
      )}

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
          <nav className="flex flex-wrap gap-1" aria-label="Filtrar por estado">
            {FILTROS.map((f, i) => {
              const activo = f.id === filtro.id;
              return (
                <Link
                  key={f.id}
                  href={href({ estado: f.id === "todos" ? undefined : f.id, page: undefined })}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                    activo ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                  }`}
                >
                  {f.etiqueta}
                  <span className={`rounded-full px-1.5 text-[10px] ${activo ? "bg-white/20" : "bg-stone-100 text-stone-500"}`}>{conteos[i]}</span>
                </Link>
              );
            })}
          </nav>
          <form action="/usuarios" method="get" className="relative w-full sm:w-72">
            {filtro.id !== "todos" && <input type="hidden" name="estado" value={filtro.id} />}
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
            <input
              name="q"
              defaultValue={busqueda ?? ""}
              placeholder="Buscar por nombre, documento o usuario"
              className="w-full rounded-full border border-stone-200 bg-stone-50 py-1.5 pl-8 pr-8 text-sm focus:border-cdmb-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-cdmb-500"
            />
            {busqueda && (
              <Link href={href({ q: undefined, page: undefined })} title="Quitar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">
                <X className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </form>
        </div>

        {usuarios.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-stone-400">No hay usuarios con este filtro.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="hidden bg-stone-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-400 md:table-header-group">
              <tr>
                <th className="px-4 py-2 font-semibold">Usuario</th>
                <th className="px-3 py-2 font-semibold">Denominación del empleo</th>
                <th className="px-3 py-2 font-semibold">Accesos</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="px-4 py-2" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {usuarios.map((u) => {
                const esAdmin = u.rol === "ADMIN";
                const vigencia = !u.directorioActivo ? estadoVigenciaPassword(u.passwordCambiadaEn, config.passwordVigenciaDias) : null;
                const denominacion = denominacionParaFirma(u.denominacionEmpleo, u.sexo, u.denominacionComplemento, u.denominacionEncargo) ?? "";
                const cargo = u.cargoAsignaciones.map((uc) => cargoParaSexo(uc.cargo.nombre, u.sexo, uc.encargo)).join(", ");
                const tramites = esAdmin ? "Acceso total" : resumenTramitesTexto(u.tramitesAcceso, categoriaDeId, totalPorCategoria);
                const sgdeaVence = u.rolCorrespondencia && u.rolCorrespondenciaVigenteHasta;
                const geconVence = u.rolesContratacion.length > 0 && u.rolContratacionVigenteHasta;
                const sgdea = esAdmin
                  ? "SGDEA: acceso total"
                  : u.rolCorrespondencia
                    ? `SGDEA: ${ETIQUETAS_ROL_CORRESPONDENCIA[u.rolCorrespondencia] ?? u.rolCorrespondencia}${sgdeaVence ? ` (vence ${formatearFecha(u.rolCorrespondenciaVigenteHasta!)})` : ""}`
                    : "SGDEA: sin acceso";
                const gecon = esAdmin
                  ? "GECON: acceso total"
                  : u.rolesContratacion.length > 0
                    ? `GECON: ${u.rolesContratacion.map((r) => ETIQUETA_ROL_CONTRATACION[r] ?? r).join(", ")}${geconVence ? ` (vence ${formatearFecha(u.rolContratacionVigenteHasta!)})` : ""}`
                    : "GECON: sin acceso";
                const seccionesDe = (prefijo: string) =>
                  u.seccionesAcceso.filter((s) => s.seccion.startsWith(prefijo)).map((s) => ETIQUETAS_SECCION_CORTA[s.seccion] ?? s.seccion).join(", ");
                const detalle: Record<ModuloUsuario, string> = {
                  TRAMITES: `Trámites 2.0: ${tramites}`,
                  SGDEA: sgdea,
                  GECON: gecon,
                  VITAL: `VITAL: ${seccionesDe("VITAL_")}`,
                  SINCA: `SINCA 1.0: ${seccionesDe("SINCA_")}`,
                };
                const habilitados = new Set(u.modulosAcceso);
                const configuracion = {
                  tramites: u.tramitesAcceso.length,
                  rolCorrespondencia: u.rolCorrespondencia,
                  rolesContratacion: u.rolesContratacion,
                  secciones: u.seccionesAcceso.map((s) => s.seccion),
                };
                const modulos = MODULOS_USUARIO.map((m) => {
                  if (esAdmin) return { m, tono: "ok" as TonoModulo, titulo: `${m.corto}: acceso total` };
                  if (!habilitados.has(m.id)) return { m, tono: "no" as TonoModulo, titulo: `${m.corto}: sin acceso` };
                  if (!config[m.campoGlobal]) return { m, tono: "pendiente" as TonoModulo, titulo: `${m.corto}: oculto para todos en Administración → Módulos` };
                  const falta = faltanteModulo(m.id, configuracion);
                  if (falta) return { m, tono: "pendiente" as TonoModulo, titulo: `${m.corto}: activado, falta configurar (${falta.toLowerCase()})` };
                  return { m, tono: "ok" as TonoModulo, titulo: detalle[m.id] };
                });
                const avisos = [
                  vigencia?.vencida ? "Contraseña vencida" : vigencia && vigencia.diasRestantes !== null && vigencia.diasRestantes <= 7 ? `Contraseña vence en ${vigencia.diasRestantes} d.` : null,
                  sgdeaVence && u.rolCorrespondenciaVigenteHasta! < ahora ? "Rol SGDEA vencido" : null,
                  geconVence && u.rolContratacionVigenteHasta! < ahora ? "Rol GECON vencido" : null,
                ].filter((a): a is string => Boolean(a));
                const est = ESTADOS[u.estadoCuenta];
                return (
                  <tr key={u.id} className={`group flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-stone-50/70 md:table-row md:p-0 ${u.activo ? "" : "opacity-70"}`}>
                    <td className="min-w-0 basis-full md:px-4 md:py-2.5">
                      <Link href={`/usuarios/${u.id}`} className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-semibold ${
                            esAdmin ? "bg-violet-100 text-violet-700" : "bg-cdmb-100 text-cdmb-800"
                          }`}
                          title={esAdmin ? "Administrador" : "Funcionario"}
                        >
                          {iniciales(u.nombre)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-stone-800 group-hover:text-cdmb-700">{u.nombre}</span>
                          <span className="block truncate text-xs text-stone-400">
                            {u.email}
                            {u.cedulaONit ? ` · ${u.tipoIdentificacionFirma === "NIT" ? "NIT" : "C.C."} ${u.cedulaONit}` : ""}
                            {u.directorioActivo ? " · Directorio activo" : ""}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden max-w-[220px] px-3 py-2.5 md:table-cell">
                      <span
                        className={`block truncate text-xs ${denominacion || esAdmin ? "text-stone-600" : "text-stone-300"}`}
                        title={[denominacion, cargo ? `Cargo en Trámites 2.0: ${cargo}` : ""].filter(Boolean).join(" · ") || undefined}
                      >
                        {esAdmin && <span className="mr-1 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">Administrador</span>}
                        {denominacion || (esAdmin ? "" : "Sin denominación")}
                      </span>
                    </td>
                    <td className="md:px-3 md:py-2.5">
                      <span className="flex items-center gap-1">
                        {modulos.map(({ m, tono, titulo }) => (
                          <ModuloIcono
                            key={m.id}
                            icon={ICONOS_MODULO[m.id]}
                            tono={tono}
                            titulo={titulo}
                            alerta={tono === "ok" && !esAdmin && ((m.id === "SGDEA" && Boolean(sgdeaVence)) || (m.id === "GECON" && Boolean(geconVence)))}
                          />
                        ))}
                      </span>
                    </td>
                    <td className="md:px-3 md:py-2.5">
                      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${est.texto}`}>
                        <span className={`h-2 w-2 rounded-full ${est.punto}`} aria-hidden />
                        {est.etiqueta}
                        {avisos.length > 0 && (
                          <span title={avisos.join(" · ")} className="text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                            <span className="sr-only">{avisos.join(" · ")}</span>
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="ml-auto md:ml-0 md:px-4 md:py-2.5">
                      <span className="flex items-center justify-end gap-1">
                        <Link
                          href={`/usuarios/${u.id}`}
                          title="Editar"
                          className="flex h-7 w-7 items-center justify-center rounded-full text-stone-400 hover:bg-cdmb-50 hover:text-cdmb-700"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          <span className="sr-only">Editar</span>
                        </Link>
                        {u.id !== session.userId && (
                          <form action={`/api/usuarios/${u.id}/toggle`} method="post">
                            <button
                              title={u.activo ? "Desactivar" : "Activar"}
                              className={`flex h-7 w-7 items-center justify-center rounded-full hover:bg-stone-100 ${u.activo ? "text-stone-400 hover:text-red-600" : "text-emerald-600"}`}
                            >
                              <Power className="h-3.5 w-3.5" aria-hidden />
                              <span className="sr-only">{u.activo ? "Desactivar" : "Activar"}</span>
                            </button>
                          </form>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <Paginador paginaActual={pagina} totalPaginas={totalPaginas} total={total} porPagina={POR_PAGINA} hrefPagina={(p) => href({ page: p > 1 ? String(p) : undefined })} />
      </div>

      <details id="nuevo-usuario" open={nuevo === "1"} className="group scroll-mt-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
        <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-acento-50 text-acento-600">
            <UserPlus className="h-4 w-4" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-stone-900">Crear usuario</h2>
            <p className="text-xs text-stone-400">Funcionarios, contratistas y empresas. Al guardar se abre su ficha para asignar accesos.</p>
          </div>
          <ChevronDown className="h-4 w-4 flex-none text-stone-400 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <NuevoUsuarioForm cargos={cargos.map((c) => ({ id: c.id, nombre: c.nombre }))} longitudMinima={config.passwordLongitudMinima} longitudMaxima={config.passwordLongitudMaxima} />
      </details>
    </div>
  );
}
