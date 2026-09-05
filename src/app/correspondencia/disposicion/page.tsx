import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightCircle, Archive, FileWarning } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { getPendientesArchivisticos, listarActasEliminacion } from "@/lib/disposicion-final-data";
import { REQUIERE_ACTA } from "@/lib/disposicion-final";
import { ETIQUETA_DISPOSICION } from "@/lib/trd";
import { Field, SectionHelp } from "@/components/Field";

const fecha = (d: Date | null | undefined) => (d ? d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—");

export default async function DisposicionFinalPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) redirect("/correspondencia");

  const sp = await searchParams;
  const [{ pendientesTransferencia, pendientesDisposicion }, actas] = await Promise.all([
    getPendientesArchivisticos(),
    listarActasEliminacion(),
  ]);

  return (
    <div className="space-y-6">
      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <SectionHelp>
        Toda comunicación clasificada con una subserie (TRD) pasa por tres etapas: se guarda en la oficina que la
        produjo (archivo de <strong>gestión</strong>), luego se transfiere al archivo <strong>central</strong> por
        un tiempo adicional, y al final se ejecuta su <strong>disposición final</strong> (conservarla para siempre,
        eliminarla, seleccionar una muestra, o microfilmarla/digitalizarla) — según lo defina la TRD de su
        subserie. Solo aparecen aquí las comunicaciones cuya subserie ya tiene años de retención configurados.
      </SectionHelp>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <ArrowRightCircle className="h-4 w-4 text-cdmb-600" aria-hidden />
          Pendientes de transferir a archivo central ({pendientesTransferencia.length})
        </h2>
        {pendientesTransferencia.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-400">No hay comunicaciones pendientes de transferir por ahora.</p>
        ) : (
          <div className="space-y-2">
            {pendientesTransferencia.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3">
                <div className="min-w-0">
                  <Link href={`/correspondencia/${c.id}`} className="font-medium text-cdmb-700 hover:underline">{c.radicado}</Link>
                  <p className="truncate text-xs text-stone-500">{c.asunto}</p>
                  <p className="text-[11px] text-stone-400">
                    {c.serie?.codigo} / {c.subserie?.codigo} — cumplió gestión el {fecha(c.fechaFinGestion)}
                  </p>
                </div>
                <form action={`/api/correspondencia/${c.id}/transferir`} method="post">
                  <button type="submit" className="inline-flex flex-none items-center gap-1.5 rounded-md border border-cdmb-600 bg-white px-3 py-1.5 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50">
                    <ArrowRightCircle className="h-3.5 w-3.5" aria-hidden />
                    Marcar transferida
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <FileWarning className="h-4 w-4 text-cdmb-600" aria-hidden />
          Pendientes de disposición final ({pendientesDisposicion.length})
        </h2>
        <SectionHelp>
          Eliminar o seleccionar destruye el original: por eso esas dos exigen indicar quién lo aprueba y quedan con
          un acta formal. Conservar o microfilmar/digitalizar no destruyen nada en este sistema — solo marcan la fecha.
        </SectionHelp>
        {pendientesDisposicion.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-400">No hay comunicaciones pendientes de disposición final por ahora.</p>
        ) : (
          <div className="space-y-2">
            {pendientesDisposicion.map((c) => {
              const disposicion = c.subserie?.disposicionFinal;
              const exigeActa = disposicion ? REQUIERE_ACTA[disposicion] : false;
              return (
                <div key={c.id} className="rounded-xl border border-stone-200 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/correspondencia/${c.id}`} className="font-medium text-cdmb-700 hover:underline">{c.radicado}</Link>
                      <p className="truncate text-xs text-stone-500">{c.asunto}</p>
                      <p className="text-[11px] text-stone-400">
                        {c.serie?.codigo} / {c.subserie?.codigo} — cumplió su retención el {fecha(c.fechaFinCentral)}
                      </p>
                    </div>
                    <span className="flex-none rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                      {disposicion ? ETIQUETA_DISPOSICION[disposicion] : "Sin disposición definida en la TRD"}
                    </span>
                  </div>
                  {!disposicion ? (
                    <p className="mt-2 text-xs text-amber-700">Configure la disposición final de esta subserie en Administración antes de poder ejecutarla.</p>
                  ) : exigeActa ? (
                    <form action={`/api/correspondencia/${c.id}/disponer`} method="post" className="mt-3 grid grid-cols-1 gap-2 border-t border-stone-100 pt-3 sm:grid-cols-3">
                      <Field label="Aprobada por" required help="Nombre de quien autoriza en el comité de archivo.">
                        <input name="responsable" required className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="Motivación" help="Por qué se dispone así este documento.">
                          <input name="motivacion" className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm" />
                        </Field>
                      </div>
                      <div className="sm:col-span-3">
                        <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">
                          <Archive className="h-3.5 w-3.5" aria-hidden />
                          Ejecutar {ETIQUETA_DISPOSICION[disposicion].toLowerCase()} (crea acta)
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form action={`/api/correspondencia/${c.id}/disponer`} method="post" className="mt-3 border-t border-stone-100 pt-3">
                      <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-cdmb-600 bg-white px-3 py-1.5 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50">
                        <Archive className="h-3.5 w-3.5" aria-hidden />
                        Marcar {ETIQUETA_DISPOSICION[disposicion].toLowerCase()}
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-stone-900">Actas de eliminación ({actas.length})</h2>
        <SectionHelp>Historial de qué se ha eliminado o seleccionado, cuándo y quién lo aprobó — evidencia permanente aunque el original ya no exista.</SectionHelp>
        {actas.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-400">Todavía no se ha generado ningún acta.</p>
        ) : (
          <div className="space-y-2">
            {actas.map((a) => (
              <div key={a.id} className="rounded-xl border border-stone-200 bg-white p-3 text-sm">
                <p className="font-medium text-stone-800">Acta N.º {a.numero} — {fecha(a.fecha)}</p>
                <p className="text-xs text-stone-500">Aprobada por {a.responsable}{a.aprobadaPor ? ` (registrada por ${a.aprobadaPor.nombre})` : ""}</p>
                {a.motivacion && <p className="mt-1 text-xs text-stone-600">{a.motivacion}</p>}
                <p className="mt-1 text-xs text-stone-400">
                  {a.comunicaciones.map((c) => c.radicado).join(", ")}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
