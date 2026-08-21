import Link from "next/link";
import { db } from "@/lib/db";
import { EstadoBadge } from "@/components/EstadoBadge";

export default async function DashboardPage() {
  const [totalTramites, totalExpedientes, porEstado, recientes] = await Promise.all([
    db.tramiteTipo.count({ where: { activo: true } }),
    db.expediente.count(),
    db.expediente.groupBy({ by: ["estado"], _count: { _all: true } }),
    db.expediente.findMany({
      take: 8,
      orderBy: { fechaUltimoMovimiento: "desc" },
      include: { tramiteTipo: true },
    }),
  ]);

  const conteoPorEstado = Object.fromEntries(porEstado.map((p) => [p.estado, p._count._all]));
  const activos =
    (conteoPorEstado.RADICADO ?? 0) +
    (conteoPorEstado.EN_TRAMITE ?? 0) +
    (conteoPorEstado.INFORMACION_ADICIONAL_REQUERIDA ?? 0) +
    (conteoPorEstado.SUSPENDIDO ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Panel general</h1>
        <p className="text-sm text-gray-500">Resumen de trámites y expedientes de la CDMB</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Trámites disponibles" value={totalTramites} href="/tramites" />
        <StatCard label="Expedientes totales" value={totalExpedientes} href="/expedientes" />
        <StatCard label="En curso" value={activos} href="/expedientes?estado=EN_TRAMITE" />
        <StatCard label="Aprobados" value={conteoPorEstado.APROBADO ?? 0} href="/expedientes?estado=APROBADO" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Actividad reciente</h2>
          <Link href="/expedientes" className="text-sm text-cdmb-700 hover:underline">
            Ver todos
          </Link>
        </div>
        {recientes.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            Todavía no hay expedientes radicados.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recientes.map((exp) => (
              <li key={exp.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <Link href={`/expedientes/${exp.id}`} className="font-medium text-gray-900 hover:text-cdmb-700">
                    {exp.numero}
                  </Link>
                  <p className="text-sm text-gray-500">
                    {exp.tramiteTipo.nombre} · {exp.solicitanteNombre}
                  </p>
                </div>
                <EstadoBadge estado={exp.estado} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-cdmb-300 hover:shadow-sm"
    >
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </Link>
  );
}
