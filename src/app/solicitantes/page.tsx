import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { regimenTributarioLabel } from "@/lib/regimen-tributario";

export default async function SolicitantesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const busqueda = q?.trim();
  const session = await getSession();

  const solicitantes = await db.solicitante.findMany({
    where: busqueda
      ? {
          OR: [
            { identificacion: { contains: busqueda, mode: "insensitive" } },
            { nombre: { contains: busqueda, mode: "insensitive" } },
          ],
        }
      : {},
    orderBy: { nombre: "asc" },
    include: { _count: { select: { expedientes: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Solicitantes</h1>
          <p className="text-sm text-stone-500">
            Registro único por NIT/cédula — se crea automáticamente al radicar un expediente y se reutiliza
            en los siguientes, para no volver a pedir los mismos datos cada vez.
          </p>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2">
          <Link
            href="/solicitantes/nuevo"
            className="rounded-md bg-cdmb-600 px-3 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
          >
            + Nuevo solicitante
          </Link>
          {session?.rol === "ADMIN" && (
            <a
              href={`/api/solicitantes/exportar${busqueda ? `?q=${encodeURIComponent(busqueda)}` : ""}`}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              ⬇ Descargar CSV{busqueda ? " (resultados filtrados)" : ""}
            </a>
          )}
        </div>
      </div>

      <form action="/solicitantes" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-stone-600">Buscar</label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="NIT, cédula o nombre…"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
        >
          Buscar
        </button>
        {busqueda && (
          <Link href="/solicitantes" className="text-sm text-stone-500 hover:text-stone-700">
            Quitar filtro
          </Link>
        )}
      </form>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        {solicitantes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-stone-400">
            {busqueda ? "Ningún solicitante coincide con esa búsqueda." : "Todavía no hay solicitantes registrados."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Identificación</th>
                <th className="px-4 py-2.5 font-medium">Nombre / razón social</th>
                <th className="px-4 py-2.5 font-medium">Régimen tributario</th>
                <th className="px-4 py-2.5 font-medium">Municipio</th>
                <th className="px-4 py-2.5 font-medium">Expedientes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {solicitantes.map((s) => (
                <tr key={s.id} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/solicitantes/${s.id}`} className="font-medium text-cdmb-700 hover:underline">
                      {s.identificacion}
                    </Link>
                    <span className="block text-xs text-stone-400">
                      {s.tipo === "JURIDICA" ? "Persona jurídica" : "Persona natural"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-stone-700">
                    {s.nombre}
                    {s.granContribuyente && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Gran contribuyente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-stone-500">{regimenTributarioLabel(s.regimenTributario)}</td>
                  <td className="px-4 py-2.5 text-stone-500">{s.municipio ?? "—"}</td>
                  <td className="px-4 py-2.5 text-stone-500">{s._count.expedientes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
