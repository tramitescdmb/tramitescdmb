import Link from "next/link";
import { Workflow } from "lucide-react";
import { estadoTerminoPaso, pasosFlujoACargo, type UsuarioFlujo } from "@/lib/flujos";
import { AMBITOS_DE_MODULO, type ModuloFlujo } from "@/lib/flujos-modulos";
import { db } from "@/lib/db";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { formatearFecha } from "@/lib/fecha";
import { ListaTablero, TarjetaTablero, VacioTablero } from "@/components/tablero";

export async function TarjetaPasosACargo({ modulo, usuario, className = "lg:col-span-12" }: { modulo: ModuloFlujo; usuario: UsuarioFlujo; className?: string }) {
  const [pasos, calendario, activos] = await Promise.all([
    pasosFlujoACargo(usuario, modulo),
    getCalendarioLaboral(),
    db.flujoTrabajo.count({ where: { activo: true, ambito: { in: AMBITOS_DE_MODULO[modulo] } } }),
  ]);
  if (pasos.length === 0 && activos === 0) return null;
  return (
    <TarjetaTablero
      id="pasos-flujo"
      className={className}
      icon={Workflow}
      tono="cielo"
      titulo="Pasos de flujo a su cargo"
      descripcion="Tareas de los flujos de trabajo de este módulo que le corresponde completar."
      contador={pasos.length}
      sinRelleno
    >
      {pasos.length === 0 ? (
        <VacioTablero>No tiene pasos de flujo pendientes.</VacioTablero>
      ) : (
        <ListaTablero>
          {pasos.map((i) => {
            const termino = estadoTerminoPaso(i.pasoActualDesde, i.pasoActual?.slaDiasHabiles ?? null, calendario);
            return (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <Link href={i.objetivo.href} className="block truncate font-medium text-stone-800 hover:text-cdmb-700 hover:underline">
                    {i.pasoActual?.nombre} · {i.objetivo.etiqueta}
                  </Link>
                  <span className="block truncate text-xs text-stone-400">
                    {i.flujo.nombre} · {i.objetivo.asunto}
                  </span>
                </div>
                {termino && (
                  <span className={`flex-none text-xs ${termino.vencido ? "font-medium text-red-600" : termino.diasHabiles <= 1 ? "font-medium text-amber-600" : "text-stone-500"}`}>
                    {termino.vencido ? `Vencido hace ${termino.diasHabiles} d. hábil(es)` : `Vence el ${formatearFecha(termino.limite)}`}
                  </span>
                )}
              </li>
            );
          })}
        </ListaTablero>
      )}
    </TarjetaTablero>
  );
}
