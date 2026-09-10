import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, PlusCircle, Send, FileEdit, ChevronDown } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeRadicar } from "@/lib/permisos";
import { getCorrespondenciaListado, getCorrespondenciaOpcionesFiltro, contarComunicacionesVencidas, ETIQUETA_ORDEN, type FiltrosCorrespondencia } from "@/lib/correspondencia-data";
import { comunicacionesFirmablesPor } from "@/lib/correspondencia";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";
import { estadoVencimiento } from "@/lib/pqrsd";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
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

/** Punto del semáforo de la columna «Vence» + su significado. */
function Semaforo({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 flex-none rounded-full ${color}`} aria-hidden />
      {children}
    </span>
  );
}

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
  const [{ filas, total, page, totalPaginas, porPagina, vista, orden }, opciones, vencidas, calendario, firmables] = await Promise.all([
    getCorrespondenciaListado(sp, rango),
    getCorrespondenciaOpcionesFiltro(),
    contarComunicacionesVencidas(),
    getCalendarioLaboral(),
    puedeRadicarUsuario ? comunicacionesFirmablesPor(session.userId) : Promise.resolve([]),
  ]);

  const hayFiltros = Boolean(sp.q || sp.tipo || sp.estado || sp.dependencia || sp.serieId || sp.vencimiento || rango);
  const CAMPOS_FILTRO = ["q", "tipo", "estado", "dependencia", "serieId", "vencimiento", "orden", "desde", "hasta"] as const;

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

      {vencidas > 0 && sp.vencimiento !== "vencidas" && (
        <div className="print:hidden rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {vencidas === 1
            ? "1 comunicación tiene el término de respuesta de ley vencido y sigue sin cerrarse."
            : `${vencidas} comunicaciones tienen el término de respuesta de ley vencido y siguen sin cerrarse.`}{" "}
          <Link href="/correspondencia?vencimiento=vencidas" className="font-medium underline hover:no-underline">Ver cuáles</Link>
        </div>
      )}

      <div className="hidden print:block">
        <h1 className="text-lg font-semibold text-stone-900">Correspondencia — bandeja</h1>
        <p className="text-xs text-stone-500">Impreso el {formatearFechaHora(new Date())}</p>
      </div>

      {firmables.length > 0 && (
        <details className="print:hidden rounded-xl border border-stone-200 bg-white">
          <summary className="flex cursor-pointer items-center gap-1.5 px-4 py-3 text-sm font-medium text-stone-700">
            <FileEdit className="h-4 w-4 text-stone-400" aria-hidden />
            Firma en lote — {firmables.length} oficio(s)/memorando(s) sin su firma
          </summary>
          <form action="/api/correspondencia/firmar-lote" method="post" className="border-t border-stone-100 p-3">
            <p className="mb-2 text-xs text-stone-500">
              Marque los que quiera firmar y confirme. Cada firma es electrónica con hash sobre su contenido
              (Ley 527/1999); queda registrada en la bitácora de cada comunicación.
            </p>
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {firmables.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="comunicacionId" value={c.id} className="mt-1 rounded border-stone-300" />
                  <span>
                    <Link href={`/correspondencia/${c.id}`} className="font-medium text-cdmb-700 hover:underline">{c.radicado}</Link>
                    <span className="ml-1 rounded bg-stone-100 px-1 text-[10px] text-stone-500">{ETIQUETA_TIPO[c.tipo] ?? c.tipo}</span>
                    <span className="block truncate text-xs text-stone-400">{c.asunto}</span>
                  </span>
                </li>
              ))}
            </ul>
            <button type="submit" className="mt-3 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
              Firmar seleccionadas
            </button>
          </form>
        </details>
      )}

      <div className="print:hidden flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-stone-200 bg-stone-50/60 px-3.5 py-2.5 text-xs text-stone-500">
        <span className="font-medium text-stone-600">Columna «Vence» — término de ley de la PQRSD</span>
        <Semaforo color="bg-emerald-500">A tiempo</Semaforo>
        <Semaforo color="bg-amber-400">Vence en 3 días hábiles o menos</Semaforo>
        <Semaforo color="bg-red-500">Término vencido</Semaforo>
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
              <input type="text" name="q" defaultValue={sp.q ?? ""} placeholder='Ej. concesión aguas  ·  "aprovechamiento forestal"  ·  vertimientos -renovación' className="w-full text-sm outline-none" />
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
            <span className="mb-1 block text-xs font-medium text-stone-600">Término de ley</span>
            <select name="vencimiento" defaultValue={sp.vencimiento ?? ""} className="rounded-md border border-stone-300 bg-white px-2 py-2 text-sm">
              <option value="">Cualquiera</option>
              <option value="vencidas">Vencidas</option>
              <option value="por_vencer">Por vencer (3 días)</option>
            </select>
          </label>

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
              vencimiento: estadoVencimiento(c.fechaVencimiento, undefined, calendario),
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
