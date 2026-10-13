import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederContratacion, puedeEditarManualDemostracion } from "@/lib/permisos";
import { asegurarManualDemostracion, parrafos } from "@/lib/manual-demostracion";
import { TituloSeccion } from "@/components/sgdea/ui";
import { BotonImprimir } from "@/components/BotonImprimir";
import { TextoManual } from "@/components/sgdea/TextoManual";
import { EditarApartadoManual } from "@/components/sgdea/EditarApartadoManual";
import { formatearFecha, formatearFechaHora } from "@/lib/fecha";

function numero(orden: number): string {
  return String(orden).padStart(2, "0");
}

export default async function ManualDemostracionGeconPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederContratacion(permisos)) redirect("/");
  const puedeEditar = puedeEditarManualDemostracion(permisos, "GECON");

  await asegurarManualDemostracion("GECON");
  const apartados = await db.apartadoManualDemostracion.findMany({
    where: { modulo: "GECON" },
    orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
    include: { actualizadoPor: { select: { nombre: true } } },
  });
  const ultimaEdicion = apartados.reduce<Date | null>((max, a) => (a.actualizadoEn && (!max || a.actualizadoEn > max) ? a.actualizadoEn : max), null);
  const siguienteOrden = (apartados.at(-1)?.orden ?? 0) + 1;

  return (
    <div className="space-y-4">
      <div className="hidden print:block">
        <h1 className="text-lg font-semibold text-stone-900">Manual de demostración de GECON</h1>
        <p className="text-xs text-stone-500">Corte: {formatearFechaHora(new Date())}</p>
      </div>

      <div className="print:hidden">
        <TituloSeccion
          icon={BookOpen}
          contador={apartados.length}
          accion={
            <div className="flex flex-wrap items-center gap-2">
              <BotonImprimir variante="secundario" />
            </div>
          }
        >
          Manual de demostración
        </TituloSeccion>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-stone-500">
          Recorrido de GECON apartado por apartado, en el orden del ciclo de vida de un contrato: ubicación en la interfaz, pasos, un ejemplo
          resuelto y el fundamento normativo. Apoyo para presentar el módulo ante el comité de contratación o la dirección.
          {ultimaEdicion && <> Última actualización: {formatearFecha(ultimaEdicion)}.</>}
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-soft">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-cdmb-700">Datos de ejemplo usados en el manual</p>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
          <dt className="text-stone-500">Expediente</dt>
          <dd className="text-stone-800">
            <code className="rounded bg-stone-100 px-1 py-0.5 font-mono">CDMB-CTO-2026-000006</code> · código <code className="rounded bg-stone-100 px-1 py-0.5 font-mono">CD-CPS-0001-2026</code> — contrato <code className="rounded bg-stone-100 px-1 py-0.5 font-mono">210-17017-8</code> en SECOP II, contratación directa
          </dd>
          <dt className="text-stone-500">Objeto</dt>
          <dd className="text-stone-800">Servicios profesionales como ingeniero de sistemas al proceso de Tecnologías de la Información — $19.800.000, del 28 de julio al 12 de diciembre de 2026</dd>
          <dt className="text-stone-500">Contratista</dt>
          <dd className="text-stone-800">
            Walid Chakib Halaby Shalaby (C.C. 91509227) — usuario de red <code className="rounded bg-stone-100 px-1 py-0.5 font-mono">walhal01</code>
          </dd>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2 print:hidden">
          <Link prefetch={false} href="/contratacion/ayuda" className="rounded-md border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-700 hover:border-cdmb-300 hover:text-cdmb-700">
            Guía de referencia
          </Link>
          <Link prefetch={false} href="/contratacion/contratistas" className="rounded-md border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-700 hover:border-cdmb-300 hover:text-cdmb-700">
            Contratistas
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr] lg:items-start">
        <nav aria-label="Apartados del manual" className="hidden lg:sticky lg:top-16 lg:block print:hidden">
          <ol className="space-y-0.5 text-xs">
            {apartados.map((a) => (
              <li key={a.id}>
                <a href={`#apartado-${a.orden}`} className="grid grid-cols-[1.6rem_1fr] gap-1 rounded-md px-1.5 py-1 text-stone-600 hover:bg-white hover:text-stone-900">
                  <span className="font-mono text-[10px] text-stone-400">{numero(a.orden)}</span>
                  <span className="leading-snug">{a.tituloIndice}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-4">
          {apartados.map((a) => {
            const ejemplo = parrafos(a.ejemplo);
            const detalle = parrafos(a.detalle);
            return (
              <section key={a.id} id={`apartado-${a.orden}`} className="scroll-mt-16 rounded-xl border border-stone-200 bg-white p-4 shadow-soft">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-sm font-semibold text-cdmb-600">{numero(a.orden)}</span>
                  <span className="rounded border border-stone-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-stone-500">{a.etiqueta}</span>
                  <h2 className="text-[15px] font-semibold text-stone-900">{a.titulo}</h2>
                </div>
                {a.ubicacion && (
                  <p className="mt-1.5 text-[11px] text-stone-500">
                    Ubicación: <TextoManual texto={a.ubicacion} />
                  </p>
                )}
                <p className="mt-2 text-xs leading-relaxed text-stone-600">
                  <TextoManual texto={a.resumen} />
                </p>

                {a.pasos.length > 0 && (
                  <div className="mt-3 rounded-lg border border-stone-200">
                    <p className="border-b border-stone-100 bg-stone-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">Procedimiento</p>
                    <ol className="list-decimal space-y-1.5 py-2.5 pl-8 pr-3 text-xs leading-relaxed text-stone-700 marker:font-mono marker:text-[11px] marker:text-cdmb-600">
                      {a.pasos.map((p, i) => (
                        <li key={i}>
                          <TextoManual texto={p} />
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {ejemplo.length > 0 && (
                  <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50/60">
                    <p className="border-b border-amber-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Ejemplo</p>
                    <div className="space-y-1.5 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
                      {ejemplo.map((p, i) => (
                        <p key={i}>
                          <TextoManual texto={p} />
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {(detalle.length > 0 || a.fundamento) && (
                  <div className="mt-2.5 rounded-lg border border-stone-200">
                    <p className="border-b border-stone-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">En detalle</p>
                    <div className="space-y-1.5 px-3 py-2.5 text-xs leading-relaxed text-stone-600">
                      {detalle.map((p, i) => (
                        <p key={i}>
                          <TextoManual texto={p} />
                        </p>
                      ))}
                      {a.fundamento && (
                        <p className="border-t border-dashed border-stone-200 pt-2 text-[11px] text-stone-500">
                          <strong className="font-semibold text-stone-700">Fundamento normativo:</strong> <TextoManual texto={a.fundamento} />
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {a.actualizadoEn && (
                  <p className="mt-2 text-[10px] text-stone-400">
                    Editado el {formatearFechaHora(a.actualizadoEn)}
                    {a.actualizadoPor && <> por {a.actualizadoPor.nombre}</>}
                  </p>
                )}
                {puedeEditar && (
                  <div className="mt-2">
                    <EditarApartadoManual
                      modulo="GECON"
                      key={`${a.id}-${a.actualizadoEn?.getTime() ?? 0}`}
                      apartado={{
                        id: a.id,
                        orden: a.orden,
                        etiqueta: a.etiqueta,
                        titulo: a.titulo,
                        tituloIndice: a.tituloIndice,
                        ubicacion: a.ubicacion,
                        resumen: a.resumen,
                        pasos: a.pasos,
                        ejemplo: a.ejemplo,
                        detalle: a.detalle,
                        fundamento: a.fundamento,
                      }}
                    />
                  </div>
                )}
              </section>
            );
          })}

          {puedeEditar && (
            <EditarApartadoManual
              modulo="GECON"
              key={`nuevo-${siguienteOrden}`}
              apartado={{
                orden: siguienteOrden,
                etiqueta: "",
                titulo: "",
                tituloIndice: "",
                ubicacion: "",
                resumen: "",
                pasos: [],
                ejemplo: "",
                detalle: "",
                fundamento: "",
              }}
            />
          )}

          <p className="text-[11px] text-stone-400">
            Documento interno de la CDMB. No sustituye la guía de referencia ni el Manual A-BS-MA01.
          </p>
        </div>
      </div>
    </div>
  );
}
