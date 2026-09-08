import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, FolderOpen, FolderCheck, Plus, FileText } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { listarExpedientesDocumentales, type FiltrosExpedienteDocumental } from "@/lib/expedientes-documentales";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { ETIQUETA_NIVEL_ACCESO, CLASE_NIVEL_ACCESO } from "@/lib/nivel-acceso";
import { SectionHelp } from "@/components/Field";
import { Paginador } from "@/components/Paginador";
import { SelectorVista } from "@/components/SelectorVista";
import { ResumenResultados } from "@/components/ResumenResultados";
import { DescargarCsvBoton } from "@/components/DescargarCsvBoton";

const fecha = (d: Date) => d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
const ETIQUETA_ESTADO: Record<string, string> = { ABIERTO: "Abiertos", CERRADO: "Cerrados" };

export default async function ExpedientesPage({ searchParams }: { searchParams: Promise<FiltrosExpedienteDocumental> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/correspondencia");

  const sp = await searchParams;
  const [{ filas: expedientes, total, page, totalPaginas, porPagina, vista }, dependencias] = await Promise.all([
    listarExpedientesDocumentales(sp),
    listarDependenciasActivas(),
  ]);

  const hayFiltros = Boolean(sp.q || sp.estado || sp.dependenciaId);
  const CAMPOS_FILTRO = ["q", "estado", "dependenciaId"] as const;
  const clausulas: string[] = [];
  if (sp.estado) clausulas.push(`${ETIQUETA_ESTADO[sp.estado] ?? sp.estado}`);
  if (sp.dependenciaId) {
    const dep = dependencias.find((d) => d.id === sp.dependenciaId);
    if (dep) clausulas.push(`de ${dep.nombre}`);
  }
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
      <SectionHelp>
        Carpeta digital de un asunto o procedimiento — no requiere originarse en una comunicación radicada
        (Art. 4.3.2 Acuerdo 001/2024 AGN). La búsqueda también encuentra un expediente por el nombre de un
        archivo que tenga adentro.
      </SectionHelp>

      <form method="get" className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-2">
            <label>
              <span className="mb-1 block text-xs font-medium text-stone-600">Buscar</span>
              <span className="flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 focus-within:border-cdmb-500 focus-within:ring-1 focus-within:ring-cdmb-500">
                <Search className="h-4 w-4 flex-none text-stone-400" aria-hidden />
                <input
                  type="text"
                  name="q"
                  defaultValue={sp.q ?? ""}
                  placeholder="Número, asunto, dependencia o nombre de un archivo"
                  className="w-full text-sm outline-none"
                />
              </span>
            </label>
          </div>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Estado</span>
            <select name="estado" defaultValue={sp.estado ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todos</option>
              <option value="ABIERTO">Abiertos</option>
              <option value="CERRADO">Cerrados</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Dependencia</span>
            <select name="dependenciaId" defaultValue={sp.dependenciaId ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todas</option>
              {dependencias.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">Filtrar</button>
            {hayFiltros && (
              <Link href="/correspondencia/expedientes" className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">Limpiar</Link>
            )}
          </div>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResumenResultados total={total} detalle={detalleFiltro} />
        <div className="flex flex-wrap gap-2">
          <DescargarCsvBoton href={hrefFuid()} label="Descargar FUID (CSV)" />
          <Link
            href="/correspondencia/expedientes/nuevo"
            className="inline-flex flex-none items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Nuevo expediente
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        {expedientes.length === 0 ? (
          <p className="p-8 text-center text-sm text-stone-400">
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
        <SelectorVista vistaActual={vista} />
        <Paginador paginaActual={page} totalPaginas={totalPaginas} total={total} porPagina={porPagina} hrefPagina={hrefPagina} />
      </div>
    </div>
  );
}
