import { redirect } from "next/navigation";
import { ChartColumn } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederContratacion } from "@/lib/permisos";
import { obtenerPanelContratacionVista } from "@/lib/contratacion";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { TituloSeccion, Panel, Sub } from "@/components/sgdea/ui";

export default async function PanelIndicadoresSigecPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");

  const vista = await obtenerPanelContratacionVista(permisos);

  return (
    <section className="space-y-4">
      <TituloSeccion icon={ChartColumn}>Indicadores de contratación</TituloSeccion>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <Sub>Tiempo promedio por etapa</Sub>
          <p className="mb-4 text-xs text-stone-500">
            Días corridos entre abrir y aprobar cada etapa, sobre {vista.totalExpedientes.toLocaleString("es-CO")} expedientes visibles.
          </p>
          <BarChartHorizontal data={vista.tiempoPorEtapa} emptyMessage="Todavía no hay etapas completadas." formatValue={(n) => `${n} días`} />
        </Panel>

        <Panel>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <Sub>Firmas — pendientes vs. resueltas</Sub>
            {vista.totalFirmasCompletadas > 0 && (
              <span className="text-xs text-stone-500">
                Tardan en promedio <strong className="tabular-nums text-stone-800">{vista.tiempoResolucionFirmas} días</strong>
              </span>
            )}
          </div>
          <p className="mb-4 text-xs text-stone-500">Solicitudes de firma (rol &ldquo;Debe firmar&rdquo;) de todos los documentos.</p>
          <BarChartHorizontal data={vista.firmas} emptyMessage="Todavía no se ha asignado ningún firmante." />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <Sub>Expedientes por dependencia</Sub>
          <p className="mb-4 text-xs text-stone-500">Las 10 dependencias solicitantes con más expedientes.</p>
          <BarChartHorizontal data={vista.porDependencia} emptyMessage="Todavía no hay expedientes." />
        </Panel>
        <Panel>
          <Sub>Expedientes por modalidad de selección</Sub>
          <p className="mb-4 text-xs text-stone-500">Informativo (Cap. 6.2 del Manual) — no valida la modalidad elegida.</p>
          <BarChartHorizontal data={vista.porModalidad} emptyMessage="Todavía no hay expedientes." />
        </Panel>
      </div>
    </section>
  );
}
