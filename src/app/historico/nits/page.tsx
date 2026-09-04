import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, AlertTriangle } from "lucide-react";
import { buscarNits, sincaConfigurado, esColumnaNitValida, SINCA_NIT_COLUMNAS, type SincaNitListado, type SincaNitColumna } from "@/lib/sinca";
import { parsePorPagina, TOPE_VISTA_TODOS } from "@/lib/vista-lista";
import { MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION, esMunicipioValido } from "@/lib/municipios";
import { db } from "@/lib/db";
import { Paginador } from "@/components/Paginador";
import { SelectorVista } from "@/components/SelectorVista";
import { ResumenResultados } from "@/components/ResumenResultados";
import { TarjetasNit, type EntidadNit } from "@/components/TarjetasNit";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";

const REGIMENES = ["Responsable de Iva", "No responsable de Iva", "Otro"] as const;
const ANIO_MIN = 1990;

function texto(v: string | null | undefined): string {
  return v?.trim() || "";
}

function nombreNit(n: SincaNitListado): string {
  return (
    texto(n.razon_soc_nit) ||
    [n.primer_nom_nit, n.segundo_nom_nit, n.primer_ape_nit, n.segundo_ape_nit].map(texto).filter(Boolean).join(" ") ||
    texto(n.nombre_nit) ||
    "—"
  );
}

function identificacion(n: SincaNitListado): string {
  if (!n.numero_nit) return "—";
  const dv = n.digito_nit != null && n.digito_nit !== "" ? `-${n.digito_nit}` : "";
  return `${n.numero_nit}${dv}`;
}

function fecha(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * SINCA 1.0 devuelve etiquetas corruptas en gran contribuyente/autorretenedor
 * ("no se D", "no lo se D"...) en vez de Sí/No — mostrar eso tal cual
 * confundiría más de lo que informa, así que solo se muestra cuando la
 * etiqueta es reconocible; si no, se omite el campo en la tarjeta.
 */
function siNoLimpio(e: unknown): string | null {
  if (!e || typeof e !== "object") return null;
  const label = (e as { label?: string | null }).label?.trim().toUpperCase();
  if (label === "SI" || label === "SÍ") return "Sí";
  if (label === "NO") return "No";
  return null;
}

function anioDe(v: string | null | undefined): number | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
}

type Filtros = {
  q?: string;
  anio?: string;
  municipio?: string;
  tipo?: string;
  regimen?: string;
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
  const columna: SincaNitColumna = filtros.orden && esColumnaNitValida(filtros.orden) ? filtros.orden : "nombre_nit";
  const direccion: "ASC" | "DESC" = filtros.dir === "DESC" ? "DESC" : "ASC";
  const anio = filtros.anio && /^\d{4}$/.test(filtros.anio) ? parseInt(filtros.anio, 10) : undefined;
  const municipio = filtros.municipio?.trim() || undefined;
  const tipo = filtros.tipo === "N" || filtros.tipo === "C" ? filtros.tipo : undefined;
  const regimen = filtros.regimen && (REGIMENES as readonly string[]).includes(filtros.regimen) ? filtros.regimen : undefined;

  // El API de SINCA 1.0 solo filtra por `search` (nit/cédula/nombre); no acepta año, municipio,
  // tipo ni régimen del lado del servidor (confirmado probando esos parámetros en vivo — los
  // ignora). Con cualquiera de esos filtros activo, se trae un lote acotado que coincide con la
  // búsqueda y se filtra/pagina en memoria; sin ellos, se sigue pidiendo la página exacta al API
  // como antes (más liviano).
  const hayFiltroSecundario = Boolean(anio || municipio || tipo || regimen);

  let totalCrudo = 0; // total de vinculaciones que cumplen `search` en el API, antes de año/municipio/tipo/régimen
  let filasApi: SincaNitListado[] = [];
  let truncado = false;
  let error = false;
  try {
    if (hayFiltroSecundario) {
      const r = await buscarNits({ search: q, page: 1, perPage: TOPE_VISTA_TODOS, column: columna, order: direccion });
      totalCrudo = r.total;
      truncado = r.total > TOPE_VISTA_TODOS;
      filasApi = r.data.filter((n) => {
        if (anio && anioDe(n.fechadesde_int) !== anio) return false;
        if (municipio) {
          if (municipio === FUERA_DE_JURISDICCION ? esMunicipioValido(n.municipio ?? "") : n.municipio !== municipio) return false;
        }
        if (tipo && n.tipo_nit?.value !== tipo) return false;
        if (regimen && n.regimen_nit?.label !== regimen) return false;
        return true;
      });
    } else {
      const r = await buscarNits({ search: q, page, perPage: porPagina, column: columna, order: direccion });
      totalCrudo = r.total;
      filasApi = r.data;
    }
  } catch {
    error = true;
  }

  // Total real a mostrar/paginar: filas crudas (si no hay filtro secundario) o filas ya filtradas.
  const totalFiltrado = hayFiltroSecundario ? filasApi.length : totalCrudo;
  const totalPaginas = Math.max(1, Math.ceil(totalFiltrado / porPagina));
  const filasPagina = hayFiltroSecundario ? filasApi.slice((page - 1) * porPagina, page * porPagina) : filasApi;

  // El detalle de una solicitud solo existe en el espejo local si tiene resolución de fondo —
  // se verifica antes de enlazar para no producir 404 (el registro de NIT cubre TODAS las
  // solicitudes históricas, un universo mucho más amplio que ese espejo).
  const idsSolicitud = [...new Set(filasPagina.map((n) => Number(n.nrosolicitud_sol)).filter(Number.isFinite))];
  const disponibles =
    idsSolicitud.length > 0
      ? new Set(
          (await db.sincaResolucion.findMany({ where: { nroSolicitud: { in: idsSolicitud } }, select: { nroSolicitud: true } })).map(
            (r) => r.nroSolicitud
          )
        )
      : new Set<number>();

  // Agrupa por tercero: un mismo NIT puede repetirse una vez por cada solicitud a la que ha
  // estado vinculado — se muestra una sola tarjeta con todas sus solicitudes adentro.
  const entidadesPorClave = new Map<string, EntidadNit>();
  for (const n of filasPagina) {
    const clave = n.numero_nit != null ? String(n.numero_nit) : `sin-nit-${n.rn}`;
    const nroSolicitud = n.nrosolicitud_sol ? Number(n.nrosolicitud_sol) : null;
    const vinc = {
      nroSolicitud,
      fechaDesde: fecha(n.fechadesde_int),
      fechaHasta: fecha(n.fechahasta_int),
      tieneDetalle: nroSolicitud != null && disponibles.has(nroSolicitud),
    };
    const existente = entidadesPorClave.get(clave);
    if (existente) {
      existente.vinculaciones.push(vinc);
      continue;
    }
    entidadesPorClave.set(clave, {
      clave,
      identificacion: identificacion(n),
      nombre: nombreNit(n),
      tipoLabel: n.tipo_nit?.label ?? null,
      tipoValue: n.tipo_nit?.value === "C" ? "C" : n.tipo_nit?.value === "N" ? "N" : null,
      regimen: n.regimen_nit?.label ?? null,
      granContribuyente: siNoLimpio(n.gcontri_nit),
      autorretenedor: siNoLimpio(n.autoret_nit),
      direccion: texto(n.direcc_nit) || null,
      telefono: texto(n.telef_nit) || null,
      celular: texto(n.celular_nit) || null,
      correo: texto(n.correo_nit) || null,
      municipio: texto(n.municipio) || null,
      departamento: texto(n.departamento) || null,
      actualizado: fecha(n.fechaact_nit) || null,
      actualizadoPor: texto(n.usuarioact_nit) || null,
      vinculaciones: [vinc],
    });
  }
  const entidades = [...entidadesPorClave.values()];

  const hrefPagina = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) {
      if (k !== "page" && typeof v === "string" && v) params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/historico/nits?${qs}` : "/historico/nits";
  };

  const hayFiltros = Boolean(q || hayFiltroSecundario);
  const clausulasFiltro: string[] = [];
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
          nombre, y afine con los filtros de abajo. Cada tarjeta es un tercero distinto, con todas las solicitudes a
          las que ha quedado vinculado.
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className="mb-1 block text-xs font-medium text-stone-600">Ordenar por</span>
            <select name="orden" defaultValue={columna} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
              {SINCA_NIT_COLUMNAS.map((c) => (
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
                Año, municipio, tipo y régimen se aplican sobre los primeros {TOPE_VISTA_TODOS.toLocaleString("es-CO")} resultados que
                coinciden con la búsqueda (hay {totalCrudo.toLocaleString("es-CO")} en total) — si no encuentra lo que busca, acote más
                con el campo Buscar.
              </p>
            </div>
          )}

          <TarjetasNit
            entidades={entidades}
            sinResultadosTexto={hayFiltros ? "Ningún tercero coincide con esos filtros." : "No hay registros."}
          />

          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <SelectorVista vistaActual={vista} />
            <Paginador paginaActual={page} totalPaginas={totalPaginas} total={totalFiltrado} porPagina={porPagina} hrefPagina={hrefPagina} />
          </div>
        </>
      )}
    </div>
  );
}
