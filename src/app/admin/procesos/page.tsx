import { redirect } from "next/navigation";
import { CalendarClock, CheckCircle2, XCircle, Loader2, Play } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { CabeceraTablero } from "@/components/tablero";
import { PROCESOS_PROGRAMADOS, ultimasEjecuciones } from "@/lib/procesos-programados";
import { formatearFechaHora } from "@/lib/fecha";

function duracion(inicio: Date, fin: Date | null) {
  if (!fin) return "en curso";
  const s = Math.max(0, Math.round((fin.getTime() - inicio.getTime()) / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

export default async function ProcesosProgramadosPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") return <AccesoRestringido titulo="Procesos programados" quien="administrador del sistema" volverHref="/" volverLabel="Ir al inicio" />;
  const sp = await searchParams;
  const ejecuciones = await ultimasEjecuciones(8);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <CabeceraTablero
        icon={CalendarClock}
        titulo="Procesos programados"
        contador={PROCESOS_PROGRAMADOS.length}
        descripcion="Tareas que el sistema ejecuta solo, todos los días, sin intervención de una persona. Cada ejecución queda registrada con su resultado."
      />
      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      {PROCESOS_PROGRAMADOS.map((p) => {
        const lista = ejecuciones.get(p.clave) ?? [];
        const ultima = lista[0];
        return (
          <section key={p.clave} className="rounded-md border border-stone-200 bg-white">
            <div className="flex flex-wrap items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-900">
                  {p.nombre}
                  {ultima &&
                    (ultima.ok === null ? (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">
                        <Loader2 className="h-3 w-3" aria-hidden /> En curso
                      </span>
                    ) : ultima.ok ? (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" aria-hidden /> Última ejecución correcta
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                        <XCircle className="h-3 w-3" aria-hidden /> Última ejecución con error
                      </span>
                    ))}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">{p.descripcion}</p>
                <p className="mt-0.5 text-xs text-stone-400">
                  {p.horario} · {ultima ? `última: ${formatearFechaHora(ultima.inicio)}` : "sin ejecuciones registradas"}
                </p>
              </div>
              {p.rutaManual && (
                <form action={p.rutaManual} method="post">
                  <button className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
                    <Play className="h-3.5 w-3.5" aria-hidden /> Ejecutar ahora
                  </button>
                </form>
              )}
            </div>
            {lista.length > 0 && (
              <details className="border-t border-stone-100">
                <summary className="cursor-pointer px-4 py-1.5 text-xs font-medium text-cdmb-700">Historial ({lista.length})</summary>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-t border-stone-100 bg-stone-50 text-left text-stone-500">
                      <th className="px-4 py-1.5 font-medium">Inicio</th>
                      <th className="px-2 py-1.5 font-medium">Origen</th>
                      <th className="px-2 py-1.5 font-medium">Duración</th>
                      <th className="px-2 py-1.5 font-medium">Resultado</th>
                      <th className="px-4 py-1.5 font-medium">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((e) => (
                      <tr key={e.id} className="border-t border-stone-100 align-top">
                        <td className="whitespace-nowrap px-4 py-1.5 text-stone-700">{formatearFechaHora(e.inicio)}</td>
                        <td className="px-2 py-1.5 text-stone-500">{e.origen === "manual" ? "Manual" : "Programado"}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-stone-500">{duracion(e.inicio, e.fin)}</td>
                        <td className="px-2 py-1.5">
                          {e.ok === null ? <span className="text-sky-700">En curso</span> : e.ok ? <span className="text-emerald-700">Correcto</span> : <span className="text-red-700">Con error</span>}
                        </td>
                        <td className="max-w-md truncate px-4 py-1.5 font-mono text-[11px] text-stone-500" title={e.resumen ?? ""}>
                          {e.resumen}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </section>
        );
      })}
    </div>
  );
}
