import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Briefcase, QrCode, Wallet, CalendarDays, Building2, UserCog, User, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import {
  obtenerPermisosUsuario,
  puedeVerExpedienteContractual,
  puedeSubirDocumentoContrato,
  puedeFirmarDocumentoContrato,
  puedeEditarSinTrazaDocumentoContrato,
  puedeAprobarEtapaContratacion,
} from "@/lib/permisos";
import { ETAPAS_ORDEN, ETIQUETA_ETAPA, ETIQUETA_MODALIDAD } from "@/lib/contratacion";
import { CATEGORIAS_SUGERIDAS } from "@/lib/contratacion-categorias";
import { etiquetaFormatoFirma } from "@/lib/firma-proveedor";
import { formatearFecha, formatearFechaHora } from "@/lib/fecha";
import { TituloSeccion } from "@/components/sgdea/ui";
import { VistaPreviaDocumento } from "@/components/VistaPreviaDocumento";
import { SubirDocumentosContratoForm } from "@/components/SubirDocumentosContratoForm";
import { FirmarRechazarDocumentoContrato, EditarEliminarDocumentoContrato } from "@/components/AccionesDocumentoContrato";
import { AprobarEtapaContratoBoton } from "@/components/AprobarEtapaContratoBoton";

const ETIQUETA_ESTADO_VALIDACION: Record<string, string> = {
  PENDIENTE: "Pendiente de revisión",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};
const CLASE_ESTADO_VALIDACION: Record<string, string> = {
  PENDIENTE: "bg-amber-50 text-amber-700",
  APROBADO: "bg-emerald-50 text-emerald-700",
  RECHAZADO: "bg-red-50 text-red-700",
};

export default async function DetalleExpedienteContractualPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);

  const expediente = await db.expedienteContractual.findUnique({
    where: { id },
    include: {
      dependenciaSolicitante: { select: { nombre: true } },
      contratista: { select: { nombreORazonSocial: true, identificacion: true } },
      supervisores: { include: { usuario: { select: { nombre: true } } } },
      etapas: true,
      documentos: {
        orderBy: { createdAt: "asc" },
        include: { subidoPor: { select: { nombre: true } }, firma: true },
      },
    },
  });
  if (!expediente) notFound();
  if (!puedeVerExpedienteContractual(permisos, expediente)) redirect("/contratacion");

  const puedeAprobar = puedeAprobarEtapaContratacion(permisos);
  const idxActual = ETAPAS_ORDEN.indexOf(expediente.etapaActual);
  const siguienteEtapa = !expediente.cerrado && idxActual < ETAPAS_ORDEN.length - 1 ? ETAPAS_ORDEN[idxActual + 1] : null;
  const esUltimaEtapa = idxActual === ETAPAS_ORDEN.length - 1;

  return (
    <section className="space-y-5">
      <TituloSeccion icon={Briefcase}>
        <span className="font-mono text-base">{expediente.numero}</span>
      </TituloSeccion>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-2xl text-sm text-stone-800">{expediente.objeto}</p>
          <Link
            href={`/contratacion/expedientes/${id}/rotulo`}
            className="inline-flex flex-none items-center gap-1.5 rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            <QrCode className="h-3.5 w-3.5" aria-hidden />
            Rótulo / QR
          </Link>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Dependencia:</dt><dd className="font-medium text-stone-800">{expediente.dependenciaSolicitante.nombre}</dd></div>
          <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Modalidad:</dt><dd className="font-medium text-stone-800">{ETIQUETA_MODALIDAD[expediente.modalidadSeleccion]}</dd></div>
          <div className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Valor:</dt><dd className="font-medium text-stone-800">{expediente.valor ? `$${Number(expediente.valor).toLocaleString("es-CO")}` : "—"}</dd></div>
          <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Vigencia:</dt><dd className="font-medium text-stone-800">{formatearFecha(expediente.fechaInicio)} – {formatearFecha(expediente.fechaFinEstimada)}</dd></div>
          <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Contratista:</dt><dd className="font-medium text-stone-800">{expediente.contratista ? `${expediente.contratista.nombreORazonSocial} (${expediente.contratista.identificacion})` : "Por definir"}</dd></div>
          <div className="flex items-center gap-1.5"><UserCog className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Supervisor(es):</dt><dd className="font-medium text-stone-800">{expediente.supervisores.length ? expediente.supervisores.map((s) => s.usuario.nombre).join(", ") : "—"}</dd></div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
          {ETAPAS_ORDEN.map((etapa, i) => {
            const pasada = i < idxActual || expediente.cerrado;
            const actual = i === idxActual && !expediente.cerrado;
            return (
              <span
                key={etapa}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  actual ? "bg-cdmb-600 text-white" : pasada ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-400"
                }`}
              >
                {ETIQUETA_ETAPA[etapa]}
              </span>
            );
          })}
          {expediente.cerrado && <span className="rounded-full bg-stone-800 px-3 py-1 text-xs font-medium text-white">Cerrado</span>}
          {!expediente.cerrado && puedeAprobar && (siguienteEtapa || esUltimaEtapa) && (
            <div className="ml-auto">
              <AprobarEtapaContratoBoton
                expedienteId={id}
                etiquetaSiguiente={siguienteEtapa ? ETIQUETA_ETAPA[siguienteEtapa] : "Cierre del expediente"}
              />
            </div>
          )}
        </div>
      </div>

      {ETAPAS_ORDEN.map((etapa) => {
        const docsEtapa = expediente.documentos.filter((d) => d.etapa === etapa);
        const puedeSubir = !expediente.cerrado && puedeSubirDocumentoContrato(permisos, expediente, etapa);
        return (
          <div key={etapa} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-stone-900">
              {ETIQUETA_ETAPA[etapa]} <span className="ml-1 text-xs font-normal text-stone-400">({docsEtapa.length} documento{docsEtapa.length === 1 ? "" : "s"})</span>
            </h3>

            {docsEtapa.length > 0 ? (
              <ul className="mb-3 space-y-2">
                {docsEtapa.map((doc) => {
                  const url = `/api/contratacion-documentos/${doc.id}`;
                  const puedeFirmarEste = doc.requiereFirma && !doc.firma && !doc.firmadoEnSecop && puedeFirmarDocumentoContrato(permisos, { id: expediente.id });
                  return (
                    <li key={doc.id} className="rounded-lg border border-stone-100 bg-stone-50/60 p-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-stone-800" title={doc.nombre}>{doc.nombre}</span>
                        {doc.categoria && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">{doc.categoria}</span>}
                        {doc.firmadoEnSecop && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">Firmado en SECOP II</span>}
                        {doc.requiereFirma && !doc.firmadoEnSecop && (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CLASE_ESTADO_VALIDACION[doc.estadoValidacion]}`}>
                            {ETIQUETA_ESTADO_VALIDACION[doc.estadoValidacion]}
                          </span>
                        )}
                        <VistaPreviaDocumento url={url} nombre={doc.nombre} mimeType={doc.mimeType} />
                        {puedeFirmarEste && <FirmarRechazarDocumentoContrato documentoId={doc.id} />}
                        {puedeEditarSinTrazaDocumentoContrato(permisos) && (
                          <EditarEliminarDocumentoContrato documentoId={doc.id} nombreActual={doc.nombre} />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-stone-400">
                        Subido por {doc.subidoPor.nombre} el {formatearFechaHora(doc.createdAt)}
                        {doc.firma && ` · Firmado el ${formatearFechaHora(doc.firma.fechaHora)} (${etiquetaFormatoFirma(doc.firma.formato)})`}
                        {doc.estadoValidacion === "RECHAZADO" && doc.comentarioValidacion && ` · Motivo del rechazo: ${doc.comentarioValidacion}`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mb-3 text-xs text-stone-400">Sin documentos todavía en esta etapa.</p>
            )}

            {puedeSubir && (
              <SubirDocumentosContratoForm expedienteId={id} etapa={etapa} categoriasSugeridas={CATEGORIAS_SUGERIDAS[etapa]} />
            )}
          </div>
        );
      })}
    </section>
  );
}
