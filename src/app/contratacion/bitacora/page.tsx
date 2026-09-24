import Link from "next/link";
import { redirect } from "next/navigation";
import { ScrollText, FilePlus2, FileUp, FileSignature, FileX2, FilePen, CheckCircle2, Trash2, ArrowRightCircle, Undo2, Lock, UserSquare2, Users, CalendarClock, Link2, Circle, type LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAdministrarSigec } from "@/lib/permisos";
import { TituloSeccion, EstadoVacio } from "@/components/sgdea/ui";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { Paginador } from "@/components/Paginador";
import { formatearFechaHora } from "@/lib/fecha";

const POR_PAGINA = 40;

const EVENTOS: Record<string, { icono: LucideIcon; clase: string; texto: string }> = {
  CREACION: { icono: FilePlus2, clase: "text-cdmb-600", texto: "Expediente creado" },
  DOCUMENTO_SUBIDO: { icono: FileUp, clase: "text-cdmb-600", texto: "Documento subido" },
  DOCUMENTO_FIRMADO: { icono: FileSignature, clase: "text-emerald-600", texto: "Documento firmado" },
  DOCUMENTO_RECHAZADO: { icono: FileX2, clase: "text-red-600", texto: "Documento rechazado" },
  DOCUMENTO_EDITADO: { icono: FilePen, clase: "text-stone-500", texto: "Documento editado" },
  DOCUMENTO_VALIDADO: { icono: CheckCircle2, clase: "text-emerald-600", texto: "Documento validado" },
  DOCUMENTO_ELIMINADO: { icono: Trash2, clase: "text-stone-500", texto: "Documento eliminado" },
  ETAPA_APROBADA: { icono: ArrowRightCircle, clase: "text-emerald-600", texto: "Etapa aprobada" },
  ETAPA_RETROCEDIDA: { icono: Undo2, clase: "text-amber-600", texto: "Etapa retrocedida" },
  EXPEDIENTE_CERRADO: { icono: Lock, clase: "text-stone-700", texto: "Expediente cerrado" },
  CONTRATISTA_VINCULADO: { icono: UserSquare2, clase: "text-cdmb-600", texto: "Contratista vinculado" },
  SUPERVISORES_ACTUALIZADOS: { icono: Users, clase: "text-stone-500", texto: "Supervisores actualizados" },
  DATOS_CONTRATO_ACTUALIZADOS: { icono: CalendarClock, clase: "text-stone-500", texto: "Datos del contrato actualizados" },
  EXPEDIENTE_RELACIONADO: { icono: Link2, clase: "text-stone-500", texto: "Expediente relacionado" },
  PERIODO_INFORME_CREADO: { icono: CalendarClock, clase: "text-cdmb-600", texto: "Espacio de informe creado" },
  PERIODO_INFORME_RENOMBRADO: { icono: CalendarClock, clase: "text-stone-500", texto: "Espacio de informe renombrado" },
  PERIODO_INFORME_ELIMINADO: { icono: CalendarClock, clase: "text-stone-500", texto: "Espacio de informe eliminado" },
};

const humanizar = (tipo: string) => tipo.charAt(0) + tipo.slice(1).toLowerCase().replace(/_/g, " ");
const infoEvento = (tipo: string) => EVENTOS[tipo] ?? { icono: Circle, clase: "text-stone-400", texto: humanizar(tipo) };

export default async function BitacoraSigecPage({ searchParams }: { searchParams: Promise<{ tipo?: string; q?: string; page?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarSigec(permisos)) {
    return <AccesoRestringido titulo="Bitácora del SIGEC" quien="administrador o jefe de contratación" volverHref="/contratacion/panel" volverLabel="Volver al panel" />;
  }

  const { tipo, q, page: pageParam } = await searchParams;
  const busqueda = q?.trim();
  const pagina = Math.max(1, Number(pageParam) || 1);

  const tiposExistentes = await db.eventoContratacion.groupBy({ by: ["tipo"], _count: { _all: true }, orderBy: { tipo: "asc" } });
  const tipoValido = tipo && tiposExistentes.some((t) => t.tipo === tipo) ? tipo : undefined;
  const where = {
    ...(tipoValido ? { tipo: tipoValido } : {}),
    ...(busqueda ? { expediente: { numero: { contains: busqueda, mode: "insensitive" as const } } } : {}),
  };

  const [total, eventos] = await Promise.all([
    db.eventoContratacion.count({ where }),
    db.eventoContratacion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: { expediente: { select: { id: true, numero: true } }, usuario: { select: { nombre: true } } },
    }),
  ]);
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const href = (p: number, t = tipoValido) => {
    const params = new URLSearchParams();
    if (t) params.set("tipo", t);
    if (busqueda) params.set("q", busqueda);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/contratacion/bitacora?${qs}` : "/contratacion/bitacora";
  };

  return (
    <section className="space-y-4">
      <TituloSeccion icon={ScrollText} contador={total}>
        Bitácora del SIGEC
      </TituloSeccion>
      <p className="-mt-2 text-sm text-stone-500">
        Registro cronológico de la gestión de los expedientes contractuales: creación, documentos, firmas, cambios de etapa y vínculos.
      </p>

      <form method="get" className="flex flex-wrap items-center gap-2">
        {tipoValido && <input type="hidden" name="tipo" value={tipoValido} />}
        <input
          name="q"
          defaultValue={busqueda ?? ""}
          placeholder="Buscar por número de expediente (ej. CDMB-CTO-2026-000001)…"
          className="min-w-[260px] flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
        />
        <button type="submit" className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
          Buscar
        </button>
        {(busqueda || tipoValido) && (
          <Link href="/contratacion/bitacora" className="text-sm text-stone-500 hover:text-stone-700">
            Quitar filtros
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        <Link href={href(1, undefined)} className={`rounded-full px-3 py-1 text-xs font-medium ${!tipoValido ? "bg-cdmb-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}>
          Todo
        </Link>
        {tiposExistentes.map((t) => (
          <Link
            key={t.tipo}
            href={href(1, t.tipo)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${tipoValido === t.tipo ? "bg-cdmb-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
          >
            {infoEvento(t.tipo).texto} <span className="tabular-nums opacity-70">{t._count._all}</span>
          </Link>
        ))}
      </div>

      {eventos.length === 0 ? (
        <EstadoVacio icon={ScrollText}>No hay eventos con este filtro.</EstadoVacio>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft">
          <ul className="divide-y divide-stone-100">
            {eventos.map((e) => {
              const info = infoEvento(e.tipo);
              const Icono = info.icono;
              return (
                <li key={e.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                  <Icono className={`mt-0.5 h-4 w-4 flex-none ${info.clase}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-stone-700">
                      <Link href={`/contratacion/expedientes/${e.expediente.id}`} className="font-mono text-xs font-medium text-cdmb-700 hover:underline">
                        {e.expediente.numero}
                      </Link>{" "}
                      {e.detalle ?? info.texto}
                    </p>
                    <p className="text-xs text-stone-400">
                      {info.texto} · {e.usuario?.nombre ?? "Sistema"} · {formatearFechaHora(e.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <Paginador paginaActual={pagina} totalPaginas={totalPaginas} total={total} porPagina={POR_PAGINA} hrefPagina={(p) => href(p)} />
        </div>
      )}
    </section>
  );
}
