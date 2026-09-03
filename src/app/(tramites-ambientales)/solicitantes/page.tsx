import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSolicitantes } from "@/lib/permisos";
import { regimenTributarioLabel } from "@/lib/regimen-tributario";
import { nombreCompletoSolicitante } from "@/lib/solicitante";
import { MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION } from "@/lib/municipios";
import { Paginador } from "@/components/Paginador";
import { ResumenResultados } from "@/components/ResumenResultados";
import { TablaSolicitantes } from "@/components/tablas/TablaSolicitantes";

const POR_PAGINA = 30;

export default async function SolicitantesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; municipio?: string; page?: string }>;
}) {
  const { q, municipio, page: pageParam } = await searchParams;
  const busqueda = q?.trim();
  const pagina = Math.max(1, Number(pageParam) || 1);
  const session = await getSession();
  if (session) {
    const permisos = await obtenerPermisosUsuario(session.userId);
    if (!puedeAccederSolicitantes(permisos)) redirect("/");
  }

  const where = {
    ...(busqueda
      ? {
          OR: [
            { identificacion: { contains: busqueda, mode: "insensitive" as const } },
            { nombres: { contains: busqueda, mode: "insensitive" as const } },
            { apellidos: { contains: busqueda, mode: "insensitive" as const } },
            { razonSocial: { contains: busqueda, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(municipio ? { municipio } : {}),
  };

  const [total, solicitantes] = await Promise.all([
    db.solicitante.count({ where }),
    db.solicitante.findMany({
      where,
      orderBy: [{ apellidos: "asc" }, { razonSocial: "asc" }],
      include: { _count: { select: { expedientes: true } } },
      take: POR_PAGINA,
      skip: (pagina - 1) * POR_PAGINA,
    }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const paramsExport = new URLSearchParams();
  if (busqueda) paramsExport.set("q", busqueda);
  if (municipio) paramsExport.set("municipio", municipio);
  const qsExport = paramsExport.toString();
  const hayFiltros = Boolean(busqueda || municipio);

  const hrefPagina = (p: number) => {
    const params = new URLSearchParams();
    if (busqueda) params.set("q", busqueda);
    if (municipio) params.set("municipio", municipio);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/solicitantes?${qs}` : "/solicitantes";
  };

  // Frase legible de lo que dio el filtro, siempre visible.
  const clausulasFiltro: string[] = [];
  if (municipio) clausulasFiltro.push(`en ${municipio}`);
  if (busqueda) clausulasFiltro.push(`que coinciden con "${busqueda}"`);
  const detalleFiltro = clausulasFiltro.join(" ");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Solicitantes</h2>
          <p className="text-sm text-stone-500">
            Registro único por NIT/cédula — se crea automáticamente al radicar un expediente y se reutiliza
            en los siguientes, para no volver a pedir los mismos datos cada vez.
          </p>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2">
          <Link
            href="/solicitantes/nuevo"
            className="rounded-md bg-cdmb-600 px-3 py-2 text-sm font-medium text-white transition-transform hover:bg-cdmb-700 active:scale-95"
          >
            + Nuevo solicitante
          </Link>
          {session?.rol === "ADMIN" && (
            <a
              href={`/api/solicitantes/exportar${qsExport ? `?${qsExport}` : ""}`}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition-transform hover:bg-stone-50 active:scale-95"
            >
              ⬇ Descargar CSV
            </a>
          )}
        </div>
      </div>

      <form action="/solicitantes" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-stone-600">Buscar</label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="NIT, cédula, nombre o apellido…"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
        </div>
        <div className="min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-stone-600">Municipio</label>
          <select
            name="municipio"
            defaultValue={municipio ?? ""}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          >
            <option value="">Todos</option>
            <option value={FUERA_DE_JURISDICCION}>{FUERA_DE_JURISDICCION}</option>
            {MUNICIPIOS_JURISDICCION_CDMB.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white transition-transform hover:bg-cdmb-700 active:scale-95"
        >
          Buscar
        </button>
        {hayFiltros && (
          <Link href="/solicitantes" className="text-sm text-stone-500 hover:text-stone-700">
            Quitar filtros
          </Link>
        )}
      </form>

      <ResumenResultados total={total} detalle={detalleFiltro} />

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        {solicitantes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-stone-400">
            {hayFiltros ? "Ningún solicitante coincide con ese filtro." : "Todavía no hay solicitantes registrados."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <TablaSolicitantes
              filas={solicitantes.map((s, i) => ({
                id: s.id,
                numero: (pagina - 1) * POR_PAGINA + i + 1,
                identificacion: s.identificacion,
                tipoPersonaTexto: s.tipo === "JURIDICA" ? "Persona jurídica" : "Persona natural",
                nombreCompleto: nombreCompletoSolicitante(s),
                granContribuyente: s.granContribuyente,
                regimenTributario: regimenTributarioLabel(s.regimenTributario),
                municipio: s.municipio,
                totalExpedientes: s._count.expedientes,
              }))}
              sinResultadosTexto={hayFiltros ? "Ningún solicitante coincide con ese filtro." : "Todavía no hay solicitantes registrados."}
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
