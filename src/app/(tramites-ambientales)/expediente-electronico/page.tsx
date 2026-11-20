import Link from "next/link";
import { Archive } from "lucide-react";
import { db } from "@/lib/db";
import { CabeceraTablero } from "@/components/tablero";
import { CajonArchivo, CarpetaExpedienteTramite } from "@/components/tramites/ArchivoElectronico";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederTramite } from "@/lib/permisos";
import { construirWhereExpedientes } from "@/lib/expedientes";

const TOPE = 1000;
const ETIQUETA_RESULTADO: Record<string, string> = {
  APROBADO: "Aprobado",
  NEGADO: "Negado",
  DESISTIDO: "Desistido",
  ARCHIVADO: "Archivado",
  RECHAZADO: "Rechazado",
};

/**
 * Menú «Expediente electrónico»: solo los expedientes de trámites ambientales que llegaron al
 * final y se cerraron, organizados como el archivo del SGDEA pero por tipo de trámite y año (o año
 * y tipo de trámite). Es un archivo de consulta: aquí no se gestiona nada.
 */
export default async function ExpedienteElectronicoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tramite?: string; anio?: string; orden?: string }>;
}) {
  const sp = await searchParams;
  const busqueda = sp.q?.trim() || undefined;
  const tramite = sp.tramite || undefined;
  const anio = Number(sp.anio) || null;
  const porAnio = sp.orden === "anio";

  const session = await getSession();
  const permisos = session ? await obtenerPermisosUsuario(session.userId) : null;
  const todosLosTramites = await db.tramiteTipo.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true, codigo: true } });
  const tramites = permisos ? todosLosTramites.filter((t) => puedeAccederTramite(permisos, t.id)) : todosLosTramites;

  const base = construirWhereExpedientes({
    tramiteIdsPermitidos: permisos && !permisos.esAdmin ? Array.from(permisos.tramites.keys()) : null,
    expedienteIdsAsignados: permisos && !permisos.esAdmin ? Array.from(permisos.expedientesTramite ?? []) : undefined,
    tramite,
    rango: null,
    busqueda,
    archivados: true,
  });
  const where = anio
    ? { AND: [base, { archivadoEn: { gte: new Date(`${anio}-01-01T05:00:00Z`), lt: new Date(`${anio + 1}-01-01T05:00:00Z`) } }] }
    : base;

  const [expedientes, anios] = await Promise.all([
    db.expediente.findMany({
      where,
      orderBy: { archivadoEn: "desc" },
      take: TOPE,
      select: {
        id: true,
        numero: true,
        estado: true,
        solicitanteNombre: true,
        solicitanteIdentificacion: true,
        municipio: true,
        archivadoEn: true,
        tramiteTipo: { select: { nombre: true, codigo: true } },
        _count: { select: { documentos: true } },
      },
    }),
    db.$queryRaw<{ anio: number }[]>`
      SELECT DISTINCT EXTRACT(YEAR FROM "archivadoEn" AT TIME ZONE 'America/Bogota')::int AS anio
      FROM "Expediente" WHERE archivado = true AND "archivadoEn" IS NOT NULL ORDER BY anio DESC`,
  ]);

  const anioDe = (d: Date | null) => (d ? Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric" }).format(d)) : 0);
  const claveTramite = (e: (typeof expedientes)[number]) => `${e.tramiteTipo.codigo} — ${e.tramiteTipo.nombre}`;
  const claveAnio = (e: (typeof expedientes)[number]) => (anioDe(e.archivadoEn) ? `Año ${anioDe(e.archivadoEn)}` : "Sin fecha");
  const [primero, segundo] = porAnio ? [claveAnio, claveTramite] : [claveTramite, claveAnio];

  // Árbol: (tipo de trámite → año) o (año → tipo de trámite) → carpetas de expedientes.
  const arbol = new Map<string, Map<string, typeof expedientes>>();
  for (const e of expedientes) {
    const a = primero(e);
    const b = segundo(e);
    if (!arbol.has(a)) arbol.set(a, new Map());
    const sub = arbol.get(a)!;
    if (!sub.has(b)) sub.set(b, []);
    sub.get(b)!.push(e);
  }
  const ordenar = (claves: string[]) => (porAnio ? claves.sort().reverse() : claves.sort((x, y) => x.localeCompare(y, "es")));
  const ramas = ordenar([...arbol.keys()]).map((a) => {
    const sub = arbol.get(a)!;
    const hojas = (porAnio ? [...sub.keys()].sort((x, y) => x.localeCompare(y, "es")) : [...sub.keys()].sort().reverse()).map((b) => ({ nombre: b, lista: sub.get(b)! }));
    return { nombre: a, total: hojas.reduce((t, h) => t + h.lista.length, 0), hojas };
  });

  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: busqueda, tramite, anio: anio ? String(anio) : undefined, orden: porAnio ? "anio" : undefined, ...extra })) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/expediente-electronico?${qs}` : "/expediente-electronico";
  };
  const hayFiltros = Boolean(busqueda || tramite || anio);
  const abrirTodo = hayFiltros || expedientes.length <= 12;

  return (
    <div className="space-y-4">
      <CabeceraTablero
        icon={Archive}
        titulo="Expediente electrónico"
        contador={expedientes.length}
        descripcion="Archivo de los expedientes de trámites ambientales que llegaron al final y quedaron cerrados. Solo consulta: abra una carpeta para ver su índice y todos sus documentos."
      />

      <form action="/expediente-electronico" method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-soft">
        {porAnio && <input type="hidden" name="orden" value="anio" />}
        <div className="min-w-[220px] flex-1">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-stone-600">Buscar</label>
          <input
            id="q"
            name="q"
            defaultValue={busqueda ?? ""}
            placeholder="Número, solicitante o identificación…"
            className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
          />
        </div>
        <div className="min-w-[200px]">
          <label htmlFor="tramite" className="mb-1 block text-xs font-medium text-stone-600">Tipo de trámite</label>
          <select id="tramite" name="tramite" defaultValue={tramite ?? ""} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm">
            <option value="">Todos</option>
            {tramites.map((t) => (
              <option key={t.id} value={t.id}>
                {t.codigo} — {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[120px]">
          <label htmlFor="anio" className="mb-1 block text-xs font-medium text-stone-600">Año de archivo</label>
          <select id="anio" name="anio" defaultValue={anio ? String(anio) : ""} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm">
            <option value="">Todos</option>
            {anios.map((a) => (
              <option key={a.anio} value={a.anio}>
                {a.anio}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600">
          Buscar
        </button>
        {hayFiltros && (
          <Link href={href({ q: undefined, tramite: undefined, anio: undefined })} className="text-sm text-stone-500 hover:text-stone-700">
            Quitar filtros
          </Link>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-stone-500">Organizar por</span>
        <div className="flex overflow-hidden rounded-md border border-stone-200">
          <Link
            prefetch={false}
            href={href({ orden: undefined })}
            aria-current={!porAnio ? "true" : undefined}
            className={`px-2.5 py-1.5 font-medium ${!porAnio ? "bg-menu-500 text-stone-900" : "bg-white text-stone-600 hover:bg-stone-50"}`}
          >
            Tipo de trámite → año
          </Link>
          <Link
            prefetch={false}
            href={href({ orden: "anio" })}
            aria-current={porAnio ? "true" : undefined}
            className={`border-l border-stone-200 px-2.5 py-1.5 font-medium ${porAnio ? "bg-menu-500 text-stone-900" : "bg-white text-stone-600 hover:bg-stone-50"}`}
          >
            Año → tipo de trámite
          </Link>
        </div>
      </div>

      {expedientes.length === 0 ? (
        <p className="rounded-2xl border border-stone-200 bg-white px-5 py-10 text-center text-sm text-stone-400 shadow-soft">
          {hayFiltros ? "Ningún expediente archivado coincide con la búsqueda." : "Todavía no hay expedientes archivados."}
        </p>
      ) : (
        <div className="space-y-3">
          {ramas.map((r, i) => (
            <CajonArchivo key={r.nombre} nombre={r.nombre} total={r.total} abierto={abrirTodo || i === 0}>
              {r.hojas.map((h, j) => (
                <CajonArchivo key={h.nombre} nombre={h.nombre} total={h.lista.length} abierto={abrirTodo || (i === 0 && j === 0)} nivel={2}>
                  {h.lista.map((e) => (
                    <CarpetaExpedienteTramite
                      key={e.id}
                      c={{
                        id: e.id,
                        numero: e.numero,
                        tramite: e.tramiteTipo.nombre,
                        solicitante: e.solicitanteNombre,
                        identificacion: e.solicitanteIdentificacion,
                        municipio: e.municipio,
                        resultado: ETIQUETA_RESULTADO[e.estado] ?? e.estado,
                        archivadoEn: e.archivadoEn,
                        documentos: e._count.documentos,
                      }}
                    />
                  ))}
                </CajonArchivo>
              ))}
            </CajonArchivo>
          ))}
          {expedientes.length >= TOPE && (
            <p className="text-xs text-stone-500">Se muestran los {TOPE} archivados más recientes; use la búsqueda o los filtros para encontrar otros.</p>
          )}
        </div>
      )}
    </div>
  );
}
