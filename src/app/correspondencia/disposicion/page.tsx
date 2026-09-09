import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightCircle, FileWarning, Clock, CheckCircle2, PackageCheck } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { getPendientesArchivisticos, listarActasEliminacion, getDisposicionesAplazadas, listarTransferenciasCentral } from "@/lib/disposicion-final-data";
import { algunaRequiereActa } from "@/lib/disposicion-final";
import { ETIQUETA_DISPOSICION } from "@/lib/trd";
import { Field, SectionHelp } from "@/components/Field";
import { DisposicionLoteForm, type ItemDisposicionPendiente } from "@/components/DisposicionLoteForm";
import { formatearFecha as fecha } from "@/lib/fecha";
import { registrarAccesoDenegadoSeccion } from "@/lib/auditoria-doc";
import { headers } from "next/headers";

export default async function DisposicionFinalPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    await registrarAccesoDenegadoSeccion("Disposición final", session, await headers());
    redirect("/correspondencia");
  }

  const sp = await searchParams;
  const [{ pendientesTransferencia, pendientesDisposicion, transferidasSinConfirmar }, actas, aplazadas, transferencias] = await Promise.all([
    getPendientesArchivisticos(),
    listarActasEliminacion(),
    getDisposicionesAplazadas(),
    listarTransferenciasCentral(),
  ]);
  const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const itemsDisposicion: ItemDisposicionPendiente[] = pendientesDisposicion.map((c) => {
    const disposiciones = c.subserie?.disposicionesFinal ?? [];
    return {
      id: c.id,
      radicado: c.radicado,
      asunto: c.asunto,
      serieSubserie: `${c.serie?.codigo ?? "—"} / ${c.subserie?.codigo ?? "—"}`,
      serieLabel: c.serie ? `${c.serie.codigo} — ${c.serie.nombre}` : "Sin serie",
      subserieLabel: c.subserie ? `${c.subserie.codigo} — ${c.subserie.nombre}` : "Sin subserie",
      fechaFinCentral: fecha(c.fechaFinCentral),
      etiquetas: disposiciones.map((d) => ETIQUETA_DISPOSICION[d]).join(" + "),
      exigeActa: algunaRequiereActa(disposiciones),
      sinDisposicionDefinida: disposiciones.length === 0,
    };
  });

  return (
    <div className="space-y-6">
      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      <SectionHelp>
        Ciclo archivístico: <strong>gestión</strong> → <strong>archivo central</strong> →{" "}
        <strong>disposición final</strong> (conservación, eliminación, selección o microfilmación/digitalización),
        según la TRD de cada subserie. Solo se listan comunicaciones con retención configurada.
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
          <PackageCheck className="h-4 w-4 text-cdmb-600" aria-hidden />
          Transferidas — pendientes de confirmar recepción ({transferidasSinConfirmar.length})
        </h2>
        <SectionHelp>
          Una transferencia registrada se <strong>conserva</strong> hasta que el archivo central confirme que
          recibió el documento y el proceso concluyó (MoReq 2.17). Mientras no se confirme, no avanza a
          disposición final aunque ya haya cumplido su retención.
        </SectionHelp>
        {transferidasSinConfirmar.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-400">No hay transferencias pendientes de confirmar recepción.</p>
        ) : (
          <div className="space-y-2">
            {transferidasSinConfirmar.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3">
                <div className="min-w-0">
                  <Link href={`/correspondencia/${c.id}`} className="font-medium text-cdmb-700 hover:underline">{c.radicado}</Link>
                  <p className="truncate text-xs text-stone-500">{c.asunto}</p>
                  <p className="text-[11px] text-stone-400">
                    {c.serie?.codigo} / {c.subserie?.codigo} — transferida el {fecha(c.transferidaCentralEn)}
                  </p>
                </div>
                <form action={`/api/correspondencia/${c.id}/confirmar-transferencia`} method="post">
                  <button type="submit" className="inline-flex flex-none items-center gap-1.5 rounded-md border border-cdmb-600 bg-white px-3 py-1.5 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    Confirmar recepción
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
          Eliminación y selección destruyen el original: exigen responsable aprobador y quedan con acta formal (una
          sola por lote). Conservación y microfilmación/digitalización solo registran la fecha.
        </SectionHelp>
        {itemsDisposicion.length === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-400">No hay comunicaciones pendientes de disposición final por ahora.</p>
        ) : (
          <>
            <DisposicionLoteForm items={itemsDisposicion} />
            <details className="group rounded-xl border border-dashed border-stone-300 bg-stone-50/60 p-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-stone-700 [&::-webkit-details-marker]:hidden">
                <Clock className="h-4 w-4 text-stone-500" aria-hidden />
                Aplazar la disposición de una en particular
              </summary>
              <SectionHelp>
                Para posponer una disposición ya vencida — ej. un proceso judicial en curso. Exige motivo y
                queda auditado.
              </SectionHelp>
              {itemsDisposicion.map((it) => (
                <form
                  key={it.id}
                  action={`/api/correspondencia/${it.id}/aplazar-disposicion`}
                  method="post"
                  className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-stone-200 bg-white p-3 sm:grid-cols-[1fr_auto_auto]"
                >
                  <div className="min-w-0 self-center">
                    <p className="truncate text-sm font-medium text-stone-800">{it.radicado}</p>
                    <p className="truncate text-xs text-stone-500">{it.asunto}</p>
                  </div>
                  <Field label="Hasta">
                    <input type="date" name="hasta" min={manana} required className="rounded-md border border-stone-300 px-2 py-1.5 text-sm" />
                  </Field>
                  <Field label="Motivo">
                    <input type="text" name="motivo" required placeholder="Motivo del aplazamiento" className="w-56 rounded-md border border-stone-300 px-2 py-1.5 text-sm" />
                  </Field>
                  <button type="submit" className="sm:col-span-3 justify-self-start rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
                    Aplazar
                  </button>
                </form>
              ))}
            </details>
          </>
        )}
      </section>

      {aplazadas.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
            <Clock className="h-4 w-4 text-cdmb-600" aria-hidden />
            Disposiciones aplazadas ({aplazadas.length})
          </h2>
          <div className="space-y-2">
            {aplazadas.map((c) => (
              <div key={c.id} className="rounded-xl border border-stone-200 bg-white p-3">
                <Link href={`/correspondencia/${c.id}`} className="font-medium text-cdmb-700 hover:underline">{c.radicado}</Link>
                <p className="truncate text-xs text-stone-500">{c.asunto}</p>
                <p className="mt-1 text-[11px] text-stone-400">
                  Aplazada hasta {fecha(c.disposicionAplazadaHasta)} — {c.motivoAplazamiento}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
          <ArrowRightCircle className="h-4 w-4 text-cdmb-600" aria-hidden />
          Transferencias a archivo central ({transferencias.total})
        </h2>
        <SectionHelp>
          Estado de cada transferencia registrada (MoReq 2.16): {transferencias.confirmadas} con recepción
          confirmada, {transferencias.sinConfirmar} pendientes de confirmar.
        </SectionHelp>
        {transferencias.total === 0 ? (
          <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-400">Todavía no se ha registrado ninguna transferencia al archivo central.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-400">
                  <th className="px-3 py-2 font-medium">Radicado</th>
                  <th className="px-3 py-2 font-medium">Serie / subserie</th>
                  <th className="px-3 py-2 font-medium">Transferida</th>
                  <th className="px-3 py-2 font-medium">Recepción confirmada</th>
                </tr>
              </thead>
              <tbody>
                {transferencias.filas.map((t) => (
                  <tr key={t.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-3 py-2">
                      <Link href={`/correspondencia/${t.id}`} className="font-medium text-cdmb-700 hover:underline">{t.radicado}</Link>
                      <p className="truncate text-xs text-stone-400">{t.asunto}</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-stone-500">{t.serie?.codigo ?? "—"} / {t.subserie?.codigo ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-stone-600">{fecha(t.transferidaCentralEn)}</td>
                    <td className="px-3 py-2 text-xs">
                      {t.transferenciaConfirmadaEn ? (
                        <span className="text-green-700">
                          {fecha(t.transferenciaConfirmadaEn)}
                          {t.transferenciaConfirmadaPor ? ` · ${t.transferenciaConfirmadaPor.nombre}` : ""}
                        </span>
                      ) : (
                        <span className="text-amber-700">Pendiente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-stone-900">Actas de eliminación ({actas.length})</h2>
        <SectionHelp>Historial de eliminaciones y selecciones ejecutadas, con responsable y fecha.</SectionHelp>
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
