import Link from "next/link";
import { db } from "@/lib/db";
import { EstadoBadge } from "@/components/EstadoBadge";
import { MUNICIPIOS_JURISDICCION_CDMB } from "@/lib/municipios";

const ESTADOS = [
  "RADICADO",
  "EN_TRAMITE",
  "INFORMACION_ADICIONAL_REQUERIDA",
  "SUSPENDIDO",
  "APROBADO",
  "NEGADO",
  "DESISTIDO",
  "ARCHIVADO",
  "RECHAZADO",
] as const;

export default async function ExpedientesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string; tramite?: string; municipio?: string }>;
}) {
  const { estado, q, tramite, municipio } = await searchParams;

  const tramites = await db.tramiteTipo.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, codigo: true },
  });

  const busqueda = q?.trim();

  const expedientes = await db.expediente.findMany({
    where: {
      ...(estado ? { estado: estado as (typeof ESTADOS)[number] } : {}),
      ...(tramite ? { tramiteTipoId: tramite } : {}),
      ...(municipio ? { municipio } : {}),
      ...(busqueda
        ? {
            OR: [
              { numero: { contains: busqueda, mode: "insensitive" } },
              { solicitanteNombre: { contains: busqueda, mode: "insensitive" } },
              { solicitanteIdentificacion: { contains: busqueda, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { fechaUltimoMovimiento: "desc" },
    include: { tramiteTipo: true, flujo: true },
  });

  const hayFiltrosExtra = Boolean(busqueda || tramite || municipio);
  // El GET conserva estado/q/tramite/municipio a la vez — helper para armar los links de los pills de estado sin perder los otros filtros.
  const conFiltro = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const actuales = { estado, q, tramite, municipio, ...extra };
    for (const [k, v] of Object.entries(actuales)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/expedientes?${qs}` : "/expedientes";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Expedientes</h1>
        <p className="text-sm text-stone-500">
          Todos los casos radicados, de cualquier trámite. Filtra por estado, o busca por número,
          solicitante, trámite o municipio para encontrar más rápido lo que buscas.
        </p>
      </div>

      <form action="/expedientes" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4">
        {estado && <input type="hidden" name="estado" value={estado} />}
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-stone-600">Buscar</label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Número, solicitante o identificación…"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
        </div>
        <div className="min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-stone-600">Trámite</label>
          <select
            name="tramite"
            defaultValue={tramite ?? ""}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          >
            <option value="">Todos los trámites</option>
            {tramites.map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo} — {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-stone-600">Municipio</label>
          <select
            name="municipio"
            defaultValue={municipio ?? ""}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          >
            <option value="">Todos</option>
            {MUNICIPIOS_JURISDICCION_CDMB.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
        >
          Buscar
        </button>
        {hayFiltrosExtra && (
          <Link href={conFiltro({ q: undefined, tramite: undefined, municipio: undefined })} className="text-sm text-stone-500 hover:text-stone-700">
            Quitar filtros de búsqueda
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        <Link
          href={conFiltro({ estado: undefined })}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !estado ? "bg-cdmb-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          Todos
        </Link>
        {ESTADOS.map((e) => (
          <Link
            key={e}
            href={conFiltro({ estado: e })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              estado === e ? "bg-cdmb-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {e.replaceAll("_", " ")}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        {expedientes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-stone-400">No hay expedientes con este filtro.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Número</th>
                <th className="px-4 py-2.5 font-medium">Trámite</th>
                <th className="px-4 py-2.5 font-medium">Solicitante</th>
                <th className="px-4 py-2.5 font-medium">Municipio</th>
                <th className="px-4 py-2.5 font-medium">Paso actual</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Último movimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {expedientes.map((exp) => (
                <tr key={exp.id} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/expedientes/${exp.id}`} className="font-medium text-cdmb-700 hover:underline">
                      {exp.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-stone-700">{exp.tramiteTipo.nombre}</td>
                  <td className="px-4 py-2.5 text-stone-700">
                    {exp.solicitanteNombre}
                    <span className="block text-xs text-stone-400">{exp.solicitanteIdentificacion}</span>
                  </td>
                  <td className="px-4 py-2.5 text-stone-500">{exp.municipio}</td>
                  <td className="px-4 py-2.5 text-stone-500">Paso {exp.pasoActualNumero}</td>
                  <td className="px-4 py-2.5">
                    <EstadoBadge estado={exp.estado} />
                  </td>
                  <td className="px-4 py-2.5 text-stone-500">
                    {exp.fechaUltimoMovimiento.toLocaleDateString("es-CO")}
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
