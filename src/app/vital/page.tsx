import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, RefreshCw } from "lucide-react";
import { getSession } from "@/lib/auth";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";
import { vitalConfigurado, nombreTramiteVital, NOMBRE_TRAMITE_VITAL, tramitesVital } from "@/lib/vital";
import { getVitalListado, getVitalOpcionesFiltro, type FiltrosVital } from "@/lib/vital-data";
import { SectionHelp } from "@/components/Field";
import { Paginador } from "@/components/Paginador";
import { DescargarCsvLimite } from "@/components/DescargarCsvLimite";

const AYER = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const fecha = (d: Date | null) => (d ? d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—");

export default async function VitalSolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<FiltrosVital & { sincronizado?: string; errores?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  if (session) {
    const permisos = await obtenerPermisosUsuario(session.userId);
    if (!puedeAccederSeccion(permisos, "VITAL_BASE")) redirect("/");
  }
  const esAdmin = session?.rol === "ADMIN";
  const configurado = vitalConfigurado();

  if (!configurado) {
    return (
      <SectionHelp>
        La conexión con VITAL todavía no está configurada en este servidor — faltan variables{" "}
        <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">VITAL_API_URL</code>,{" "}
        <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">VITAL_XROAD_URL</code>,{" "}
        <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">VITAL_XROAD_CLIENT</code> y las credenciales.
      </SectionHelp>
    );
  }

  const [{ filas, total, page, totalPaginas, porPagina }, opciones] = await Promise.all([
    getVitalListado(sp),
    getVitalOpcionesFiltro(),
  ]);

  const hayFiltros = Boolean(sp.q || sp.tramite || sp.anio || sp.actividad);
  const hrefPagina = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (["q", "tramite", "anio", "actividad"].includes(k) && v) params.set(k, String(v));
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/vital?${s}` : "/vital";
  };

  return (
    <div className="space-y-4">
      {sp.sincronizado != null && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Sincronización completa: {sp.sincronizado} solicitud{sp.sincronizado === "1" ? "" : "es"} de VITAL.
          {sp.errores && <p className="mt-1 text-xs text-green-700">Con errores puntuales: {sp.errores}</p>}
        </div>
      )}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      {esAdmin && (
        <details className="rounded-xl border border-stone-200 bg-white p-4" open={total === 0}>
          <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-stone-900 [&::-webkit-details-marker]:hidden">
            <RefreshCw className="h-3.5 w-3.5 text-cdmb-600" aria-hidden />
            Sincronizar desde VITAL
          </summary>
          <form action="/api/admin/vital/sincronizar" method="post" className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Trámite</label>
              <select name="idTramite" defaultValue={sp.tramite ?? tramitesVital()[0] ?? 41} className="rounded-md border border-stone-300 px-2 py-1.5 text-sm">
                {Object.entries(NOMBRE_TRAMITE_VITAL).map(([id, nombre]) => (
                  <option key={id} value={id}>({id}) {nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Desde</label>
              <input name="fechaInicio" type="date" required defaultValue="2018-01-01" className="rounded-md border border-stone-300 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Hasta</label>
              <input name="fechaFin" type="date" required defaultValue={AYER} className="rounded-md border border-stone-300 px-2 py-1.5 text-sm" />
            </div>
            <button type="submit" className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
              Sincronizar
            </button>
          </form>
          <p className="mt-2 text-xs text-stone-400">El cron diario ya mantiene al día los últimos 45 días de todos los trámites; esto es para el histórico.</p>
        </details>
      )}

      {/* Filtros estilo SINCA 1.0 */}
      <form method="get" className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block text-xs font-medium text-stone-600">Buscar</span>
            <span className="flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 focus-within:border-cdmb-500 focus-within:ring-1 focus-within:ring-cdmb-500">
              <Search className="h-4 w-4 flex-none text-stone-400" aria-hidden />
              <input type="text" name="q" defaultValue={sp.q ?? ""} placeholder="ID VITAL, solicitante, identificación o actividad" className="w-full text-sm outline-none" />
            </span>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Trámite</span>
            <select name="tramite" defaultValue={sp.tramite ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todos</option>
              {opciones.tramites.map((t) => (
                <option key={t.id} value={t.id}>({t.id}) {t.nombre} ({t.total})</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Año de radicación</span>
            <select name="anio" defaultValue={sp.anio ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todos</option>
              {opciones.anios.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Actividad</span>
            <select name="actividad" defaultValue={sp.actividad ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todas</option>
              {opciones.actividades.map((a) => (
                <option key={a.nombre} value={a.nombre}>{a.nombre} ({a.total})</option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">Filtrar</button>
            {hayFiltros && (
              <Link href="/vital" className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">Limpiar</Link>
            )}
          </div>
        </div>
      </form>

      <DescargarCsvLimite
        href={(limite) => {
          const params = new URLSearchParams();
          for (const [k, v] of Object.entries(sp)) if (["q", "tramite", "anio", "actividad"].includes(k) && v) params.set(k, String(v));
          params.set("limite", limite);
          return `/api/vital/exportar?${params.toString()}`;
        }}
      />

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">ID VITAL</th>
                <th className="px-4 py-2.5 font-medium">Trámite</th>
                <th className="px-4 py-2.5 font-medium">Solicitante</th>
                <th className="px-4 py-2.5 font-medium">Identificación</th>
                <th className="px-4 py-2.5 font-medium">Radicación</th>
                <th className="px-4 py-2.5 font-medium">Actividad</th>
                <th className="px-4 py-2.5 font-medium">Docs.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-stone-400">
                    {hayFiltros ? "No hay solicitudes que coincidan." : "Todavía no se ha traído ninguna solicitud de VITAL."}
                  </td>
                </tr>
              ) : (
                filas.map((s) => (
                  <tr key={s.id} className="hover:bg-stone-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/vital/${s.id}`} className="font-medium text-cdmb-700 hover:underline">{s.idVital}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-stone-600">{nombreTramiteVital(s.idTramiteVital)}</td>
                    <td className="px-4 py-2.5 text-stone-700">{s.solicitanteNombre ?? "—"}</td>
                    <td className="px-4 py-2.5 text-stone-500">{s.solicitanteIdentificacion ?? "—"}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-stone-500">{fecha(s.fechaRadicacion)}</td>
                    <td className="px-4 py-2.5 text-stone-600">{s.nombreActividad ?? "—"}</td>
                    <td className="px-4 py-2.5 text-center text-stone-500">{s._count.documentos || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Paginador paginaActual={page} totalPaginas={totalPaginas} total={total} porPagina={porPagina} hrefPagina={hrefPagina} />
      </div>
    </div>
  );
}
