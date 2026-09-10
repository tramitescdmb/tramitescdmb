import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, Archive, ImageOff, Image as ImageIcon, Info } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { fondoHistoricoConfigurado, FONDOS, AVISO_IMAGEN, urlIntranetPsdocuments } from "@/lib/fondo-historico";
import { getFondoListado, getFondoPanel, type FiltrosFondo } from "@/lib/fondo-historico-data";
import { Paginador } from "@/components/Paginador";
import { formatearFecha as fecha, formatearFechaHora as fechaHora } from "@/lib/fecha";

const FONDO = FONDOS.psdocuments.id;

export const metadata = { title: "Fondo histórico — psdocuments" };

export default async function FondoHistoricoPage({
  searchParams,
}: {
  searchParams: Promise<FiltrosFondo>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");

  if (!fondoHistoricoConfigurado()) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">
        El Fondo Documental histórico no está configurado en este servidor.
      </div>
    );
  }

  const filtros = await searchParams;
  const [{ filas, total, page, totalPaginas, porPagina }, panel] = await Promise.all([
    getFondoListado(FONDO, filtros),
    getFondoPanel(FONDO),
  ]);

  const hrefPagina = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) {
      if (k !== "page" && typeof v === "string" && v) params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/correspondencia/fondo?${qs}` : "/correspondencia/fondo";
  };

  const hayFiltros = Boolean(filtros.q || filtros.serie || filtros.anio || filtros.imagen);

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <Archive className="h-4 w-4" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold text-stone-900">Fondo psdocuments</h2>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">Solo consulta</span>
        </div>
        <p className="max-w-3xl text-sm text-stone-500">
          Catálogo del sistema de gestión documental anterior de la CDMB (psdocuments, 2006–2023). Espejo de
          solo lectura: no se crea, edita ni elimina nada desde aquí. Los documentos escaneados no se copian a
          este sistema — se consultan en la red corporativa a través de Gestión Documental.
        </p>
      </header>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tarjeta etiqueta="Documentos" valor={total.toLocaleString("es-CO")} />
        <Tarjeta
          etiqueta="Con imagen"
          valor={panel.conImagen.toLocaleString("es-CO")}
          nota={panel.total ? `${Math.round((panel.conImagen / panel.total) * 100)}%` : undefined}
        />
        <Tarjeta
          etiqueta="Rango"
          valor={panel.desde ? `${panel.desde.getFullYear()}–${panel.hasta?.getFullYear() ?? ""}` : "—"}
        />
        <Tarjeta etiqueta="Series" valor={String(panel.series.length)} />
      </div>

      {panel.ultimaSync && (
        <p className="text-xs text-stone-400">
          Última sincronización: {fechaHora(panel.ultimaSync.terminadoEn ?? panel.ultimaSync.iniciadoEn)}
          {panel.ultimaSync.ok ? "" : " (con errores)"} · {panel.ultimaSync.totalOrigen?.toLocaleString("es-CO") ?? "?"} registros de origen
        </p>
      )}

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4">
        <label className="flex-1 min-w-[16rem] text-sm">
          <span className="mb-1 block font-medium text-stone-600">Buscar</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" aria-hidden />
            <input
              type="search"
              name="q"
              defaultValue={filtros.q ?? ""}
              placeholder="Asunto, tercero, número o id de documento"
              className="w-full rounded-md border border-stone-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-cdmb-500 focus:ring-1 focus:ring-cdmb-500"
            />
          </span>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-stone-600">Serie</span>
          <select name="serie" defaultValue={filtros.serie ?? ""} className="rounded-md border border-stone-300 py-2 pl-2 pr-7 text-sm outline-none focus:border-cdmb-500">
            <option value="">Todas</option>
            {panel.series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} ({s.total.toLocaleString("es-CO")})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-stone-600">Año</span>
          <select name="anio" defaultValue={filtros.anio ?? ""} className="rounded-md border border-stone-300 py-2 pl-2 pr-7 text-sm outline-none focus:border-cdmb-500">
            <option value="">Todos</option>
            {panel.anios.map((a) => (
              <option key={a.anio} value={a.anio}>
                {a.anio} ({a.total.toLocaleString("es-CO")})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-stone-600">Imagen</span>
          <select name="imagen" defaultValue={filtros.imagen ?? ""} className="rounded-md border border-stone-300 py-2 pl-2 pr-7 text-sm outline-none focus:border-cdmb-500">
            <option value="">Todos</option>
            <option value="si">Con imagen</option>
            <option value="no">Sin imagen</option>
          </select>
        </label>
        <button type="submit" className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
          Filtrar
        </button>
        {hayFiltros && (
          <Link href="/correspondencia/fondo" className="text-sm text-stone-500 underline hover:text-stone-800">
            Limpiar
          </Link>
        )}
      </form>

      {/* Resultados */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Documento</th>
                <th className="px-4 py-2.5 font-semibold">Serie</th>
                <th className="px-4 py-2.5 font-semibold">Fecha</th>
                <th className="px-4 py-2.5 font-semibold">Asunto</th>
                <th className="px-4 py-2.5 font-semibold">Tercero</th>
                <th className="px-4 py-2.5 font-semibold text-center">Imagen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filas.map((d) => (
                <tr key={d.id} className="hover:bg-stone-50/70">
                  <td className="px-4 py-2.5 align-top">
                    <Link href={`/correspondencia/fondo/${encodeURIComponent(d.refId)}`} className="font-medium text-cdmb-700 hover:underline">
                      {d.numero || d.numeroEntrada || d.numeroSalida || `#${d.refId}`}
                    </Link>
                    <div className="text-xs text-stone-400">id {d.refId}</div>
                  </td>
                  <td className="px-4 py-2.5 align-top text-stone-600">{d.serieNombre ?? "—"}</td>
                  <td className="px-4 py-2.5 align-top whitespace-nowrap text-stone-600">{d.fecha ? fecha(d.fecha) : "—"}</td>
                  <td className="px-4 py-2.5 align-top text-stone-700">
                    <span className="line-clamp-2">{d.asunto ?? "—"}</span>
                  </td>
                  <td className="px-4 py-2.5 align-top text-stone-600">
                    <span className="line-clamp-2">{d.razonSocial || d.destinatario || d.oficina || "—"}</span>
                  </td>
                  <td className="px-4 py-2.5 align-top text-center">
                    {d.tieneImagen ? (
                      (() => {
                        const url = urlIntranetPsdocuments(d.rutaOriginal);
                        const inner = (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <ImageIcon className="h-4 w-4" aria-hidden />
                            {d.numArchivos > 1 ? d.numArchivos : ""}
                          </span>
                        );
                        return url ? (
                          <a href={url} target="_blank" rel="noreferrer" title="Abrir el escaneado (solo desde la red CDMB)" className="hover:opacity-70">
                            {inner}
                          </a>
                        ) : (
                          <span title={`${d.numArchivos} archivo(s) — consulta en la red corporativa`}>{inner}</span>
                        );
                      })()
                    ) : (
                      <ImageOff className="mx-auto h-4 w-4 text-stone-300" aria-hidden />
                    )}
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-500">
                    {hayFiltros ? "Ningún documento coincide con el filtro." : "Todavía no hay documentos sincronizados."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Paginador paginaActual={page} totalPaginas={totalPaginas} total={total} porPagina={porPagina} hrefPagina={hrefPagina} />
      </div>

      <p className="flex items-start gap-2 text-xs text-stone-400">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
        {AVISO_IMAGEN}
      </p>
    </div>
  );
}

function Tarjeta({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-stone-400">{etiqueta}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-xl font-semibold text-stone-900">{valor}</span>
        {nota && <span className="text-xs text-stone-400">{nota}</span>}
      </div>
    </div>
  );
}
