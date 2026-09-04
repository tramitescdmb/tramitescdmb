import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, AlertTriangle } from "lucide-react";
import { sincaConfigurado } from "@/lib/sinca";
import { obtenerSnapshotNit } from "@/lib/sinca-nit-stats";
import { OPCIONES_ORDEN_NIT, REGIMENES_NIT, procesarFiltrosNit, filtrarYOrdenarEntidadesNit, type EntidadNit } from "@/lib/sinca-nit";
import { parsePorPagina } from "@/lib/vista-lista";
import { resolverPeriodo, type FiltrosPeriodo } from "@/lib/periodo-dashboard";
import { MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION } from "@/lib/municipios";
import { Paginador } from "@/components/Paginador";
import { SelectorVista } from "@/components/SelectorVista";
import { SelectorPeriodo } from "@/components/SelectorPeriodo";
import { ResumenResultados } from "@/components/ResumenResultados";
import { DescargarCsvBoton } from "@/components/DescargarCsvBoton";
import { TablaNits } from "@/components/tablas/TablaNits";
import { EstadisticasNit } from "@/components/EstadisticasNit";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";

type Filtros = FiltrosPeriodo & {
  q?: string;
  municipio?: string;
  tipo?: string;
  regimen?: string;
  vinculadas?: string;
  orden?: string;
  dir?: string;
  page?: string;
  vista?: string;
};

export default async function HistoricoNitsPage({ searchParams }: { searchParams: Promise<Filtros> }) {
  const session = await getSession();
  if (session) {
    const permisos = await obtenerPermisosUsuario(session.userId);
    if (!puedeAccederSeccion(permisos, "SINCA_BASE")) redirect("/");
  }
  if (!sincaConfigurado()) {
    return <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">SINCA 1.0 no está configurado en este servidor.</p>;
  }

  const filtros = await searchParams;
  const page = Math.max(1, parseInt(filtros.page ?? "1", 10) || 1);
  const { porPagina, vista } = parsePorPagina(filtros.vista);
  const { rango, etiqueta: etiquetaPeriodo } = resolverPeriodo(filtros);
  const f = procesarFiltrosNit(filtros);

  // Todo el listado sale de un único snapshot cacheado (ver src/lib/sinca-nit-stats.ts): el API de
  // SINCA 1.0 no tiene forma de "darme ya agrupado por tercero" ni de ordenar por cantidad de
  // vinculadas, así que agrupar es algo que solo se puede hacer de este lado — y haciéndolo sobre
  // el registro COMPLETO (no una muestra acotada) los totales de aquí, de la paginación y del panel
  // de estadísticas de abajo siempre cuadran entre sí. El filtro/orden en sí vive en sinca-nit.ts
  // (`filtrarYOrdenarEntidadesNit`) para que la exportación a CSV use exactamente la misma lógica.
  let entidades: EntidadNit[] = [];
  let error = false;
  try {
    const snapshot = await obtenerSnapshotNit();
    entidades = filtrarYOrdenarEntidadesNit(snapshot.entidades, f, rango);
  } catch {
    error = true;
  }

  const totalFiltrado = entidades.length;
  const totalPaginas = Math.max(1, Math.ceil(totalFiltrado / porPagina));
  const entidadesPagina = entidades.slice((page - 1) * porPagina, page * porPagina);
  const filas = entidadesPagina.map((e, i) => ({ ...e, numero: (page - 1) * porPagina + i + 1 }));

  const hrefPagina = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) {
      if (k !== "page" && typeof v === "string" && v) params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/historico/nits?${qs}` : "/historico/nits";
  };
  const hrefDescarga = () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) {
      if (k !== "page" && k !== "vista" && typeof v === "string" && v) params.set(k, v);
    }
    return `/api/historico/nits/exportar?${params.toString()}`;
  };

  const hayFiltros = Boolean(f.q || rango || f.municipio || f.tipo || f.regimen || f.vinculacion);
  const clausulasFiltro: string[] = [];
  if (f.vinculacion === "con") clausulasFiltro.push("con al menos una solicitud vinculada");
  if (f.vinculacion === "sin") clausulasFiltro.push("sin ninguna solicitud vinculada");
  if (f.tipo) clausulasFiltro.push(f.tipo === "N" ? "tipo NIT (empresa)" : "tipo cédula (persona)");
  if (f.regimen) clausulasFiltro.push(`régimen "${f.regimen}"`);
  if (f.municipio) clausulasFiltro.push(`en ${f.municipio}`);
  if (rango) clausulasFiltro.push(`vinculados entre ${etiquetaPeriodo}`);
  if (f.q) clausulasFiltro.push(`que coinciden con "${f.q}"`);
  const detalleFiltro = clausulasFiltro.join(" ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">NIT / Terceros</h2>
          <p className="text-sm text-stone-500">
            Registro histórico de terceros de SINCA 1.0 (personas y empresas). Busque por número de NIT, cédula o
            nombre, y afine con los filtros de abajo. Cada fila es un tercero distinto: <strong>Solicitudes</strong>{" "}
            es el total a las que ha quedado vinculado, y <strong>Vinculadas</strong> cuántas de esas ya tienen el
            detalle completo disponible en esta plataforma (con resolución de fondo) — entre al NIT para verlas.
          </p>
        </div>
        <DescargarCsvBoton href={hrefDescarga()} />
      </div>

      <SelectorPeriodo desdeActual={filtros.desde} hastaActual={filtros.hasta} />

      <form method="get" className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        {filtros.desde && <input type="hidden" name="desde" value={filtros.desde} />}
        {filtros.hasta && <input type="hidden" name="hasta" value={filtros.hasta} />}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-600">Buscar</span>
          <span className="flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 focus-within:border-cdmb-500 focus-within:ring-1 focus-within:ring-cdmb-500">
            <Search className="h-4 w-4 flex-none text-stone-400" aria-hidden />
            <input
              type="text"
              name="q"
              defaultValue={f.q ?? ""}
              placeholder="Número de NIT, cédula o nombre / razón social"
              className="w-full text-sm outline-none"
            />
          </span>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Municipio</span>
            <select name="municipio" defaultValue={filtros.municipio ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todos</option>
              <option value={FUERA_DE_JURISDICCION}>{FUERA_DE_JURISDICCION}</option>
              {MUNICIPIOS_JURISDICCION_CDMB.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Tipo de identificación</span>
            <select name="tipo" defaultValue={filtros.tipo ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todos</option>
              <option value="N">NIT (empresa)</option>
              <option value="C">Cédula (persona)</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Régimen tributario</span>
            <select name="regimen" defaultValue={filtros.regimen ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todos</option>
              {REGIMENES_NIT.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Vinculadas</span>
            <select name="vinculadas" defaultValue={filtros.vinculadas ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todos</option>
              <option value="1">Con al menos una vinculación</option>
              <option value="0">Sin ninguna vinculación</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Ordenar por</span>
            <select name="orden" defaultValue={f.orden} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              {OPCIONES_ORDEN_NIT.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Dirección</span>
            <select name="dir" defaultValue={f.direccion} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="ASC">Ascendente</option>
              <option value="DESC">Descendente</option>
            </select>
          </label>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
            <button type="submit" className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
              Filtrar
            </button>
            {hayFiltros && (
              <Link href="/historico/nits" className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">
                Limpiar
              </Link>
            )}
          </div>
        </div>
      </form>

      {error ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 flex-none text-amber-600" aria-hidden />
          <p>No se pudo consultar el registro de NIT de SINCA 1.0 en este momento. Intente de nuevo en unos minutos.</p>
        </div>
      ) : (
        <>
          <ResumenResultados total={totalFiltrado} detalle={detalleFiltro} />

          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="overflow-x-auto">
              <TablaNits filas={filas} sinResultadosTexto={hayFiltros ? "Ningún tercero coincide con esos filtros." : "No hay registros."} />
            </div>
            <SelectorVista vistaActual={vista} />
            <Paginador paginaActual={page} totalPaginas={totalPaginas} total={totalFiltrado} porPagina={porPagina} hrefPagina={hrefPagina} />
          </div>

          <EstadisticasNit />
        </>
      )}
    </div>
  );
}
