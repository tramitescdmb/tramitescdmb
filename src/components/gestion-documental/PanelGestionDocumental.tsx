import Link from "next/link";
import type { ReactNode } from "react";
import { Archive, FolderOpen, FolderTree, Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { Field, SectionHelp } from "@/components/Field";
import { ETIQUETA_NIVEL_ACCESO, CLASE_NIVEL_ACCESO } from "@/lib/nivel-acceso";
import { formatearFechaHora } from "@/lib/fecha";

export type ClasificacionTrd = {
  dependencia: string | null;
  serie: string;
  subserie: string;
  retencion?: string | null;
};

const NIVELES = ["PUBLICA", "CLASIFICADA", "RESERVADA"] as const;

function Seccion({ titulo, icono, tono = "normal", children }: { titulo: string; icono: ReactNode; tono?: "normal" | "aviso"; children: ReactNode }) {
  return (
    <section
      className={
        tono === "aviso" ? "rounded-xl border border-amber-200 bg-amber-50/40 p-4" : "rounded-xl border border-stone-200 bg-white p-4 shadow-soft"
      }
    >
      <h3
        className={`mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${tono === "aviso" ? "text-amber-800" : "text-stone-500"}`}
      >
        {icono}
        {titulo}
      </h3>
      {children}
    </section>
  );
}

export function PanelGestionDocumental({
  accion,
  clasificacion,
  formularioTrd,
  nivelAcceso,
  fundamentoNivelAcceso,
  puedeEditar,
  cerrado,
  cerradoEn,
  cerradoPor,
  fichaSgdea,
  cierre,
  puedeReabrir,
}: {
  accion: string;
  clasificacion: ClasificacionTrd | null;
  formularioTrd?: ReactNode;
  nivelAcceso: string;
  fundamentoNivelAcceso: string | null;
  puedeEditar: boolean;
  cerrado: boolean;
  cerradoEn: Date | null;
  cerradoPor: string | null;
  fichaSgdea: { id: string; numero: string } | null;
  cierre: { descripcion: string; control?: ReactNode; bloqueo?: string | null };
  puedeReabrir: boolean;
}) {
  const editable = puedeEditar && !cerrado;

  return (
    <div id="gestion-documental" className="scroll-mt-4 space-y-4">
      <div
        className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
          cerrado ? "border-stone-300 bg-stone-50 text-stone-700" : "border-emerald-200 bg-emerald-50/50 text-emerald-900"
        }`}
      >
        <span className="flex items-start gap-2">
          {cerrado ? <Lock className="mt-0.5 h-4 w-4 flex-none text-stone-500" aria-hidden /> : <FolderOpen className="mt-0.5 h-4 w-4 flex-none text-emerald-600" aria-hidden />}
          <span>
            {cerrado ? (
              <>
                <strong>Cerrado</strong>
                {cerradoEn && <> el {formatearFechaHora(cerradoEn)}</>}
                {cerradoPor && <> por {cerradoPor}</>} y archivado en el SGDEA. No admite cambios mientras no se reabra.
              </>
            ) : (
              <>
                <strong>Abierto</strong> — en gestión.{fichaSgdea && " Su registro en el archivo del SGDEA figura como reabierto hasta un nuevo cierre."}
              </>
            )}
          </span>
        </span>
        {fichaSgdea && (
          <Link
            prefetch={false}
            href={`/correspondencia/expedientes/${fichaSgdea.id}`}
            className="inline-flex flex-none items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50"
          >
            <Archive className="h-3.5 w-3.5" aria-hidden />
            Ver en el archivo del SGDEA
          </Link>
        )}
      </div>

      <Seccion titulo="Clasificación TRD" icono={<FolderTree className="h-3.5 w-3.5 text-cdmb-600" aria-hidden />}>
        {clasificacion ? (
          <div className="mb-3 text-sm text-stone-700">
            <p className="font-medium text-stone-800">
              {clasificacion.dependencia && <>{clasificacion.dependencia} · </>}
              {clasificacion.serie} · {clasificacion.subserie}
            </p>
            {clasificacion.retencion && <p className="text-xs text-stone-500">{clasificacion.retencion}</p>}
          </div>
        ) : (
          <p className="mb-3 inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">Sin clasificar — requerida para cerrar</p>
        )}
        {editable && formularioTrd}
      </Seccion>

      <Seccion titulo="Nivel de acceso a la información (Ley 1712/2014)" icono={<ShieldCheck className="h-3.5 w-3.5 text-cdmb-600" aria-hidden />}>
        <p className="mb-3 text-sm text-stone-700">
          <span className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CLASE_NIVEL_ACCESO[nivelAcceso] ?? ""}`}>
            {ETIQUETA_NIVEL_ACCESO[nivelAcceso] ?? nivelAcceso}
          </span>
          {fundamentoNivelAcceso && <span className="text-xs text-stone-500">Fundamento: {fundamentoNivelAcceso}</span>}
        </p>
        {editable && (
          <form action={accion} method="post" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="accion" value="nivel-acceso" />
            <div className="min-w-[200px]">
              <Field label="Nivel de acceso" required>
                <select name="nivelAcceso" required defaultValue={nivelAcceso} className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm">
                  {NIVELES.map((n) => (
                    <option key={n} value={n}>
                      {ETIQUETA_NIVEL_ACCESO[n]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="min-w-[260px] flex-1">
              <Field label="Fundamento" help="Obligatorio si es clasificada o reservada.">
                <input name="fundamento" defaultValue={fundamentoNivelAcceso ?? ""} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
              </Field>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Guardar
            </button>
          </form>
        )}
      </Seccion>

      {!cerrado && (
        <Seccion titulo="Cierre del expediente" icono={<Archive className="h-3.5 w-3.5 text-cdmb-600" aria-hidden />}>
          <SectionHelp>{cierre.descripcion}</SectionHelp>
          {cierre.bloqueo && <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{cierre.bloqueo}</p>}
          {cierre.control}
        </Seccion>
      )}

      {cerrado && puedeReabrir && (
        <Seccion titulo="Reabrir expediente" icono={<RotateCcw className="h-3.5 w-3.5" aria-hidden />} tono="aviso">
          <SectionHelp>Vuelve a admitir cambios desde este módulo. Exige motivo y queda en la historia del expediente.</SectionHelp>
          <form action={accion} method="post" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="accion" value="reabrir" />
            <div className="min-w-[260px] flex-1">
              <Field label="Motivo" required>
                <input name="motivo" required className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
              </Field>
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reabrir
            </button>
          </form>
        </Seccion>
      )}
    </div>
  );
}

export function BotonCerrarExpediente({ accion, deshabilitado }: { accion: string; deshabilitado?: boolean }) {
  return (
    <form action={accion} method="post">
      <input type="hidden" name="accion" value="cerrar" />
      <button
        type="submit"
        disabled={deshabilitado}
        className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Archive className="h-3.5 w-3.5" aria-hidden />
        Cerrar y archivar en el SGDEA
      </button>
    </form>
  );
}
