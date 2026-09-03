import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Field, SectionHelp } from "@/components/Field";
import { IconUser, IconMail, IconLock, IconShieldCheck } from "@/components/icons";
import { UserPlus, Briefcase, Pencil } from "lucide-react";
import { getCatalogoTramites } from "@/lib/tramites-data";
import { agruparTramitesPorCategoria } from "@/lib/tramite-categoria";
import { Paginador } from "@/components/Paginador";

const iconSm = "h-4 w-4";
const POR_PAGINA = 15;

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

type AccesoTramite = { tramiteTipoId: string; nivel: "VER" | "EDITAR" };

const ETIQUETAS_SECCION_CORTA: Record<string, string> = {
  VITAL_BASE: "VITAL: Solicitudes",
  VITAL_DASHBOARD: "VITAL: Dashboard",
  SINCA_BASE: "SINCA: Solicitudes",
  SINCA_DASHBOARD: "SINCA: Dashboard",
  SINCA_MINERIA: "SINCA: Minería",
};

/**
 * Resumen legible del acceso de un usuario: si cubre completo una o varias
 * categorías del catálogo (ej. "Recurso Hídrico"), se muestra el nombre de
 * la categoría en vez de un conteo — más claro que "5 editar · 0 ver" para
 * alguien que piensa en "le di todo lo de Recurso Hídrico", que es como lo
 * describe el jefe de oficina. Si el acceso es parcial o mixto, cae al
 * conteo simple.
 */
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

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; page?: string; q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") redirect("/");

  const { error, ok, page: pageParam, q } = await searchParams;
  const pagina = Math.max(1, Number(pageParam) || 1);
  const busqueda = q?.trim();
  const where = busqueda
    ? {
        OR: [
          { nombre: { contains: busqueda, mode: "insensitive" as const } },
          { email: { contains: busqueda, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, usuarios, cargos, catalogo] = await Promise.all([
    db.usuario.count({ where }),
    db.usuario.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        cargos: true,
        tramitesAcceso: { select: { tramiteTipoId: true, nivel: true } },
        seccionesAcceso: { select: { seccion: true } },
      },
      take: POR_PAGINA,
      skip: (pagina - 1) * POR_PAGINA,
    }),
    db.cargo.findMany({ orderBy: { orden: "asc" } }),
    getCatalogoTramites(),
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
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- descarga de archivo (ruta de API), no una página */}
        <a
          href="/api/usuarios/exportar"
          className="flex-none rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition-transform hover:bg-stone-50 active:scale-95"
        >
          ⬇ Descargar CSV
        </a>
      </div>

      <SectionHelp>
        Rol <strong>Administrador</strong>: acceso total a todo, sin excepción — incluye crear/desactivar
        usuarios. Rol <strong>Funcionario</strong>: solo ve y gestiona los trámites que se le asignen
        explícitamente en &quot;Editar&quot; — sin nada asignado, no ve ninguno.
        <br />
        Los usuarios marcados como <strong>Directorio activo</strong> se crean solos la primera vez que
        ingresan con las credenciales de la red de la CDMB (rol Funcionario, sin cargo ni trámites);
        entre a &quot;Editar&quot; para asignarle cargo(s) y los trámites a los que puede entrar, con
        nivel Ver (solo consulta) o Editar (puede actuar).
      </SectionHelp>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{ok}</div>}

      <form action="/usuarios" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-stone-600">Buscar</label>
          <input
            name="q"
            defaultValue={busqueda ?? ""}
            placeholder="Nombre o correo…"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
        </div>
        <button type="submit" className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
          Buscar
        </button>
        {busqueda && (
          <Link href="/usuarios" className="text-sm text-stone-500 hover:text-stone-700">
            Quitar búsqueda
          </Link>
        )}
      </form>

      <div className="space-y-3">
        {usuarios.length === 0 && (
          <p className="rounded-2xl border border-stone-200 bg-white px-5 py-10 text-center text-sm text-stone-400">
            No hay usuarios con este filtro.
          </p>
        )}
        {usuarios.map((u) => (
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
                  <p className="truncate text-xs text-stone-400">{u.email}</p>
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
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.activo ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {u.activo ? "Activo" : "Inactivo"}
                </span>
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

            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-stone-100 pt-3 sm:grid-cols-3">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Cargo(s)</p>
                {u.cargos.length === 0 ? (
                  <span className="text-xs text-stone-400">—</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {u.cargos.map((c) => (
                      <span key={c.id} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                        {c.nombre}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Trámites</p>
                {u.rol === "ADMIN" ? (
                  <span className="text-xs text-stone-400">Acceso total</span>
                ) : u.tramitesAcceso.length === 0 ? (
                  <span className="text-xs text-amber-700">Sin trámites asignados</span>
                ) : (
                  (() => {
                    const resumen = resumenAcceso(u.tramitesAcceso, categoriaDeId, totalPorCategoria);
                    if (resumen.tipo === "categorias") {
                      return (
                        <div className="flex flex-wrap gap-1">
                          {resumen.categorias.map((cat) => (
                            <span key={cat} className="rounded-full bg-cdmb-50 px-2 py-0.5 text-[11px] font-medium text-cdmb-700">
                              {cat}
                            </span>
                          ))}
                        </div>
                      );
                    }
                    return (
                      <span className="text-xs">
                        {resumen.editar} editar · {resumen.ver} ver
                      </span>
                    );
                  })()
                )}
              </div>

              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">VITAL / SINCA 1.0</p>
                {u.rol === "ADMIN" ? (
                  <span className="text-xs text-stone-400">Acceso total</span>
                ) : u.seccionesAcceso.length === 0 ? (
                  <span className="text-xs text-amber-700">Sin acceso</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {u.seccionesAcceso.map((s) => (
                      <span
                        key={s.seccion}
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          s.seccion === "SINCA_MINERIA" ? "bg-amber-50 text-amber-800" : "bg-sky-50 text-sky-700"
                        }`}
                      >
                        {ETIQUETAS_SECCION_CORTA[s.seccion] ?? s.seccion}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

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

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
            <UserPlus className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Crear usuario nuevo</h2>
            <p className="text-xs text-stone-400">
              Al guardar, pasa directo a la página de este usuario para asignarle los trámites y el acceso
              a VITAL/SINCA 1.0.
            </p>
          </div>
        </div>
        <form action="/api/usuarios" method="post" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" required icon={<IconUser className={iconSm} />} help="Como debe aparecer en la bitácora de los expedientes.">
              <input
                name="nombre"
                required
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
            </Field>
            <Field label="Correo institucional" required icon={<IconMail className={iconSm} />} help="Con este correo va a iniciar sesión.">
              <input
                type="email"
                name="email"
                required
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
                placeholder="nombre@cdmb.gov.co"
              />
            </Field>
            <Field label="Contraseña temporal" required icon={<IconLock className={iconSm} />} help="Mínimo 8 caracteres. El usuario la puede cambiar después.">
              <input
                type="password"
                name="password"
                required
                minLength={8}
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
            </Field>
            <Field label="Rol" required icon={<IconShieldCheck className={iconSm} />} help="Qué puede hacer este usuario dentro de la app.">
              <select
                name="rol"
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              >
                <option value="FUNCIONARIO">Funcionario</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </Field>
          </div>

          <Field
            label="Cargo(s) en la CDMB"
            icon={<Briefcase className={iconSm} />}
            help="Su(s) puesto(s) real(es) (Subdirector, Profesional en Derecho, etc.). Se usan para resaltarle qué pasos de un trámite le corresponden. Puede marcar uno, varios, o ninguno."
          >
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-stone-200 bg-stone-50/60 p-2.5">
              {cargos.map((c) => (
                <label key={c.id} className="cursor-pointer">
                  <input type="checkbox" name="cargoIds" value={c.id} className="peer sr-only" />
                  <span className="inline-block rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600 transition hover:border-cdmb-300 hover:text-cdmb-700 peer-checked:border-cdmb-600 peer-checked:bg-cdmb-600 peer-checked:text-white">
                    {c.nombre}
                  </span>
                </label>
              ))}
            </div>
          </Field>

          <button
            type="submit"
            className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white transition-transform hover:bg-cdmb-700 active:scale-95"
          >
            Crear usuario
          </button>
        </form>
      </section>
    </div>
  );
}
