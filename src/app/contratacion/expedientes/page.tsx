import { Paginador } from "@/components/Paginador";
import { db } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Table2, FolderOpen, X } from "lucide-react";
import { hrefLista } from "@/lib/tableros";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederContratacion, puedeGestionarContratistas } from "@/lib/permisos";
import { listarExpedientesContractuales, construirWhereExpedienteContractual, vigenciaPorDefecto, aniosDeExpedientes, usaSelectorDeVigencia, ETIQUETA_ETAPA, ETIQUETA_MODALIDAD, ETAPAS_ORDEN } from "@/lib/contratacion";
import { MosaicosFiltro } from "@/components/MosaicosFiltro";
import { SelectorAnios } from "@/components/SelectorAnios";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { TituloSeccion, EstadoVacio } from "@/components/sgdea/ui";
import { CarpetaExpedienteContractual } from "@/components/CarpetaExpedienteContractual";
import { formatearFecha } from "@/lib/fecha";
import { TablaExpedientesContractuales } from "@/components/tablas/TablaExpedientesContractuales";
import { BotonExportar } from "@/components/BotonExportar";

export default async function ExpedientesContratacionPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; contratista?: string; etapa?: string; dependenciaId?: string; vigencia?: string; asignados?: string; page?: string; vista?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");

  const sp = await searchParams;
  const vigencia = vigenciaPorDefecto(permisos, sp.vigencia);
  const consulta = { ...sp, vigencia };
  const sinEtapa = { ...sp, etapa: undefined };
  const consultaSinEtapa = { ...consulta, etapa: undefined };
  const [{ filas, total, page, totalPaginas, porPagina }, dependencias, porEtapa, terminados, anios] = await Promise.all([
    listarExpedientesContractuales(consulta, permisos),
    listarDependenciasActivas(),
    db.expedienteContractual.groupBy({ by: ["etapaActual"], where: construirWhereExpedienteContractual(consultaSinEtapa, permisos), _count: { _all: true } }),
    db.expedienteContractual.count({ where: construirWhereExpedienteContractual({ ...consultaSinEtapa, etapa: "TERMINADOS" }, permisos) }),
    aniosDeExpedientes(construirWhereExpedienteContractual({ ...sp, vigencia: undefined, etapa: undefined }, permisos)),
  ]);
  const hrefEtapa = (etapa?: string) => {
    const params = new URLSearchParams(Object.entries({ ...sinEtapa, page: undefined }).filter((par): par is [string, string] => Boolean(par[1])));
    if (etapa) params.set("etapa", etapa);
    return `?${params.toString()}`;
  };
  const COLOR_ETAPA: Record<string, string> = { PRECONTRACTUAL: "#2a78d6", CONTRACTUAL: "#d16f00", POSTCONTRACTUAL: "#4a3aa7" };

  const vista = sp.vista === "tabla" || sp.vista === "carpetas" ? sp.vista : puedeGestionarContratistas(permisos) ? "tabla" : "carpetas";
  const hrefExportar = (formato: "xlsx" | "csv") => {
    const params = new URLSearchParams(
      Object.entries({ q: sp.q, etapa: sp.etapa, dependenciaId: sp.dependenciaId, vigencia }).filter((par): par is [string, string] => Boolean(par[1]))
    );
    params.set("formato", formato);
    return `/api/contratacion/expedientes/exportar?${params.toString()}`;
  };

  return (
    <section className="space-y-4">
      <TituloSeccion icon={Briefcase} contador={total}>
        Expedientes contractuales
      </TituloSeccion>

      {sp.asignados === "mi" && (
        <Link href={hrefLista("/contratacion/expedientes", { ...sp, asignados: undefined, page: undefined })} className="inline-flex w-fit items-center gap-1.5 rounded-sm bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-200">
          A mi cargo
          <X className="h-3 w-3" aria-hidden />
        </Link>
      )}
      {sp.contratista === "sin" && (
        <Link href={hrefLista("/contratacion/expedientes", { ...sp, contratista: undefined, page: undefined })} className="inline-flex w-fit items-center gap-1.5 rounded-sm bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-200">
          Sin contratista asignado
          <X className="h-3 w-3" aria-hidden />
        </Link>
      )}
      {usaSelectorDeVigencia(permisos) && (
      <SelectorAnios
        anios={anios.anios}
        total={anios.total}
        actual={vigencia ?? "todas"}
        href={(v) => hrefLista("/contratacion/expedientes", { ...sp, vigencia: v, page: undefined })}
      />
      )}
      <MosaicosFiltro
        mosaicos={[
          { clave: "todos", etiqueta: "Expedientes", valor: porEtapa.reduce((t, e) => t + e._count._all, 0), href: hrefEtapa(), color: "#d99a00", activo: !sp.etapa },
          ...ETAPAS_ORDEN.map((e) => ({
            clave: e,
            etiqueta: ETIQUETA_ETAPA[e],
            valor: porEtapa.find((x) => x.etapaActual === e)?._count._all ?? 0,
            href: hrefEtapa(e),
            color: COLOR_ETAPA[e]!,
            activo: sp.etapa === e,
          })),
          { clave: "terminados", etiqueta: "Terminados", valor: terminados, href: hrefEtapa("TERMINADOS"), color: "#76847a", activo: sp.etapa === "TERMINADOS" },
        ]}
      />

      <form className="flex flex-wrap items-center gap-2" method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Buscar por código de proceso, número, N.º de proceso SECOP, N.º de contrato, objeto o contratista…"
          className="min-w-[220px] flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
        />
        <select
          name="etapa"
          defaultValue={sp.etapa ?? ""}
          className="rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
        >
          <option value="">Todas las etapas</option>
          {ETAPAS_ORDEN.map((e) => (
            <option key={e} value={e}>{ETIQUETA_ETAPA[e]}</option>
          ))}
          <option value="TERMINADOS">Terminados</option>
        </select>
        <select
          name="dependenciaId"
          defaultValue={sp.dependenciaId ?? ""}
          className="rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
        >
          <option value="">Todas las dependencias</option>
          {dependencias.map((d) => (
            <option key={d.id} value={d.id}>{d.nombre}</option>
          ))}
        </select>
        {sp.vigencia && <input type="hidden" name="vigencia" value={sp.vigencia} />}
        {sp.asignados === "mi" && <input type="hidden" name="asignados" value="mi" />}
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
        {total > 0 && <BotonExportar hrefXlsx={hrefExportar("xlsx")} hrefCsv={hrefExportar("csv")} />}
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
                codigoProceso: e.codigoProceso,
                numeroProcesoSecop: e.numeroProcesoSecop,
                objeto: e.objeto,
                modalidadSeleccion: e.modalidadSeleccion,
                etapaActual: e.etapaActual,
                cerrado: e.cerrado,
                fechaInicio: e.fechaInicio,
                dependencia: e.dependenciaSolicitante.nombre,
                contratista: e.contratista?.nombreORazonSocial ?? null,
                documentos: e._count.documentos,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-soft">
          <TablaExpedientesContractuales
            filas={filas.map((e) => {
              const pendiente = !e.cerrado && e.etapaActual === "CONTRACTUAL" && !e.fechaInicio;
              return {
                id: e.id,
                numero: e.numero,
                codigoProceso: e.codigoProceso,
                numeroProcesoSecop: e.numeroProcesoSecop,
                numeroContrato: e.numeroContrato,
                objeto: e.objeto,
                modalidad: ETIQUETA_MODALIDAD[e.modalidadSeleccion],
                dependencia: e.dependenciaSolicitante.nombre,
                contratista: e.contratista?.nombreORazonSocial ?? null,
                supervisor: e.supervisores.length ? e.supervisores.map((s) => s.usuario.nombre).join(", ") : e.supervisorSecopNombre,
                supervisorSinUsuario: e.supervisores.length === 0 && Boolean(e.supervisorSecopNombre),
                documentos: e._count.documentos,
                etapa: pendiente ? "Pendiente de inicio" : e.cerrado ? "Cerrado" : ETIQUETA_ETAPA[e.etapaActual],
                tonoEtapa: pendiente ? "pendiente" : e.cerrado ? "cerrado" : "activa",
                firma: e.fechaSuscripcion ? formatearFecha(e.fechaSuscripcion) : null,
                terminacion: e.fechaFinEstimada ? formatearFecha(e.fechaFinEstimada) : null,
                creado: formatearFecha(e.createdAt),
              };
            })}
          />
        </div>
      )}

      <Paginador
        paginaActual={page}
        totalPaginas={totalPaginas}
        total={total}
        porPagina={porPagina}
        hrefPagina={(p) => `?${new URLSearchParams({ ...sp, page: String(p) }).toString()}`}
      />
    </section>
  );
}
