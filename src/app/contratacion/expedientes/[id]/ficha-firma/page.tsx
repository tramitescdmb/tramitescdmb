import { notFound, redirect } from "next/navigation";
import { FileSignature, ShieldCheck, Eye } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeVerExpedienteContractual, tieneFirmaOSolicitudEnDocumentoContrato } from "@/lib/permisos";
import Link from "next/link";
import { etiquetaFormatoFirma } from "@/lib/firma-proveedor";
import { identidadFirmante } from "@/lib/contratacion";
import { formatearFechaHoraLarga } from "@/lib/fecha";
import { ordenarPorCalidad, rotuloCalidadFirma } from "@/lib/calidad-firma";
import { BotonImprimir } from "@/components/BotonImprimir";

export default async function FichaFirmaExpedienteContractualPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ documento?: string }>;
}) {
  const { id } = await params;
  const { documento: documentoId } = await searchParams;
  const session = await getSession();
  if (!session) redirect(`/login?next=/contratacion/expedientes/${id}/ficha-firma`);
  const permisos = await obtenerPermisosUsuario(session.userId);

  const expediente = await db.expedienteContractual.findUnique({
    where: { id },
    select: {
      numero: true,
      objeto: true,
      contratistaId: true,
      dependenciaSolicitanteId: true,
      documentos: {
        where: {
          AND: [
            { OR: [{ firmas: { some: {} } }, { solicitudesFirma: { some: { rol: "VISTO_BUENO", estado: "COMPLETADA" } } }] },
            ...(documentoId ? [{ id: documentoId }] : []),
          ],
        },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          nombre: true,
          firmas: {
            orderBy: { fechaHora: "asc" },
            include: {
              usuario: {
                select: {
                  nombre: true,
                  cedulaONit: true,
                  correoNotificacion: true,
                  denominacionEmpleo: true,
                  contratista: { select: { identificacion: true, contactoEmail: true } },
                },
              },
            },
          },
          solicitudesFirma: {
            where: { rol: "VISTO_BUENO", estado: "COMPLETADA" },
            orderBy: { completadoEn: "asc" },
            include: {
              usuarioAsignado: {
                select: {
                  nombre: true,
                  cedulaONit: true,
                  correoNotificacion: true,
                  denominacionEmpleo: true,
                  contratista: { select: { identificacion: true, contactoEmail: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!expediente) notFound();
  const veExpediente = puedeVerExpedienteContractual(permisos, { id, contratistaId: expediente.contratistaId, dependenciaSolicitanteId: expediente.dependenciaSolicitanteId });
  if (!veExpediente && !(documentoId && expediente.documentos.length > 0 && (await tieneFirmaOSolicitudEnDocumentoContrato(session.userId, documentoId)))) {
    redirect("/contratacion");
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-stone-900">
          <FileSignature className="h-5 w-5 text-cdmb-600" aria-hidden />
          Ficha técnica de firmas
        </h1>
        <BotonImprimir variante="secundario">Descargar / imprimir</BotonImprimir>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="font-mono text-sm text-stone-500">{expediente.numero}</p>
        <p className="mt-0.5 text-base font-medium text-stone-900">{expediente.objeto}</p>
        {documentoId && veExpediente && (
          <p className="mt-1 text-xs text-stone-500 print:hidden">
            Ficha de un solo documento.{" "}
            <Link href={`/contratacion/expedientes/${id}/ficha-firma`} className="text-cdmb-700 hover:underline">
              Ver la ficha de todo el expediente
            </Link>
          </p>
        )}

        {expediente.documentos.length === 0 ? (
          <p className="mt-4 text-sm text-stone-400">Este expediente todavía no tiene ningún documento firmado.</p>
        ) : (
          <>
            <p className="mt-4 text-xs text-stone-500">
              {expediente.documentos.length} documento{expediente.documentos.length === 1 ? "" : "s"} firmado
              {expediente.documentos.length === 1 ? "" : "s"} ·{" "}
              {expediente.documentos.reduce((acc, d) => acc + d.firmas.length + d.solicitudesFirma.length, 0)} firma(s)
              y visto(s) bueno(s) en total
            </p>
            {expediente.documentos.length > 3 && (
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-b border-stone-100 pb-3 text-xs print:hidden">
                {expediente.documentos.map((doc) => (
                  <li key={doc.id}>
                    <a href={`#doc-${doc.id}`} className="text-cdmb-700 hover:underline">
                      {doc.nombre}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          <div className="mt-4 space-y-5">
            {expediente.documentos.map((doc) => (
              <div key={doc.id} id={`doc-${doc.id}`} className="scroll-mt-4">
                <p className="mb-1.5 text-sm font-semibold text-stone-800">{doc.nombre}</p>
                <ul className="space-y-3">
                  {ordenarPorCalidad(doc.firmas, (f) => f.calidad).map((f) => {
                    const identidad = identidadFirmante(f.usuario);
                    return (
                    <li key={f.id} className="rounded-lg border border-stone-100 bg-stone-50/60 p-3 text-sm">
                      <p className="flex items-center gap-1.5 font-medium text-stone-900">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                        {f.usuario.nombre}
                        {f.usuario.denominacionEmpleo && <span className="font-normal text-stone-500"> — {f.usuario.denominacionEmpleo}</span>}
                        {rotuloCalidadFirma(f.calidad) && (
                          <span className="rounded-full bg-cdmb-50 px-1.5 py-0.5 text-[10px] font-medium text-cdmb-700">{rotuloCalidadFirma(f.calidad)}</span>
                        )}
                      </p>
                      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                        <Dato k="Cédula o NIT" v={identidad.cedulaONit ?? "no registrada"} mono />
                        <Dato k="Correo de notificación" v={identidad.correoNotificacion ?? "no registrado"} />
                        <Dato k="Fecha y hora" v={formatearFechaHoraLarga(f.fechaHora)} />
                        <Dato k="Algoritmo / formato" v={etiquetaFormatoFirma(f.formato)} />
                        <Dato k="Proveedor" v={f.proveedor} />
                        <Dato k="Hash SHA-256 del contenido" v={f.hashContenido} mono />
                        <Dato k="Dirección IP" v={f.ip ?? "no disponible"} mono />
                        <Dato k="Agente de usuario" v={f.userAgent ?? "no disponible"} mono />
                        <Dato k="Identificador de la firma" v={f.id} mono />
                        {f.selloTiempoEn && <Dato k="Sello de tiempo" v={`${formatearFechaHoraLarga(f.selloTiempoEn)} — ${f.selloTiempoFuente ?? ""}`} />}
                        {f.selloTiempoToken && <Dato k="Token RFC-3161" v={f.selloTiempoToken} mono />}
                      </dl>
                    </li>
                    );
                  })}
                  {doc.solicitudesFirma.map((s) => {
                    const identidadVb = identidadFirmante(s.usuarioAsignado);
                    return (
                    <li key={s.id} className="rounded-lg border border-sky-100 bg-sky-50/50 p-3 text-sm">
                      <p className="flex items-center gap-1.5 font-medium text-stone-900">
                        <Eye className="h-3.5 w-3.5 text-sky-600" aria-hidden />
                        {s.usuarioAsignado.nombre}
                        {s.usuarioAsignado.denominacionEmpleo && <span className="font-normal text-stone-500"> — {s.usuarioAsignado.denominacionEmpleo}</span>}
                        <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">Visto bueno</span>
                      </p>
                      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                        <Dato k="Cédula o NIT" v={identidadVb.cedulaONit ?? "no registrada"} mono />
                        <Dato k="Correo de notificación" v={identidadVb.correoNotificacion ?? "no registrado"} />
                        <Dato k="Fecha y hora" v={s.completadoEn ? formatearFechaHoraLarga(s.completadoEn) : "—"} />
                        <Dato k="Dirección IP" v={s.ip ?? "no disponible"} mono />
                        <Dato k="Agente de usuario" v={s.userAgent ?? "no disponible"} mono />
                        <Dato k="Identificador" v={s.id} mono />
                      </dl>
                    </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          </>
        )}

        <p className="mt-4 border-t border-stone-100 pt-3 text-[11px] leading-relaxed text-stone-400">
          Firma electrónica conforme a la Ley 527 de 1999 (art. 7) y el Decreto 1074 de 2015 — hash SHA-256,
          identidad del firmante y sello de tiempo. Documento de uso interno; contiene datos personales
          (Ley 1581 de 2012), no debe publicarse sin control de acceso.
        </p>
      </div>
    </section>
  );
}

function Dato({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-stone-400">{k}</dt>
      <dd className={`break-all text-stone-800 ${mono ? "font-mono text-[11px]" : ""}`}>{v}</dd>
    </div>
  );
}
