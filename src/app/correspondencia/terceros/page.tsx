import Link from "next/link";
import { redirect } from "next/navigation";
import { Contact, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeRadicar } from "@/lib/permisos";
import { TituloSeccion, EstadoVacio } from "@/components/sgdea/ui";
import { Paginador } from "@/components/Paginador";
import { filtroTerceros, nombreTercero } from "@/lib/terceros";

const POR_PAGINA = 30;

export default async function TercerosPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");

  const { q, page } = await searchParams;
  const busqueda = q?.trim() ?? "";
  const pagina = Math.max(1, Number(page) || 1);
  const where = filtroTerceros(busqueda);
  const [total, terceros] = await Promise.all([
    db.tercero.count({ where }),
    db.tercero.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: POR_PAGINA,
      skip: (pagina - 1) * POR_PAGINA,
      include: { _count: { select: { comunicaciones: true } } },
    }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <section className="space-y-4">
      <TituloSeccion
        icon={Contact}
        contador={total}
        accion={
          puedeRadicar(permisos) ? (
            <Link
              href="/correspondencia/terceros/nuevo"
              className="flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-acento-600"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Nuevo tercero
            </Link>
          ) : undefined
        }
      >
        Terceros
      </TituloSeccion>
      <p className="-mt-2 text-sm text-stone-500">Remitentes y destinatarios de la correspondencia: ciudadanos, empresas y entidades.</p>

      <form className="flex flex-wrap items-center gap-2" method="get">
        <input
          name="q"
          defaultValue={busqueda}
          placeholder="Documento, nombres, apellidos, razón social o correo…"
          className="min-w-[260px] flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
        />
        <button type="submit" className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
          Buscar
        </button>
        {busqueda && (
          <Link href="/correspondencia/terceros" className="text-sm text-stone-500 hover:text-stone-700">
            Quitar filtro
          </Link>
        )}
      </form>

      {terceros.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-soft">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-100 text-left text-[11px] font-medium uppercase tracking-wide text-stone-400">
                <th className="px-3 py-2">Documento</th>
                <th className="px-3 py-2">Nombre / razón social</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Contacto</th>
                <th className="px-3 py-2">Ciudad</th>
                <th className="px-3 py-2">Comunicaciones</th>
              </tr>
            </thead>
            <tbody>
              {terceros.map((t) => (
                <tr key={t.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                  <td className="px-3 py-2 font-mono">
                    <Link href={`/correspondencia/terceros/${t.id}`} className="text-cdmb-700 hover:underline">
                      {t.tipoIdentificacion ? `${t.tipoIdentificacion} ` : ""}
                      {t.identificacion}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-sm text-stone-800">{nombreTercero(t)}</td>
                  <td className="px-3 py-2 text-stone-500">{t.tipo === "JURIDICA" ? "Jurídica" : "Natural"}</td>
                  <td className="px-3 py-2 text-stone-500">{[t.email, t.celular ?? t.telefono].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-2 text-stone-500">{[t.ciudad, t.departamento].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-stone-500">{t._count.comunicaciones}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EstadoVacio icon={Contact}>{busqueda ? "Ningún tercero coincide con la búsqueda." : "Todavía no hay terceros registrados."}</EstadoVacio>
      )}

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
          return qs ? `/correspondencia/terceros?${qs}` : "/correspondencia/terceros";
        }}
      />
    </section>
  );
}
