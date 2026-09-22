import Link from "next/link";
import { redirect } from "next/navigation";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { Users, Plus, Download } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederContratacion, puedeVerRegistroContratistas, puedeGestionarContratistas } from "@/lib/permisos";
import { TituloSeccion, EstadoVacio } from "@/components/sgdea/ui";
import { ResumenResultados } from "@/components/ResumenResultados";
import { Paginador } from "@/components/Paginador";

const POR_PAGINA = 30;

export default async function ContratistasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");
  if (!puedeVerRegistroContratistas(permisos)) {
    return <AccesoRestringido titulo="Contratistas" quien="administrador, jefe o funcionario de contratación, o supervisor" volverHref="/contratacion/panel" volverLabel="Volver al panel" />;
  }

  const { q, page: pageParam } = await searchParams;
  const busqueda = q?.trim();
  const pagina = Math.max(1, Number(pageParam) || 1);

  const where = busqueda
    ? {
        OR: [
          { identificacion: { contains: busqueda, mode: "insensitive" as const } },
          { nombreORazonSocial: { contains: busqueda, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, contratistas] = await Promise.all([
    db.contratista.count({ where }),
    db.contratista.findMany({
      where,
      orderBy: { nombreORazonSocial: "asc" },
      include: { _count: { select: { expedientes: true } }, usuario: { select: { nombre: true } } },
      take: POR_PAGINA,
      skip: (pagina - 1) * POR_PAGINA,
    }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const hrefPagina = (p: number) => {
    const params = new URLSearchParams();
    if (busqueda) params.set("q", busqueda);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/contratacion/contratistas?${qs}` : "/contratacion/contratistas";
  };

  return (
    <section className="space-y-4">
      <TituloSeccion
        icon={Users}
        contador={total}
        accion={
          puedeGestionarContratistas(permisos) ? (
            <Link
              href="/contratacion/contratistas/nuevo"
              className="flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cdmb-700"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Nuevo contratista
            </Link>
          ) : undefined
        }
      >
        Contratistas
      </TituloSeccion>
      <p className="-mt-2 text-sm text-stone-500">
        Registro propio de este módulo — datos de contacto de personas y empresas contratistas, separado del
        registro de solicitantes de Trámites ambientales 2.0.
      </p>

      <form className="flex flex-wrap items-center gap-2" method="get">
        <input
          name="q"
          defaultValue={busqueda ?? ""}
          placeholder="Buscar por identificación o nombre/razón social…"
          className="min-w-[260px] flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        />
        <button type="submit" className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
          Buscar
        </button>
        {busqueda && (
          <Link href="/contratacion/contratistas" className="text-sm text-stone-500 hover:text-stone-700">
            Quitar filtro
          </Link>
        )}
        <a
          href={`/api/contratacion/contratistas/exportar${busqueda ? `?q=${encodeURIComponent(busqueda)}` : ""}`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Descargar CSV
        </a>
      </form>

      <ResumenResultados total={total} detalle={busqueda ? `que coinciden con "${busqueda}"` : undefined} />

      {contratistas.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
                <th className="px-3 py-2">Identificación</th>
                <th className="px-3 py-2">Nombre / razón social</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Contacto</th>
                <th className="px-3 py-2">Ciudad</th>
                <th className="px-3 py-2">Expedientes</th>
                <th className="px-3 py-2">Cuenta de acceso</th>
              </tr>
            </thead>
            <tbody>
              {contratistas.map((c) => (
                <tr key={c.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link href={`/contratacion/contratistas/${c.id}`} className="text-cdmb-700 hover:underline">
                      {c.identificacion}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{c.nombreORazonSocial}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">{c.tipoPersona === "JURIDICA" ? "Persona jurídica" : "Persona natural"}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">{c.contactoEmail ?? c.contactoTelefono ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">{c.ciudad ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">{c._count.expedientes}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">{c.usuario ? c.usuario.nombre : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EstadoVacio icon={Users}>
          {busqueda ? "Ningún contratista coincide con ese filtro." : "Todavía no hay contratistas registrados."}
        </EstadoVacio>
      )}

      <Paginador paginaActual={pagina} totalPaginas={totalPaginas} total={total} porPagina={POR_PAGINA} hrefPagina={hrefPagina} />
    </section>
  );
}
