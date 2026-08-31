import Link from "next/link";
import { LibraryBig, FolderOpen, Clock3, CheckCircle2, XCircle, Percent } from "lucide-react";
import { EstadoBadge } from "@/components/EstadoBadge";
import { ProgresoExpediente } from "@/components/ProgresoExpediente";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { getDashboardData } from "@/lib/dashboard-data";
import { getSession } from "@/lib/auth";

function saludo(hora: number) {
  if (hora < 12) return "Buenos días";
  if (hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

export default async function DashboardPage() {
  const [d, session] = await Promise.all([getDashboardData(), getSession()]);
  const primerNombre = session?.nombre.trim().split(/\s+/)[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">
          {saludo(new Date().getHours())}{primerNombre ? `, ${primerNombre}` : ""}
        </h1>
        <p className="text-sm text-stone-500">Este es el resumen de trámites y expedientes de la CDMB.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={LibraryBig} label="Trámites disponibles" value={d.totalTramites} href="/tramites" />
        <StatCard icon={FolderOpen} label="Expedientes totales" value={d.totalExpedientes} href="/expedientes" />
        <StatCard icon={Clock3} label="En curso" value={d.activos} href="/expedientes?estado=EN_TRAMITE" accent="progreso" />
        <StatCard icon={CheckCircle2} label="Aprobados" value={d.aprobados} href="/expedientes?estado=APROBADO" accent="good" />
        <StatCard icon={XCircle} label="Negados / rechazados" value={d.negados} href="/expedientes?estado=NEGADO" accent="critical" />
        <StatCard
          icon={Percent}
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
            Municipio donde se adelanta el trámite (los 13 de la jurisdicción CDMB). Ayuda a ver dónde se concentra la demanda.
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
              <li key={exp.id} className="flex items-center gap-4 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/expedientes/${exp.id}`} className="font-medium text-stone-900 hover:text-cdmb-700">
                    {exp.numero}
                  </Link>
                  <p className="truncate text-sm text-stone-500">
                    {exp.tramiteTipo.nombre} · {exp.solicitanteNombre} · {exp.municipio}
                  </p>
                </div>
                <div className="hidden w-32 flex-none sm:block">
                  <ProgresoExpediente
                    pasoActualNumero={exp.pasoActualNumero}
                    totalPasos={exp.flujo.pasos.length}
                    estado={exp.estado}
                  />
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
  icon: Icon,
  label,
  value,
  href,
  accent,
  help,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: number | string;
  href: string;
  accent?: "good" | "critical" | "progreso";
  help?: string;
}) {
  const ESTILOS_POR_ACENTO = {
    good: { valor: "text-emerald-700", icono: "bg-emerald-50 text-emerald-600" },
    critical: { valor: "text-red-700", icono: "bg-red-50 text-red-600" },
    progreso: { valor: "text-stone-900", icono: "bg-amber-50 text-amber-600" },
  } satisfies Record<string, { valor: string; icono: string }>;
  const estilos = accent ? ESTILOS_POR_ACENTO[accent] : { valor: "text-stone-900", icono: "bg-cdmb-50 text-cdmb-600" };

  return (
    <Link
      href={href}
      title={help}
      className="group flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-cdmb-300 hover:shadow-md"
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${estilos.icono}`}>
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div>
        <p className={`text-2xl font-semibold leading-tight ${estilos.valor}`}>{value}</p>
        <p className="text-sm text-stone-500">{label}</p>
      </div>
    </Link>
  );
}
