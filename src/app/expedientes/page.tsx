import Link from "next/link";
import { db } from "@/lib/db";
import { EstadoBadge } from "@/components/EstadoBadge";

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
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;

  const expedientes = await db.expediente.findMany({
    where: estado ? { estado: estado as (typeof ESTADOS)[number] } : undefined,
    orderBy: { fechaUltimoMovimiento: "desc" },
    include: { tramiteTipo: true, flujo: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Expedientes</h1>
        <p className="text-sm text-gray-500">
          Todos los casos radicados, de cualquier trámite. Filtra por estado para encontrar más rápido lo
          que buscas.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/expedientes"
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !estado ? "bg-cdmb-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Todos
        </Link>
        {ESTADOS.map((e) => (
          <Link
            key={e}
            href={`/expedientes?estado=${e}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              estado === e ? "bg-cdmb-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {e.replaceAll("_", " ")}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {expedientes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">No hay expedientes con este filtro.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Número</th>
                <th className="px-4 py-2.5 font-medium">Trámite</th>
                <th className="px-4 py-2.5 font-medium">Solicitante</th>
                <th className="px-4 py-2.5 font-medium">Paso actual</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Último movimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expedientes.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/expedientes/${exp.id}`} className="font-medium text-cdmb-700 hover:underline">
                      {exp.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{exp.tramiteTipo.nombre}</td>
                  <td className="px-4 py-2.5 text-gray-700">{exp.solicitanteNombre}</td>
                  <td className="px-4 py-2.5 text-gray-500">Paso {exp.pasoActualNumero}</td>
                  <td className="px-4 py-2.5">
                    <EstadoBadge estado={exp.estado} />
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">
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
