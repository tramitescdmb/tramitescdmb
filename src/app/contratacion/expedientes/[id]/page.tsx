import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Briefcase, QrCode, Wallet, CalendarDays, Building2, UserCog, User, ShieldCheck, AlertTriangle, Lock, FileCheck2 } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import {
  obtenerPermisosUsuario,
  puedeVerExpedienteContractual,
  puedeSubirDocumentoContrato,
  puedeFirmarDocumentoContrato,
  puedeEditarSinTrazaDocumentoContrato,
  puedeAprobarEtapaContratacion,
  puedeGestionarEtapasContratacion,
  puedeEliminarExpedienteContractual,
  puedeAdministrarContratacion,
} from "@/lib/permisos";
import {
  ETAPAS_ORDEN,
  ETIQUETA_ETAPA,
  ETIQUETA_MODALIDAD,
  obtenerRequisitosDeEtapa,
  cruzarChecklist,
  type ItemChecklist,
} from "@/lib/contratacion";
import { CATEGORIAS_SUGERIDAS } from "@/lib/contratacion-categorias";
import { etiquetaFormatoFirma } from "@/lib/firma-proveedor";
import { formatearFecha, formatearFechaHora } from "@/lib/fecha";
import { formatearPesosCO } from "@/lib/moneda";
import { TituloSeccion } from "@/components/sgdea/ui";
import { VistaPreviaDocumento } from "@/components/VistaPreviaDocumento";
import { SubirDocumentosContratoForm } from "@/components/SubirDocumentosContratoForm";
import { SubirDocumentoRequisitoForm } from "@/components/SubirDocumentoRequisitoForm";
import { FirmarRechazarDocumentoContrato, EditarEliminarDocumentoContrato } from "@/components/AccionesDocumentoContrato";
import { AprobarEtapaContratoBoton } from "@/components/AprobarEtapaContratoBoton";
import { RetrocederEtapaBoton } from "@/components/RetrocederEtapaBoton";
import { EliminarExpedienteBoton } from "@/components/EliminarExpedienteBoton";
import { VincularContratistaForm } from "@/components/VincularContratistaForm";

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
      documentos: {
        orderBy: { createdAt: "asc" },
        include: { subidoPor: { select: { nombre: true } }, firma: true },
      },
    },
  });
  if (!expediente) notFound();
  if (!puedeVerExpedienteContractual(permisos, expediente)) redirect("/contratacion");

  const idxActual = ETAPAS_ORDEN.indexOf(expediente.etapaActual);
  const puedeAprobar = puedeAprobarEtapaContratacion(permisos);
  const puedeRetroceder = puedeGestionarEtapasContratacion(permisos) && (idxActual > 0 || expediente.cerrado);
  const siguienteEtapa = !expediente.cerrado && idxActual < ETAPAS_ORDEN.length - 1 ? ETAPAS_ORDEN[idxActual + 1] : null;
  const esUltimaEtapa = idxActual === ETAPAS_ORDEN.length - 1;
  const faltaContratista = !expediente.contratista && expediente.etapaActual === "PRECONTRACTUAL" && !expediente.cerrado;

  // Checklist real por etapa (catálogo del Manual A-BS-MA01 cruzado con lo ya subido) —
  // solo se calcula para las etapas ya alcanzadas (actual o completadas); una etapa
  // futura solo muestra los NOMBRES del catálogo, sin cruzar documentos ni permitir subir.
  const checklistsPorEtapa = new Map<string, ItemChecklist[]>();
  for (let i = 0; i <= idxActual; i++) {
    const etapa = ETAPAS_ORDEN[i]!;
    const requisitos = await obtenerRequisitosDeEtapa(expediente.modalidadSeleccion, etapa);
    const docs = expediente.documentos.filter((d) => d.etapa === etapa);
    checklistsPorEtapa.set(etapa, cruzarChecklist(requisitos, docs));
  }
  const previewFuturo = new Map<string, { nombre: string; obligatorio: boolean }[]>();
  for (let i = idxActual + 1; i < ETAPAS_ORDEN.length; i++) {
    const etapa = ETAPAS_ORDEN[i]!;
    const requisitos = await obtenerRequisitosDeEtapa(expediente.modalidadSeleccion, etapa);
    previewFuturo.set(etapa, requisitos.map((r) => ({ nombre: r.nombre, obligatorio: r.obligatorio })));
  }

  return (
    <section className="space-y-5">
      <TituloSeccion icon={Briefcase}>
        <span className="font-mono text-base">{expediente.numero}</span>
      </TituloSeccion>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-2xl text-sm text-stone-800">{expediente.objeto}</p>
          <div className="flex flex-none items-center gap-2">
            <Link
              href={`/contratacion/expedientes/${id}/rotulo`}
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
            >
              <QrCode className="h-3.5 w-3.5" aria-hidden />
              Rótulo / QR
            </Link>
            {puedeEliminarExpedienteContractual(permisos) && <EliminarExpedienteBoton expedienteId={id} numero={expediente.numero} />}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Dependencia:</dt><dd className="font-medium text-stone-800">{expediente.dependenciaSolicitante.nombre}</dd></div>
          <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Modalidad:</dt><dd className="font-medium text-stone-800">{ETIQUETA_MODALIDAD[expediente.modalidadSeleccion]}</dd></div>
          <div className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Valor:</dt><dd className="font-medium text-stone-800">{formatearPesosCO(expediente.valor?.toString())}</dd></div>
          <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Vigencia:</dt><dd className="font-medium text-stone-800">{formatearFecha(expediente.fechaInicio)} – {formatearFecha(expediente.fechaFinEstimada)}</dd></div>
          <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Contratista:</dt><dd className="font-medium text-stone-800">{expediente.contratista ? `${expediente.contratista.nombreORazonSocial} (${expediente.contratista.identificacion})` : "Por definir"}</dd></div>
          <div className="flex items-center gap-1.5"><UserCog className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Supervisor(es):</dt><dd className="font-medium text-stone-800">{expediente.supervisores.length ? expediente.supervisores.map((s) => s.usuario.nombre).join(", ") : "—"}</dd></div>
        </dl>

        {faltaContratista && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
              <span>
                Este expediente no puede pasar a la etapa Contractual sin conocer al contratista (persona natural o
                jurídica).
              </span>
            </div>
            {puedeAdministrarContratacion(permisos) && <VincularContratistaForm expedienteId={id} />}
          </div>
        )}

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
          <div className="ml-auto flex items-center gap-2">
            {puedeRetroceder && (
              <RetrocederEtapaBoton
                expedienteId={id}
                etiquetaAnterior={ETIQUETA_ETAPA[ETAPAS_ORDEN[(expediente.cerrado ? ETAPAS_ORDEN.length - 1 : idxActual) - 1]!]}
              />
            )}
            {!expediente.cerrado && puedeAprobar && !faltaContratista && (siguienteEtapa || esUltimaEtapa) && (
              <AprobarEtapaContratoBoton
                expedienteId={id}
                etiquetaSiguiente={siguienteEtapa ? ETIQUETA_ETAPA[siguienteEtapa] : "Cierre del expediente"}
              />
            )}
          </div>
        </div>
      </div>

      {ETAPAS_ORDEN.map((etapa, i) => {
        const estado = expediente.cerrado || i < idxActual ? "completada" : i === idxActual ? "actual" : "bloqueada";

        if (estado === "bloqueada") {
          return (
            <div key={etapa} className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/60 p-5 opacity-70">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-stone-500">
                <Lock className="h-3.5 w-3.5" aria-hidden />
                {ETIQUETA_ETAPA[etapa]} — se habilita al completar {ETIQUETA_ETAPA[ETAPAS_ORDEN[i - 1]!]}
              </h3>
              <ul className="grid grid-cols-1 gap-1 text-xs text-stone-400 sm:grid-cols-2">
                {(previewFuturo.get(etapa) ?? []).map((r) => (
                  <li key={r.nombre}>• {r.nombre}{!r.obligatorio && " (opcional)"}</li>
                ))}
              </ul>
            </div>
          );
        }

        const checklist = checklistsPorEtapa.get(etapa) ?? [];
        const documentosLibres = expediente.documentos.filter((d) => d.etapa === etapa && !d.requisitoId);
        const puedeSubir = estado === "actual" && !expediente.cerrado && puedeSubirDocumentoContrato(permisos, expediente, etapa);
        const etapaInfo = estado === "completada" ? "border-emerald-100 bg-emerald-50/20" : "border-stone-200 bg-white";

        return (
          <div key={etapa} className={`rounded-2xl border p-5 shadow-sm ${etapaInfo}`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
                {estado === "completada" && <FileCheck2 className="h-4 w-4 text-emerald-600" aria-hidden />}
                {ETIQUETA_ETAPA[etapa]}
              </h3>
              <span className="text-xs text-stone-400">
                {checklist.filter((c) => c.documento).length}/{checklist.length} documentos del catálogo
              </span>
            </div>

            <ul className="mb-3 divide-y divide-stone-100 rounded-lg border border-stone-100">
              {checklist.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm text-stone-800">
                      {item.nombre}
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${item.obligatorio ? "bg-red-50 text-red-600" : "bg-stone-100 text-stone-500"}`}>
                        {item.obligatorio ? "Obligatorio" : "Opcional"}
                      </span>
                      {item.gestionadoEnSecop && (
                        <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">Se gestiona en SECOP II</span>
                      )}
                    </p>
                    <p className="text-[11px] text-stone-400">
                      {item.codigoFormato && `${item.codigoFormato} · `}
                      {item.fuente}
                      {item.notaOrigenExterno && ` — ${item.notaOrigenExterno}`}
                    </p>
                    {item.documento && (
                      <p className="text-[11px] text-stone-400">
                        Subido por {item.documento.subidoPorNombre} el {formatearFechaHora(item.documento.createdAt)}
                        {item.documento.firmaFechaHora &&
                          ` · Firmado el ${formatearFechaHora(item.documento.firmaFechaHora)} (${etiquetaFormatoFirma(item.documento.firmaFormato ?? "hash-sha256")})`}
                      </p>
                    )}
                  </div>
                  {item.documento ? (
                    <div className="flex flex-none items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CLASE_ESTADO_VALIDACION[item.documento.estadoValidacion]}`}>
                        {ETIQUETA_ESTADO_VALIDACION[item.documento.estadoValidacion]}
                      </span>
                      <VistaPreviaDocumento url={`/api/contratacion-documentos/${item.documento.id}`} nombre={item.documento.nombre} mimeType={item.documento.mimeType} />
                      {item.documento.requiereFirma && !item.documento.firmadoEnSecop && item.documento.estadoValidacion === "PENDIENTE" && puedeFirmarDocumentoContrato(permisos, { id: expediente.id }) && (
                        <FirmarRechazarDocumentoContrato documentoId={item.documento.id} />
                      )}
                      {puedeEditarSinTrazaDocumentoContrato(permisos) && (
                        <EditarEliminarDocumentoContrato documentoId={item.documento.id} nombreActual={item.documento.nombre} />
                      )}
                    </div>
                  ) : puedeSubir ? (
                    <SubirDocumentoRequisitoForm
                      expedienteId={id}
                      etapa={etapa}
                      requisitoId={item.id}
                      requisitoNombre={item.nombre}
                      firmadoEnSecopSugerido={item.gestionadoEnSecop}
                    />
                  ) : (
                    <span className="flex-none text-xs text-stone-300">Sin subir</span>
                  )}
                </li>
              ))}
            </ul>

            {documentosLibres.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-medium text-stone-500">Otros documentos subidos en esta etapa (fuera del catálogo)</p>
                <ul className="space-y-1.5">
                  {documentosLibres.map((doc) => (
                    <li key={doc.id} className="flex flex-wrap items-center gap-2 rounded-md border border-stone-100 bg-stone-50/60 p-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-stone-700" title={doc.nombre}>{doc.nombre}</span>
                      {doc.categoria && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">{doc.categoria}</span>}
                      <VistaPreviaDocumento url={`/api/contratacion-documentos/${doc.id}`} nombre={doc.nombre} mimeType={doc.mimeType} />
                      {puedeEditarSinTrazaDocumentoContrato(permisos) && <EditarEliminarDocumentoContrato documentoId={doc.id} nombreActual={doc.nombre} />}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {puedeSubir && (
              <details className="group">
                <summary className="cursor-pointer text-xs font-medium text-cdmb-700 [&::-webkit-details-marker]:hidden">
                  + Subir otro documento no listado en el catálogo
                </summary>
                <div className="mt-2">
                  <SubirDocumentosContratoForm expedienteId={id} etapa={etapa} categoriasSugeridas={CATEGORIAS_SUGERIDAS[etapa]} />
                </div>
              </details>
            )}
          </div>
        );
      })}
    </section>
  );
}
