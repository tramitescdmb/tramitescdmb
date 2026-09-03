import Link from "next/link";
import { redirect } from "next/navigation";
import { Search, AlertTriangle } from "lucide-react";
import { buscarNits, sincaConfigurado, type SincaNitListado } from "@/lib/sinca";
import { parsePorPagina } from "@/lib/vista-lista";
import { db } from "@/lib/db";
import { Paginador } from "@/components/Paginador";
import { SelectorVista } from "@/components/SelectorVista";
import { ResumenResultados } from "@/components/ResumenResultados";
import { TablaSincaNits, type FilaNit } from "@/components/tablas/TablaSincaNits";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";

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

function fecha(v: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

type Filtros = { q?: string; page?: string; vista?: string };

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

  let total = 0;
  let filasApi: SincaNitListado[] = [];
  let error = false;
  try {
    const r = await buscarNits({ search: q, page, perPage: porPagina });
    total = r.total;
    filasApi = r.data;
  } catch {
    error = true;
  }
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  // El registro de NIT cubre TODAS las solicitudes históricas, pero el espejo local de
  // /historico/solicitudes solo tiene las resoluciones de fondo (un subconjunto) — antes de
  // enlazar cada fila hay que confirmar que ese detalle sí existe localmente, o el enlace da 404.
  const idsSolicitud = [...new Set(filasApi.map((n) => Number(n.nrosolicitud_sol)).filter(Number.isFinite))];
  const disponibles =
    idsSolicitud.length > 0
      ? new Set(
          (await db.sincaResolucion.findMany({ where: { nroSolicitud: { in: idsSolicitud } }, select: { nroSolicitud: true } })).map(
            (r) => r.nroSolicitud
          )
        )
      : new Set<number>();

  const hrefPagina = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filtros.vista) params.set("vista", filtros.vista);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/historico/nits?${qs}` : "/historico/nits";
  };

  const hayFiltros = Boolean(q);
  const detalleFiltro = q ? `que coinciden con "${q}"` : "";

  const filas: FilaNit[] = filasApi.map((n, i) => ({
    key: `${n.rn}-${n.numero_nit}-${n.nrosolicitud_sol}`,
    numero: (page - 1) * porPagina + i + 1,
    identificacion: identificacion(n),
    nombre: nombreNit(n),
    tipo: n.natur_jurid_nit?.label ?? null,
    regimen: n.regimen_nit?.label ?? null,
    municipio: n.municipio ?? null,
    nroSolicitud: n.nrosolicitud_sol ? Number(n.nrosolicitud_sol) : null,
    tieneDetalle: n.nrosolicitud_sol ? disponibles.has(Number(n.nrosolicitud_sol)) : false,
    fechaDesde: fecha(n.fechadesde_int),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-stone-900">NIT / Terceros</h2>
        <p className="text-sm text-stone-500">
          Registro histórico de terceros de SINCA 1.0 (personas y empresas) — busque por número de NIT, cédula o
          nombre. Cada resultado muestra la solicitud a la que quedó vinculado; un mismo NIT puede aparecer varias
          veces si ha estado en más de una.
        </p>
      </div>

      <form method="get" className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[260px] flex-1">
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
          <button type="submit" className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700">
            Buscar
          </button>
          {hayFiltros && (
            <Link href="/historico/nits" className="rounded-md border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">
              Limpiar
            </Link>
          )}
        </div>
      </form>

      {error ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 flex-none text-amber-600" aria-hidden />
          <p>No se pudo consultar el registro de NIT de SINCA 1.0 en este momento. Intente de nuevo en unos minutos.</p>
        </div>
      ) : (
        <>
          <ResumenResultados total={total} detalle={detalleFiltro} />

          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <div className="overflow-x-auto">
              <TablaSincaNits
                filas={filas}
                sinResultadosTexto={hayFiltros ? "Ningún NIT o cédula coincide con esa búsqueda." : "No hay registros."}
              />
            </div>
            <SelectorVista vistaActual={vista} />
            <Paginador paginaActual={page} totalPaginas={totalPaginas} total={total} porPagina={porPagina} hrefPagina={hrefPagina} />
          </div>
        </>
      )}
    </div>
  );
}
