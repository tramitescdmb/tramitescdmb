import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, AlertTriangle } from "lucide-react";
import { buscarNits, sincaConfigurado, esColumnaNitValida, type SincaNitListado, type SincaNitColumna } from "@/lib/sinca";
import { agruparEntidadesNit, anioNit, contarVinculadas, OPCIONES_ORDEN_NIT } from "@/lib/sinca-nit";
import { parsePorPagina, TOPE_VISTA_TODOS } from "@/lib/vista-lista";
import { MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION, esMunicipioValido } from "@/lib/municipios";
import { db } from "@/lib/db";
import { Paginador } from "@/components/Paginador";
import { SelectorVista } from "@/components/SelectorVista";
import { ResumenResultados } from "@/components/ResumenResultados";
import { TablaNits } from "@/components/tablas/TablaNits";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";

const REGIMENES = ["Responsable de Iva", "No responsable de Iva", "Otro"] as const;
const ANIO_MIN = 1990;

type Filtros = {
  q?: string;
  anio?: string;
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
  const q = filtros.q?.trim();
  const page = Math.max(1, parseInt(filtros.page ?? "1", 10) || 1);
  const { porPagina, vista } = parsePorPagina(filtros.vista);
  const anio = filtros.anio && /^\d{4}$/.test(filtros.anio) ? parseInt(filtros.anio, 10) : undefined;
  const municipio = filtros.municipio?.trim() || undefined;
  const tipo = filtros.tipo === "N" || filtros.tipo === "C" ? filtros.tipo : undefined;
  const regimen = filtros.regimen && (REGIMENES as readonly string[]).includes(filtros.regimen) ? filtros.regimen : undefined;
  const soloVinculados = filtros.vinculadas === "1";

  // "vinculadas" no es una columna del API (es la cantidad de solicitudes con detalle, que solo
  // se sabe después de agrupar) — cuando se ordena por ahí, o cuando el filtro "solo vinculados"
  // está activo, hace falta agrupar TODO el lote antes de paginar (ver más abajo). Si el usuario no
  // eligió un orden explícito y activó "solo vinculados", el orden por defecto pasa a ser esa
  // cantidad descendente (el que más tiene, primero) — es lo que tiene sentido para ese filtro.
  const ordenarPorVinculadas = filtros.orden ? filtros.orden === "vinculadas" : soloVinculados;
  const columna: SincaNitColumna = !ordenarPorVinculadas && filtros.orden && esColumnaNitValida(filtros.orden) ? filtros.orden : "nombre_nit";
  const direccion: "ASC" | "DESC" = filtros.dir ? (filtros.dir === "DESC" ? "DESC" : "ASC") : ordenarPorVinculadas ? "DESC" : "ASC";

  // El API de SINCA 1.0 solo filtra por `search` (nit/cédula/nombre) y no tiene noción de
  // "vinculadas" (confirmado probando año/municipio/tipo/régimen en vivo — los ignora). Con
  // cualquiera de esos filtros u órdenes activo, se trae un lote acotado que coincide con la
  // búsqueda, se agrupa entero y se filtra/ordena/pagina por tercero en memoria; sin ellos, se
  // sigue pidiendo la página exacta al API como antes (más liviano).
  const necesitaLoteCompleto = Boolean(anio || municipio || tipo || regimen || soloVinculados || ordenarPorVinculadas);

  // Al ordenar por vinculadas, la "Dirección" elegida es la del conteo (más vinculadas primero o
  // al revés) — no debe además invertir qué 5.000 filas se traen del API, o cambiar esa dirección
  // cambiaría silenciosamente la muestra sobre la que se calcula el conteo. Por eso el pedido al
  // API siempre va en un orden fijo (nombre ascendente) cuando se ordena por vinculadas.
  const ordenApi: "ASC" | "DESC" = ordenarPorVinculadas ? "ASC" : direccion;

  let totalCrudo = 0; // total de vinculaciones que cumplen `search` en el API, antes de cualquier filtro de esta página
  let filasBase: SincaNitListado[] = [];
  let truncado = false;
  let error = false;
  try {
    if (necesitaLoteCompleto) {
      const r = await buscarNits({ search: q, page: 1, perPage: TOPE_VISTA_TODOS, column: columna, order: ordenApi });
      totalCrudo = r.total;
      truncado = r.total > TOPE_VISTA_TODOS;
      filasBase = r.data.filter((n) => {
        if (anio && anioNit(n.fechadesde_int) !== anio) return false;
        if (municipio) {
          if (municipio === FUERA_DE_JURISDICCION ? esMunicipioValido(n.municipio ?? "") : n.municipio !== municipio) return false;
        }
        if (tipo && n.tipo_nit?.value !== tipo) return false;
        if (regimen && n.regimen_nit?.label !== regimen) return false;
        return true;
      });
    } else {
      const r = await buscarNits({ search: q, page, perPage: porPagina, column: columna, order: ordenApi });
      totalCrudo = r.total;
      filasBase = r.data;
    }
  } catch {
    error = true;
  }

  // El detalle de una solicitud solo existe en el espejo local si tiene resolución de fondo — se
  // calcula aquí (no solo en la ficha) para poder mostrar en el listado cuántas de las solicitudes
  // de cada tercero sí tienen ese detalle, y así no perder tiempo entrando a las que no tienen nada.
  const idsSolicitud = [...new Set(filasBase.map((n) => Number(n.nrosolicitud_sol)).filter(Number.isFinite))];
  const disponibles =
    idsSolicitud.length > 0
      ? new Set(
          (await db.sincaResolucion.findMany({ where: { nroSolicitud: { in: idsSolicitud } }, select: { nroSolicitud: true } })).map(
            (r) => r.nroSolicitud
          )
        )
      : new Set<number>();

  // Agrupa por tercero: un mismo NIT puede repetirse una vez por cada solicitud a la que ha
  // estado vinculado — el listado muestra una sola fila por tercero, con la cantidad total y
  // cuántas de esas sí tienen detalle; la lista completa se ve al entrar a la ficha del NIT.
  let entidades = agruparEntidadesNit(filasBase, disponibles);
  if (soloVinculados) entidades = entidades.filter((e) => contarVinculadas(e) > 0);
  if (ordenarPorVinculadas) {
    const factor = direccion === "DESC" ? -1 : 1;
    entidades = [...entidades].sort((a, b) => factor * (contarVinculadas(a) - contarVinculadas(b)));
  }

  const totalFiltrado = necesitaLoteCompleto ? entidades.length : totalCrudo;
  const totalPaginas = Math.max(1, Math.ceil(totalFiltrado / porPagina));
  const entidadesPagina = necesitaLoteCompleto ? entidades.slice((page - 1) * porPagina, page * porPagina) : entidades;
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

  const hayFiltros = Boolean(q || anio || municipio || tipo || regimen || soloVinculados);
  const clausulasFiltro: string[] = [];
  if (soloVinculados) clausulasFiltro.push("con al menos una solicitud vinculada");
  if (tipo) clausulasFiltro.push(tipo === "N" ? "tipo NIT (empresa)" : "tipo cédula (persona)");
  if (regimen) clausulasFiltro.push(`régimen "${regimen}"`);
  if (municipio) clausulasFiltro.push(`en ${municipio}`);
  if (anio) clausulasFiltro.push(`vinculados en ${anio}`);
  if (q) clausulasFiltro.push(`que coinciden con "${q}"`);
  const detalleFiltro = clausulasFiltro.join(" ");

  const anios: number[] = [];
  for (let y = new Date().getFullYear(); y >= ANIO_MIN; y--) anios.push(y);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-stone-900">NIT / Terceros</h2>
        <p className="text-sm text-stone-500">
          Registro histórico de terceros de SINCA 1.0 (personas y empresas). Busque por número de NIT, cédula o
          nombre, y afine con los filtros de abajo. Cada fila es un tercero distinto: <strong>Solicitudes</strong> es
          el total a las que ha quedado vinculado, y <strong>Vinculadas</strong> cuántas de esas ya tienen el detalle
          completo disponible en esta plataforma (con resolución de fondo) — entre al NIT para verlas.
        </p>
      </div>

      <form method="get" className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-600">Buscar</span>
          <span className="flex items-center gap-2 rounded-md border border-stone-300 px-3 py-2 focus-within:border-cdmb-500 focus-within:ring-1 focus-within:ring-cdmb-500">
            <Search className="h-4 w-4 flex-none text-stone-400" aria-hidden />
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Número de NIT, cédula o nombre / razón social"
              className="w-full text-sm outline-none"
            />
          </span>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Año de vinculación</span>
            <select name="anio" defaultValue={filtros.anio ?? ""} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              <option value="">Todos</option>
              {anios.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>

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
              {REGIMENES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Vinculadas</span>
            <span className="flex h-[38px] items-center gap-2 rounded-md border border-stone-300 bg-white px-3">
              <input
                type="checkbox"
                name="vinculadas"
                value="1"
                defaultChecked={soloVinculados}
                className="h-4 w-4 rounded border-stone-300 text-cdmb-600 focus:ring-cdmb-500"
              />
              <span className="text-sm text-stone-700">Solo con vinculadas</span>
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Ordenar por</span>
            <select
              name="orden"
              defaultValue={ordenarPorVinculadas ? "vinculadas" : columna}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              {OPCIONES_ORDEN_NIT.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Dirección</span>
            <select name="dir" defaultValue={direccion} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
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
          {truncado && (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 flex-none text-amber-600" aria-hidden />
              <p>
                Año, municipio, tipo, régimen, vinculadas y el orden por vinculadas se calculan sobre una muestra de{" "}
                {TOPE_VISTA_TODOS.toLocaleString("es-CO")} resultados que coinciden con la búsqueda (hay{" "}
                {totalCrudo.toLocaleString("es-CO")} en total) — si no encuentra lo que busca, acote más con el campo Buscar.
              </p>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            {!necesitaLoteCompleto && filas.length > 0 && filas.length < filasBase.length && (
              <p className="border-b border-stone-100 px-4 py-2 text-xs text-stone-400">
                Esta página trae {filasBase.length} solicitudes, agrupadas en {filas.length} terceros distintos — por eso se ven
                menos filas de las que eligió en &quot;Ver&quot;.
              </p>
            )}
            <div className="overflow-x-auto">
              <TablaNits filas={filas} sinResultadosTexto={hayFiltros ? "Ningún tercero coincide con esos filtros." : "No hay registros."} />
            </div>
            <SelectorVista vistaActual={vista} />
            <Paginador paginaActual={page} totalPaginas={totalPaginas} total={totalFiltrado} porPagina={porPagina} hrefPagina={hrefPagina} />
          </div>
        </>
      )}
    </div>
  );
}
