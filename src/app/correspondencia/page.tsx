import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, PlusCircle, Send, FileEdit } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeRadicar } from "@/lib/permisos";
import { getCorrespondenciaListado, getCorrespondenciaOpcionesFiltro, type FiltrosCorrespondencia } from "@/lib/correspondencia-data";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";
import { estadoVencimiento } from "@/lib/pqrsd";
import { SectionHelp } from "@/components/Field";
import { Paginador } from "@/components/Paginador";
import { DescargarCsvBoton } from "@/components/DescargarCsvBoton";
import { SelectorVista } from "@/components/SelectorVista";
import { SelectorPeriodo } from "@/components/SelectorPeriodo";
import { ResumenResultados } from "@/components/ResumenResultados";
import { TablaCorrespondencia } from "@/components/tablas/TablaCorrespondencia";

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

const fecha = (d: Date | null) => (d ? d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—");

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
  const [{ filas, total, page, totalPaginas, porPagina, vista }, opciones] = await Promise.all([
    getCorrespondenciaListado(sp, rango),
    getCorrespondenciaOpcionesFiltro(),
  ]);

  const hayFiltros = Boolean(sp.q || sp.tipo || sp.estado || sp.dependencia || rango);
  const CAMPOS_FILTRO = ["q", "tipo", "estado", "dependencia", "desde", "hasta"] as const;

  const clausulas: string[] = [];
  if (sp.tipo) clausulas.push(`de tipo "${ETIQUETA_TIPO[sp.tipo] ?? sp.tipo}"`);
  if (sp.estado) clausulas.push(`en estado "${ETIQUETA_ESTADO[sp.estado] ?? sp.estado}"`);
  if (sp.dependencia) {
    const dep = opciones.dependencias.find((d) => d.id === sp.dependencia);
    if (dep) clausulas.push(`relacionadas con ${dep.nombre}`);
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
      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <SectionHelp>
        Bandeja de toda la correspondencia: recibida (entra), enviada (sale) y memorandos (entre dependencias). La
        columna &quot;Progreso&quot; muestra en qué etapa va cada una, y &quot;Vence&quot; el semáforo del plazo de
        ley cuando es una PQRSD: gris = a tiempo, ámbar = vence en 3 días hábiles o menos, rojo = vencida.
      </SectionHelp>

      <SelectorPeriodo desdeActual={sp.desde} hastaActual={sp.hasta} />

      <form method="get" className="rounded-xl border border-stone-200 bg-white p-4">
        {sp.desde && <input type="hidden" name="desde" value={sp.desde} />}
        {sp.hasta && <input type="hidden" name="hasta" value={sp.hasta} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
            <label className="flex-1">
              <span className="mb-1 block text-xs font-medium text-stone-600">Buscar</span>
              <span className="flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 focus-within:border-cdmb-500 focus-within:ring-1 focus-within:ring-cdmb-500">
                <Search className="h-4 w-4 flex-none text-stone-400" aria-hidden />
                <input type="text" name="q" defaultValue={sp.q ?? ""} placeholder="Radicado, tercero, identificación o asunto" className="w-full text-sm outline-none" />
              </span>
            </label>
            <DescargarCsvBoton href={hrefDescarga()} />
          </div>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Tipo</span>
            <select name="tipo" defaultValue={sp.tipo ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todos</option>
              {opciones.tipos.map((t) => (
                <option key={t} value={t}>{ETIQUETA_TIPO[t] ?? t}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Estado</span>
            <select name="estado" defaultValue={sp.estado ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todos</option>
              {opciones.estados.map((e) => (
                <option key={e} value={e}>{ETIQUETA_ESTADO[e] ?? e}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Dependencia</span>
            <select name="dependencia" defaultValue={sp.dependencia ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todas</option>
              {opciones.dependencias.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">Filtrar</button>
            {hayFiltros && (
              <Link href="/correspondencia" className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">Limpiar</Link>
            )}
          </div>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResumenResultados total={total} detalle={detalleFiltro} />
        {puedeRadicarUsuario && (
          <div className="flex flex-wrap gap-2">
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
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
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
            }))}
            sinResultadosTexto={hayFiltros ? "No hay comunicaciones que coincidan." : "Todavía no se ha radicado correspondencia."}
          />
        </div>
        <SelectorVista vistaActual={vista} />
        <Paginador paginaActual={page} totalPaginas={totalPaginas} total={total} porPagina={porPagina} hrefPagina={hrefPagina} />
      </div>
    </div>
  );
}
