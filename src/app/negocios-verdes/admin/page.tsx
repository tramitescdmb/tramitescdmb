import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { MUNICIPIOS_NV, esMunicipioNV } from "@/lib/negocios-verdes";
import { listarNegociosPanel, resumenPanelNV } from "@/lib/negocios-verdes-data";
import { revisionDatosNV } from "@/lib/negocios-verdes-admin";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeGestionarNV } from "@/lib/negocios-verdes-permisos";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

function Cifra({ titulo, valor, nota }: { titulo: string; valor: number; nota?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-900">{valor.toLocaleString("es-CO")}</p>
      {nota && <p className="mt-0.5 text-xs text-stone-500">{nota}</p>}
    </div>
  );
}

export default async function PanelNegociosVerdes({ searchParams }: Props) {
  const sp = await searchParams;
  const estado = sp.estado === "publicados" || sp.estado === "borradores" ? sp.estado : undefined;
  const municipio = esMunicipioNV(sp.municipio) ? sp.municipio : undefined;
  const session = await verificarSesion();
  const [resumen, negocios, config, permisos, revision] = await Promise.all([
    resumenPanelNV(),
    listarNegociosPanel({ q: sp.q, municipio, estado }),
    getConfiguracionSitio(),
    session ? obtenerPermisosUsuario(session.userId) : null,
    revisionDatosNV(),
  ]);
  const porCorregir = revision.filter((f) => f.problemas.some((p) => p.grave)).length;
  const puedeCrear = Boolean(permisos && puedeGestionarNV(permisos, "CREAR"));

  return (
    <div className="space-y-6">
      {!config.negociosVerdesSitioPublico && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          El sitio público está apagado: la ciudadanía ve «Sitio en preparación». Se enciende en Administración → Módulos, casilla «Negocios Verdes — Sitio público».
        </p>
      )}

      {porCorregir > 0 && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          {porCorregir} registro{porCorregir === 1 ? "" : "s"} con correo mal escrito o coordenadas fuera de la jurisdicción.{" "}
          <Link prefetch={false} href="/negocios-verdes/admin/revision" className="font-medium underline">
            Ver revisión de datos
          </Link>
        </p>
      )}

      {sp.eliminado && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Negocio eliminado.</p>}
      {puedeCrear && (
        <div className="flex justify-end">
          <Link prefetch={false} href="/negocios-verdes/admin/negocios/nuevo" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
            + Nuevo negocio
          </Link>
        </div>
      )}

      {resumen.total === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-600">
          <p className="font-medium text-stone-800">Aún no hay negocios cargados.</p>
          <p className="mt-1">
            Los datos de la plataforma anterior se traen con el script de migración (<code>npm run nv:migrar</code>, ver docs/NEGOCIOS-VERDES.md),
            o se crean uno a uno con «Nuevo negocio».
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Cifra titulo="Negocios" valor={resumen.total} />
          <Cifra titulo="Publicados" valor={resumen.publicados} nota={`${resumen.borradores} sin publicar`} />
          <Cifra titulo="Categorías activas" valor={resumen.categorias} />
          <Cifra titulo="Sin coordenadas" valor={resumen.sinCoordenadas} nota="No salen en el mapa" />
        </div>
      )}

      <section className="space-y-3">
        <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl border border-stone-200 bg-white p-3 text-sm">
          <label className="block min-w-[12rem] flex-1">
            <span className="mb-1 block text-xs font-medium text-stone-600">Nombre</span>
            <input name="q" defaultValue={sp.q ?? ""} className="w-full rounded-lg border border-stone-300 px-3 py-1.5" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">Municipio</span>
            <select name="municipio" defaultValue={municipio ?? ""} className="rounded-lg border border-stone-300 px-3 py-1.5">
              <option value="">Todos</option>
              {MUNICIPIOS_NV.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">Estado</span>
            <select name="estado" defaultValue={estado ?? ""} className="rounded-lg border border-stone-300 px-3 py-1.5">
              <option value="">Todos</option>
              <option value="publicados">Publicados</option>
              <option value="borradores">Sin publicar</option>
            </select>
          </label>
          <button className="rounded-lg bg-emerald-700 px-4 py-1.5 font-semibold text-white hover:bg-emerald-800">Filtrar</button>
        </form>

        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2">Negocio</th>
                <th className="px-3 py-2">Municipio</th>
                <th className="px-3 py-2">Categoría principal</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Productos</th>
                <th className="px-3 py-2 text-right">Fotos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {negocios.map((n) => (
                <tr key={n.id}>
                  <td className="px-3 py-2">
                    <Link prefetch={false} href={`/negocios-verdes/admin/negocios/${n.id}`} className="font-medium text-stone-900 hover:text-emerald-800 hover:underline">
                      {n.nombre}
                    </Link>
                    {n.destacado && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">Destacado</span>}
                    {n.activo && (
                      <Link
                        prefetch={false}
                        href={`/negocios-verdes/negocio/${encodeURIComponent(n.slug)}`}
                        target="_blank"
                        className="ml-2 inline-flex items-center gap-0.5 text-xs text-emerald-700 hover:underline"
                      >
                        ficha <ExternalLink className="h-3 w-3" aria-hidden />
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2 text-stone-700">{n.municipio}</td>
                  <td className="px-3 py-2 text-stone-700">{n.categoria.nombre}</td>
                  <td className="px-3 py-2">
                    {n.activo ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">Publicado</span>
                    ) : (
                      <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">Sin publicar</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-stone-700">{n._count.productos}</td>
                  <td className="px-3 py-2 text-right text-stone-700">{n._count.fotos}</td>
                </tr>
              ))}
              {negocios.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-stone-500">
                    Sin resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {resumen.porMunicipio.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-stone-800">Negocios por municipio</h2>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {resumen.porMunicipio.map((m) => (
              <li key={m.municipio} className="flex justify-between border-b border-stone-100 py-1">
                <span className="text-stone-700">{m.municipio}</span>
                <span className="font-medium text-stone-900">{m.cantidad}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
