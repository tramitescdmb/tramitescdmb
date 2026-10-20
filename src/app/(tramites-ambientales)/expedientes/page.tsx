import Link from "next/link";
import { MosaicosFiltro } from "@/components/MosaicosFiltro";
import { estiloEstado } from "@/lib/estados-expediente-estilo";
import { FolderOpen } from "lucide-react";
import { CabeceraTablero, EnlaceTablero } from "@/components/tablero";
import { db } from "@/lib/db";
import { pasosParaAvance } from "@/components/ProgresoExpediente";
import { verificarSesion as getSession } from "@/lib/permisos";
import { Paginador } from "@/components/Paginador";
import { ResumenResultados } from "@/components/ResumenResultados";
import { SelectorPeriodo } from "@/components/SelectorPeriodo";
import { BotonExportar } from "@/components/BotonExportar";
import { TablaExpedientes } from "@/components/tablas/TablaExpedientes";
import { MUNICIPIOS_JURISDICCION_CDMB } from "@/lib/municipios";
import { obtenerPermisosUsuario, puedeAccederTramite } from "@/lib/permisos";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";
import { formatearFecha } from "@/lib/fecha";
import { ESTADOS_EXPEDIENTE } from "@/lib/estados-expediente";
import { construirWhereExpedientes, aniosConRadicacion } from "@/lib/expedientes";

const POR_PAGINA = 30;

export default async function ExpedientesPage({
  searchParams,
}: {
  searchParams: Promise<
    FiltrosPeriodo & { estado?: string; q?: string; tramite?: string; municipio?: string; asignados?: string; page?: string }
  >;
}) {
  const sp = await searchParams;
  const { estado, q, tramite, municipio, asignados, page: pageParam } = sp;
  const { rango, etiqueta: etiquetaPeriodo } = resolverPeriodo(sp);

  const [todosLosTramites, session, anios] = await Promise.all([
    db.tramiteTipo.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, codigo: true },
    }),
    getSession(),
    aniosConRadicacion(),
  ]);
  const permisos = session ? await obtenerPermisosUsuario(session.userId) : null;
  const tramites = permisos ? todosLosTramites.filter((t) => puedeAccederTramite(permisos, t.id)) : todosLosTramites;
  const tramiteIdsPermitidos = permisos && !permisos.esAdmin ? Array.from(permisos.tramites.keys()) : null;

  const busqueda = q?.trim();
  const pagina = Math.max(1, Number(pageParam) || 1);

  const soloMios = asignados === "mi" && Boolean(session);

  const where = construirWhereExpedientes({
    tramiteIdsPermitidos,
    estado,
    tramite,
    municipio,
    rango,
    busqueda,
    soloMios,
    usuarioId: session?.userId,
    cargos: session?.cargos,
  });

  const whereSinEstado = construirWhereExpedientes({
    tramiteIdsPermitidos,
    tramite,
    municipio,
    rango,
    busqueda,
    soloMios,
    usuarioId: session?.userId,
    cargos: session?.cargos,
  });
  const [total, expedientes, porEstado] = await Promise.all([
    db.expediente.count({ where }),
    db.expediente.findMany({
      where,
      orderBy: { fechaUltimoMovimiento: "desc" },
      include: { tramiteTipo: true, flujo: { include: { pasos: { select: { id: true, titulo: true }, orderBy: { numero: "asc" } } } } },
      take: POR_PAGINA,
      skip: (pagina - 1) * POR_PAGINA,
    }),
    db.expediente.groupBy({ by: ["estado"], where: whereSinEstado, _count: { _all: true } }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const hayFiltrosExtra = Boolean(busqueda || tramite || municipio || rango);
  const conFiltro = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const actuales = { estado, q, tramite, municipio, asignados, desde: sp.desde, hasta: sp.hasta, ...extra };
    for (const [k, v] of Object.entries(actuales)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/expedientes?${qs}` : "/expedientes";
  };
  const hrefPagina = (p: number) => conFiltro({ page: p > 1 ? String(p) : undefined });
  const hrefGeovisor = () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ desde: sp.desde, hasta: sp.hasta })) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/visor-tramites?${qs}` : "/visor-tramites";
  };
  const hrefExportar = (formato: "xlsx" | "csv") => {
    const params = new URLSearchParams();
    const actuales = { estado, q, tramite, municipio, asignados, desde: sp.desde, hasta: sp.hasta, formato };
    for (const [k, v] of Object.entries(actuales)) {
      if (v) params.set(k, v);
    }
    return `/api/expedientes/exportar?${params.toString()}`;
  };

  const clausulasFiltro: string[] = [];
  if (tramite) {
    const t = tramites.find((x) => x.id === tramite);
    clausulasFiltro.push(`de ${t ? `${t.codigo} — ${t.nombre}` : tramite}`);
  }
  if (municipio) clausulasFiltro.push(`en ${municipio}`);
  if (estado) clausulasFiltro.push(`en estado "${estado.replaceAll("_", " ")}"`);
  if (rango) clausulasFiltro.push(`radicados entre ${etiquetaPeriodo}`);
  if (soloMios) clausulasFiltro.push("asignados a usted");
  if (busqueda) clausulasFiltro.push(`que coinciden con "${busqueda}"`);
  const detalleFiltro = clausulasFiltro.join(" ");

  return (
    <div className="space-y-4">
      <CabeceraTablero
        icon={FolderOpen}
        titulo="Expedientes"
        contador={total}
        descripcion="Casos radicados de todos los trámites; filtre por estado o busque por número, solicitante, trámite o municipio."
        acciones={
          <>
            {session?.rol === "ADMIN" && <EnlaceTablero href="/expedientes/disposicion">Disposición final (TRD)</EnlaceTablero>}
            <EnlaceTablero href={hrefGeovisor()}>Ver en el visor de trámites</EnlaceTablero>
          </>
        }
      />

      {soloMios && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cdmb-200 bg-cdmb-50/60 px-4 py-2.5 text-sm text-cdmb-900">
          <span>Mostrando solo los expedientes asignados a su nombre o a su cargo.</span>
          <Link href={conFiltro({ asignados: undefined })} className="font-medium text-cdmb-700 hover:underline">
            Ver todos
          </Link>
        </div>
      )}

      <SelectorPeriodo desdeActual={sp.desde} hastaActual={sp.hasta} />

      {anios.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-stone-500">Vigencia</span>
          {anios.map((anio) => {
            const activa = sp.desde === `${anio}-01-01` && sp.hasta === `${anio}-12-31`;
            return (
              <Link
                key={anio}
                href={conFiltro({ desde: `${anio}-01-01`, hasta: `${anio}-12-31` })}
                className={`rounded-sm px-3 py-1 text-xs font-medium ${
                  activa ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50 hover:text-stone-900"
                }`}
              >
                {anio}
              </Link>
            );
          })}
        </div>
      )}

      <form action="/expedientes" method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white shadow-soft p-4">
        {estado && <input type="hidden" name="estado" value={estado} />}
        {soloMios && <input type="hidden" name="asignados" value="mi" />}
        {sp.desde && <input type="hidden" name="desde" value={sp.desde} />}
        {sp.hasta && <input type="hidden" name="hasta" value={sp.hasta} />}
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-stone-600">Buscar</label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Número, solicitante o identificación…"
            className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
          />
        </div>
        <div className="min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-stone-600">Trámite</label>
          <select
            name="tramite"
            defaultValue={tramite ?? ""}
            className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
          >
            <option value="">Todos los trámites</option>
            {tramites.map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo} — {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-stone-600">Municipio</label>
          <select
            name="municipio"
            defaultValue={municipio ?? ""}
            className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
          >
            <option value="">Todos</option>
            {MUNICIPIOS_JURISDICCION_CDMB.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600"
        >
          Buscar
        </button>
        {hayFiltrosExtra && (
          <Link
            href={conFiltro({ q: undefined, tramite: undefined, municipio: undefined, desde: undefined, hasta: undefined })}
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            Quitar filtros de búsqueda
          </Link>
        )}
      </form>

      <MosaicosFiltro
        mosaicos={[
          {
            clave: "todos",
            etiqueta: "Expedientes",
            valor: porEstado.reduce((t, e) => t + e._count._all, 0),
            href: conFiltro({ estado: undefined }),
            color: "#d99a00",
            activo: !estado,
          },
          ...ESTADOS_EXPEDIENTE.map((e) => ({
            clave: e,
            etiqueta: estiloEstado(e).etiqueta,
            valor: porEstado.find((x) => x.estado === e)?._count._all ?? 0,
            href: conFiltro({ estado: e }),
            color: estiloEstado(e).color,
            activo: estado === e,
          })),
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ResumenResultados total={total} detalle={detalleFiltro} />
        {total > 0 && <BotonExportar hrefXlsx={hrefExportar("xlsx")} hrefCsv={hrefExportar("csv")} />}
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft">
        {expedientes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-stone-400">No hay expedientes con este filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <TablaExpedientes
              filas={expedientes.map((exp, i) => ({
                id: exp.id,
                numero: (pagina - 1) * POR_PAGINA + i + 1,
                numeroExpediente: exp.numero,
                tramiteNombre: exp.tramiteTipo.nombre,
                solicitanteNombre: exp.solicitanteNombre,
                solicitanteIdentificacion: exp.solicitanteIdentificacion,
                municipio: exp.municipio,
                pasoActualNumero: exp.pasoActualNumero,
                totalPasos: exp.flujo.pasos.length,
                pasosAvance: pasosParaAvance(exp.flujo.pasos.map((p) => p.titulo)),
                estado: exp.estado,
                archivado: exp.archivado,
                fechaUltimoMovimiento: formatearFecha(exp.fechaUltimoMovimiento),
              }))}
            />
          </div>
        )}
        <Paginador
          paginaActual={pagina}
          totalPaginas={totalPaginas}
          total={total}
          porPagina={POR_PAGINA}
          hrefPagina={hrefPagina}
        />
      </div>
    </div>
  );
}
