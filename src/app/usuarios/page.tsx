import { redirect } from "next/navigation";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import Link from "next/link";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { NuevoUsuarioForm } from "@/components/NuevoUsuarioForm";
import { UserPlus, Pencil, ChevronDown } from "lucide-react";
import { getCatalogoTramites } from "@/lib/tramites-data";
import { agruparTramitesPorCategoria } from "@/lib/tramite-categoria";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { estadoVigenciaPassword } from "@/lib/password-policy";
import { Paginador } from "@/components/Paginador";
import { DescargarCsvBoton } from "@/components/DescargarCsvBoton";
import { formatearFecha } from "@/lib/fecha";
import { cargoParaSexo } from "@/lib/cargos";
import { ETIQUETA_ROL_CONTRATACION } from "@/lib/contratacion";

const POR_PAGINA = 15;

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

type AccesoTramite = { tramiteTipoId: string; nivel: "VER" | "EDITAR" };

const ETIQUETAS_ROL_CORRESPONDENCIA: Record<string, string> = {
  OPERADOR_VENTANILLA: "SGDEA: Ventanilla",
  FUNCIONARIO_DEPENDENCIA: "SGDEA: Funcionario",
  JEFE_DEPENDENCIA: "SGDEA: Jefe de dependencia",
  ADMIN_ARCHIVO: "SGDEA: Admin. de archivo",
};

const ETIQUETAS_SECCION_CORTA: Record<string, string> = {
  VITAL_BASE: "VITAL: Solicitudes",
  VITAL_DASHBOARD: "VITAL: Dashboard",
  SINCA_BASE: "SINCA: Solicitudes",
  SINCA_DASHBOARD: "SINCA: Dashboard",
  SINCA_MINERIA: "SINCA: Minería",
};

function resumenAcceso(
  accesos: AccesoTramite[],
  categoriaDeId: Map<string, string>,
  totalPorCategoria: Map<string, number>
): { tipo: "categorias"; categorias: string[] } | { tipo: "conteo"; editar: number; ver: number } {
  const porCategoria = new Map<string, number>();
  for (const a of accesos) {
    const cat = categoriaDeId.get(a.tramiteTipoId);
    if (!cat) continue;
    porCategoria.set(cat, (porCategoria.get(cat) ?? 0) + 1);
  }
  const categoriasCompletas = Array.from(porCategoria.entries())
    .filter(([cat, count]) => count === totalPorCategoria.get(cat))
    .map(([cat]) => cat);

  if (categoriasCompletas.length > 0 && categoriasCompletas.length === porCategoria.size) {
    return { tipo: "categorias", categorias: categoriasCompletas };
  }
  return {
    tipo: "conteo",
    editar: accesos.filter((a) => a.nivel === "EDITAR").length,
    ver: accesos.filter((a) => a.nivel === "VER").length,
  };
}

/** Resume en una sola línea de texto (no una pared de chips) — pensado para que la tarjeta no
 * crezca sin control cuando el registro llegue a cientos o miles de usuarios. El detalle completo
 * sigue disponible en el `title` (al pasar el mouse) y en la ficha de edición de cada usuario. */
function resumenTramitesTexto(accesos: AccesoTramite[], categoriaDeId: Map<string, string>, totalPorCategoria: Map<string, number>): string {
  if (accesos.length === 0) return "Sin trámites asignados";
  const resumen = resumenAcceso(accesos, categoriaDeId, totalPorCategoria);
  if (resumen.tipo === "categorias") return resumen.categorias.join(", ");
  return `${accesos.length} trámite(s) — ${resumen.editar} editar · ${resumen.ver} ver`;
}

function resumenSeccionesTexto(secciones: { seccion: string }[]): string {
  if (secciones.length === 0) return "Sin acceso";
  return secciones.map((s) => ETIQUETAS_SECCION_CORTA[s.seccion] ?? s.seccion).join(", ");
}

function resumenCargosTexto(cargoAsignaciones: { encargo: boolean; cargo: { nombre: string } }[], sexo: string | null | undefined): string {
  if (cargoAsignaciones.length === 0) return "Sin cargo asignado";
  return cargoAsignaciones.map((uc) => cargoParaSexo(uc.cargo.nombre, sexo, uc.encargo)).join(", ");
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; page?: string; q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") return <AccesoRestringido titulo="Usuarios y roles" volverHref="/" volverLabel="Ir al inicio" />;

  const { error, ok, page: pageParam, q } = await searchParams;
  const pagina = Math.max(1, Number(pageParam) || 1);
  const busqueda = q?.trim();
  const where = busqueda
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

  const [total, usuarios, cargos, catalogo, config, bloqueadas] = await Promise.all([
    db.usuario.count({ where }),
    db.usuario.findMany({
      where,
      orderBy: { createdAt: "asc" },
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
    db.usuario.findMany({ where: { estadoCuenta: "BLOQUEADA" }, select: { id: true, nombre: true, email: true }, orderBy: { nombre: "asc" } }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const categoriaDeId = new Map<string, string>();
  const totalPorCategoria = new Map<string, number>();
  for (const grupo of agruparTramitesPorCategoria(catalogo)) {
    totalPorCategoria.set(grupo.etiqueta, grupo.items.length);
    for (const t of grupo.items) categoriaDeId.set(t.id, grupo.etiqueta);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Usuarios</h1>
          <p className="text-sm text-stone-500">
            Funcionarios de la CDMB que pueden ingresar a esta aplicación para gestionar trámites.
          </p>
        </div>
        <DescargarCsvBoton href="/api/usuarios/exportar" />
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</div>}

      {bloqueadas.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="font-medium">
            {bloqueadas.length === 1 ? "1 cuenta bloqueada" : `${bloqueadas.length} cuentas bloqueadas`} por exceder los intentos fallidos de inicio de sesión:
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
            {bloqueadas.map((u) => (
              <li key={u.id}>
                <Link href={`/usuarios/${u.id}`} className="underline hover:no-underline">{u.nombre}</Link>
                <span className="text-red-600"> ({u.email})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action="/usuarios" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white shadow-soft p-4">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-stone-600">Buscar</label>
          <input
            name="q"
            defaultValue={busqueda ?? ""}
            placeholder="Nombre, apellidos, documento o usuario…"
            className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
          />
        </div>
        <button type="submit" className="rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600">
          Buscar
        </button>
        {busqueda && (
          <Link href="/usuarios" className="text-sm text-stone-500 hover:text-stone-700">
            Quitar búsqueda
          </Link>
        )}
      </form>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Usuarios registrados ({total})
        </p>
        {usuarios.length === 0 && (
          <p className="rounded-2xl border border-stone-200 bg-white px-5 py-10 text-center text-sm text-stone-400">
            No hay usuarios con este filtro.
          </p>
        )}
        {usuarios.map((u) => {
          const vigencia = !u.directorioActivo ? estadoVigenciaPassword(u.passwordCambiadaEn, config.passwordVigenciaDias) : null;
          return (
          <div key={u.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-cdmb-100 text-xs font-semibold text-cdmb-800">
                  {iniciales(u.nombre)}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 font-medium text-stone-800">
                    {u.nombre}
                    {u.directorioActivo && (
                      <span className="rounded-full bg-cdmb-50 px-2 py-0.5 text-[11px] font-medium text-cdmb-700">
                        Directorio activo
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-stone-400">
                    {u.directorioActivo ? `Usuario de red: ${u.email}` : u.email}
                    {u.cedulaONit ? ` · ${u.tipoIdentificacionFirma === "NIT" ? "NIT" : "C.C."} ${u.cedulaONit}` : ""}
                    {u.tipoPersona === "JURIDICA" ? " · Persona jurídica" : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.rol === "ADMIN" ? "bg-violet-50 text-violet-700" : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {u.rol === "ADMIN" ? "Administrador" : "Funcionario"}
                </span>
                {u.rol !== "ADMIN" && (
                  <>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        u.rolCorrespondencia ? "bg-cdmb-50 text-cdmb-700" : "bg-stone-100 text-stone-400"
                      }`}
                      title="Rol dentro del módulo de correspondencia (SGDEA) — sin este rol no puede entrar al módulo ni recibir un reparto"
                    >
                      {u.rolCorrespondencia ? ETIQUETAS_ROL_CORRESPONDENCIA[u.rolCorrespondencia] ?? u.rolCorrespondencia : "Sin acceso SGDEA"}
                    </span>
                    {u.rolCorrespondencia && u.rolCorrespondenciaVigenteHasta && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.rolCorrespondenciaVigenteHasta < new Date() ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                        }`}
                        title="Pasada esta fecha, pierde el rol de correspondencia automáticamente"
                      >
                        {u.rolCorrespondenciaVigenteHasta < new Date() ? "Rol vencido" : `Vence ${formatearFecha(u.rolCorrespondenciaVigenteHasta)}`}
                      </span>
                    )}
                    {u.rolesContratacion.map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-cdmb-50 px-2 py-0.5 text-xs font-medium text-cdmb-700"
                        title="Rol dentro del módulo de Contratación (GECON)"
                      >
                        {ETIQUETA_ROL_CONTRATACION[r] ?? r}
                      </span>
                    ))}
                    {u.rolesContratacion.length > 0 && u.rolContratacionVigenteHasta && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.rolContratacionVigenteHasta < new Date() ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                        }`}
                        title="Pasada esta fecha, pierde el rol de contratación automáticamente"
                      >
                        {u.rolContratacionVigenteHasta < new Date() ? "Rol vencido" : `Vence ${formatearFecha(u.rolContratacionVigenteHasta)}`}
                      </span>
                    )}
                  </>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    {
                      HABILITADA: "bg-green-50 text-green-700",
                      DESHABILITADA: "bg-stone-100 text-stone-500",
                      BLOQUEADA: "bg-red-50 text-red-700",
                      SUSPENDIDA: "bg-amber-50 text-amber-700",
                    }[u.estadoCuenta]
                  }`}
                  title={u.estadoCuenta === "BLOQUEADA" ? "Bloqueada por el sistema tras intentos fallidos" : undefined}
                >
                  {{ HABILITADA: "Habilitada", DESHABILITADA: "Deshabilitada", BLOQUEADA: "Bloqueada", SUSPENDIDA: "Suspendida" }[u.estadoCuenta]}
                </span>
                {vigencia && vigencia.diasRestantes !== null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      vigencia.vencida
                        ? "bg-red-50 text-red-700"
                        : vigencia.diasRestantes <= 7
                          ? "bg-amber-50 text-amber-700"
                          : "bg-stone-100 text-stone-500"
                    }`}
                    title="Vigencia de la contraseña — configurable en Administración → Seguridad"
                  >
                    {vigencia.vencida ? "Contraseña vencida" : `Contraseña vence en ${vigencia.diasRestantes} d.`}
                  </span>
                )}
                <Link
                  href={`/usuarios/${u.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-cdmb-700"
                >
                  <Pencil className="h-3 w-3" aria-hidden />
                  Editar
                </Link>
                {u.id !== session.userId && (
                  <form action={`/api/usuarios/${u.id}/toggle`} method="post">
                    <button className="text-xs text-stone-500 hover:text-cdmb-700 hover:underline">
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <details className="group mt-3 border-t border-stone-100 pt-2">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-stone-500 hover:text-cdmb-700 [&::-webkit-details-marker]:hidden">
                <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
                Cargo, trámites y accesos
              </summary>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                <div className="min-w-0">
                  <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Cargo(s)</p>
                  {(() => {
                    const texto = resumenCargosTexto(u.cargoAsignaciones, u.sexo);
                    return (
                      <p className={`truncate text-xs ${u.cargoAsignaciones.length === 0 ? "text-stone-400" : "text-stone-600"}`} title={texto}>
                        {texto}
                      </p>
                    );
                  })()}
                </div>

                <div className="min-w-0">
                  <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Trámites</p>
                  {u.rol === "ADMIN" ? (
                    <p className="text-xs text-stone-400">Acceso total</p>
                  ) : (
                    (() => {
                      const texto = resumenTramitesTexto(u.tramitesAcceso, categoriaDeId, totalPorCategoria);
                      return (
                        <p className={`truncate text-xs ${u.tramitesAcceso.length === 0 ? "text-amber-700" : "text-stone-600"}`} title={texto}>
                          {texto}
                        </p>
                      );
                    })()
                  )}
                </div>

                <div className="min-w-0">
                  <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">VITAL / SINCA 1.0</p>
                  {u.rol === "ADMIN" ? (
                    <p className="text-xs text-stone-400">Acceso total</p>
                  ) : (
                    (() => {
                      const texto = resumenSeccionesTexto(u.seccionesAcceso);
                      return (
                        <p className={`truncate text-xs ${u.seccionesAcceso.length === 0 ? "text-amber-700" : "text-stone-600"}`} title={texto}>
                          {texto}
                        </p>
                      );
                    })()
                  )}
                </div>
              </div>
            </details>
          </div>
          );
        })}

        <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
          <Paginador
            paginaActual={pagina}
            totalPaginas={totalPaginas}
            total={total}
            porPagina={POR_PAGINA}
            hrefPagina={(p) => {
              const params = new URLSearchParams();
              if (busqueda) params.set("q", busqueda);
              if (p > 1) params.set("page", String(p));
              const qs = params.toString();
              return qs ? `/usuarios?${qs}` : "/usuarios";
            }}
          />
        </div>
      </div>

      <details className="group rounded-2xl border border-dashed border-cdmb-300 bg-cdmb-50/40 p-5">
        <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
            <UserPlus className="h-4 w-4" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-stone-900">+ Crear usuario nuevo</h2>
            <p className="text-xs text-stone-400">Funcionarios, contratistas y empresas. Al guardar se abre su ficha para asignar accesos.</p>
          </div>
          <ChevronDown className="h-4 w-4 flex-none text-stone-400 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <NuevoUsuarioForm cargos={cargos.map((c) => ({ id: c.id, nombre: c.nombre }))} longitudMinima={config.passwordLongitudMinima} longitudMaxima={config.passwordLongitudMaxima} />
      </details>
    </div>
  );
}
