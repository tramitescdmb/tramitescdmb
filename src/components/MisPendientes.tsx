import Link from "next/link";
import { CheckCircle2, FolderOpen, Scale, ClipboardList, Paperclip, AlertTriangle, ClipboardCheck, CalendarClock, CalendarX, RotateCcw, CalendarPlus } from "lucide-react";
import type { ItemPendiente, ResumenPendientes } from "@/lib/pendientes";
import type { AlertaVisita, ResumenVisitas } from "@/lib/pendientes-visitas";

const TOPE_LISTA = 5;

export function MisPendientes({ resumen, visitas }: { resumen: ResumenPendientes | null; visitas?: ResumenVisitas | null }) {
  if (!resumen) return null;

  if (!resumen.hayAlgo && !visitas?.hayAlgo) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white shadow-soft p-4">
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
    <div className="rounded-xl border border-stone-200 bg-white shadow-soft">
      <div className="border-b border-stone-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-stone-900">Sus pendientes</h2>
        <p className="text-xs text-stone-500">
          Lo que requiere su atención según su cargo y los expedientes asignados a su nombre.
          {resumen.esAdmin && " Como administrador, ve además todas las decisiones e informaciones adicionales pendientes de la entidad."}
        </p>
      </div>

      <div className="divide-y divide-stone-100">
        {visitas && (
          <>
            <SeccionVisitas
              Icono={ClipboardCheck}
              clase="bg-red-50 text-red-600"
              titulo="Visitas por registrar"
              ayuda="Visitas suyas cuya fecha ya pasó: registre la hoja de visita o indique que no se pudo realizar."
              items={visitas.porRegistrar}
            />
            <SeccionVisitas
              Icono={CalendarClock}
              clase="bg-sky-50 text-sky-600"
              titulo="Sus próximas visitas técnicas"
              ayuda="Visitas programadas a su nombre para los próximos 7 días."
              items={visitas.proximas}
            />
            <SeccionVisitas
              Icono={CalendarX}
              clase="bg-orange-50 text-orange-600"
              titulo="Visitas del equipo sin registrar"
              ayuda="Visitas vencidas de otros profesionales que aún no tienen hoja de visita."
              items={visitas.equipoVencidas}
            />
            <SeccionVisitas
              Icono={RotateCcw}
              clase="bg-amber-50 text-amber-600"
              titulo="Visitas por reprogramar"
              ayuda="La última visita no se pudo realizar y no hay una nueva programada."
              items={visitas.porReprogramar}
            />
            <SeccionVisitas
              Icono={CalendarPlus}
              clase="bg-violet-50 text-violet-600"
              titulo="Trámites en paso de visita sin programar"
              ayuda="El procedimiento está en el paso de programar o realizar la visita y no hay ninguna programada."
              items={visitas.sinProgramar}
            />
          </>
        )}
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

function SeccionVisitas({
  Icono,
  clase,
  titulo,
  ayuda,
  items,
}: {
  Icono: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  clase: string;
  titulo: string;
  ayuda: string;
  items: AlertaVisita[];
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
            <li key={`${it.visitaId ?? it.expedienteId}-${i}`} className="text-sm">
              <Link
                href={it.visitaId ? `/expedientes/${it.expedienteId}/visitas/${it.visitaId}` : `/expedientes/${it.expedienteId}#planeador`}
                className="font-medium text-cdmb-700 hover:underline"
              >
                {it.numero}
              </Link>{" "}
              <span className="text-stone-600">· {it.tramite}</span>{" "}
              <span className={it.destacada ? "rounded bg-amber-100 px-1 font-medium text-amber-900" : "text-stone-400"}>— {it.texto}</span>
            </li>
          ))}
        </ul>
        {restantes > 0 && (
          <Link href="/planeador" className="mt-1.5 inline-block text-xs text-cdmb-700 hover:underline">
            y {restantes} más en el Planeador
          </Link>
        )}
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
