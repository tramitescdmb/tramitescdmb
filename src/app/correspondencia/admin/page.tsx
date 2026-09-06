import { redirect } from "next/navigation";
import { Building2, FolderTree, Plus, Upload } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { listarDependencias, listarDependenciasActivas } from "@/lib/dependencias";
import { listarSeries } from "@/lib/trd";
import { Field, SectionHelp } from "@/components/Field";
import { TrdSeriesExplorer, type GrupoVista } from "@/components/TrdSeriesExplorer";

const inputCls = "w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500";

function agruparPorDependencia(series: Awaited<ReturnType<typeof listarSeries>>): GrupoVista[] {
  const mapa = new Map<string, GrupoVista>();
  const sinDependencia: GrupoVista["series"] = [];
  for (const s of series) {
    const vista = {
      id: s.id,
      codigo: s.codigo,
      nombre: s.nombre,
      version: s.version,
      esAnterior: s.vigenteHasta !== null,
      totalComunicaciones: s._count.comunicaciones,
      subseries: s.subseries.map((ss) => ({
        id: ss.id,
        codigo: ss.codigo,
        nombre: ss.nombre,
        retencionGestionAnios: ss.retencionGestionAnios,
        retencionCentralAnios: ss.retencionCentralAnios,
        disposicionesFinal: ss.disposicionesFinal,
      })),
    };
    if (!s.dependencia) {
      sinDependencia.push(vista);
      continue;
    }
    const key = s.dependencia.codigo;
    if (!mapa.has(key)) mapa.set(key, { codigo: s.dependencia.codigo, nombre: s.dependencia.nombre, series: [] });
    mapa.get(key)!.series.push(vista);
  }
  const grupos = Array.from(mapa.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
  if (sinDependencia.length > 0) grupos.push({ codigo: "", nombre: "Sin dependencia asignada", series: sinDependencia });
  return grupos;
}

export default async function CorrespondenciaAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) redirect("/correspondencia");

  const sp = await searchParams;
  const [dependencias, dependenciasActivas, series] = await Promise.all([
    listarDependencias(),
    listarDependenciasActivas(),
    listarSeries(),
  ]);

  return (
    <div className="space-y-6">
      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      {/* Dependencias / organigrama */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <Building2 className="h-4 w-4 text-cdmb-600" aria-hidden /> Dependencias (organigrama)
        </h2>
        <SectionHelp>
          El organigrama determina a quién se le puede distribuir una comunicación y quién puede firmar memorandos en
          nombre de cada área. Una dependencia inactiva deja de aparecer para asignar cosas nuevas, pero no borra su
          historial.
        </SectionHelp>

        <form action="/api/correspondencia/dependencias" method="post" className="grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-4">
          <Field label="Código" required help="Sigla corta y única, ej. SEYCA.">
            <input name="codigo" className={inputCls} placeholder="Ej. SEYCA" required />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Nombre" required>
              <input name="nombre" className={inputCls} required />
            </Field>
          </div>
          <Field label="Depende de" help="La dependencia jerárquicamente superior, si tiene. Déjelo vacío si es de primer nivel.">
            <select name="parentId" className={inputCls}>
              <option value="">— Ninguna (nivel raíz) —</option>
              {dependenciasActivas.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
            </select>
          </Field>
          <div className="sm:col-span-4">
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
              <Plus className="h-3.5 w-3.5" aria-hidden /> Agregar dependencia
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">Código</th>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 text-right font-medium">Funcionarios</th>
                <th className="px-4 py-2 text-right font-medium">Comunicaciones</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {dependencias.map((d) => (
                <tr key={d.id} className={d.activo ? "" : "opacity-50"}>
                  <td className="px-4 py-2 font-medium text-stone-700" style={{ paddingLeft: `${16 + d.nivel * 16}px` }}>{d.codigo}</td>
                  <td className="px-4 py-2 text-stone-800">{d.nombre}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500">{d._count.usuarios}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-stone-500">{d._count.comunicacionesDestino}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${d.activo ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                      {d.activo ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={`/api/correspondencia/dependencias/${d.id}/toggle`} method="post">
                      <button className="text-xs font-medium text-cdmb-700 hover:underline">{d.activo ? "Desactivar" : "Activar"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* TRD / CCD */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <FolderTree className="h-4 w-4 text-cdmb-600" aria-hidden /> Tablas de Retención Documental (TRD/CCD)
        </h2>
        <SectionHelp>
          La TRD clasifica cada comunicación por el tipo de asunto que trata (una &quot;serie&quot;, ej. Contratos) y
          define por cuánto tiempo debe conservarse antes de transferirla o eliminarla (Acuerdo 060/2001 AGN). Puede
          tener varias versiones de una misma serie a la vez — útil para migrar de una TRD antigua a una nueva sin
          perder la clasificación de lo ya radicado. Un mismo código de serie (ej. &quot;20 ACTAS&quot;) se repite en
          cada dependencia: no es un error, así es la TRD real de la CDMB.
        </SectionHelp>

        <details className="rounded-xl border border-stone-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-stone-900">Importar TRD desde un archivo (CSV)</summary>
          <div className="mt-3 space-y-3">
            <SectionHelp>
              Cargue toda una TRD de una vez desde un archivo de texto separado por &quot;;&quot; (así es como Excel
              exporta un CSV). Debe tener, como mínimo, las columnas <code>dependencia_codigo</code>,{" "}
              <code>dependencia_nombre</code>, <code>serie_codigo</code>, <code>serie_nombre</code>,{" "}
              <code>subserie_codigo</code>, <code>subserie_nombre</code>, <code>retencion_gestion</code>,{" "}
              <code>retencion_central</code>, <code>disposicion_ct</code>, <code>disposicion_e</code>,{" "}
              <code>disposicion_md</code>, <code>disposicion_s</code> (marque con &quot;X&quot; la o las que apliquen),{" "}
              <code>procedimiento</code> y <code>tipos_documentales</code> (varios, separados por &quot;|&quot;). Las
              dependencias que no existan todavía se crean automáticamente a partir del código y el nombre del archivo.
            </SectionHelp>
            <form action="/api/correspondencia/trd/importar" method="post" encType="multipart/form-data" className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Field label="Archivo CSV" required>
                  <input type="file" name="archivo" accept=".csv,text/csv" required className="w-full text-sm" />
                </Field>
              </div>
              <Field label="Versión de esta TRD" required help='Identificador libre, ej. "2022-1" o el año de aprobación.'>
                <input name="version" className={inputCls} required />
              </Field>
              <Field label="Tipo de carga" help="Vigente reemplaza la actual de cada serie que toque (sin borrar la anterior). Histórica queda cerrada desde ya, solo para reclasificar/migrar información antigua.">
                <select name="modo" className={inputCls} defaultValue="vigente">
                  <option value="vigente">TRD vigente (activa)</option>
                  <option value="historica">TRD histórica (para migrar)</option>
                </select>
              </Field>
              <div className="sm:col-span-4">
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
                  <Upload className="h-3.5 w-3.5" aria-hidden /> Importar TRD
                </button>
              </div>
            </form>
          </div>
        </details>

        <details className="rounded-xl border border-stone-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-stone-900">Agregar una serie manualmente</summary>
        <form action="/api/correspondencia/series" method="post" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Código de serie" required>
            <input name="codigo" className={inputCls} placeholder="Ej. 100" required />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Nombre" required>
              <input name="nombre" className={inputCls} placeholder="Ej. Contratos" required />
            </Field>
          </div>
          <Field label="Versión" help="Súbala al crear una TRD nueva sin perder la anterior — ambas quedan disponibles.">
            <input name="version" className={inputCls} defaultValue="1" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Dependencia productora" help="El área dueña de este tipo de documentos.">
              <select name="dependenciaId" className={inputCls}>
                <option value="">— Ninguna —</option>
                {dependenciasActivas.map((d) => (<option key={d.id} value={d.id}>{d.nombre}</option>))}
              </select>
            </Field>
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
              <Plus className="h-3.5 w-3.5" aria-hidden /> Agregar serie
            </button>
          </div>
        </form>
        </details>

        <TrdSeriesExplorer grupos={agruparPorDependencia(series)} />
      </section>
    </div>
  );
}
