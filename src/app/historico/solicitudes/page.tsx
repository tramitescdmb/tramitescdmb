import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { getHistoricoListado, getHistoricoOpcionesFiltro, type FiltrosHistorico } from "@/lib/sinca-data";
import { sincaConfigurado } from "@/lib/sinca";
import { Paginador } from "@/components/Paginador";
import { DescargarCsvBoton } from "@/components/DescargarCsvBoton";
import { SelectorVista } from "@/components/SelectorVista";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";

function fecha(d: Date | null) {
  return d ? d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export default async function HistoricoSolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<FiltrosHistorico>;
}) {
  const session = await getSession();
  if (session) {
    const permisos = await obtenerPermisosUsuario(session.userId);
    if (!puedeAccederSeccion(permisos, "SINCA_BASE")) redirect("/");
  }
  if (!sincaConfigurado()) {
    return <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">SINCA 1.0 no está configurado en este servidor.</p>;
  }

  const filtros = await searchParams;
  const [{ filas, total, page, totalPaginas, porPagina, vista }, opciones] = await Promise.all([
    getHistoricoListado(filtros),
    getHistoricoOpcionesFiltro(),
  ]);

  const hrefPagina = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) {
      if (k !== "page" && typeof v === "string" && v) params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/historico/solicitudes?${qs}` : "/historico/solicitudes";
  };
  const hrefVista = (v: string) => {
    const params = new URLSearchParams();
    for (const [k, val] of Object.entries(filtros)) {
      if (k !== "page" && k !== "vista" && typeof val === "string" && val) params.set(k, val);
    }
    params.set("vista", v);
    return `/historico/solicitudes?${params.toString()}`;
  };
  const hrefDescarga = () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) {
      if (k !== "page" && k !== "vista" && typeof v === "string" && v) params.set(k, v);
    }
    params.set("limite", vista);
    return `/api/historico/exportar?${params.toString()}`;
  };

  const hayFiltros = Boolean(filtros.q || filtros.anio || filtros.tipo || filtros.municipio || filtros.estado);

  // Frase legible de lo que dio el filtro — antes solo se veía el "Mostrando
  // X–Y de Z" del paginador, y ese se ocultaba por completo si el resultado
  // cabía en una sola página, dejando sin ninguna pista de cuántos había en
  // total para decidir si convenía cambiar la Vista a 100/150/200/Todos.
  const clausulasFiltro: string[] = [];
  if (filtros.tipo) {
    const tipo = opciones.tipos.find((t) => t.codigo === filtros.tipo);
    clausulasFiltro.push(`de ${tipo?.nombre ?? filtros.tipo}`);
  }
  if (filtros.anio) clausulasFiltro.push(`del año ${filtros.anio}`);
  if (filtros.municipio) clausulasFiltro.push(`en ${filtros.municipio}`);
  if (filtros.estado) clausulasFiltro.push(`en estado "${filtros.estado}"`);
  if (filtros.q) clausulasFiltro.push(`que coinciden con "${filtros.q}"`);
  const resumenFiltro = `${total} resultado${total === 1 ? "" : "s"}${
    clausulasFiltro.length > 0 ? ` ${clausulasFiltro.join(" ")}` : " en total"
  }.`;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DescargarCsvBoton href={hrefDescarga()} cantidad={vista} />
      </div>

      <form method="get" className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block text-xs font-medium text-stone-600">Buscar</span>
            <span className="flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 focus-within:border-cdmb-500 focus-within:ring-1 focus-within:ring-cdmb-500">
              <Search className="h-4 w-4 flex-none text-stone-400" aria-hidden />
              <input
                type="text"
                name="q"
                defaultValue={filtros.q ?? ""}
                placeholder="Número de solicitud, expediente, número de resolución, proyecto o representante"
                className="w-full text-sm outline-none"
              />
            </span>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Año de la resolución</span>
            <select name="anio" defaultValue={filtros.anio ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todos</option>
              {opciones.anios.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Tipo de trámite</span>
            <select name="tipo" defaultValue={filtros.tipo ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todos</option>
              {opciones.tipos.map((t) => (
                <option key={t.codigo} value={t.codigo}>{t.nombre} ({t.total})</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Municipio</span>
            <select name="municipio" defaultValue={filtros.municipio ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todos</option>
              {opciones.municipios.map((m) => (
                <option key={m.nombre} value={m.nombre}>{m.nombre} ({m.total})</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Estado</span>
            <select name="estado" defaultValue={filtros.estado ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todos</option>
              {opciones.estados.map((e) => (
                <option key={e.nombre} value={e.nombre}>{e.nombre} ({e.total})</option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
              Filtrar
            </button>
            {hayFiltros && (
              <Link href="/historico/solicitudes" className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">
                Limpiar
              </Link>
            )}
          </div>
        </div>
      </form>

      <p className="px-1 text-sm text-stone-600">{resumenFiltro}</p>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">Solicitud</th>
                <th className="px-4 py-2.5 font-medium">Resolución</th>
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Municipio</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-stone-400">
                    No hay resoluciones que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                filas.map((r, i) => (
                  <tr key={r.nroSolicitud} className="hover:bg-stone-50">
                    <td className="px-4 py-2.5 text-stone-400">{(page - 1) * porPagina + i + 1}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/historico/solicitudes/${r.nroSolicitud}`} className="font-medium text-cdmb-700 hover:underline">
                        {r.nroSolicitud}
                      </Link>
                      {r.expediente && <span className="block text-xs text-stone-400">Exp. {r.expediente}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-stone-700">{r.numeroResolucion ?? "—"}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-stone-600">{fecha(r.fechaResolucion)}</td>
                    <td className="px-4 py-2.5 text-stone-600">
                      {r.tipoSolicitudNombre ?? "—"}
                      {r.tipoSolicitudCodigo && <span className="ml-1 text-xs text-stone-400">({r.tipoSolicitudCodigo})</span>}
                    </td>
                    <td className="px-4 py-2.5 text-stone-600">{r.municipio ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{r.estado ?? "—"}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <SelectorVista vistaActual={vista} hrefVista={hrefVista} />
        <Paginador paginaActual={page} totalPaginas={totalPaginas} total={total} porPagina={porPagina} hrefPagina={hrefPagina} />
      </div>
    </div>
  );
}
