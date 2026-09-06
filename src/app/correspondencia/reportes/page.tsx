import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, FolderOpen, FolderCheck, ShieldAlert } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { obtenerReportesCorrespondencia, listarBitacoraFiltrada, ACCIONES_BITACORA, type FiltrosBitacora } from "@/lib/correspondencia-reportes";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { BarChartHorizontal } from "@/components/charts/BarChartHorizontal";
import { SectionHelp } from "@/components/Field";
import type { AccionAuditoriaDoc } from "@prisma/client";

const ETIQUETA_ACCION: Record<string, string> = {
  CREA: "Creación", LEE: "Consulta", MODIFICA: "Modificación", EXPORTA: "Exportación",
  ELIMINA: "Eliminación", DISTRIBUYE: "Distribución", FIRMA: "Firma", CLASIFICA: "Clasificación",
  ARCHIVA: "Archivo", ANULA: "Anulación", SUSPENDE: "Suspensión de término", REACTIVA: "Reactivación de término",
  TRANSFIERE: "Transferencia a archivo central", DISPONE: "Disposición final", ACCESO_DENEGADO: "Acceso denegado",
};

const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

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

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ accion?: string; entidad?: string; desde?: string; hasta?: string; pagina?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) redirect("/correspondencia");

  const sp = await searchParams;
  const filtros: FiltrosBitacora = {
    accion: ACCIONES_BITACORA.includes(sp.accion as AccionAuditoriaDoc) ? (sp.accion as AccionAuditoriaDoc) : undefined,
    entidad: sp.entidad || undefined,
    desde: sp.desde || undefined,
    hasta: sp.hasta || undefined,
  };
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const [reportes, bitacora] = await Promise.all([
    obtenerReportesCorrespondencia(),
    listarBitacoraFiltrada(filtros, pagina),
  ]);

  const paramsSinPagina = new URLSearchParams();
  if (filtros.accion) paramsSinPagina.set("accion", filtros.accion);
  if (filtros.entidad) paramsSinPagina.set("entidad", filtros.entidad);
  if (filtros.desde) paramsSinPagina.set("desde", filtros.desde);
  if (filtros.hasta) paramsSinPagina.set("hasta", filtros.hasta);

  const fecha = (d: Date) => d.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6">
      <SectionHelp>
        Vista general del módulo: cuánto se radica, cómo se distribuye, y una bitácora consultable de todo lo que ha
        pasado — para el comité de archivo y para detectar patrones raros (ej. muchos intentos fallidos de acceso).
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

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-stone-900">Bitácora de auditoría (inalterable)</h2>
        <SectionHelp>
          Todo lo que ha pasado en este módulo, filtrable por tipo de acción, de registro y por fecha. Cada fila va
          encadenada por hash SHA-256 — alterar o borrar una rompe la cadena y queda en evidencia.
        </SectionHelp>
        <form method="get" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <select name="accion" defaultValue={filtros.accion ?? ""} className={inputCls}>
            <option value="">Cualquier acción</option>
            {ACCIONES_BITACORA.map((a) => (<option key={a} value={a}>{ETIQUETA_ACCION[a] ?? a}</option>))}
          </select>
          <select name="entidad" defaultValue={filtros.entidad ?? ""} className={inputCls}>
            <option value="">Cualquier registro</option>
            {bitacora.entidadesDisponibles.map((e) => (<option key={e} value={e}>{e}</option>))}
          </select>
          <input type="date" name="desde" defaultValue={filtros.desde ?? ""} className={inputCls} />
          <input type="date" name="hasta" defaultValue={filtros.hasta ?? ""} className={inputCls} />
          <button type="submit" className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
            Filtrar
          </button>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Acción</th>
                <th className="py-2 pr-3 font-medium">Registro</th>
                <th className="py-2 pr-3 font-medium">Detalle</th>
                <th className="py-2 pr-3 font-medium">Usuario</th>
                <th className="py-2 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {bitacora.filas.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-stone-400">Ningún registro coincide con estos filtros.</td></tr>
              ) : (
                bitacora.filas.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2 pr-3 font-medium text-stone-700">{ETIQUETA_ACCION[b.accion] ?? b.accion}</td>
                    <td className="py-2 pr-3 text-xs text-stone-500">{b.entidad}</td>
                    <td className="max-w-md truncate py-2 pr-3 text-stone-600" title={b.detalle ?? ""}>{b.detalle}</td>
                    <td className="py-2 pr-3 text-stone-600">{b.usuario?.nombre ?? "—"}</td>
                    <td className="py-2 text-xs text-stone-400">{fecha(b.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {bitacora.totalPaginas > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-xs text-stone-400">Página {pagina} de {bitacora.totalPaginas} · {bitacora.total} registros</span>
            <div className="flex gap-2">
              {pagina > 1 && (
                <Link href={`?${paramsSinPagina.toString()}&pagina=${pagina - 1}`} className="rounded-md border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-50">
                  Anterior
                </Link>
              )}
              {pagina < bitacora.totalPaginas && (
                <Link href={`?${paramsSinPagina.toString()}&pagina=${pagina + 1}`} className="rounded-md border border-stone-300 px-3 py-1 text-stone-700 hover:bg-stone-50">
                  Siguiente
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
