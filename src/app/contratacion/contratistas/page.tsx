import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { Users, Download } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederContratacion, puedeVerRegistroContratistas, puedeRegistrarContratistaMinimo } from "@/lib/permisos";
import { TituloSeccion, EstadoVacio } from "@/components/sgdea/ui";
import { ResumenResultados } from "@/components/ResumenResultados";
import { Paginador } from "@/components/Paginador";
import { NuevoContratistaSeccion } from "@/components/NuevoContratistaSeccion";
import { vigenciaDeExpediente } from "@/lib/contratacion";
import { CONTRATO_ACTIVO, filtroContratistas, vigenciasDisponibles } from "@/lib/contratistas-registro";

const POR_PAGINA = 30;

function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

export default async function ContratistasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; vigencia?: string; estado?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");
  if (!puedeVerRegistroContratistas(permisos)) {
    return <AccesoRestringido titulo="Contratistas" quien="administrador, jefe o personal de contratación, o supervisor" volverHref="/contratacion/panel" volverLabel="Volver al panel" />;
  }

  const { q, page: pageParam, vigencia: vigenciaParam, estado: estadoParam } = await searchParams;
  const busqueda = q?.trim() ?? "";
  const pagina = Math.max(1, Number(pageParam) || 1);
  const vigencia = Number(vigenciaParam) || null;
  const estado = estadoParam === "activo" || estadoParam === "inactivo" ? estadoParam : "";

  const where: Prisma.ContratistaWhereInput = filtroContratistas({ busqueda, vigencia, estado });

  const [total, contratistas, conActivo, vigencias] = await Promise.all([
    db.contratista.count({ where }),
    db.contratista.findMany({
      where,
      orderBy: { nombreORazonSocial: "asc" },
      select: {
        id: true,
        identificacion: true,
        nombreORazonSocial: true,
        tipoPersona: true,
        contactoEmail: true,
        contactoCelular: true,
        contactoTelefono: true,
        ciudad: true,
        expedientes: {
          where: { eliminado: false },
          select: { id: true, numero: true, fechaInicio: true, createdAt: true, etapaActual: true, cerrado: true },
        },
      },
      take: POR_PAGINA,
      skip: (pagina - 1) * POR_PAGINA,
    }),
    db.contratista.count({ where: { expedientes: { some: CONTRATO_ACTIVO } } }),
    vigenciasDisponibles(),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const parametros = (cambios: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const base: Record<string, string | null> = { q: busqueda || null, vigencia: vigencia ? String(vigencia) : null, estado: estado || null, ...cambios };
    for (const [k, v] of Object.entries(base)) if (v) params.set(k, v);
    return params.toString();
  };
  const hrefPagina = (p: number) => {
    const qs = parametros({ page: p > 1 ? String(p) : null });
    return qs ? `/contratacion/contratistas?${qs}` : "/contratacion/contratistas";
  };
  const qsFiltros = parametros({});

  return (
    <section className="space-y-4">
      <TituloSeccion icon={Users} contador={total}>
        Contratistas
      </TituloSeccion>
      <p className="-mt-2 text-sm text-stone-500">
        Personas y empresas con expediente en GECON. Sus datos se toman de su usuario en la plataforma.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-soft">
          <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Con contrato activo</p>
          <p className="text-2xl font-semibold text-cdmb-700">{conActivo}</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-soft">
          <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">{vigencia ? `Vigencia ${vigencia}` : "Resultado del filtro"}</p>
          <p className="text-2xl font-semibold text-stone-800">{total}</p>
        </div>
      </div>

      <form className="flex flex-wrap items-center gap-2" method="get">
        <input
          name="q"
          defaultValue={busqueda}
          placeholder="Documento, nombres, apellidos o razón social…"
          className="min-w-[240px] flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
        />
        <select
          name="vigencia"
          defaultValue={vigencia ? String(vigencia) : ""}
          aria-label="Vigencia"
          className="rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
        >
          <option value="">Todas las vigencias</option>
          {vigencias.map((v) => (
            <option key={v} value={v}>
              Vigencia {v}
            </option>
          ))}
        </select>
        <select
          name="estado"
          defaultValue={estado}
          aria-label="Estado del contrato"
          className="rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-vivo-500 focus:outline-none focus:ring-1 focus:ring-vivo-500"
        >
          <option value="">Todos</option>
          <option value="activo">Con contrato activo</option>
          <option value="inactivo">Sin contrato activo</option>
        </select>
        <button type="submit" className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
          Filtrar
        </button>
        {qsFiltros && (
          <Link prefetch={false} href="/contratacion/contratistas" className="text-sm text-stone-500 hover:text-stone-700">
            Quitar filtros
          </Link>
        )}
        <a
          href={`/api/contratacion/contratistas/exportar${qsFiltros ? `?${qsFiltros}` : ""}`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Descargar CSV
        </a>
      </form>

      <ResumenResultados total={total} detalle={busqueda ? `que coinciden con "${busqueda}"` : undefined} />

      {contratistas.length > 0 ? (
        <div className="space-y-2">
          {contratistas.map((c) => {
            const porVigencia = new Map<number, number>();
            for (const e of c.expedientes) {
              const v = vigenciaDeExpediente(e.fechaInicio, e.createdAt);
              porVigencia.set(v, (porVigencia.get(v) ?? 0) + 1);
            }
            const activos = c.expedientes.filter((e) => !e.cerrado && e.etapaActual === "CONTRACTUAL");
            const contacto = [c.contactoEmail, c.contactoCelular ?? c.contactoTelefono].filter(Boolean).join(" · ");
            return (
              <Link
                key={c.id}
                prefetch={false}
                href={`/contratacion/contratistas/${c.id}`}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-cdmb-300 hover:shadow-md"
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-cdmb-100 text-xs font-semibold text-cdmb-800">
                  {iniciales(c.nombreORazonSocial)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 font-medium text-stone-800">
                    {c.nombreORazonSocial}
                    {c.tipoPersona === "JURIDICA" && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">Jurídica</span>}
                  </p>
                  <p className="truncate text-xs text-stone-400">
                    {c.tipoPersona === "JURIDICA" ? "NIT" : "C.C."} {c.identificacion}
                    {c.ciudad ? ` · ${c.ciudad}` : ""}
                    {contacto ? ` · ${contacto}` : ""}
                  </p>
                </div>
                <div className="flex flex-none flex-wrap items-center justify-end gap-1">
                  {Array.from(porVigencia.entries())
                    .sort((a, b) => b[0] - a[0])
                    .map(([v, n]) => (
                      <span key={v} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${v === vigencia ? "bg-cdmb-100 text-cdmb-800" : "bg-stone-100 text-stone-600"}`}>
                        {v}: {n}
                      </span>
                    ))}
                  {activos.length > 0 ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700" title={activos.map((e) => e.numero).join(", ")}>
                      Contrato activo{activos.length > 1 ? ` (${activos.length})` : ""}
                    </span>
                  ) : (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-400">Sin contrato activo</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EstadoVacio icon={Users}>{qsFiltros ? "Ningún contratista coincide con ese filtro." : "Todavía no hay contratistas con expediente."}</EstadoVacio>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
        <Paginador paginaActual={pagina} totalPaginas={totalPaginas} total={total} porPagina={POR_PAGINA} hrefPagina={hrefPagina} />
      </div>

      {puedeRegistrarContratistaMinimo(permisos) && <NuevoContratistaSeccion />}
    </section>
  );
}
