import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Circle, CircleDot, FileText } from "lucide-react";
import { EncabezadoSolicitud } from "@/components/solicitud-ambiental/Encabezado";
import { BotonSalirCiudadano } from "@/components/solicitud-ambiental/CuentaCiudadana";
import { cuentaEnSesion } from "@/lib/cuenta-ciudadana-db";
import { db } from "@/lib/db";
import { formatearFechaHora, formatearFechaLarga as fecha } from "@/lib/fecha";
import { nombreFlujo } from "@/lib/flujo-nombre";
import { estadoPublico, etapaPublica, historialPublico } from "@/lib/solicitud-ambiental";
import { CORREO_VENTANILLA_VIRTUAL } from "@/lib/solicitud-ambiental-db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Detalle de mi solicitud — CDMB" };

function tamano(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function DetalleMiSolicitudPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cuenta = await cuentaEnSesion();
  if (!cuenta) redirect(`/solicitud-ambiental/ingresar?siguiente=${encodeURIComponent(`/solicitud-ambiental/mis-solicitudes/${id}`)}`);
  if (!cuenta.completa) redirect("/solicitud-ambiental/mis-solicitudes");

  // Solo expedientes de esta cuenta: cualquier otro id responde «no encontrado», igual que uno inexistente.
  const e = await db.expediente.findFirst({
    where: { id, cuentaCiudadanaId: cuenta.id },
    select: {
      numero: true,
      codigoSolicitudPublica: true,
      estado: true,
      pasoActualNumero: true,
      fechaRadicacion: true,
      fechaUltimoMovimiento: true,
      fechaCierre: true,
      solicitanteNombre: true,
      municipio: true,
      predioDireccion: true,
      tramiteTipo: { select: { nombre: true } },
      flujo: { select: { nombre: true, pasos: { select: { numero: true, titulo: true }, orderBy: { numero: "asc" } } } },
      eventos: { select: { tipo: true, createdAt: true, pasoNumero: true, estadoAnterior: true, estadoNuevo: true }, orderBy: { createdAt: "asc" } },
      // Solo los documentos que radicó el propio solicitante; los internos (conceptos, actos) no.
      documentos: {
        where: { subidoPor: { email: CORREO_VENTANILLA_VIRTUAL } },
        select: { id: true, nombre: true, tamanoBytes: true, createdAt: true, requisito: { select: { nombre: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!e) notFound();

  const pasos = e.flujo.pasos;
  const estado = estadoPublico(e.estado);
  const etapa = etapaPublica({ ...e, pasos });
  const indiceActual = etapa ? etapa.posicion - 1 : pasos.length;
  const historial = historialPublico(e.eventos, pasos);
  const tipo = nombreFlujo(e.flujo.nombre);
  const requiereAccion = e.estado === "INFORMACION_ADICIONAL_REQUERIDA";

  return (
    <div className="space-y-5">
      <Link href="/solicitud-ambiental/mis-solicitudes" className="text-xs font-medium uppercase tracking-wide text-cdmb-700 hover:underline">
        ← Mis solicitudes
      </Link>
      <EncabezadoSolicitud titulo={e.tramiteTipo.nombre} antetitulo={`Solicitud ${e.codigoSolicitudPublica ?? ""}`} acciones={<BotonSalirCiudadano />}>
        {tipo !== e.tramiteTipo.nombre ? `${tipo} · ` : ""}Expediente {e.numero}
      </EncabezadoSolicitud>

      {requiereAccion && (
        <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          <AlertTriangle className="h-5 w-5 flex-none" aria-hidden />
          <p>
            La CDMB necesita información o documentos adicionales para continuar. Revise el correo o el teléfono que indicó; allí encontrará
            qué debe completar.
          </p>
        </div>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[11px] text-stone-400">Estado</dt>
            <dd className="font-semibold text-stone-900">{estado.etiqueta}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-stone-400">Radicada el</dt>
            <dd className="text-stone-800">{fecha(e.fechaRadicacion)}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-stone-400">{e.fechaCierre ? "Terminada el" : "Último movimiento"}</dt>
            <dd className="text-stone-800">{fecha(e.fechaCierre ?? e.fechaUltimoMovimiento)}</dd>
          </div>
          <div className="sm:col-span-3">
            <dt className="text-[11px] text-stone-400">Lugar</dt>
            <dd className="text-stone-800">
              {e.predioDireccion} · {e.municipio}
            </dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-500">{estado.explicacion}</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft" aria-labelledby="titulo-etapas">
          <h2 id="titulo-etapas" className="text-sm font-semibold text-stone-800">
            Etapas del procedimiento
          </h2>
          <ol className="mt-3 space-y-2">
            {pasos.map((p, i) => {
              const hecho = i < indiceActual;
              const actual = i === indiceActual;
              const Icono = hecho ? CheckCircle2 : actual ? CircleDot : Circle;
              return (
                <li key={p.numero} aria-current={actual ? "step" : undefined} className="flex items-start gap-2 text-sm">
                  <Icono className={`mt-0.5 h-4 w-4 flex-none ${hecho ? "text-cdmb-600" : actual ? "text-acento-500" : "text-stone-300"}`} aria-hidden />
                  <span className={actual ? "font-semibold text-stone-900" : hecho ? "text-stone-600" : "text-stone-400"}>{p.titulo}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft" aria-labelledby="titulo-historial">
          <h2 id="titulo-historial" className="text-sm font-semibold text-stone-800">
            Historial
          </h2>
          <ul className="mt-3 space-y-2">
            {historial.map((h, i) => (
              <li key={i} className="text-sm">
                <span className="block text-[11px] text-stone-400">{formatearFechaHora(h.fecha)}</span>
                <span className="text-stone-800">{h.texto}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-soft" aria-labelledby="titulo-documentos">
        <h2 id="titulo-documentos" className="text-sm font-semibold text-stone-800">
          Documentos que usted radicó
        </h2>
        {e.documentos.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">No hay documentos.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {e.documentos.map((d) => (
              <li key={d.id} className="flex items-start gap-2 py-2 text-sm">
                <FileText className="mt-0.5 h-4 w-4 flex-none text-stone-400" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-stone-800">{d.requisito?.nombre ?? d.nombre}</span>
                  <span className="block text-[11px] text-stone-400">
                    {d.requisito ? `${d.nombre} · ` : ""}
                    {tamano(d.tamanoBytes)} · {fecha(d.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
