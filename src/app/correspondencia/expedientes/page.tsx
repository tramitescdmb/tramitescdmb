import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, FolderOpen, FolderCheck, Plus, FileText, Files, Handshake } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { listarExpedientesDocumentales, type FiltrosExpedienteDocumental } from "@/lib/expedientes-documentales";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { ETIQUETA_NIVEL_ACCESO, CLASE_NIVEL_ACCESO } from "@/lib/nivel-acceso";
import { SectionHelp } from "@/components/Field";
import { TarjetaKpi } from "@/components/sgdea/ui";
import { Paginador } from "@/components/Paginador";
import { SelectorVista } from "@/components/SelectorVista";
import { ResumenResultados } from "@/components/ResumenResultados";
import { DescargarCsvBoton } from "@/components/DescargarCsvBoton";
import { BotonImprimir } from "@/components/BotonImprimir";
import { formatearFecha as fecha, formatearFechaHora } from "@/lib/fecha";
const ETIQUETA_ESTADO: Record<string, string> = { ABIERTO: "Abiertos", CERRADO: "Cerrados" };

export default async function ExpedientesPage({ searchParams }: { searchParams: Promise<FiltrosExpedienteDocumental & { error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/correspondencia");

  const sp = await searchParams;
  const [{ filas: expedientes, total, page, totalPaginas, porPagina, vista }, dependencias, serieFiltro, resumen, prestamosActivos, documentosTotal] =
    await Promise.all([
      listarExpedientesDocumentales(sp, permisos),
      listarDependenciasActivas(),
      sp.serieId ? db.serieDocumental.findUnique({ where: { id: sp.serieId }, select: { codigo: true, nombre: true } }) : null,
      db.expedienteDocumental.groupBy({ by: ["estado"], _count: { _all: true } }),
      db.prestamoExpediente.count({ where: { fechaDevolucionReal: null } }),
      db.documentoArchivo.count(),
    ]);
  const abiertos = resumen.find((r) => r.estado === "ABIERTO")?._count._all ?? 0;
  const cerrados = resumen.find((r) => r.estado === "CERRADO")?._count._all ?? 0;

  const hayFiltros = Boolean(sp.q || sp.estado || sp.dependenciaId || sp.serieId);
  const CAMPOS_FILTRO = ["q", "estado", "dependenciaId", "serieId"] as const;
  const clausulas: string[] = [];
  if (sp.estado) clausulas.push(`${ETIQUETA_ESTADO[sp.estado] ?? sp.estado}`);
  if (sp.dependenciaId) {
    const dep = dependencias.find((d) => d.id === sp.dependenciaId);
    if (dep) clausulas.push(`de ${dep.nombre}`);
  }
  if (serieFiltro) clausulas.push(`de la serie "${serieFiltro.codigo} — ${serieFiltro.nombre}"`);
  if (sp.q) clausulas.push(`que coinciden con "${sp.q}"`);
  const detalleFiltro = clausulas.join(" ");

  const hrefPagina = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if ((CAMPOS_FILTRO as readonly string[]).includes(k) && v) params.set(k, String(v));
    if (sp.vista) params.set("vista", sp.vista);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/correspondencia/expedientes?${s}` : "/correspondencia/expedientes";
  };
  const hrefFuid = () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if ((CAMPOS_FILTRO as readonly string[]).includes(k) && v) params.set(k, String(v));
    const s = params.toString();
    return s ? `/api/correspondencia/expedientes/exportar-fuid?${s}` : "/api/correspondencia/expedientes/exportar-fuid";
  };

  return (
    <div className="space-y-4">
      <div className="hidden print:block">
        <h1 className="text-lg font-semibold text-stone-900">Expedientes documentales</h1>
        <p className="text-xs text-stone-500">Impreso el {formatearFechaHora(new Date())}</p>
      </div>

      <div className="print:hidden">
        <SectionHelp>
          Carpeta digital de un asunto o procedimiento — no requiere originarse en una comunicación radicada
          (Art. 4.3.2 Acuerdo 001/2024 AGN). La búsqueda también encuentra un expediente por el nombre de un
          archivo que tenga adentro.
        </SectionHelp>
      </div>

      <div className="grid grid-cols-2 gap-3 print:hidden sm:grid-cols-4">
        <TarjetaKpi icon={FolderOpen} label="Abiertos" value={abiertos} tono="cdmb" />
        <TarjetaKpi icon={FolderCheck} label="Cerrados" value={cerrados} tono="verde" />
        <TarjetaKpi icon={Files} label="Documentos" value={documentosTotal} />
        <TarjetaKpi icon={Handshake} label="Préstamos activos" value={prestamosActivos} tono={prestamosActivos > 0 ? "ambar" : "neutro"} />
      </div>

      {sp.error && <div className="print:hidden rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <form method="get" className="print:hidden flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-2.5">
        <span className="flex min-w-[200px] flex-1 items-center gap-1.5 rounded-md border border-stone-300 px-2.5 py-1.5 focus-within:border-cdmb-500 focus-within:ring-1 focus-within:ring-cdmb-500">
          <Search className="h-3.5 w-3.5 flex-none text-stone-400" aria-hidden />
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Número, asunto, dependencia o archivo"
            className="w-full text-sm outline-none"
          />
        </span>
        <select name="estado" defaultValue={sp.estado ?? ""} className="flex-none rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm">
          <option value="">Todos los estados</option>
          <option value="ABIERTO">Abiertos</option>
          <option value="CERRADO">Cerrados</option>
        </select>
        <select name="dependenciaId" defaultValue={sp.dependenciaId ?? ""} className="flex-none rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm">
          <option value="">Todas las dependencias</option>
          {dependencias.map((d) => (
            <option key={d.id} value={d.id}>{d.nombre}</option>
          ))}
        </select>
        <button type="submit" className="flex-none rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cdmb-700">Filtrar</button>
        {hayFiltros && (
          <Link href="/correspondencia/expedientes" className="flex-none rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50">Limpiar</Link>
        )}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResumenResultados total={total} detalle={detalleFiltro} />
        <div className="flex flex-wrap gap-1.5 print:hidden">
          <BotonImprimir variante="secundario" />
          <DescargarCsvBoton href={hrefFuid()} label="FUID (CSV)" />
          <Link
            href="/correspondencia/expedientes/nuevo"
            className="inline-flex flex-none items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cdmb-700"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Nuevo expediente
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white print:overflow-visible print:rounded-none print:border-none">
        {expedientes.length === 0 ? (
          <p className="p-10 text-center text-sm text-stone-400">
            {hayFiltros ? "No hay expedientes que coincidan." : "No hay expedientes todavía."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Número</th>
                  <th className="px-4 py-2 font-medium">Asunto</th>
                  <th className="px-4 py-2 font-medium">Dependencia</th>
                  <th className="px-4 py-2 font-medium">Clasificación</th>
                  <th className="px-4 py-2 text-right font-medium">Documentos</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium">Apertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {expedientes.map((e) => (
                  <tr key={e.id} className="hover:bg-stone-50">
                    <td className="px-4 py-2">
                      <Link href={`/correspondencia/expedientes/${e.id}`} className="font-mono text-xs font-medium text-cdmb-700 hover:underline">
                        {e.numero}
                      </Link>
                    </td>
                    <td className="max-w-xs px-4 py-2 text-stone-700">
                      <p className="truncate" title={e.asunto}>{e.asunto}</p>
                      {e.documentos.length > 0 && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-cdmb-600" title={e.documentos.map((d) => d.nombre).join(", ")}>
                          <FileText className="h-3 w-3 flex-none" aria-hidden />
                          Coincide: {e.documentos.map((d) => d.nombre).join(", ")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-stone-600">{e.dependencia.nombre}</td>
                    <td className="px-4 py-2 text-xs text-stone-500">{e.serie ? `${e.serie.codigo} — ${e.serie.nombre}` : "Sin clasificar"}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-stone-500">{e._count.documentos}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            e.estado === "ABIERTO" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {e.estado === "ABIERTO" ? <FolderOpen className="h-3 w-3" aria-hidden /> : <FolderCheck className="h-3 w-3" aria-hidden />}
                          {e.estado === "ABIERTO" ? "Abierto" : "Cerrado"}
                        </span>
                        {e.nivelAcceso !== "PUBLICA" && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CLASE_NIVEL_ACCESO[e.nivelAcceso]}`}>
                            {ETIQUETA_NIVEL_ACCESO[e.nivelAcceso]}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-xs text-stone-400">{fecha(e.fechaApertura)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="print:hidden">
          <SelectorVista vistaActual={vista} />
          <Paginador paginaActual={page} totalPaginas={totalPaginas} total={total} porPagina={porPagina} hrefPagina={hrefPagina} />
        </div>
      </div>
    </div>
  );
}
