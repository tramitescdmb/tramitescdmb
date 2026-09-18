import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Briefcase, QrCode, Wallet, CalendarDays, Building2, UserCog, User, ShieldCheck, AlertTriangle, Lock, FileCheck2, Printer } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import {
  obtenerPermisosUsuario,
  puedeVerExpedienteContractual,
  tieneSolicitudFirmaEnExpedienteContractual,
  puedeSubirDocumentoContrato,
  puedeAsignarFirmantesDocumentoContrato,
  puedeEditarSinTrazaDocumentoContrato,
  puedeEditarConTrazaDocumentoContrato,
  puedeAprobarEtapaContratacion,
  puedeGestionarEtapasContratacion,
  puedeEliminarExpedienteContractual,
  puedeGestionarContratistas,
} from "@/lib/permisos";
import {
  ETAPAS_ORDEN,
  ETIQUETA_ETAPA,
  ETIQUETA_MODALIDAD,
  obtenerRequisitosDeEtapa,
  cruzarChecklist,
  type ItemChecklist,
} from "@/lib/contratacion";
import { puedeActuarSolicitud } from "@/lib/solicitudes-firma";
import { CATEGORIAS_SUGERIDAS } from "@/lib/contratacion-categorias";
import { etiquetaFormatoFirma } from "@/lib/firma-proveedor";
import { formatearFecha, formatearFechaHora } from "@/lib/fecha";
import { formatearPesosCO } from "@/lib/moneda";
import { TituloSeccion } from "@/components/sgdea/ui";
import { VistaPreviaDocumento } from "@/components/VistaPreviaDocumento";
import { SubirDocumentosContratoForm } from "@/components/SubirDocumentosContratoForm";
import { SubirDocumentoRequisitoForm } from "@/components/SubirDocumentoRequisitoForm";
import { EditarEliminarDocumentoContrato } from "@/components/AccionesDocumentoContrato";
import { AsignarFirmantesModal } from "@/components/AsignarFirmantesModal";
import { ConfirmarFirmaModal } from "@/components/ConfirmarFirmaModal";
import { AprobarEtapaContratoBoton } from "@/components/AprobarEtapaContratoBoton";
import { RetrocederEtapaBoton } from "@/components/RetrocederEtapaBoton";
import { EliminarExpedienteBoton } from "@/components/EliminarExpedienteBoton";
import { VincularContratistaForm } from "@/components/VincularContratistaForm";
import { VincularExpedienteRelacionadoForm } from "@/components/VincularExpedienteRelacionadoForm";
import { EditarSupervisoresForm } from "@/components/EditarSupervisoresForm";

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

const ETIQUETA_ROL_FIRMANTE: Record<string, string> = {
  FIRMA: "firma",
  VISTO_BUENO: "visto bueno",
  LECTURA: "lectura",
};
const ETIQUETA_ESTADO_SOLICITUD: Record<string, string> = {
  PENDIENTE: "pendiente",
  COMPLETADA: "completada",
  RECHAZADA: "rechazada",
};
const CLASE_ESTADO_SOLICITUD: Record<string, string> = {
  PENDIENTE: "bg-amber-50 text-amber-700",
  COMPLETADA: "bg-emerald-50 text-emerald-700",
  RECHAZADA: "bg-red-50 text-red-700",
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
      contratista: { select: { id: true, nombreORazonSocial: true, identificacion: true } },
      expedienteRelacionado: { select: { numero: true } },
      expedientesQueLoReferencian: { select: { id: true, numero: true } },
      supervisores: { include: { usuario: { select: { nombre: true } } } },
      documentos: {
        orderBy: { createdAt: "asc" },
        include: {
          subidoPor: { select: { nombre: true } },
          firmas: true,
          solicitudesFirma: { include: { usuarioAsignado: { select: { nombre: true } } }, orderBy: { orden: "asc" } },
        },
      },
    },
  });
  if (!expediente) notFound();
  if (
    !puedeVerExpedienteContractual(permisos, expediente) &&
    !(await tieneSolicitudFirmaEnExpedienteContractual(session.userId, id))
  ) {
    redirect("/contratacion");
  }

  // Las 3 consultas son independientes entre sí — antes se hacían en secuencia (3 ida y vuelta a
  // la base en vez de 1), lo cual pesa en una página que ya de por sí hace varias consultas.
  const [supervisoresDisponibles, usuariosOpcionesCrudo, otrosContratosDelContratista] = await Promise.all([
    db.usuario.findMany({
      where: { rolContratacion: "SUPERVISOR_INTERVENTOR", activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
    db.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, dependencia: { select: { nombre: true } } },
      orderBy: { nombre: "asc" },
    }),
    // Otros contratos del MISMO contratista — para poder marcar prórrogas/continuaciones como
    // relacionadas sin fusionar expedientes (un contratista puede tener varios en el año).
    expediente.contratista
      ? db.expedienteContractual.findMany({
          where: { contratistaId: expediente.contratista.id, id: { not: id } },
          select: { id: true, numero: true, objeto: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);
  const usuariosOpciones = usuariosOpcionesCrudo.map((u) => ({ id: u.id, nombre: u.nombre, dependenciaNombre: u.dependencia?.nombre ?? null }));

  const idxActual = ETAPAS_ORDEN.indexOf(expediente.etapaActual);
  const puedeAprobar = puedeAprobarEtapaContratacion(permisos);
  const puedeAsignarFirmantes = puedeAsignarFirmantesDocumentoContrato(permisos, expediente);
  const puedeRetroceder = puedeGestionarEtapasContratacion(permisos) && (idxActual > 0 || expediente.cerrado);
  const siguienteEtapa = !expediente.cerrado && idxActual < ETAPAS_ORDEN.length - 1 ? ETAPAS_ORDEN[idxActual + 1] : null;
  const esUltimaEtapa = idxActual === ETAPAS_ORDEN.length - 1;
  const faltaContratista = !expediente.contratista && expediente.etapaActual === "PRECONTRACTUAL" && !expediente.cerrado;
  // Por qué NO se ve el botón de aprobar etapa, cuando corresponde — antes desaparecía en
  // silencio y el usuario probando la app no entendía si era un bug o le faltaba algo.
  const motivoEtapaOculta = expediente.cerrado
    ? null
    : !puedeAprobar
      ? "Solo el Jefe de Contratación (o un Administrador del sistema) puede aprobar el paso de etapa."
      : faltaContratista
        ? null // ya tiene su propio aviso (VincularContratistaForm más abajo)
        : null;

  // Checklist real por etapa (catálogo del Manual A-BS-MA01 cruzado con lo ya subido) —
  // solo se calcula para las etapas ya alcanzadas (actual o completadas); una etapa
  // futura solo muestra los NOMBRES del catálogo, sin cruzar documentos ni permitir subir.
  // Las consultas de requisitos por etapa son independientes — se piden todas a la vez en vez
  // de una por una (a lo sumo 3 etapas, pero cada round-trip a la base suma).
  const etapasAlcanzadas = ETAPAS_ORDEN.slice(0, idxActual + 1);
  const etapasFuturas = ETAPAS_ORDEN.slice(idxActual + 1);
  const [requisitosAlcanzados, requisitosFuturos] = await Promise.all([
    Promise.all(etapasAlcanzadas.map((etapa) => obtenerRequisitosDeEtapa(expediente.modalidadSeleccion, etapa))),
    Promise.all(etapasFuturas.map((etapa) => obtenerRequisitosDeEtapa(expediente.modalidadSeleccion, etapa))),
  ]);
  const checklistsPorEtapa = new Map<string, ItemChecklist[]>();
  etapasAlcanzadas.forEach((etapa, i) => {
    const docs = expediente.documentos.filter((d) => d.etapa === etapa);
    checklistsPorEtapa.set(etapa, cruzarChecklist(requisitosAlcanzados[i]!, docs));
  });
  const previewFuturo = new Map<string, { nombre: string; obligatorio: boolean }[]>();
  etapasFuturas.forEach((etapa, i) => {
    previewFuturo.set(etapa, requisitosFuturos[i]!.map((r) => ({ nombre: r.nombre, obligatorio: r.obligatorio })));
  });

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
            <Link
              href={`/contratacion/expedientes/${id}/ficha-firma`}
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
            >
              <FileCheck2 className="h-3.5 w-3.5" aria-hidden />
              Ficha técnica de firmas
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
          <div className="flex items-center gap-1.5 sm:col-span-2 lg:col-span-1">
            <UserCog className="h-3.5 w-3.5 text-stone-400" aria-hidden />
            <dt className="text-stone-500">Supervisor(es):</dt>
            <dd className="font-medium text-stone-800">{expediente.supervisores.length ? expediente.supervisores.map((s) => s.usuario.nombre).join(", ") : "—"}</dd>
            {puedeGestionarContratistas(permisos) && (
              <EditarSupervisoresForm
                expedienteId={id}
                supervisoresDisponibles={supervisoresDisponibles}
                supervisoresActualesIds={expediente.supervisores.map((s) => s.usuarioId)}
              />
            )}
          </div>
        </dl>

        {(expediente.expedienteRelacionado || expediente.expedientesQueLoReferencian.length > 0 || (puedeGestionarContratistas(permisos) && otrosContratosDelContratista.length > 0)) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-100 pt-3 text-xs text-stone-500">
            {expediente.expedienteRelacionado && <span>Relacionado con <span className="font-medium text-stone-700">{expediente.expedienteRelacionado.numero}</span></span>}
            {expediente.expedientesQueLoReferencian.length > 0 && (
              <span>
                Referenciado por{" "}
                {expediente.expedientesQueLoReferencian.map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && ", "}
                    <Link href={`/contratacion/expedientes/${e.id}`} className="font-medium text-cdmb-700 hover:underline">{e.numero}</Link>
                  </span>
                ))}
              </span>
            )}
            {puedeGestionarContratistas(permisos) && otrosContratosDelContratista.length > 0 && (
              <VincularExpedienteRelacionadoForm
                expedienteId={id}
                opciones={otrosContratosDelContratista}
                actualId={expediente.expedienteRelacionadoId}
              />
            )}
          </div>
        )}

        {faltaContratista && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
              <span>
                Este expediente no puede pasar a la etapa Contractual sin conocer al contratista (persona natural o
                jurídica).
              </span>
            </div>
            {puedeGestionarContratistas(permisos) && <VincularContratistaForm expedienteId={id} />}
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
            {motivoEtapaOculta && (
              <span className="inline-flex items-center gap-1 text-[11px] text-stone-400" title={motivoEtapaOculta}>
                <Lock className="h-3 w-3 flex-none" aria-hidden />
                {motivoEtapaOculta}
              </span>
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
                <li
                  key={item.id}
                  id={item.documento ? `documento-${item.documento.id}` : undefined}
                  className="flex flex-wrap items-center gap-2 rounded-md p-2.5 scroll-mt-4 target:bg-amber-50 target:ring-1 target:ring-amber-300"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm text-stone-800">
                      {item.nombre}
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${item.obligatorio ? "bg-red-50 text-red-600" : "bg-stone-100 text-stone-500"}`}>
                        {item.obligatorio ? "Obligatorio" : "Opcional"}
                      </span>
                      {item.gestionadoEnSecop && (
                        <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">Se gestiona en SECOP II</span>
                      )}
                      {item.documento?.requiereFirma && !item.documento.firmadoEnSecop && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            item.documento.solicitudesFirma.some((s) => s.rol === "FIRMA")
                              ? "bg-emerald-50 text-emerald-700"
                              : "animate-pulse bg-amber-100 text-amber-800"
                          }`}
                          title={
                            item.documento.solicitudesFirma.some((s) => s.rol === "FIRMA")
                              ? "Ya tiene firmante(s) asignado(s)"
                              : "Falta asignar quién debe firmarlo"
                          }
                        >
                          {item.documento.solicitudesFirma.some((s) => s.rol === "FIRMA") ? "Firmante asignado" : "Requiere asignar firmante"}
                        </span>
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
                          ` · Firmado el ${formatearFechaHora(item.documento.firmaFechaHora)} (${etiquetaFormatoFirma(item.documento.firmaFormato ?? "hash-sha256")}${item.documento.totalFirmas > 1 ? `, ${item.documento.totalFirmas} firmantes` : ""})`}
                      </p>
                    )}
                    {item.documento && item.documento.solicitudesFirma.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.documento.solicitudesFirma.map((s) => (
                          <span key={s.id} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${CLASE_ESTADO_SOLICITUD[s.estado]}`}>
                            {s.usuarioAsignadoNombre} · {ETIQUETA_ROL_FIRMANTE[s.rol]} · {ETIQUETA_ESTADO_SOLICITUD[s.estado]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {item.documento ? (
                    <div className="flex flex-none flex-wrap items-center justify-end gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CLASE_ESTADO_VALIDACION[item.documento.estadoValidacion]}`}>
                        {ETIQUETA_ESTADO_VALIDACION[item.documento.estadoValidacion]}
                      </span>
                      <VistaPreviaDocumento url={`/api/contratacion-documentos/${item.documento.id}`} nombre={item.documento.nombre} mimeType={item.documento.mimeType} />
                      {item.documento.mimeType === "application/pdf" && item.documento.totalFirmas > 0 && (
                        <a
                          href={`/api/contratacion-documentos/${item.documento.id}/rotulado`}
                          target="_blank"
                          rel="noreferrer"
                          title="PDF con el sello de firma electrónica y el QR de verificación estampados"
                          className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
                        >
                          <Printer className="h-3.5 w-3.5" aria-hidden />
                          Con firma
                        </a>
                      )}
                      {(() => {
                        const doc = item.documento!;
                        const miSolicitud = doc.solicitudesFirma.find(
                          (s) => s.usuarioAsignadoId === session.userId && s.estado === "PENDIENTE" && s.rol !== "LECTURA"
                        );
                        const puedeActuarYo = miSolicitud && puedeActuarSolicitud(doc.solicitudesFirma, miSolicitud);
                        return puedeActuarYo ? (
                          <ConfirmarFirmaModal
                            rol={miSolicitud.rol === "FIRMA" ? "FIRMA" : "VISTO_BUENO"}
                            endpointCompletar={`/api/contratacion/solicitudes-firma/${miSolicitud.id}/completar`}
                            endpointRechazar={`/api/contratacion/solicitudes-firma/${miSolicitud.id}/rechazar`}
                            documentoUrl={`/api/contratacion-documentos/${doc.id}`}
                            documentoNombre={doc.nombre}
                            documentoMimeType={doc.mimeType}
                          />
                        ) : null;
                      })()}
                      {puedeAsignarFirmantes && (
                        <AsignarFirmantesModal
                          endpointAsignar={`/api/contratacion/documentos/${item.documento.id}/solicitudes-firma`}
                          usuarios={usuariosOpciones}
                          firmantesActuales={item.documento.solicitudesFirma.map((s) => ({
                            id: s.id,
                            usuarioAsignadoNombre: s.usuarioAsignadoNombre,
                            rol: s.rol,
                            orden: s.orden,
                            estado: s.estado,
                          }))}
                        />
                      )}
                      {(puedeEditarSinTrazaDocumentoContrato(permisos) || puedeEditarConTrazaDocumentoContrato(permisos, expediente)) && (
                        <EditarEliminarDocumentoContrato
                          documentoId={item.documento.id}
                          expedienteId={id}
                          nombreActual={item.documento.nombre}
                          requiereFirmaActual={item.documento.requiereFirma}
                          sinTraza={puedeEditarSinTrazaDocumentoContrato(permisos)}
                        />
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
                  {documentosLibres.map((doc) => {
                    const solicitudes = doc.solicitudesFirma.map((s) => ({
                      id: s.id,
                      usuarioAsignadoId: s.usuarioAsignadoId,
                      usuarioAsignadoNombre: s.usuarioAsignado.nombre,
                      rol: s.rol,
                      orden: s.orden,
                      estado: s.estado,
                    }));
                    const miSolicitud = solicitudes.find((s) => s.usuarioAsignadoId === session.userId && s.estado === "PENDIENTE" && s.rol !== "LECTURA");
                    const puedeActuarYo = miSolicitud && puedeActuarSolicitud(solicitudes, miSolicitud);
                    return (
                      <li
                        key={doc.id}
                        id={`documento-${doc.id}`}
                        className="flex flex-wrap items-center gap-2 rounded-md border border-stone-100 bg-stone-50/60 p-2 text-sm scroll-mt-4 target:bg-amber-50 target:ring-1 target:ring-amber-300"
                      >
                        <span className="min-w-0 flex-1 truncate text-stone-700" title={doc.nombre}>{doc.nombre}</span>
                        {doc.categoria && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">{doc.categoria}</span>}
                        {doc.requiereFirma && !doc.firmadoEnSecop && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              solicitudes.some((s) => s.rol === "FIRMA") ? "bg-emerald-50 text-emerald-700" : "animate-pulse bg-amber-100 text-amber-800"
                            }`}
                          >
                            {solicitudes.some((s) => s.rol === "FIRMA") ? "Firmante asignado" : "Requiere asignar firmante"}
                          </span>
                        )}
                        {solicitudes.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {solicitudes.map((s) => (
                              <span key={s.id} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${CLASE_ESTADO_SOLICITUD[s.estado]}`}>
                                {s.usuarioAsignadoNombre} · {ETIQUETA_ROL_FIRMANTE[s.rol]}
                              </span>
                            ))}
                          </div>
                        )}
                        <VistaPreviaDocumento url={`/api/contratacion-documentos/${doc.id}`} nombre={doc.nombre} mimeType={doc.mimeType} />
                        {doc.mimeType === "application/pdf" && doc.firmas.length > 0 && (
                          <a
                            href={`/api/contratacion-documentos/${doc.id}/rotulado`}
                            target="_blank"
                            rel="noreferrer"
                            title="PDF con el sello de firma electrónica y el QR de verificación estampados"
                            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
                          >
                            <Printer className="h-3.5 w-3.5" aria-hidden />
                            Con firma
                          </a>
                        )}
                        {puedeActuarYo && (
                          <ConfirmarFirmaModal
                            rol={miSolicitud!.rol === "FIRMA" ? "FIRMA" : "VISTO_BUENO"}
                            endpointCompletar={`/api/contratacion/solicitudes-firma/${miSolicitud!.id}/completar`}
                            endpointRechazar={`/api/contratacion/solicitudes-firma/${miSolicitud!.id}/rechazar`}
                            documentoUrl={`/api/contratacion-documentos/${doc.id}`}
                            documentoNombre={doc.nombre}
                            documentoMimeType={doc.mimeType}
                          />
                        )}
                        {puedeAsignarFirmantes && (
                          <AsignarFirmantesModal
                            endpointAsignar={`/api/contratacion/documentos/${doc.id}/solicitudes-firma`}
                            usuarios={usuariosOpciones}
                            firmantesActuales={solicitudes}
                          />
                        )}
                        {(puedeEditarSinTrazaDocumentoContrato(permisos) || puedeEditarConTrazaDocumentoContrato(permisos, expediente)) && (
                          <EditarEliminarDocumentoContrato
                            documentoId={doc.id}
                            expedienteId={id}
                            nombreActual={doc.nombre}
                            requiereFirmaActual={doc.requiereFirma}
                            sinTraza={puedeEditarSinTrazaDocumentoContrato(permisos)}
                          />
                        )}
                      </li>
                    );
                  })}
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
