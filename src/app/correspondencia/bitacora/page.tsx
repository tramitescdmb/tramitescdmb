import Link from "next/link";
import { redirect } from "next/navigation";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { listarBitacoraFiltrada, ACCIONES_BITACORA, ETIQUETA_ACCION_BITACORA, type FiltrosBitacora } from "@/lib/correspondencia-bitacora";
import { SectionHelp } from "@/components/Field";
import type { AccionAuditoriaDoc } from "@prisma/client";

const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

export default async function BitacoraPage({
  searchParams,
}: {
  searchParams: Promise<{ accion?: string; entidad?: string; desde?: string; hasta?: string; pagina?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) redirect("/correspondencia");

  const sp = await searchParams;
  const filtros: FiltrosBitacora = {
    accion: ACCIONES_BITACORA.includes(sp.accion as AccionAuditoriaDoc) ? (sp.accion as AccionAuditoriaDoc) : undefined,
    entidad: sp.entidad || undefined,
    desde: sp.desde || undefined,
    hasta: sp.hasta || undefined,
  };
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const bitacora = await listarBitacoraFiltrada(filtros, pagina);

  const paramsSinPagina = new URLSearchParams();
  if (filtros.accion) paramsSinPagina.set("accion", filtros.accion);
  if (filtros.entidad) paramsSinPagina.set("entidad", filtros.entidad);
  if (filtros.desde) paramsSinPagina.set("desde", filtros.desde);
  if (filtros.hasta) paramsSinPagina.set("hasta", filtros.hasta);

  const fecha = (d: Date) => d.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-stone-900">Bitácora de auditoría (inalterable)</h2>
        <SectionHelp>
          Todo lo que ha pasado en este módulo, filtrable por tipo de acción, de registro y por fecha. Cada fila va
          encadenada por hash SHA-256 — alterar o borrar una rompe la cadena y queda en evidencia. Vive en su propia
          pestaña porque crece de forma indefinida y no debe demorar la carga del panel de Reportes.
        </SectionHelp>
        <form method="get" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <select name="accion" defaultValue={filtros.accion ?? ""} className={inputCls}>
            <option value="">Cualquier acción</option>
            {ACCIONES_BITACORA.map((a) => (<option key={a} value={a}>{ETIQUETA_ACCION_BITACORA[a] ?? a}</option>))}
          </select>
          <select name="entidad" defaultValue={filtros.entidad ?? ""} className={inputCls}>
            <option value="">Cualquier registro</option>
            {bitacora.entidadesDisponibles.map((e) => (<option key={e} value={e}>{e}</option>))}
          </select>
          <input type="date" name="desde" defaultValue={filtros.desde ?? ""} className={inputCls} />
          <input type="date" name="hasta" defaultValue={filtros.hasta ?? ""} className={inputCls} />
          <button type="submit" className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
            Filtrar
          </button>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Acción</th>
                <th className="py-2 pr-3 font-medium">Registro</th>
                <th className="py-2 pr-3 font-medium">Detalle</th>
                <th className="py-2 pr-3 font-medium">Usuario</th>
                <th className="py-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {bitacora.filas.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-stone-400">Ningún registro coincide con estos filtros.</td></tr>
              ) : (
                bitacora.filas.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2 pr-3 font-medium text-stone-700">{ETIQUETA_ACCION_BITACORA[b.accion] ?? b.accion}</td>
                    <td className="py-2 pr-3 text-xs text-stone-500">{b.entidad}</td>
                    <td className="max-w-md truncate py-2 pr-3 text-stone-600" title={b.detalle ?? ""}>{b.detalle}</td>
                    <td className="py-2 pr-3 text-stone-600">{b.usuario?.nombre ?? "—"}</td>
                    <td className="py-2 text-xs text-stone-400">{fecha(b.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {bitacora.totalPaginas > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-xs text-stone-400">Página {pagina} de {bitacora.totalPaginas} · {bitacora.total} registros</span>
            <div className="flex gap-2">
              {pagina > 1 && (
                <Link href={`?${paramsSinPagina.toString()}&pagina=${pagina - 1}`} className="rounded-md border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-50">
                  Anterior
                </Link>
              )}
              {pagina < bitacora.totalPaginas && (
                <Link href={`?${paramsSinPagina.toString()}&pagina=${pagina + 1}`} className="rounded-md border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-50">
                  Siguiente
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
