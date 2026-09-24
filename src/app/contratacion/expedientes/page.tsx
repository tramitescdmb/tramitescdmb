import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Plus, Table2, FolderOpen } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederContratacion, puedeGestionarContratistas } from "@/lib/permisos";
import { listarExpedientesContractuales, ETIQUETA_ETAPA, ETIQUETA_MODALIDAD, ETAPAS_ORDEN } from "@/lib/contratacion";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { TituloSeccion, EstadoVacio } from "@/components/sgdea/ui";
import { CarpetaExpedienteContractual } from "@/components/CarpetaExpedienteContractual";
import { BotonDescargarZip } from "@/components/BotonDescargarZip";
import { formatearFecha } from "@/lib/fecha";

export default async function ExpedientesContratacionPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; etapa?: string; dependenciaId?: string; page?: string; vista?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");

  const sp = await searchParams;
  const [{ filas, total, page, totalPaginas }, dependencias] = await Promise.all([
    listarExpedientesContractuales(sp, permisos),
    listarDependenciasActivas(),
  ]);

  const vista = sp.vista === "tabla" || sp.vista === "carpetas" ? sp.vista : puedeGestionarContratistas(permisos) ? "tabla" : "carpetas";
  const paramsSinVista = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "vista" && v) as [string, string][]);
  const hrefZip = `/api/contratacion/expedientes/zip-masivo?${paramsSinVista.toString()}`;

  return (
    <section className="space-y-4">
      <TituloSeccion
        icon={Briefcase}
        contador={total}
        accion={
          puedeGestionarContratistas(permisos) ? (
            <Link
              href="/contratacion/expedientes/nuevo"
              className="flex items-center gap-1.5 rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cdmb-700"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Nuevo expediente
            </Link>
          ) : undefined
        }
      >
        Expedientes contractuales
      </TituloSeccion>

      <form className="flex flex-wrap items-center gap-2" method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Buscar por número, N.º de contrato, objeto o contratista…"
          className="min-w-[220px] flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        />
        <select
          name="etapa"
          defaultValue={sp.etapa ?? ""}
          className="rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        >
          <option value="">Todas las etapas</option>
          {ETAPAS_ORDEN.map((e) => (
            <option key={e} value={e}>{ETIQUETA_ETAPA[e]}</option>
          ))}
        </select>
        <select
          name="dependenciaId"
          defaultValue={sp.dependenciaId ?? ""}
          className="rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        >
          <option value="">Todas las dependencias</option>
          {dependencias.map((d) => (
            <option key={d.id} value={d.id}>{d.nombre}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
          Filtrar
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50/80 p-1">
          <Link
            href={`?${new URLSearchParams({ ...sp, vista: "tabla" }).toString()}`}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
              vista === "tabla" ? "bg-white text-cdmb-800 shadow-sm ring-1 ring-stone-200" : "text-stone-500 hover:text-stone-800"
            }`}
          >
            <Table2 className="h-3.5 w-3.5" aria-hidden />
            Tabla
          </Link>
          <Link
            href={`?${new URLSearchParams({ ...sp, vista: "carpetas" }).toString()}`}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${
              vista === "carpetas" ? "bg-white text-cdmb-800 shadow-sm ring-1 ring-stone-200" : "text-stone-500 hover:text-stone-800"
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" aria-hidden />
            Carpetas
          </Link>
        </div>
        {total > 0 && (
          <BotonDescargarZip
            href={hrefZip}
            nombreArchivo="expedientes-sigec.zip"
            etiqueta="Descargar ZIP de estos resultados"
            titulo="Descarga en un ZIP los documentos de los expedientes que coinciden con el filtro (máximo 50)"
          />
        )}
      </div>

      {filas.length === 0 ? (
        <EstadoVacio icon={Briefcase}>No hay expedientes que coincidan con este filtro.</EstadoVacio>
      ) : vista === "carpetas" ? (
        <div className="grid grid-cols-1 gap-x-3 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {filas.map((e) => (
            <CarpetaExpedienteContractual
              key={e.id}
              c={{
                id: e.id,
                numero: e.numero,
                numeroContrato: e.numeroContrato,
                objeto: e.objeto,
                modalidadSeleccion: e.modalidadSeleccion,
                etapaActual: e.etapaActual,
                cerrado: e.cerrado,
                dependencia: e.dependenciaSolicitante.nombre,
                contratista: e.contratista?.nombreORazonSocial ?? null,
                documentos: e._count.documentos,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-soft">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
                <th className="px-3 py-2">Número</th>
                <th className="px-3 py-2">N.º contrato</th>
                <th className="px-3 py-2">Objeto</th>
                <th className="px-3 py-2">Modalidad</th>
                <th className="px-3 py-2">Dependencia</th>
                <th className="px-3 py-2">Contratista</th>
                <th className="px-3 py-2">Documentos</th>
                <th className="px-3 py-2">Etapa</th>
                <th className="px-3 py-2">Creado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((e) => (
                <tr key={e.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link href={`/contratacion/expedientes/${e.id}`} className="text-cdmb-700 hover:underline">
                      {e.numero}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-stone-500">{e.numeroContrato ?? "—"}</td>
                  <td className="max-w-xs truncate px-3 py-2" title={e.objeto}>{e.objeto}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">{ETIQUETA_MODALIDAD[e.modalidadSeleccion]}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">{e.dependenciaSolicitante.nombre}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">{e.contratista?.nombreORazonSocial ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">{e._count.documentos}</td>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        e.cerrado ? "bg-stone-100 text-stone-600" : "bg-cdmb-50 text-cdmb-700"
                      }`}
                    >
                      {e.cerrado ? "Cerrado" : ETIQUETA_ETAPA[e.etapaActual]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-400">{formatearFecha(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex justify-center gap-1 text-sm">
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`?${new URLSearchParams({ ...sp, page: String(p) }).toString()}`}
              className={`rounded-md px-2.5 py-1 ${p === page ? "bg-cdmb-600 text-white" : "text-stone-500 hover:bg-stone-100"}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
