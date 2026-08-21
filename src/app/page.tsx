import Link from "next/link";
import { EstadoBadge } from "@/components/EstadoBadge";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function DashboardPage() {
  const d = await getDashboardData();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Panel general</h1>
        <p className="text-sm text-stone-500">Resumen de trámites y expedientes de la CDMB</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Trámites disponibles" value={d.totalTramites} href="/tramites" />
        <StatCard label="Expedientes totales" value={d.totalExpedientes} href="/expedientes" />
        <StatCard label="En curso" value={d.activos} href="/expedientes?estado=EN_TRAMITE" />
        <StatCard label="Aprobados" value={d.aprobados} href="/expedientes?estado=APROBADO" accent="good" />
        <StatCard label="Negados / rechazados" value={d.negados} href="/expedientes?estado=NEGADO" accent="critical" />
        <StatCard
          label="Tasa de aprobación"
          value={d.tasaAprobacion === null ? "—" : `${d.tasaAprobacion}%`}
          href="/expedientes"
          help={d.tasaAprobacion === null ? "Aún no hay expedientes decididos (aprobados o negados)." : "De los expedientes ya decididos (aprobados + negados/rechazados)."}
        />
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-stone-900">Solicitudes radicadas por mes</h2>
        <p className="mb-4 text-xs text-stone-500">Últimos 12 meses, por fecha de radicación del expediente.</p>
        <AreaTrendChart data={d.serieMensual} emptyMessage="Todavía no hay expedientes radicados para mostrar una tendencia." />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-900">Municipios con más solicitudes</h2>
          <p className="mb-4 text-xs text-stone-500">
            Municipio del predio o proyecto (los 13 de la jurisdicción CDMB). Ayuda a ver dónde se concentra la demanda.
          </p>
          <BarChartHorizontal data={d.topMunicipios} emptyMessage="Todavía no hay expedientes con municipio registrado." />
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-900">Trámites más solicitados</h2>
          <p className="mb-4 text-xs text-stone-500">Cuáles de los 30 trámites concentran más expedientes.</p>
          <BarChartHorizontal data={d.topTramites} emptyMessage="Todavía no hay expedientes radicados." />
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-stone-900">Actividad reciente</h2>
          <Link href="/expedientes" className="text-sm text-cdmb-700 hover:underline">
            Ver todos
          </Link>
        </div>
        {d.recientes.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-stone-400">
            Todavía no hay expedientes radicados.
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {d.recientes.map((exp) => (
              <li key={exp.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <Link href={`/expedientes/${exp.id}`} className="font-medium text-stone-900 hover:text-cdmb-700">
                    {exp.numero}
                  </Link>
                  <p className="text-sm text-stone-500">
                    {exp.tramiteTipo.nombre} · {exp.solicitanteNombre} · {exp.municipio}
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

function StatCard({
  label,
  value,
  href,
  accent,
  help,
}: {
  label: string;
  value: number | string;
  href: string;
  accent?: "good" | "critical";
  help?: string;
}) {
  const valueColor = accent === "good" ? "text-green-700" : accent === "critical" ? "text-red-700" : "text-stone-900";
  return (
    <Link
      href={href}
      title={help}
      className="rounded-xl border border-stone-200 bg-white p-4 transition hover:border-cdmb-300 hover:shadow-sm"
    >
      <p className={`text-2xl font-semibold ${valueColor}`}>{value}</p>
      <p className="text-sm text-stone-500">{label}</p>
    </Link>
  );
}
