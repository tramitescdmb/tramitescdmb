import { redirect } from "next/navigation";
import { Inbox, Users, CalendarPlus, CalendarClock, CalendarX, RotateCcw, ClipboardCheck, CheckCircle2 } from "lucide-react";
import type { TipoNotificacion } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { formatearFechaHora } from "@/lib/fecha";
import { CabeceraTablero } from "@/components/tablero";

const ICONO: Record<TipoNotificacion, { Icono: typeof Inbox; clase: string }> = {
  VISITA_SIN_PROGRAMAR: { Icono: CalendarPlus, clase: "bg-violet-50 text-violet-600" },
  VISITA_PROGRAMADA: { Icono: CalendarClock, clase: "bg-sky-50 text-sky-600" },
  VISITA_REPROGRAMADA: { Icono: CalendarClock, clase: "bg-sky-50 text-sky-600" },
  VISITA_CANCELADA: { Icono: CalendarX, clase: "bg-stone-100 text-stone-500" },
  VISITA_POR_REGISTRAR: { Icono: ClipboardCheck, clase: "bg-red-50 text-red-600" },
  VISITA_NO_REALIZADA: { Icono: RotateCcw, clase: "bg-amber-50 text-amber-600" },
  EQUIPO_VISITA: { Icono: Users, clase: "bg-emerald-50 text-emerald-600" },
  CONCEPTO_FIRMADO: { Icono: CheckCircle2, clase: "bg-emerald-50 text-emerald-600" },
  CONCEPTO_RECHAZADO: { Icono: RotateCcw, clase: "bg-red-50 text-red-600" },
};

export default async function BuzonVisitasPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [pendientes, atendidas] = await Promise.all([
    db.notificacion.findMany({
      where: { usuarioId: session.userId, resueltaEn: null },
      orderBy: [{ leidaEn: { sort: "asc", nulls: "first" } }, { updatedAt: "desc" }],
    }),
    db.notificacion.findMany({
      where: { usuarioId: session.userId, resueltaEn: { gte: hace30 } },
      orderBy: { resueltaEn: "desc" },
      take: 50,
    }),
  ]);
  const noLeidas = pendientes.filter((n) => !n.leidaEn).length;

  const fila = (n: (typeof pendientes)[number], atendida: boolean) => {
    const { Icono, clase } = ICONO[n.tipo];
    return (
      <li key={n.id}>
        <a href={`/api/notificaciones/${n.id}`} className={`flex gap-3 px-4 py-3 hover:bg-stone-50 ${atendida ? "opacity-60" : ""}`}>
          <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${clase}`}>
            <Icono className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              {!n.leidaEn && !atendida && <span className="h-2 w-2 flex-none rounded-full bg-red-500" aria-label="No leída" />}
              <span className={`truncate text-sm ${!n.leidaEn && !atendida ? "font-semibold text-stone-900" : "text-stone-800"}`}>{n.titulo}</span>
            </span>
            <span className="block text-xs text-stone-600">{n.mensaje}</span>
            <span className="block text-[11px] text-stone-400">
              {formatearFechaHora(n.updatedAt)}
              {atendida && n.resueltaEn && ` · atendida el ${formatearFechaHora(n.resueltaEn)}`}
            </span>
          </span>
        </a>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <CabeceraTablero
        icon={Inbox}
        tono="acento"
        titulo="Buzón de visitas"
        contador={noLeidas > 0 ? noLeidas : undefined}
        descripcion="Avisos del planeador sobre visitas técnicas asignadas, reprogramadas o pendientes de registro."
        acciones={
          noLeidas > 0 ? (
            <form action="/api/notificaciones/leer-todas" method="post">
              <button type="submit" className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
                Marcar todas como leídas
              </button>
            </form>
          ) : undefined
        }
      />

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft">
        {pendientes.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-6 text-sm text-stone-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
            No tiene avisos pendientes.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100">{pendientes.map((n) => fila(n, false))}</ul>
        )}
      </section>

      {atendidas.length > 0 && (
        <details className="rounded-2xl border border-stone-200 bg-white shadow-soft">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-stone-600">Atendidas en los últimos 30 días ({atendidas.length})</summary>
          <ul className="divide-y divide-stone-100 border-t border-stone-100">{atendidas.map((n) => fila(n, true))}</ul>
        </details>
      )}
    </div>
  );
}
