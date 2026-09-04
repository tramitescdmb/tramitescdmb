import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, Building2, User, MapPin, Phone, Smartphone, Mail, Home, ReceiptText, BadgeCheck, ClipboardList, CalendarClock, AlertTriangle } from "lucide-react";
import { buscarNits, sincaConfigurado, type SincaNitListado } from "@/lib/sinca";
import { agruparEntidadesNit } from "@/lib/sinca-nit";
import { TOPE_VISTA_TODOS } from "@/lib/vista-lista";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";

function Campo({ k, v }: { k: string; v: string | null }) {
  if (!v) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-tight text-stone-400">{k}</dt>
      <dd className="truncate text-sm text-stone-800" title={v}>
        {v}
      </dd>
    </div>
  );
}

function Tarjeta({ icon: Icon, titulo, children }: { icon: typeof MapPin; titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
        <Icon className="h-3.5 w-3.5 text-cdmb-600" aria-hidden />
        {titulo}
      </h3>
      {children}
    </section>
  );
}

export default async function NitDetallePage({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;

  const session = await getSession();
  if (session) {
    const permisos = await obtenerPermisosUsuario(session.userId);
    if (!puedeAccederSeccion(permisos, "SINCA_BASE")) redirect("/");
  }
  if (!sincaConfigurado()) return null;

  // No existe un endpoint de detalle por NIT (probado en vivo: /presinca/nit/{numero} da 404) —
  // se reconstruye buscando ese número exacto en el mismo listado y agrupando sus filas.
  let filas: SincaNitListado[] = [];
  try {
    const r = await buscarNits({ search: numero, perPage: TOPE_VISTA_TODOS, page: 1 });
    filas = r.data.filter((n) => String(n.numero_nit) === numero);
  } catch {
    filas = [];
  }
  if (filas.length === 0) notFound();

  const idsSolicitud = [...new Set(filas.map((n) => Number(n.nrosolicitud_sol)).filter(Number.isFinite))];
  const disponibles = new Set(
    (await db.sincaResolucion.findMany({ where: { nroSolicitud: { in: idsSolicitud } }, select: { nroSolicitud: true } })).map(
      (r) => r.nroSolicitud
    )
  );
  const entidad = agruparEntidadesNit(filas, disponibles)[0];
  const Icono = entidad.tipoValue === "C" ? User : Building2;

  return (
    <div className="space-y-4">
      <Link href="/historico/nits" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver al listado
      </Link>

      {/* Cabecera */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
              <Icono className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-semibold text-stone-900">{entidad.nombre}</h2>
              <p className="text-sm text-stone-500">
                {entidad.tipoLabel ?? "Identificación"} · <span className="font-medium text-stone-700">{entidad.identificacion}</span>
              </p>
            </div>
          </div>
          {entidad.regimen && (
            <span className="flex-none rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">{entidad.regimen}</span>
          )}
        </div>
      </div>

      {/* Contacto y ubicación */}
      <Tarjeta icon={MapPin} titulo="Contacto y ubicación">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Campo k="Municipio" v={[entidad.municipio, entidad.departamento].filter(Boolean).join(", ") || null} />
          <Campo k="Dirección" v={entidad.direccion} />
          <Campo k="Teléfono" v={entidad.telefono} />
          <Campo k="Celular" v={entidad.celular} />
          <Campo k="Correo electrónico" v={entidad.correo} />
        </dl>
      </Tarjeta>

      {/* Datos tributarios */}
      <Tarjeta icon={ReceiptText} titulo="Datos tributarios">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Campo k="Régimen tributario" v={entidad.regimen} />
          <Campo k="Gran contribuyente" v={entidad.granContribuyente} />
          <Campo k="Autorretenedor" v={entidad.autorretenedor} />
        </dl>
        {!entidad.granContribuyente && !entidad.autorretenedor && !entidad.regimen && (
          <p className="text-sm text-stone-400">SINCA 1.0 no reporta datos tributarios claros para este tercero.</p>
        )}
      </Tarjeta>

      {/* Solicitudes vinculadas */}
      <Tarjeta icon={ClipboardList} titulo={`Solicitudes vinculadas (${entidad.vinculaciones.length})`}>
        {(() => {
          const conDetalle = entidad.vinculaciones.filter((v) => v.tieneDetalle).length;
          // Las que sí tienen detalle van primero, para no tener que buscarlas entre el resto.
          const ordenadas = [...entidad.vinculaciones].sort((a, b) => Number(b.tieneDetalle) - Number(a.tieneDetalle));
          return (
            <>
              {conDetalle > 0 && (
                <p className="mb-2 text-xs text-stone-400">
                  {conDetalle} de {entidad.vinculaciones.length} tienen el detalle completo disponible aquí (resaltadas abajo).
                </p>
              )}
              <ul className="divide-y divide-stone-100">
                {ordenadas.map((v, i) => (
                  <li
                    key={`${v.nroSolicitud}-${i}`}
                    className={`flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm ${
                      v.tieneDetalle ? "bg-cdmb-50" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {v.nroSolicitud && v.tieneDetalle ? (
                        <Link
                          href={`/historico/solicitudes/${v.nroSolicitud}`}
                          className="inline-flex items-center gap-1 rounded-md bg-cdmb-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-cdmb-700"
                        >
                          Ver solicitud {v.nroSolicitud}
                        </Link>
                      ) : (
                        <span className="font-medium text-stone-500" title={v.nroSolicitud ? "Sin resolución de fondo en el histórico" : undefined}>
                          Solicitud {v.nroSolicitud ?? "—"}
                        </span>
                      )}
                    </span>
                    <span className={`text-xs ${v.tieneDetalle ? "text-cdmb-700" : "text-stone-400"}`}>
                      {v.fechaDesde || "—"}
                      {v.fechaHasta ? ` – ${v.fechaHasta}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          );
        })()}
      </Tarjeta>

      {(entidad.actualizado || entidad.actualizadoPor) && (
        <p className="flex items-center gap-1.5 text-xs text-stone-400">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          Actualizado en SINCA 1.0{entidad.actualizado ? ` el ${entidad.actualizado}` : ""}
          {entidad.actualizadoPor ? ` por ${entidad.actualizadoPor}` : ""}.
        </p>
      )}
      <p className="flex items-center gap-1.5 text-xs text-stone-400">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        Esta ficha muestra exactamente lo que reporta SINCA 1.0; algunos campos pueden venir vacíos o desactualizados
        en el sistema de origen.
      </p>
    </div>
  );
}
