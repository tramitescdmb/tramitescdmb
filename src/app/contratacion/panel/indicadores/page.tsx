import { redirect } from "next/navigation";
import { Briefcase, Building2, Clock3, PenLine, Scale, Timer } from "lucide-react";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederContratacion } from "@/lib/permisos";
import { obtenerPanelContratacionVista } from "@/lib/contratacion";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { CabeceraTablero, Indicador, TarjetaTablero } from "@/components/tablero";

export default async function PanelIndicadoresGeconPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");

  const vista = await obtenerPanelContratacionVista(permisos);

  return (
    <section className="space-y-4">
      <CabeceraTablero titulo="Indicadores de contratación" descripcion="Tiempos por etapa, firmas y distribución de los expedientes visibles para usted.">
        <Indicador icon={Briefcase} valor={vista.totalExpedientes} etiqueta="Expedientes" tono="cdmb" />
        <Indicador icon={PenLine} valor={vista.totalFirmasCompletadas} etiqueta="Firmas resueltas" tono="verde" />
        {vista.totalFirmasCompletadas > 0 && <Indicador icon={Timer} valor={`${vista.tiempoResolucionFirmas} d`} etiqueta="Promedio por firma" tono="ambar" />}
      </CabeceraTablero>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TarjetaTablero icon={Clock3} tono="ambar" titulo="Tiempo promedio por etapa" descripcion="Días corridos entre abrir y aprobar cada etapa.">
          <BarChartHorizontal data={vista.tiempoPorEtapa} emptyMessage="Todavía no hay etapas completadas." formatValue={(n) => `${n} días`} />
        </TarjetaTablero>
        <TarjetaTablero icon={PenLine} tono="rojo" titulo="Firmas pendientes y resueltas" descripcion="Solicitudes de firma (rol «Debe firmar») de todos los documentos.">
          <BarChartHorizontal data={vista.firmas} emptyMessage="Todavía no se ha asignado ningún firmante." />
        </TarjetaTablero>
        <TarjetaTablero icon={Building2} tono="cielo" titulo="Expedientes por dependencia" descripcion="Las 10 dependencias solicitantes con más expedientes.">
          <BarChartHorizontal data={vista.porDependencia} emptyMessage="Todavía no hay expedientes." />
        </TarjetaTablero>
        <TarjetaTablero icon={Scale} tono="violeta" titulo="Expedientes por modalidad de selección" descripcion="Informativo (Cap. 6.2 del Manual); no valida la modalidad elegida.">
          <BarChartHorizontal data={vista.porModalidad} emptyMessage="Todavía no hay expedientes." />
        </TarjetaTablero>
      </div>
    </section>
  );
}
