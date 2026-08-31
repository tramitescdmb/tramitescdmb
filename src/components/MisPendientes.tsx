import Link from "next/link";
import { CheckCircle2, FolderOpen, Scale, ClipboardList, Paperclip, AlertTriangle } from "lucide-react";
import type { ItemPendiente, ResumenPendientes } from "@/lib/pendientes";

/**
 * Tarjeta de "Sus pendientes" en el panel de inicio. Le dice al funcionario,
 * apenas entra, qué requiere su atención — según su cargo y las asignaciones
 * a su nombre (ver `src/lib/pendientes.ts`). Si no tiene nada, muestra un
 * mensaje de "al día" en vez de esconderse, para que quede claro que la
 * revisión se hizo y no que falló.
 */

const TOPE_LISTA = 5;

export function MisPendientes({ resumen }: { resumen: ResumenPendientes | null }) {
  if (!resumen) return null;

  if (!resumen.hayAlgo) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-stone-900">Está al día</p>
          <p className="text-sm text-stone-500">
            No hay expedientes asignados a su nombre ni pasos que le correspondan por su cargo en este momento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-stone-900">Sus pendientes</h2>
        <p className="text-xs text-stone-500">
          Lo que requiere su atención según su cargo y los expedientes asignados a su nombre.
          {resumen.esAdmin && " Como administrador, ve además todas las decisiones e informaciones adicionales pendientes de la entidad."}
        </p>
      </div>

      <div className="divide-y divide-stone-100">
        {resumen.asignadosTotal > 0 && (
          <div className="flex items-center gap-3 px-5 py-3">
            <IconoSeccion Icono={FolderOpen} clase="bg-cdmb-50 text-cdmb-600" />
            <p className="flex-1 text-sm text-stone-700">
              <strong className="font-semibold text-stone-900">{resumen.asignadosTotal}</strong>{" "}
              {resumen.asignadosTotal === 1 ? "expediente activo asignado" : "expedientes activos asignados"} a su nombre o a su cargo.
            </p>
            <Link href="/expedientes?asignados=mi" className="flex-none text-xs font-medium text-cdmb-700 hover:underline">
              Ver la lista
            </Link>
          </div>
        )}

        <Seccion
          Icono={Scale}
          clase="bg-violet-50 text-violet-600"
          titulo="Requieren una decisión"
          ayuda="Pasos de decisión (aprobar / negar / devolver) cuyo responsable, según el procedimiento, es su cargo."
          items={resumen.decisiones}
        />

        <Seccion
          Icono={ClipboardList}
          clase="bg-blue-50 text-blue-600"
          titulo="Pasos por completar"
          ayuda="El expediente está detenido en un paso que le corresponde gestionar y marcar como completado."
          items={resumen.gestionPaso}
        />

        <Seccion
          Icono={Paperclip}
          clase="bg-amber-50 text-amber-600"
          titulo="Documentos por cargar"
          ayuda="Documentos que el procedimiento exige en el paso actual y que aún no se han adjuntado."
          items={resumen.documentos}
          conDetalle
        />

        <Seccion
          Icono={AlertTriangle}
          clase="bg-orange-50 text-orange-600"
          titulo="Con información adicional requerida"
          ayuda="Expedientes en espera de que el solicitante aporte lo que se le pidió."
          items={resumen.informacionAdicional}
        />
      </div>
    </div>
  );
}

function IconoSeccion({
  Icono,
  clase,
}: {
  Icono: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  clase: string;
}) {
  return (
    <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${clase}`}>
      <Icono className="h-[18px] w-[18px]" aria-hidden />
    </span>
  );
}

function Seccion({
  Icono,
  clase,
  titulo,
  ayuda,
  items,
  conDetalle,
}: {
  Icono: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  clase: string;
  titulo: string;
  ayuda: string;
  items: ItemPendiente[];
  conDetalle?: boolean;
}) {
  if (items.length === 0) return null;
  const visibles = items.slice(0, TOPE_LISTA);
  const restantes = items.length - visibles.length;

  return (
    <div className="flex gap-3 px-5 py-3">
      <IconoSeccion Icono={Icono} clase={clase} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-900">
          {titulo} <span className="text-stone-400">({items.length})</span>
        </p>
        <p className="text-xs text-stone-500">{ayuda}</p>
        <ul className="mt-2 space-y-1.5">
          {visibles.map((it, i) => (
            <li key={`${it.expedienteId}-${conDetalle ? it.detalle : ""}-${i}`} className="text-sm">
              <Link href={`/expedientes/${it.expedienteId}`} className="font-medium text-cdmb-700 hover:underline">
                {it.numero}
              </Link>{" "}
              <span className="text-stone-600">
                {conDetalle && it.detalle ? (
                  <>— {it.detalle} <span className="text-stone-400">(paso {it.pasoNumero})</span></>
                ) : (
                  <>
                    · {it.tramiteNombre}{" "}
                    <span className="text-stone-400">
                      — paso {it.pasoNumero}: {it.pasoTitulo}
                    </span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
        {restantes > 0 && (
          <p className="mt-1.5 text-xs text-stone-400">y {restantes} {restantes === 1 ? "más" : "más"}…</p>
        )}
      </div>
    </div>
  );
}
