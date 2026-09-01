import Link from "next/link";
import { Link2, RefreshCw, Search } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { vitalConfigurado, tramitesVital, nombreTramiteVital, NOMBRE_TRAMITE_VITAL } from "@/lib/vital";
import { SectionHelp } from "@/components/Field";
import { Paginador } from "@/components/Paginador";

const AYER = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const POR_PAGINA = 30;
const fecha = (d: Date | null) => (d ? d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—");

export default async function VitalPage({
  searchParams,
}: {
  searchParams: Promise<{ sincronizado?: string; errores?: string; error?: string; tramite?: string; q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const { sincronizado, errores, error } = sp;
  const session = await getSession();
  const configurado = vitalConfigurado();
  const esAdmin = session?.rol === "ADMIN";
  const tramiteDefault = tramitesVital()[0] ?? 41;

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const tramiteFiltro = sp.tramite && /^\d+$/.test(sp.tramite) ? parseInt(sp.tramite, 10) : null;
  const q = sp.q?.trim();

  const where = {
    ...(tramiteFiltro ? { idTramiteVital: tramiteFiltro } : {}),
    ...(q
      ? {
          OR: [
            { idVital: { contains: q } },
            { solicitanteNombre: { contains: q, mode: "insensitive" as const } },
            { solicitanteIdentificacion: { contains: q } },
            { nombreActividad: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, solicitudes, porTramite] = await Promise.all([
    db.solicitudVital.count({ where }),
    db.solicitudVital.findMany({
      where,
      orderBy: [{ fechaRadicacion: { sort: "desc", nulls: "last" } }, { ultimaSincronizacion: "desc" }],
      include: { _count: { select: { documentos: true } } },
      skip: (page - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    db.solicitudVital.groupBy({ by: ["idTramiteVital"], _count: { _all: true }, orderBy: { _count: { idTramiteVital: "desc" } } }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const totalGlobal = porTramite.reduce((s, t) => s + t._count._all, 0);

  const hrefPagina = (p: number) => {
    const params = new URLSearchParams();
    if (tramiteFiltro) params.set("tramite", String(tramiteFiltro));
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/vital?${s}` : "/vital";
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-stone-900">
          <Link2 className="h-5 w-5 text-cdmb-600" aria-hidden />
          VITAL
        </h1>
        <p className="text-sm text-stone-500">
          Solicitudes radicadas por el ciudadano en la Ventanilla Integral de Trámites Ambientales en Línea
          (VITAL) de MinAmbiente, traídas por el bus de interoperabilidad X-Road de la CDMB. Es de{" "}
          <strong>solo lectura</strong>: no se reporta nada de vuelta a VITAL.
        </p>
      </div>

      {!configurado && (
        <SectionHelp>
          La conexión con VITAL todavía no está configurada en este servidor — faltan variables{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">VITAL_API_URL</code>,{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">VITAL_XROAD_URL</code>,{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">VITAL_XROAD_CLIENT</code> y las credenciales.
        </SectionHelp>
      )}

      {sincronizado != null && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Sincronización completa: {sincronizado} solicitud{sincronizado === "1" ? "" : "es"} de VITAL.
          {errores && <p className="mt-1 text-xs text-green-700">Con errores puntuales: {errores}</p>}
        </div>
      )}
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Resumen por tipo de trámite */}
      {totalGlobal > 0 && (
        <div className="flex flex-wrap gap-2">
          <FiltroChip href="/vital" activo={!tramiteFiltro} label="Todos" total={totalGlobal} />
          {porTramite.map((t) => (
            <FiltroChip
              key={t.idTramiteVital}
              href={`/vital?tramite=${t.idTramiteVital}`}
              activo={tramiteFiltro === t.idTramiteVital}
              label={NOMBRE_TRAMITE_VITAL[t.idTramiteVital] ?? `Trámite ${t.idTramiteVital}`}
              total={t._count._all}
            />
          ))}
        </div>
      )}

      {esAdmin && (
        <details className="rounded-xl border border-stone-200 bg-white p-4" open={!totalGlobal}>
          <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-stone-900 [&::-webkit-details-marker]:hidden">
            <RefreshCw className="h-3.5 w-3.5 text-cdmb-600" aria-hidden />
            Sincronizar desde VITAL
          </summary>
          <form action="/api/admin/vital/sincronizar" method="post" className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Trámite</label>
              <select name="idTramite" defaultValue={tramiteFiltro ?? tramiteDefault} disabled={!configurado} className="rounded-md border border-stone-300 px-2 py-1.5 text-sm disabled:bg-stone-50">
                {Object.entries(NOMBRE_TRAMITE_VITAL).map(([id, nombre]) => (
                  <option key={id} value={id}>({id}) {nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Desde</label>
              <input name="fechaInicio" type="date" required defaultValue="2018-01-01" disabled={!configurado} className="rounded-md border border-stone-300 px-2 py-1.5 text-sm disabled:bg-stone-50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Hasta</label>
              <input name="fechaFin" type="date" required defaultValue={AYER} disabled={!configurado} className="rounded-md border border-stone-300 px-2 py-1.5 text-sm disabled:bg-stone-50" />
            </div>
            <button type="submit" disabled={!configurado} className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700 disabled:cursor-not-allowed disabled:opacity-50">
              Sincronizar
            </button>
          </form>
          <p className="mt-2 text-xs text-stone-400">
            Trae (o actualiza) las solicitudes de ese trámite en ese rango. El cron diario ya mantiene al día
            los últimos 45 días de todos los trámites; use esto para el histórico.
          </p>
        </details>
      )}

      {/* Buscador */}
      <form method="get" className="flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 focus-within:border-cdmb-500 focus-within:ring-1 focus-within:ring-cdmb-500">
        {tramiteFiltro && <input type="hidden" name="tramite" value={tramiteFiltro} />}
        <Search className="h-4 w-4 flex-none text-stone-400" aria-hidden />
        <input type="text" name="q" defaultValue={q ?? ""} placeholder="ID VITAL, solicitante, identificación o actividad" className="w-full text-sm outline-none" />
        {q && (
          <Link href={tramiteFiltro ? `/vital?tramite=${tramiteFiltro}` : "/vital"} className="text-xs text-stone-400 hover:text-stone-600">
            limpiar
          </Link>
        )}
      </form>

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
              {solicitudes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-stone-400">
                    {totalGlobal === 0 ? "Todavía no se ha traído ninguna solicitud de VITAL." : "No hay solicitudes que coincidan."}
                  </td>
                </tr>
              ) : (
                solicitudes.map((s) => (
                  <tr key={s.id} className="hover:bg-stone-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/vital/${s.id}`} className="font-medium text-cdmb-700 hover:underline">
                        {s.idVital}
                      </Link>
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
        <Paginador paginaActual={page} totalPaginas={totalPaginas} total={total} porPagina={POR_PAGINA} hrefPagina={hrefPagina} />
      </div>
    </div>
  );
}

function FiltroChip({ href, activo, label, total }: { href: string; activo: boolean; label: string; total: number }) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        activo ? "border-cdmb-600 bg-cdmb-50 text-cdmb-800" : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
      }`}
    >
      {label} <span className={activo ? "text-cdmb-600" : "text-stone-400"}>{total}</span>
    </Link>
  );
}
