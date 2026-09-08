import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, PlusCircle, Send, FileEdit, ChevronDown } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeRadicar } from "@/lib/permisos";
import { getCorrespondenciaListado, getCorrespondenciaOpcionesFiltro, ETIQUETA_ORDEN, type FiltrosCorrespondencia } from "@/lib/correspondencia-data";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";
import { estadoVencimiento } from "@/lib/pqrsd";
import { SectionHelp } from "@/components/Field";
import { Paginador } from "@/components/Paginador";
import { DescargarCsvBoton } from "@/components/DescargarCsvBoton";
import { BotonImprimir } from "@/components/BotonImprimir";
import { SelectorVista } from "@/components/SelectorVista";
import { SelectorSerieBusqueda } from "@/components/SelectorSerieBusqueda";
import { ResumenResultados } from "@/components/ResumenResultados";
import { TablaCorrespondencia } from "@/components/tablas/TablaCorrespondencia";
import { formatearFecha as fecha, formatearFechaHora } from "@/lib/fecha";

const ETIQUETA_ESTADO: Record<string, string> = {
  RADICADA: "Radicada",
  EN_REPARTO: "En reparto",
  ASIGNADA: "Asignada",
  EN_TRAMITE: "En trámite",
  INFORMACION_ADICIONAL_REQUERIDA: "Info. requerida",
  RESPONDIDA: "Respondida",
  ARCHIVADA: "Archivada",
  ANULADA: "Anulada",
};
const ETIQUETA_TIPO: Record<string, string> = { RECIBIDA: "Recibida", ENVIADA: "Enviada", INTERNA: "Memorando" };

export default async function CorrespondenciaBandejaPage({
  searchParams,
}: {
  searchParams: Promise<FiltrosCorrespondencia & FiltrosPeriodo & { ok?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");
  const puedeRadicarUsuario = puedeRadicar(permisos);

  const sp = await searchParams;
  const { rango, etiqueta: etiquetaPeriodo } = resolverPeriodo(sp);
  const [{ filas, total, page, totalPaginas, porPagina, vista, orden }, opciones] = await Promise.all([
    getCorrespondenciaListado(sp, rango),
    getCorrespondenciaOpcionesFiltro(),
  ]);

  const hayFiltros = Boolean(sp.q || sp.tipo || sp.estado || sp.dependencia || sp.serieId || rango);
  const CAMPOS_FILTRO = ["q", "tipo", "estado", "dependencia", "serieId", "orden", "desde", "hasta"] as const;

  const clausulas: string[] = [];
  if (sp.tipo) clausulas.push(`de tipo "${ETIQUETA_TIPO[sp.tipo] ?? sp.tipo}"`);
  if (sp.estado) clausulas.push(`en estado "${ETIQUETA_ESTADO[sp.estado] ?? sp.estado}"`);
  if (sp.dependencia) {
    const dep = opciones.dependencias.find((d) => d.id === sp.dependencia);
    if (dep) clausulas.push(`relacionadas con ${dep.nombre}`);
  }
  if (sp.serieId) {
    const serie = opciones.series.find((s) => s.id === sp.serieId);
    if (serie) clausulas.push(`clasificadas en "${serie.codigo} — ${serie.nombre}"`);
  }
  if (rango) clausulas.push(`radicadas entre ${etiquetaPeriodo}`);
  if (sp.q) clausulas.push(`que coinciden con "${sp.q}"`);
  const detalleFiltro = clausulas.join(" ");

  const hrefPagina = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if ((CAMPOS_FILTRO as readonly string[]).includes(k) && v) params.set(k, String(v));
    if (sp.vista) params.set("vista", sp.vista);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/correspondencia?${s}` : "/correspondencia";
  };
  const hrefDescarga = () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if ((CAMPOS_FILTRO as readonly string[]).includes(k) && v) params.set(k, String(v));
    params.set("limite", vista);
    return `/api/correspondencia/exportar?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      {sp.ok && <div className="print:hidden rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="print:hidden rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <div className="hidden print:block">
        <h1 className="text-lg font-semibold text-stone-900">Correspondencia — bandeja</h1>
        <p className="text-xs text-stone-500">Impreso el {formatearFechaHora(new Date())}</p>
      </div>

      <div className="print:hidden">
        <SectionHelp>
          Recibidas, enviadas y memorandos en una sola bandeja — la búsqueda también encuentra por el nombre
          de un archivo adjunto. El semáforo de &quot;Vence&quot; aplica a PQRSD: gris = a tiempo, ámbar = vence
          en 3 días hábiles o menos, rojo = vencida.
        </SectionHelp>
      </div>

      <details open={hayFiltros} className="print:hidden group rounded-xl border border-stone-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-stone-700">
          <span className="flex items-center gap-1.5">
            <Search className="h-4 w-4 text-stone-400" aria-hidden />
            Filtros y período
            {hayFiltros && <span className="rounded-full bg-cdmb-50 px-2 py-0.5 text-xs font-medium text-cdmb-700">Activos</span>}
          </span>
          <ChevronDown className="h-4 w-4 text-stone-400 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <form method="get" className="flex flex-wrap items-end gap-2 border-t border-stone-100 p-3">
          <label className="min-w-[220px] flex-1">
            <span className="mb-1 block text-xs font-medium text-stone-600">Buscar</span>
            <span className="flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 focus-within:border-cdmb-500 focus-within:ring-1 focus-within:ring-cdmb-500">
              <Search className="h-4 w-4 flex-none text-stone-400" aria-hidden />
              <input type="text" name="q" defaultValue={sp.q ?? ""} placeholder="Radicado, tercero, asunto o archivo adjunto" className="w-full text-sm outline-none" />
            </span>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Tipo</span>
            <select name="tipo" defaultValue={sp.tipo ?? ""} className="rounded-md border border-stone-300 bg-white px-2 py-2 text-sm">
              <option value="">Todos</option>
              {opciones.tipos.map((t) => (
                <option key={t} value={t}>{ETIQUETA_TIPO[t] ?? t}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Estado</span>
            <select name="estado" defaultValue={sp.estado ?? ""} className="rounded-md border border-stone-300 bg-white px-2 py-2 text-sm">
              <option value="">Todos</option>
              {opciones.estados.map((e) => (
                <option key={e} value={e}>{ETIQUETA_ESTADO[e] ?? e}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Dependencia</span>
            <select name="dependencia" defaultValue={sp.dependencia ?? ""} className="max-w-[160px] rounded-md border border-stone-300 bg-white px-2 py-2 text-sm">
              <option value="">Todas</option>
              {opciones.dependencias.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </label>

          <SelectorSerieBusqueda series={opciones.series} valorInicial={sp.serieId} />

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Desde</span>
            <input type="date" name="desde" defaultValue={sp.desde ?? ""} className="rounded-md border border-stone-300 px-2 py-2 text-sm" />
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Hasta</span>
            <input type="date" name="hasta" defaultValue={sp.hasta ?? ""} className="rounded-md border border-stone-300 px-2 py-2 text-sm" />
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Orden</span>
            <select name="orden" defaultValue={orden} className="rounded-md border border-stone-300 bg-white px-2 py-2 text-sm">
              {Object.entries(ETIQUETA_ORDEN).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>{etiqueta}</option>
              ))}
            </select>
          </label>

          <button type="submit" className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">Filtrar</button>
          {hayFiltros && (
            <Link href="/correspondencia" className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">Limpiar</Link>
          )}
          <DescargarCsvBoton href={hrefDescarga()} />
        </form>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResumenResultados total={total} detalle={detalleFiltro} />
        <div className="flex flex-wrap gap-2 print:hidden">
          <BotonImprimir variante="secundario" />
          {puedeRadicarUsuario && (
            <>
              <Link href="/correspondencia/nueva" className="inline-flex flex-none items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
                <PlusCircle className="h-4 w-4" aria-hidden />
                Radicar recibida
              </Link>
              <Link href="/correspondencia/nueva/enviada" className="inline-flex flex-none items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
                <Send className="h-4 w-4" aria-hidden />
                Radicar enviada
              </Link>
              <Link href="/correspondencia/nueva/interna" className="inline-flex flex-none items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
                <FileEdit className="h-4 w-4" aria-hidden />
                Nuevo memorando
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white print:overflow-visible print:rounded-none print:border-none">
        <div className="overflow-x-auto">
          <TablaCorrespondencia
            filas={filas.map((c, i) => ({
              id: c.id,
              numero: (page - 1) * porPagina + i + 1,
              tipo: c.tipo,
              radicado: c.radicado,
              fecha: fecha(c.fechaRadicacion),
              tercero: c.tipo === "INTERNA" ? [c.dependenciaOrigen?.nombre, c.dependenciaDestino?.nombre].filter(Boolean).join(" → ") : c.terceroNombre,
              asunto: c.asunto,
              estado: c.estado,
              vencimiento: estadoVencimiento(c.fechaVencimiento),
              docs: c._count.documentos,
              documentosCoincidentes: c.documentos.map((d) => d.nombre),
            }))}
            sinResultadosTexto={hayFiltros ? "No hay comunicaciones que coincidan." : "Todavía no se ha radicado correspondencia."}
          />
        </div>
        <div className="print:hidden">
          <SelectorVista vistaActual={vista} />
          <Paginador paginaActual={page} totalPaginas={totalPaginas} total={total} porPagina={porPagina} hrefPagina={hrefPagina} />
        </div>
      </div>
    </div>
  );
}
