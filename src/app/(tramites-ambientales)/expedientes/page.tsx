import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { EstadoBadge } from "@/components/EstadoBadge";
import { ProgresoExpediente } from "@/components/ProgresoExpediente";
import { Paginador } from "@/components/Paginador";
import { ResumenResultados } from "@/components/ResumenResultados";
import { MUNICIPIOS_JURISDICCION_CDMB } from "@/lib/municipios";
import { obtenerPermisosUsuario, puedeAccederTramite } from "@/lib/permisos";

const POR_PAGINA = 30;

const ESTADOS = [
  "RADICADO",
  "EN_TRAMITE",
  "INFORMACION_ADICIONAL_REQUERIDA",
  "SUSPENDIDO",
  "APROBADO",
  "NEGADO",
  "DESISTIDO",
  "ARCHIVADO",
  "RECHAZADO",
] as const;

export default async function ExpedientesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string; tramite?: string; municipio?: string; asignados?: string; page?: string }>;
}) {
  const { estado, q, tramite, municipio, asignados, page: pageParam } = await searchParams;

  const [todosLosTramites, session] = await Promise.all([
    db.tramiteTipo.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, codigo: true },
    }),
    getSession(),
  ]);
  const permisos = session ? await obtenerPermisosUsuario(session.userId) : null;
  const tramites = permisos ? todosLosTramites.filter((t) => puedeAccederTramite(permisos, t.id)) : todosLosTramites;
  const tramiteIdsPermitidos = permisos && !permisos.esAdmin ? Array.from(permisos.tramites.keys()) : null;

  const busqueda = q?.trim();
  const pagina = Math.max(1, Number(pageParam) || 1);

  // Filtro "asignados a mí": expedientes asignados a mi usuario puntual o a mi cargo.
  // Solo tiene efecto si hay sesión; si no, se ignora (no se puede saber "quién soy").
  const soloMios = asignados === "mi" && Boolean(session);

  const filtros: Prisma.ExpedienteWhereInput[] = [];
  if (tramiteIdsPermitidos) filtros.push({ tramiteTipoId: { in: tramiteIdsPermitidos } });
  if (estado) filtros.push({ estado: estado as (typeof ESTADOS)[number] });
  if (tramite) filtros.push({ tramiteTipoId: tramite });
  if (municipio) filtros.push({ municipio });
  if (busqueda) {
    filtros.push({
      OR: [
        { numero: { contains: busqueda, mode: "insensitive" } },
        { solicitanteNombre: { contains: busqueda, mode: "insensitive" } },
        { solicitanteIdentificacion: { contains: busqueda, mode: "insensitive" } },
      ],
    });
  }
  if (soloMios && session) {
    filtros.push({
      OR: [
        { usuariosAsignados: { some: { id: session.userId } } },
        ...(session.cargos.length > 0 ? [{ cargosAsignados: { some: { nombre: { in: session.cargos } } } }] : []),
      ],
    });
  }
  const where: Prisma.ExpedienteWhereInput = filtros.length ? { AND: filtros } : {};

  const [total, expedientes] = await Promise.all([
    db.expediente.count({ where }),
    db.expediente.findMany({
      where,
      orderBy: { fechaUltimoMovimiento: "desc" },
      include: { tramiteTipo: true, flujo: { include: { pasos: { select: { id: true } } } } },
      take: POR_PAGINA,
      skip: (pagina - 1) * POR_PAGINA,
    }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const hayFiltrosExtra = Boolean(busqueda || tramite || municipio);
  // El GET conserva estado/q/tramite/municipio a la vez — helper para armar los links de los pills de estado sin perder los otros filtros.
  const conFiltro = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const actuales = { estado, q, tramite, municipio, asignados, ...extra };
    for (const [k, v] of Object.entries(actuales)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/expedientes?${qs}` : "/expedientes";
  };
  const hrefPagina = (p: number) => conFiltro({ page: p > 1 ? String(p) : undefined });

  // Frase legible de lo que dio el filtro, siempre visible (no solo cuando hay
  // más de una página) — ver la nota en Paginador.tsx sobre por qué ese "Mostrando
  // X–Y de Z" antes desaparecía por completo con un resultado de una sola página.
  const clausulasFiltro: string[] = [];
  if (tramite) {
    const t = tramites.find((x) => x.id === tramite);
    clausulasFiltro.push(`de ${t ? `${t.codigo} — ${t.nombre}` : tramite}`);
  }
  if (municipio) clausulasFiltro.push(`en ${municipio}`);
  if (estado) clausulasFiltro.push(`en estado "${estado.replaceAll("_", " ")}"`);
  if (soloMios) clausulasFiltro.push("asignados a usted");
  if (busqueda) clausulasFiltro.push(`que coinciden con "${busqueda}"`);
  const detalleFiltro = clausulasFiltro.join(" ");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Expedientes</h2>
        <p className="text-sm text-stone-500">
          Todos los casos radicados, de cualquier trámite. Puede filtrarse por estado, o buscarse por
          número, solicitante, trámite o municipio.
        </p>
      </div>

      {soloMios && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cdmb-200 bg-cdmb-50/60 px-4 py-2.5 text-sm text-cdmb-900">
          <span>Mostrando solo los expedientes asignados a su nombre o a su cargo.</span>
          <Link href={conFiltro({ asignados: undefined })} className="font-medium text-cdmb-700 hover:underline">
            Ver todos
          </Link>
        </div>
      )}

      <form action="/expedientes" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4">
        {estado && <input type="hidden" name="estado" value={estado} />}
        {soloMios && <input type="hidden" name="asignados" value="mi" />}
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-stone-600">Buscar</label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Número, solicitante o identificación…"
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
          />
        </div>
        <div className="min-w-[200px]">
          <label className="mb-1 block text-xs font-medium text-stone-600">Trámite</label>
          <select
            name="tramite"
            defaultValue={tramite ?? ""}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
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
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
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
          className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
        >
          Buscar
        </button>
        {hayFiltrosExtra && (
          <Link href={conFiltro({ q: undefined, tramite: undefined, municipio: undefined })} className="text-sm text-stone-500 hover:text-stone-700">
            Quitar filtros de búsqueda
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        <Link
          href={conFiltro({ estado: undefined })}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !estado ? "bg-cdmb-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          Todos
        </Link>
        {ESTADOS.map((e) => (
          <Link
            key={e}
            href={conFiltro({ estado: e })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              estado === e ? "bg-cdmb-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {e.replaceAll("_", " ")}
          </Link>
        ))}
      </div>

      <ResumenResultados total={total} detalle={detalleFiltro} />

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        {expedientes.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-stone-400">No hay expedientes con este filtro.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-stone-100 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-2.5 py-2 font-medium">#</th>
                <th className="px-2.5 py-2 font-medium">Número</th>
                <th className="px-2.5 py-2 font-medium">Trámite</th>
                <th className="px-2.5 py-2 font-medium">Solicitante</th>
                <th className="px-2.5 py-2 font-medium">Municipio</th>
                <th className="px-2.5 py-2 font-medium">Avance</th>
                <th className="px-2.5 py-2 font-medium">Estado</th>
                <th className="px-2.5 py-2 font-medium">Último movimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {expedientes.map((exp, i) => (
                <tr key={exp.id} className="hover:bg-stone-50">
                  <td className="px-2.5 py-2 text-stone-400">{(pagina - 1) * POR_PAGINA + i + 1}</td>
                  <td className="px-2.5 py-2">
                    <Link href={`/expedientes/${exp.id}`} className="font-medium text-cdmb-700 hover:underline">
                      {exp.numero}
                    </Link>
                  </td>
                  <td className="max-w-[170px] truncate px-2.5 py-2 text-stone-700" title={exp.tramiteTipo.nombre}>
                    {exp.tramiteTipo.nombre}
                  </td>
                  <td className="max-w-[150px] truncate px-2.5 py-2 text-stone-700" title={exp.solicitanteNombre}>
                    {exp.solicitanteNombre}
                    <span className="block text-xs text-stone-400">{exp.solicitanteIdentificacion}</span>
                  </td>
                  <td className="px-2.5 py-2 text-stone-500">{exp.municipio}</td>
                  <td className="min-w-[140px] px-2.5 py-2">
                    <ProgresoExpediente
                      pasoActualNumero={exp.pasoActualNumero}
                      totalPasos={exp.flujo.pasos.length}
                      estado={exp.estado}
                    />
                  </td>
                  <td className="px-2.5 py-2">
                    <EstadoBadge estado={exp.estado} />
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-stone-500">
                    {exp.fechaUltimoMovimiento.toLocaleDateString("es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
