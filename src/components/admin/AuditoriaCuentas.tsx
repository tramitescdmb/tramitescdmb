import Link from "next/link";
import { LogIn, ShieldAlert, UserPlus, CheckCircle2, UserX, Palette, Circle, Lock, UserCog, Trash2, type LucideIcon } from "lucide-react";
import { TipoAuditoria } from "@prisma/client";
import { db } from "@/lib/db";
import { SectionHelp } from "@/components/Field";
import { formatearFechaHora } from "@/lib/fecha";

const ETIQUETAS_TIPO: Record<TipoAuditoria, { icono: LucideIcon; clase: string; texto: string }> = {
  LOGIN_EXITOSO: { icono: LogIn, clase: "text-emerald-600", texto: "Inicio de sesión" },
  LOGIN_FALLIDO: { icono: ShieldAlert, clase: "text-red-600", texto: "Intento de acceso fallido" },
  USUARIO_CREADO: { icono: UserPlus, clase: "text-cdmb-600", texto: "Usuario creado" },
  USUARIO_ACTIVADO: { icono: CheckCircle2, clase: "text-emerald-600", texto: "Usuario activado" },
  USUARIO_DESACTIVADO: { icono: UserX, clase: "text-stone-500", texto: "Usuario desactivado" },
  USUARIO_BLOQUEADO: { icono: Lock, clase: "text-red-600", texto: "Usuario bloqueado" },
  USUARIO_ACTUALIZADO: { icono: UserCog, clase: "text-cdmb-600", texto: "Usuario actualizado" },
  CONFIGURACION_ACTUALIZADA: { icono: Palette, clase: "text-cdmb-600", texto: "Configuración actualizada" },
  CONTRATISTA_ELIMINADO: { icono: Trash2, clase: "text-stone-500", texto: "Contratista eliminado" },
};

const TIPOS_VALIDOS = new Set<string>(Object.values(TipoAuditoria));

export async function AuditoriaCuentas({ tipo, basePath, incluirTramites }: { tipo?: string; basePath: string; incluirTramites: boolean }) {
  const filtro = tipo && TIPOS_VALIDOS.has(tipo) ? (tipo as TipoAuditoria) : undefined;

  const [registros, eventosExpedientes] = await Promise.all([
    db.registroAuditoria.findMany({
      where: filtro ? { tipo: filtro } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { usuario: true },
    }),
    incluirTramites
      ? db.expedienteEvento.findMany({
          orderBy: { createdAt: "desc" },
          take: 30,
          include: { usuario: true, expediente: { select: { id: true, numero: true } } },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Auditoría de cuentas</h1>
        <p className="text-sm text-stone-500">
          Registro de acciones del sistema: inicios de sesión, gestión de usuarios y cambios de configuración. Solo visible para administradores.
        </p>
      </div>

      <SectionHelp>
        Aparte de la <strong>bitácora de cada expediente</strong>: aquí se ven las cuentas y la configuración de toda la aplicación —accesos,
        gestión de usuarios, cambios de seguridad.
      </SectionHelp>

      <div className="flex flex-wrap gap-2">
        <Link href={basePath} className={`rounded-full px-3 py-1 text-xs font-medium ${!filtro ? "bg-cdmb-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}>
          Todo
        </Link>
        {Object.entries(ETIQUETAS_TIPO).map(([key, { texto }]) => (
          <Link
            key={key}
            href={`${basePath}?tipo=${key}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filtro === key ? "bg-cdmb-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
          >
            {texto}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft">
        {registros.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-stone-400">No hay registros con este filtro.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {registros.map((r) => {
              const info = ETIQUETAS_TIPO[r.tipo] ?? { icono: Circle, clase: "text-stone-400", texto: r.tipo };
              const Icono = info.icono;
              return (
                <li key={r.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                  <Icono className={`mt-0.5 h-4 w-4 flex-none ${info.clase}`} aria-hidden />
                  <div className="flex-1">
                    <p className="text-stone-700">{r.descripcion}</p>
                    <p className="text-xs text-stone-400">
                      {info.texto} · {formatearFechaHora(r.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {incluirTramites && (
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Actividad reciente en expedientes</h2>
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft">
            {eventosExpedientes.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-stone-400">Sin actividad todavía.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {eventosExpedientes.map((ev) => (
                  <li key={ev.id} className="px-4 py-2.5 text-sm">
                    <Link href={`/expedientes/${ev.expediente.id}`} className="font-medium text-cdmb-700 hover:underline">
                      {ev.expediente.numero}
                    </Link>{" "}
                    <span className="text-stone-600">{ev.descripcion}</span>
                    <p className="text-xs text-stone-400">
                      {ev.usuario.nombre} · {formatearFechaHora(ev.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
