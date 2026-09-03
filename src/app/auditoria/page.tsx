import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { SectionHelp } from "@/components/Field";

const ETIQUETAS_TIPO: Record<string, { icono: string; texto: string }> = {
  LOGIN_EXITOSO: { icono: "🔓", texto: "Inicio de sesión" },
  LOGIN_FALLIDO: { icono: "⛔", texto: "Intento de acceso fallido" },
  USUARIO_CREADO: { icono: "➕", texto: "Usuario creado" },
  USUARIO_ACTIVADO: { icono: "✅", texto: "Usuario activado" },
  USUARIO_DESACTIVADO: { icono: "🚫", texto: "Usuario desactivado" },
  CONFIGURACION_ACTUALIZADA: { icono: "🖼️", texto: "Apariencia actualizada" },
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") redirect("/");

  const { tipo } = await searchParams;

  const [registros, eventosExpedientes] = await Promise.all([
    db.registroAuditoria.findMany({
      where: tipo ? { tipo: tipo as never } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { usuario: true },
    }),
    db.expedienteEvento.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { usuario: true, expediente: { select: { id: true, numero: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Auditoría</h1>
        <p className="text-sm text-stone-500">
          Registro de acciones del sistema: inicios de sesión, gestión de usuarios y cambios de
          configuración. Solo visible para administradores.
        </p>
      </div>

      <SectionHelp>
        Esto es aparte de la <strong>bitácora de cada expediente</strong> (que ya ves en el detalle de
        cada uno) — aquí se ve todo el sistema junto: quién entró, quién creó o desactivó a quién, y
        quién cambió el logo. Abajo también hay un resumen de la actividad más reciente en expedientes,
        con enlace directo a cada uno.
      </SectionHelp>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/auditoria"
          className={`rounded-full px-3 py-1 text-xs font-medium ${!tipo ? "bg-cdmb-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
        >
          Todo
        </Link>
        {Object.entries(ETIQUETAS_TIPO).map(([key, { texto }]) => (
          <Link
            key={key}
            href={`/auditoria?tipo=${key}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${tipo === key ? "bg-cdmb-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
          >
            {texto}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        {registros.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-stone-400">No hay registros con este filtro.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {registros.map((r) => {
              const info = ETIQUETAS_TIPO[r.tipo] ?? { icono: "•", texto: r.tipo };
              return (
                <li key={r.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                  <span aria-hidden>{info.icono}</span>
                  <div className="flex-1">
                    <p className="text-stone-700">{r.descripcion}</p>
                    <p className="text-xs text-stone-400">
                      {info.texto} · {r.createdAt.toLocaleString("es-CO")}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Actividad reciente en expedientes
        </h2>
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
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
                    {ev.usuario.nombre} · {ev.createdAt.toLocaleString("es-CO")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
