import { redirect } from "next/navigation";
import { FileText, FolderOpen, FolderCheck, ShieldAlert } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { obtenerReportesCorrespondencia } from "@/lib/correspondencia-reportes";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { SectionHelp } from "@/components/Field";
import { registrarAccesoDenegadoSeccion } from "@/lib/auditoria-doc";
import { headers } from "next/headers";

function Stat({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2 text-stone-400">
        <Icon className="h-4 w-4" aria-hidden />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{value.toLocaleString("es-CO")}</p>
    </div>
  );
}

export default async function ReportesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    await registrarAccesoDenegadoSeccion("Reportes", session, await headers());
    redirect("/correspondencia");
  }

  const reportes = await obtenerReportesCorrespondencia();

  return (
    <div className="space-y-6">
      <SectionHelp>
        La bitácora de auditoría detallada, con sus propios filtros, está en la pestaña <strong>Bitácora</strong>.
      </SectionHelp>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={FileText} label="Total radicados" value={reportes.totalComunicaciones} />
        <Stat icon={FolderOpen} label="Expedientes abiertos" value={reportes.expedientesAbiertos} />
        <Stat icon={FolderCheck} label="Expedientes cerrados" value={reportes.expedientesCerrados} />
        <Stat icon={ShieldAlert} label="Accesos fallidos (30 días)" value={reportes.intentosFallidosRecientes} />
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-stone-900">Radicados por mes</h2>
        <p className="mb-4 text-xs text-stone-500">Últimos 12 meses, por fecha de radicación.</p>
        <AreaTrendChart data={reportes.serieMensual} emptyMessage="Todavía no hay comunicaciones radicadas para mostrar una tendencia." />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-900">Dependencias con más radicados</h2>
          <p className="mb-4 text-xs text-stone-500">A qué área se distribuyó cada comunicación recibida.</p>
          <BarChartHorizontal data={reportes.porDependencia} emptyMessage="Todavía no hay comunicaciones distribuidas a una dependencia." />
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-stone-900">Por tipo y por estado</h2>
          <p className="mb-4 text-xs text-stone-500">Recibida / enviada / interna, y en qué estado están.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BarChartHorizontal data={reportes.porTipoChart} emptyMessage="Sin datos." />
            <BarChartHorizontal data={reportes.porEstadoChart} emptyMessage="Sin datos." />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-stone-900">Archivo (TRD)</h2>
        <p className="mb-3 text-xs text-stone-500">Tamaño actual de la Tabla de Retención Documental y del archivo general.</p>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><dt className="text-[11px] text-stone-400">Series vigentes</dt><dd className="text-lg font-semibold tabular-nums text-stone-800">{reportes.seriesVigentesTotal}</dd></div>
          <div><dt className="text-[11px] text-stone-400">Subseries activas</dt><dd className="text-lg font-semibold tabular-nums text-stone-800">{reportes.subseriesVigentesTotal}</dd></div>
          <div><dt className="text-[11px] text-stone-400">Expedientes documentales</dt><dd className="text-lg font-semibold tabular-nums text-stone-800">{reportes.expedientesTotal}</dd></div>
          <div><dt className="text-[11px] text-stone-400">Documentos en expedientes</dt><dd className="text-lg font-semibold tabular-nums text-stone-800">{reportes.documentosArchivoTotal}</dd></div>
        </dl>
      </div>
    </div>
  );
}
