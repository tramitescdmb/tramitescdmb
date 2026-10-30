import Link from "next/link";
import { Workflow } from "lucide-react";
import { estadoTerminoPaso, pasosFlujoACargo, ETIQUETA_TIPO_PASO, type UsuarioFlujo } from "@/lib/flujos";
import { AMBITOS_DE_MODULO, type ModuloFlujo } from "@/lib/flujos-modulos";
import { db } from "@/lib/db";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { formatearFecha } from "@/lib/fecha";
import { Chip, ListaTablero, TarjetaTablero, VacioTablero } from "@/components/tablero";

const VISIBLES = 8;

export async function TarjetaPasosACargo({
  modulo,
  usuario,
  className = "lg:col-span-12",
  verTodosHref,
}: {
  modulo: ModuloFlujo;
  usuario: UsuarioFlujo;
  className?: string;
  verTodosHref?: string;
}) {
  const [pasos, calendario, activos] = await Promise.all([
    pasosFlujoACargo(usuario, modulo),
    getCalendarioLaboral(),
    db.flujoTrabajo.count({ where: { activo: true, ambito: { in: AMBITOS_DE_MODULO[modulo] } } }),
  ]);
  if (pasos.length === 0 && activos === 0) return null;
  const ahora = new Date();
  const filas = pasos
    .map((i) => ({ ...i, termino: estadoTerminoPaso(i.pasoActualDesde, i.pasoActual?.slaDiasHabiles ?? null, calendario, ahora) }))
    .sort((a, b) => {
      const rango = (t: typeof a.termino) => (t ? (t.vencido ? 0 : 1) : 2);
      return (
        rango(a.termino) - rango(b.termino) ||
        (a.termino?.vencido ? b.termino!.diasHabiles - a.termino.diasHabiles : (a.termino?.limite.getTime() ?? 0) - (b.termino?.limite.getTime() ?? 0)) ||
        (a.pasoActualDesde?.getTime() ?? 0) - (b.pasoActualDesde?.getTime() ?? 0)
      );
    });
  const vencidos = filas.filter((f) => f.termino?.vencido).length;
  const mostrar = verTodosHref ? filas.slice(0, VISIBLES) : filas;

  return (
    <TarjetaTablero
      id="pasos-flujo"
      className={className}
      icon={Workflow}
      tono="cielo"
      titulo={
        <>
          Pasos de flujo a su cargo
          {vencidos > 0 && <Chip tono="rojo">{vencidos} vencido{vencidos === 1 ? "" : "s"}</Chip>}
        </>
      }
      descripcion="Tareas de los flujos de trabajo de este módulo que le corresponde completar."
      contador={pasos.length}
      accion={
        verTodosHref && filas.length > VISIBLES ? (
          <Link href={verTodosHref} className="font-medium text-cdmb-700 hover:underline">
            Ver todos
          </Link>
        ) : undefined
      }
      sinRelleno
    >
      {filas.length === 0 ? (
        <VacioTablero>No tiene pasos de flujo pendientes.</VacioTablero>
      ) : (
        <ListaTablero>
          {mostrar.map((i) => (
            <li key={i.id} className="relative flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
              {i.termino?.vencido && <span className="absolute inset-y-0 left-0 w-[3px] bg-red-500" aria-hidden />}
              <div className="min-w-0 flex-1">
                <Link href={i.objetivo.href} className="flex min-w-0 items-center gap-2 font-medium text-stone-800 hover:text-cdmb-700 hover:underline">
                  <span className="truncate">
                    {i.pasoActual?.nombre} · {i.objetivo.etiqueta}
                  </span>
                  {i.pasoActual && i.pasoActual.tipo !== "TAREA" && <Chip>{ETIQUETA_TIPO_PASO[i.pasoActual.tipo]}</Chip>}
                </Link>
                <span className="block truncate text-xs text-stone-400">
                  {i.flujo.nombre} · {i.objetivo.asunto}
                  {i.pasoActualDesde ? ` · desde el ${formatearFecha(i.pasoActualDesde)}` : ""}
                </span>
              </div>
              {i.termino && (
                <span className={`flex-none text-xs ${i.termino.vencido ? "font-medium text-red-600" : i.termino.diasHabiles <= 1 ? "font-medium text-amber-600" : "text-stone-500"}`}>
                  {i.termino.vencido ? `Vencido hace ${i.termino.diasHabiles} d. hábil(es)` : `Vence el ${formatearFecha(i.termino.limite)}`}
                </span>
              )}
            </li>
          ))}
        </ListaTablero>
      )}
    </TarjetaTablero>
  );
}
