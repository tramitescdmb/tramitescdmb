import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, AlertTriangle } from "lucide-react";
import { sincaConfigurado } from "@/lib/sinca";
import { obtenerSnapshotNit } from "@/lib/sinca-nit-stats";
import { contarVinculadas, OPCIONES_ORDEN_NIT, type EntidadNit } from "@/lib/sinca-nit";
import { parsePorPagina } from "@/lib/vista-lista";
import { MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION, esMunicipioValido } from "@/lib/municipios";
import { Paginador } from "@/components/Paginador";
import { SelectorVista } from "@/components/SelectorVista";
import { ResumenResultados } from "@/components/ResumenResultados";
import { TablaNits } from "@/components/tablas/TablaNits";
import { EstadisticasNit } from "@/components/EstadisticasNit";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";

const REGIMENES = ["Responsable de Iva", "No responsable de Iva", "Otro"] as const;
const ANIO_MIN = 1990;
const ORDENES_VALIDOS = new Set(OPCIONES_ORDEN_NIT.map((o) => o.value as string));

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

  // Si el usuario no eligió un orden explícito y activó "solo vinculados", el orden por defecto
  // pasa a ser esa cantidad descendente (el que más tiene, primero) — es lo que tiene sentido ahí.
  const orden = filtros.orden && ORDENES_VALIDOS.has(filtros.orden) ? filtros.orden : soloVinculados ? "vinculadas" : "nombre_nit";
  const direccion: "ASC" | "DESC" = filtros.dir ? (filtros.dir === "DESC" ? "DESC" : "ASC") : orden === "vinculadas" ? "DESC" : "ASC";

  // Todo el listado sale de un único snapshot cacheado (ver src/lib/sinca-nit-stats.ts): el API de
  // SINCA 1.0 no tiene forma de "darme ya agrupado por tercero" ni de ordenar por cantidad de
  // vinculadas, así que agrupar es algo que solo se puede hacer de este lado — y haciéndolo sobre
  // el registro COMPLETO (no una muestra acotada) los totales de aquí, de la paginación y del panel
  // de estadísticas de abajo siempre cuadran entre sí.
  let entidades: EntidadNit[] = [];
  let error = false;
  try {
    const snapshot = await obtenerSnapshotNit();
    entidades = snapshot.entidades;
  } catch {
    error = true;
  }

  if (q) {
    const qNorm = q.toUpperCase();
    entidades = entidades.filter(
      (e) => e.nombre.toUpperCase().includes(qNorm) || e.identificacion.toUpperCase().includes(qNorm)
    );
  }
  if (anio) entidades = entidades.filter((e) => e.vinculaciones.some((v) => v.anio === anio));
  if (municipio) {
    entidades = entidades.filter((e) =>
      municipio === FUERA_DE_JURISDICCION ? !esMunicipioValido(e.municipio ?? "") : e.municipio === municipio
    );
  }
  if (tipo) entidades = entidades.filter((e) => e.tipoValue === tipo);
  if (regimen) entidades = entidades.filter((e) => e.regimen === regimen);
  if (soloVinculados) entidades = entidades.filter((e) => contarVinculadas(e) > 0);

  const dirFactor = direccion === "DESC" ? -1 : 1;
  entidades = [...entidades].sort((a, b) => {
    if (orden === "vinculadas") return dirFactor * (contarVinculadas(a) - contarVinculadas(b));
    if (orden === "numero_nit") return dirFactor * ((a.numeroNit ?? 0) - (b.numeroNit ?? 0));
    if (orden === "tipo_id_nit") return dirFactor * (a.tipoValue ?? "").localeCompare(b.tipoValue ?? "");
    return dirFactor * a.nombre.localeCompare(b.nombre, "es");
  });

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
            <select name="orden" defaultValue={orden} className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm">
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
