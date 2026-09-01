import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { vitalConfigurado, tramitesVital } from "@/lib/vital";
import { SectionHelp } from "@/components/Field";

// VITAL rechaza fecha_fin >= hoy, así que el tope por defecto es ayer.
const AYER = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

export default async function VitalPage({
  searchParams,
}: {
  searchParams: Promise<{ sincronizado?: string; errores?: string; error?: string }>;
}) {
  const { sincronizado, errores, error } = await searchParams;
  const session = await getSession();
  const configurado = vitalConfigurado();
  const tramiteDefault = tramitesVital()[0] ?? 41;

  const solicitudes = await db.solicitudVital.findMany({
    orderBy: { ultimaSincronizacion: "desc" },
    include: { _count: { select: { documentos: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">VITAL</h1>
        <p className="text-sm text-stone-500">
          Solicitudes radicadas por el ciudadano en la Ventanilla Integral de Trámites Ambientales en Línea
          (VITAL) de MinAmbiente, traídas aquí para consulta a través del bus de interoperabilidad X-Road de
          la CDMB. Es de <strong>solo lectura</strong>: no se reporta nada de vuelta a VITAL. Se actualiza a
          diario.
        </p>
      </div>

      {!configurado && (
        <SectionHelp>
          La conexión con VITAL todavía no está configurada en este servidor — faltan variables de entorno{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">VITAL_API_URL</code>,{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">VITAL_XROAD_URL</code>,{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">VITAL_XROAD_CLIENT</code> y las
          credenciales (<code className="rounded bg-stone-100 px-1 py-0.5 text-xs">VITAL_CLIENT_ID/SECRET</code>,{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">VITAL_USERNAME/PASSWORD</code>).
        </SectionHelp>
      )}

      {sincronizado != null && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Sincronización completa: {sincronizado} solicitud{sincronizado === "1" ? "" : "es"} traída
          {sincronizado === "1" ? "" : "s"} de VITAL.
          {errores && <p className="mt-1 text-xs text-green-700">Con errores puntuales: {errores}</p>}
        </div>
      )}
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {session?.rol === "ADMIN" && (
        <details className="rounded-xl border border-stone-200 bg-white p-4" open={!solicitudes.length}>
          <summary className="cursor-pointer text-sm font-semibold text-stone-900 [&::-webkit-details-marker]:hidden">
            Sincronizar desde VITAL
          </summary>
          <form
            action="/api/admin/vital/sincronizar"
            method="post"
            className="mt-3 flex flex-wrap items-end gap-3"
          >
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">id_tramite en VITAL</label>
              <input
                name="idTramite"
                type="number"
                required
                defaultValue={tramiteDefault}
                disabled={!configurado}
                className="w-32 rounded-md border border-stone-300 px-2 py-1.5 text-sm disabled:bg-stone-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Desde</label>
              <input
                name="fechaInicio"
                type="date"
                required
                defaultValue="2018-01-01"
                disabled={!configurado}
                className="rounded-md border border-stone-300 px-2 py-1.5 text-sm disabled:bg-stone-50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Hasta</label>
              <input
                name="fechaFin"
                type="date"
                required
                defaultValue={AYER}
                disabled={!configurado}
                className="rounded-md border border-stone-300 px-2 py-1.5 text-sm disabled:bg-stone-50"
              />
            </div>
            <button
              type="submit"
              disabled={!configurado}
              className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sincronizar
            </button>
          </form>
          <p className="mt-2 text-xs text-stone-400">
            Trae (o actualiza) las solicitudes de ese trámite en ese rango de fechas. Puede tardar si hay
            muchas — trae hasta 50 por página y sigue paginando solo hasta terminar.
          </p>
        </details>
      )}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        {solicitudes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-stone-400">
            Todavía no se ha traído ninguna solicitud de VITAL.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">ID VITAL</th>
                <th className="px-4 py-2.5 font-medium">id_tramite</th>
                <th className="px-4 py-2.5 font-medium">Solicitante</th>
                <th className="px-4 py-2.5 font-medium">Identificación</th>
                <th className="px-4 py-2.5 font-medium">Actividad actual</th>
                <th className="px-4 py-2.5 font-medium">Radicación</th>
                <th className="px-4 py-2.5 font-medium">Documentos</th>
                <th className="px-4 py-2.5 font-medium">Última sincronización</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {solicitudes.map((s) => (
                <tr key={s.id} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/vital/${s.id}`} className="font-medium text-cdmb-700 hover:underline">
                      {s.idVital}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-stone-500">{s.idTramiteVital}</td>
                  <td className="px-4 py-2.5 text-stone-700">{s.solicitanteNombre ?? "—"}</td>
                  <td className="px-4 py-2.5 text-stone-500">{s.solicitanteIdentificacion ?? "—"}</td>
                  <td className="px-4 py-2.5 text-stone-700">{s.nombreActividad ?? "—"}</td>
                  <td className="px-4 py-2.5 text-stone-500">
                    {s.fechaRadicacion ? s.fechaRadicacion.toLocaleDateString("es-CO") : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-stone-500">{s._count.documentos}</td>
                  <td className="px-4 py-2.5 text-stone-500">
                    {s.ultimaSincronizacion.toLocaleString("es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
