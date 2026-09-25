import Link from "next/link";
import type { EtapaContratacion } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { Briefcase, QrCode, Wallet, CalendarDays, Building2, UserCog, User, ShieldCheck, AlertTriangle, Lock, FileCheck2, Printer, Hash, ChevronDown, Info, ArrowRight } from "lucide-react";
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
  puedeGestionarExpedienteCompleto,
  puedeGestionarPeriodosInforme,
  puedeValidarDocumentoContrato,
} from "@/lib/permisos";
import {
  ETAPAS_ORDEN,
  ETIQUETA_ETAPA,
  ETIQUETA_MODALIDAD,
  ORDEN_MODALIDADES,
  obtenerRequisitosDeEtapa,
  cruzarChecklist,
  type ItemChecklist,
} from "@/lib/contratacion";
import { puedeActuarSolicitud } from "@/lib/solicitudes-firma";
import { rotuloCalidadFirma } from "@/lib/calidad-firma";
import { calcularPeriodosInforme, esRequisitoPorPeriodos, etiquetaRangoPeriodo } from "@/lib/periodos-informe";
import { CATEGORIAS_SUGERIDAS } from "@/lib/contratacion-categorias";
import { etiquetaFormatoFirma } from "@/lib/firma-proveedor";
import { formatearFecha, formatearFechaHora, formatearFechaSolo } from "@/lib/fecha";
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
import { BotonDescargarZip } from "@/components/BotonDescargarZip";
import { VincularContratistaForm } from "@/components/VincularContratistaForm";
import { VincularExpedienteRelacionadoForm } from "@/components/VincularExpedienteRelacionadoForm";
import { EditarSupervisoresForm } from "@/components/EditarSupervisoresForm";
import { EditarDatosContratoForm } from "@/components/EditarDatosContratoForm";
import { NuevoEspacioInformeForm, EspacioEventualAcciones } from "@/components/EspaciosInformeAcciones";
import { ValidarDocumentoBoton } from "@/components/ValidarDocumentoBoton";

const ETIQUETA_ESTADO_VALIDACION: Record<string, string> = {
  PENDIENTE: "Pendiente de revisión",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};
const TITULO_ESTADO_VALIDACION: Record<string, string> = {
  PENDIENTE: "Se aprueba al firmarse (si requiere firma), al validarlo manualmente, o al aprobar el paso de esta etapa.",
  APROBADO: "Ya fue revisado y aprobado.",
  RECHAZADO: "Quien lo revisó lo rechazó — vea el motivo en la trazabilidad, al final de la página.",
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

function etiquetaFirmante(s: { rol: string; calidad?: string | null }): string {
  const rotulo = s.rol === "FIRMA" ? rotuloCalidadFirma(s.calidad) : null;
  return rotulo ? rotulo.toLowerCase() : ETIQUETA_ROL_FIRMANTE[s.rol] ?? s.rol;
}
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

const ITEMS_DESTACADOS = new Set(["Hoja de vida SIGEP"]);

const ETIQUETA_ACCION_AUDITORIA: Record<string, string> = {
  CREA: "Subió",
  MODIFICA: "Editó",
  ELIMINA: "Eliminó",
  VALIDA: "Validó",
};
const CLASE_ACCION_AUDITORIA: Record<string, string> = {
  CREA: "bg-cdmb-50 text-cdmb-700",
  MODIFICA: "bg-amber-50 text-amber-700",
  ELIMINA: "bg-red-50 text-red-700",
  VALIDA: "bg-emerald-50 text-emerald-700",
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
      periodosEventuales: { orderBy: { createdAt: "asc" } },
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

  const puedeGestionar = puedeGestionarContratistas(permisos);
  const puedeEditarDatosGenerales = puedeGestionarExpedienteCompleto(permisos);
  const puedeVerListaUsuarios = puedeGestionar || puedeAsignarFirmantesDocumentoContrato(permisos, expediente);
  const idsDocumentos = expediente.documentos.map((d) => d.id);
  const [supervisoresDisponibles, usuariosOpcionesCrudo, otrosContratosDelContratista, trazabilidad, dependencias, rechazos] = await Promise.all([
    puedeGestionar
      ? db.usuario.findMany({
          where: { rolContratacion: "SUPERVISOR_INTERVENTOR", activo: true },
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true, dependencia: { select: { nombre: true } } },
        })
      : Promise.resolve([]),
    puedeVerListaUsuarios
      ? db.usuario.findMany({
          where: { activo: true },
          select: { id: true, nombre: true, dependencia: { select: { nombre: true } } },
          orderBy: { nombre: "asc" },
        })
      : Promise.resolve([]),
    expediente.contratista
      ? db.expedienteContractual.findMany({
          where: { contratistaId: expediente.contratista.id, id: { not: id } },
          select: { id: true, numero: true, objeto: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    idsDocumentos.length > 0
      ? db.auditoriaDoc.findMany({
          where: { entidad: "DocumentoContrato", entidadId: { in: idsDocumentos } },
          orderBy: { secuencia: "asc" },
          include: { usuario: { select: { nombre: true } } },
        })
      : Promise.resolve([]),
    puedeEditarDatosGenerales
      ? db.dependencia.findMany({ where: { activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } })
      : Promise.resolve([]),
    db.eventoContratacion.findMany({
      where: { expedienteId: id, tipo: "DOCUMENTO_RECHAZADO" },
      orderBy: { createdAt: "desc" },
      include: { usuario: { select: { nombre: true } } },
    }),
  ]);
  const usuariosOpciones = usuariosOpcionesCrudo.map((u) => ({ id: u.id, nombre: u.nombre, dependenciaNombre: u.dependencia?.nombre ?? null }));
  const supervisoresOpciones = supervisoresDisponibles.map((s) => ({ id: s.id, nombre: s.nombre, dependenciaNombre: s.dependencia?.nombre ?? null }));

  const periodosMensuales = calcularPeriodosInforme(expediente.fechaInicio, expediente.fechaFinEstimada);
  const hoy = new Date();

  const idxActual = ETAPAS_ORDEN.indexOf(expediente.etapaActual);
  const puedeAprobar = puedeAprobarEtapaContratacion(permisos);
  const puedeAsignarFirmantes = puedeAsignarFirmantesDocumentoContrato(permisos, expediente);
  const puedeValidar = puedeValidarDocumentoContrato(permisos);
  const puedeRetroceder = puedeGestionarEtapasContratacion(permisos) && (idxActual > 0 || expediente.cerrado);
  const siguienteEtapa = !expediente.cerrado && idxActual < ETAPAS_ORDEN.length - 1 ? ETAPAS_ORDEN[idxActual + 1] : null;
  const esUltimaEtapa = idxActual === ETAPAS_ORDEN.length - 1;
  const faltaContratista = !expediente.contratista && expediente.etapaActual === "PRECONTRACTUAL" && !expediente.cerrado;
  const motivoEtapaOculta = expediente.cerrado
    ? null
    : !puedeAprobar
      ? "Solo el Jefe de Contratación (o un Administrador del sistema) puede aprobar el paso de etapa."
      : faltaContratista
        ? null
        : null;

  const requisitosPorEtapa = await Promise.all(ETAPAS_ORDEN.map((etapa) => obtenerRequisitosDeEtapa(expediente.modalidadSeleccion, etapa)));
  const checklistsPorEtapa = new Map<string, ItemChecklist[]>();
  ETAPAS_ORDEN.forEach((etapa, i) => {
    const docs = expediente.documentos.filter((d) => d.etapa === etapa);
    checklistsPorEtapa.set(etapa, cruzarChecklist(requisitosPorEtapa[i]!, docs));
  });

  type DocumentoExpediente = (typeof expediente.documentos)[number];

  const controlesDocumento = (doc: DocumentoExpediente, etapa: EtapaContratacion, puedeGestionarEtapaCerrada: boolean) => {
    const solicitudes = doc.solicitudesFirma.map((s) => ({
      id: s.id,
      usuarioAsignadoId: s.usuarioAsignadoId,
      usuarioAsignadoNombre: s.usuarioAsignado.nombre,
      rol: s.rol,
      orden: s.orden,
      calidad: s.calidad,
      estado: s.estado,
    }));
    const miSolicitud = solicitudes.find((s) => s.usuarioAsignadoId === session.userId && s.estado === "PENDIENTE" && s.rol !== "LECTURA");
    const puedeActuarYo = miSolicitud && puedeActuarSolicitud(solicitudes, miSolicitud);
    const firmado = doc.mimeType === "application/pdf" && (doc.firmas.length > 0 || doc.solicitudesFirma.some((s) => s.rol === "VISTO_BUENO" && s.estado === "COMPLETADA"));
    return (
      <div className="flex flex-none flex-wrap items-center justify-end gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CLASE_ESTADO_VALIDACION[doc.estadoValidacion]}`} title={TITULO_ESTADO_VALIDACION[doc.estadoValidacion]}>
          {ETIQUETA_ESTADO_VALIDACION[doc.estadoValidacion]}
        </span>
        {doc.requiereFirma && !doc.firmadoEnSecop && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${solicitudes.some((s) => s.rol === "FIRMA") ? "bg-emerald-50 text-emerald-700" : "animate-pulse bg-amber-100 text-amber-800"}`}
          >
            {solicitudes.some((s) => s.rol === "FIRMA") ? "Firmante asignado" : "Requiere asignar firmante"}
          </span>
        )}
        <VistaPreviaDocumento url={`/api/contratacion-documentos/${doc.id}${firmado ? "/rotulado" : ""}`} nombre={doc.nombre} mimeType={doc.mimeType} />
        {puedeValidar && doc.estadoValidacion !== "APROBADO" && <ValidarDocumentoBoton documentoId={doc.id} nombre={doc.nombre} />}
        {firmado && (
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
        {puedeGestionarEtapaCerrada && miSolicitud && puedeActuarYo && (
          <ConfirmarFirmaModal
            rol={miSolicitud.rol === "FIRMA" ? "FIRMA" : "VISTO_BUENO"}
            endpointCompletar={`/api/contratacion/solicitudes-firma/${miSolicitud.id}/completar`}
            endpointRechazar={`/api/contratacion/solicitudes-firma/${miSolicitud.id}/rechazar`}
            documentoUrl={`/api/contratacion-documentos/${doc.id}${firmado ? "/rotulado" : ""}`}
            documentoNombre={doc.nombre}
            documentoMimeType={doc.mimeType}
          />
        )}
        {puedeGestionarEtapaCerrada && puedeAsignarFirmantes && (
          <AsignarFirmantesModal conCalidad endpointAsignar={`/api/contratacion/documentos/${doc.id}/solicitudes-firma`} usuarios={usuariosOpciones} firmantesActuales={solicitudes} />
        )}
        {puedeGestionarEtapaCerrada && (puedeEditarSinTrazaDocumentoContrato(permisos) || puedeEditarConTrazaDocumentoContrato(permisos, expediente, etapa)) && (
          <EditarEliminarDocumentoContrato
            documentoId={doc.id}
            expedienteId={id}
            nombreActual={doc.nombre}
            requiereFirmaActual={doc.requiereFirma}
            sinTraza={puedeEditarSinTrazaDocumentoContrato(permisos)}
          />
        )}
      </div>
    );
  };

  const panelPorPeriodos = (item: ItemChecklist, etapa: EtapaContratacion, puedeSubirEtapa: boolean, puedeGestionarEtapaCerrada: boolean) => {
    const docs = expediente.documentos.filter((d) => d.requisitoId === item.id);
    const claves = new Set(periodosMensuales.map((p) => p.clave));
    const eventualesDelRequisito = expediente.periodosEventuales.filter((e) => e.requisitoId === item.id);
    const idsEventuales = new Set(eventualesDelRequisito.map((e) => e.id));
    const sueltos = docs.filter((d) => (d.periodoMes ? !claves.has(d.periodoMes) : d.periodoEventualId ? !idsEventuales.has(d.periodoEventualId) : true));
    const puedeCrearEspacios = puedeSubirEtapa && puedeGestionarPeriodosInforme(permisos, expediente);

    const fila = (
      key: string,
      titulo: string,
      subtitulo: string,
      doc: DocumentoExpediente | undefined,
      subida: { periodoMes?: string; periodoEventualId?: string },
      pendiente: boolean,
      extra?: React.ReactNode
    ) => (
      <li
        key={key}
        id={doc ? `documento-${doc.id}` : undefined}
        className="flex flex-wrap items-center gap-2 rounded-md p-2 scroll-mt-4 target:bg-amber-50 target:ring-1 target:ring-amber-300"
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-stone-800">
            {titulo}
            {!doc && pendiente && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">Por radicar</span>}
          </p>
          <p className="text-[11px] text-stone-400">{subtitulo}</p>
          {doc && (
            <p className="text-[11px] text-stone-400">
              Subido por {doc.subidoPor.nombre} el {formatearFechaHora(doc.createdAt)}
            </p>
          )}
        </div>
        {doc ? (
          controlesDocumento(doc, etapa, puedeGestionarEtapaCerrada)
        ) : puedeSubirEtapa ? (
          <SubirDocumentoRequisitoForm
            expedienteId={id}
            etapa={etapa}
            requisitoId={item.id}
            requisitoNombre={item.nombre}
            firmadoEnSecopSugerido={item.gestionadoEnSecop}
            {...subida}
          />
        ) : (
          <span className="flex-none text-xs text-stone-300">Sin subir</span>
        )}
        {extra}
      </li>
    );

    return (
      <div className="basis-full space-y-2 pt-1">
        {periodosMensuales.length === 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Para generar los espacios mensuales de este informe, registre la <strong>fecha de inicio</strong> y la <strong>fecha de fin</strong> del contrato
            (se ajustan en «Datos del contrato», más arriba). Mientras tanto puede usar espacios eventuales.
          </p>
        ) : (
          <details className="group/periodos">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] text-stone-500 [&::-webkit-details-marker]:hidden">
              <ChevronDown className="h-3 w-3 flex-none transition-transform group-open/periodos:rotate-180" aria-hidden />
              {docs.filter((d) => d.periodoMes && claves.has(d.periodoMes)).length} de {periodosMensuales.length} periodos mensuales con informe cargado — clic para ver cada uno
            </summary>
            <p className="mb-1.5 mt-1.5 text-[11px] text-stone-400">Cada periodo se radica desde el día siguiente a su cierre.</p>
            <ul className="divide-y divide-stone-100 rounded-lg border border-stone-100 bg-stone-50/40">
              {periodosMensuales.map((p, i) => {
                const doc = docs.find((d) => d.periodoMes === p.clave);
                return fila(
                  `mes-${p.clave}`,
                  `${item.nombre} ${i + 1}`,
                  `Periodo ${etiquetaRangoPeriodo(p)} · se radica desde el ${formatearFechaSolo(p.radicaDesde)}`,
                  doc,
                  { periodoMes: p.clave },
                  p.radicaDesde <= hoy
                );
              })}
            </ul>
          </details>
        )}

        {eventualesDelRequisito.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium text-stone-500">Espacios eventuales</p>
            <ul className="divide-y divide-stone-100 rounded-lg border border-stone-100 bg-stone-50/40">
              {eventualesDelRequisito.map((e) => {
                const doc = docs.find((d) => d.periodoEventualId === e.id);
                return fila(
                  `ev-${e.id}`,
                  e.nombre,
                  "Espacio eventual",
                  doc,
                  { periodoEventualId: e.id },
                  false,
                  puedeCrearEspacios ? <EspacioEventualAcciones expedienteId={id} periodoId={e.id} nombre={e.nombre} tieneDocumento={Boolean(doc)} /> : null
                );
              })}
            </ul>
          </div>
        )}

        {sueltos.length > 0 && (
          <div>
            <p className="mb-1 text-[11px] font-medium text-amber-700">Informes fuera de los periodos actuales (cambiaron las fechas del contrato)</p>
            <ul className="divide-y divide-stone-100 rounded-lg border border-amber-100 bg-amber-50/30">
              {sueltos.map((d) => fila(`suelto-${d.id}`, d.nombre, "Sin periodo vigente", d, {}, false))}
            </ul>
          </div>
        )}

        {puedeCrearEspacios && <NuevoEspacioInformeForm expedienteId={id} requisitoId={item.id} />}
      </div>
    );
  };

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
            <BotonDescargarZip
              href={`/api/contratacion/expedientes/${id}/zip`}
              nombreArchivo={`${expediente.numero}.zip`}
              etiqueta="Descargar todo (ZIP)"
              titulo="Descarga en un ZIP todos los documentos del expediente, en carpetas por etapa"
            />
            {puedeEditarDatosGenerales && (
              <EditarDatosContratoForm
                expedienteId={id}
                modalidadActual={expediente.modalidadSeleccion}
                modalidades={ORDEN_MODALIDADES.map((valor) => ({ valor, etiqueta: ETIQUETA_MODALIDAD[valor] }))}
                valorActual={expediente.valor?.toString() ?? null}
                dependenciaActualId={expediente.dependenciaSolicitanteId}
                dependencias={dependencias}
                numeroContratoActual={expediente.numeroContrato}
                fechaInicioActual={expediente.fechaInicio ? expediente.fechaInicio.toISOString().slice(0, 10) : null}
                fechaFinEstimadaActual={expediente.fechaFinEstimada ? expediente.fechaFinEstimada.toISOString().slice(0, 10) : null}
              />
            )}
            {puedeEliminarExpedienteContractual(permisos) && <EliminarExpedienteBoton expedienteId={id} numero={expediente.numero} />}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Dependencia:</dt><dd className="font-medium text-stone-800">{expediente.dependenciaSolicitante.nombre}</dd></div>
          <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Modalidad:</dt><dd className="font-medium text-stone-800">{ETIQUETA_MODALIDAD[expediente.modalidadSeleccion]}</dd></div>
          <div className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Valor:</dt><dd className="font-medium text-stone-800">{formatearPesosCO(expediente.valor?.toString())}</dd></div>
          <div className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">N.º contrato:</dt><dd className="font-medium text-stone-800">{expediente.numeroContrato ?? "Por definir"}</dd></div>
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-stone-400" aria-hidden />
            <dt className="text-stone-500">Vigencia:</dt>
            <dd className="font-medium text-stone-800">{formatearFecha(expediente.fechaInicio)} – {formatearFecha(expediente.fechaFinEstimada)}</dd>
          </div>
          <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Contratista:</dt><dd className="font-medium text-stone-800">{expediente.contratista ? `${expediente.contratista.nombreORazonSocial} (${expediente.contratista.identificacion})` : "Por definir"}</dd></div>
          <div className="flex items-center gap-1.5 sm:col-span-2 lg:col-span-1">
            <UserCog className="h-3.5 w-3.5 text-stone-400" aria-hidden />
            <dt className="text-stone-500">Supervisor(es):</dt>
            <dd className="font-medium text-stone-800">{expediente.supervisores.length ? expediente.supervisores.map((s) => s.usuario.nombre).join(", ") : "—"}</dd>
            {puedeGestionarContratistas(permisos) && (
              <EditarSupervisoresForm
                expedienteId={id}
                supervisoresDisponibles={supervisoresOpciones}
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
            {puedeEditarDatosGenerales && <VincularContratistaForm expedienteId={id} />}
          </div>
        )}

        {!faltaContratista && puedeEditarDatosGenerales && (
          <details className="group mt-3 text-xs" open={!expediente.contratista}>
            <summary className="cursor-pointer font-medium text-cdmb-700 [&::-webkit-details-marker]:hidden">
              {expediente.contratista ? "Cambiar el contratista" : "Vincular un contratista"}
            </summary>
            <p className="mt-1.5 text-stone-500">
              El contratista vinculado (si tiene cuenta de acceso) puede consultar este expediente —incluidas las etapas Contractual y
              Postcontractual— y cargar en él sus documentos. El vínculo (y cualquier cambio) queda en la bitácora.
            </p>
            <VincularContratistaForm expedienteId={id} contratistaActual={expediente.contratista} />
          </details>
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
        const puedeGestionarPrivilegiado = puedeGestionarExpedienteCompleto(permisos);
        const puedeVerEtapaCompleta =
          estado !== "bloqueada" ||
          puedeGestionarPrivilegiado ||
          (permisos.contratacion === "SUPERVISOR_INTERVENTOR" && permisos.supervisaExpedientes.has(expediente.id));

        if (estado === "bloqueada" && !puedeVerEtapaCompleta) {
          const checklistFuturo = checklistsPorEtapa.get(etapa) ?? [];
          return (
            <div key={etapa} className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/60 p-5 opacity-70">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-stone-500">
                <Lock className="h-3.5 w-3.5" aria-hidden />
                {ETIQUETA_ETAPA[etapa]} — se habilita al completar {ETIQUETA_ETAPA[ETAPAS_ORDEN[i - 1]!]}
              </h3>
              <ul className="grid grid-cols-1 gap-1 text-xs text-stone-400 sm:grid-cols-2">
                {checklistFuturo.map((r) => (
                  <li key={r.id}>• {r.nombre}{!r.obligatorio && " (opcional)"}</li>
                ))}
              </ul>
            </div>
          );
        }

        const checklist = checklistsPorEtapa.get(etapa) ?? [];
        const documentosLibres = expediente.documentos.filter((d) => d.etapa === etapa && !d.requisitoId);
        const puedeSubir = (estado === "actual" || puedeGestionarPrivilegiado) && !expediente.cerrado && puedeSubirDocumentoContrato(permisos, expediente, etapa);
        const etapaInfo =
          estado === "completada" ? "border-emerald-100 bg-emerald-50/20" : estado === "bloqueada" ? "border-dashed border-amber-200 bg-amber-50/10" : "border-stone-200 bg-white";
        const puedeGestionarEtapaCerrada =
          estado === "actual" || puedeGestionarPrivilegiado || (permisos.contratacion === "SUPERVISOR_INTERVENTOR" && permisos.supervisaExpedientes.has(expediente.id));

        return (
          <details key={etapa} open={estado === "actual"} className={`group rounded-2xl border p-5 shadow-sm ${etapaInfo}`}>
            <summary className="mb-3 flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
                {estado === "completada" && <FileCheck2 className="h-4 w-4 text-emerald-600" aria-hidden />}
                {estado === "bloqueada" && <Lock className="h-4 w-4 text-amber-500" aria-hidden />}
                {ETIQUETA_ETAPA[etapa]}
                {estado === "completada" && <span className="text-xs font-normal text-stone-400">(clic para expandir)</span>}
                {estado === "bloqueada" && (
                  <span className="text-xs font-normal text-amber-600" title="El expediente todavía no llega a esta etapa — se está viendo por adelantado porque su rol lo permite.">
                    (aún no alcanzada — clic para expandir)
                  </span>
                )}
              </h3>
              <span className="flex items-center gap-1.5 text-xs text-stone-400">
                {checklist.filter((c) => c.documento).length}/{checklist.length} documentos del catálogo
                {estado !== "actual" && <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />}
              </span>
            </summary>

            <ul className="mb-3 divide-y divide-stone-100 rounded-lg border border-stone-100">
              {checklist.map((item) => {
                const destacado = ITEMS_DESTACADOS.has(item.nombre);
                return (
                <li
                  key={item.id}
                  id={item.documento ? `documento-${item.documento.id}` : undefined}
                  className={`flex flex-wrap items-center gap-2 rounded-md p-2.5 scroll-mt-4 target:bg-amber-50 target:ring-1 target:ring-amber-300 ${
                    destacado ? "bg-cdmb-50/60 ring-1 ring-inset ring-cdmb-200" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm text-stone-800">
                      {destacado && <ArrowRight className="h-3.5 w-3.5 flex-none text-cdmb-600" aria-hidden />}
                      {item.nombre}
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${item.obligatorio ? "bg-red-50 text-red-600" : "bg-stone-100 text-stone-500"}`}>
                        {item.obligatorio ? "Obligatorio" : "Opcional"}
                      </span>
                      {item.gestionadoEnSecop && (
                        <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">Se gestiona en SECOP II</span>
                      )}
                      {!esRequisitoPorPeriodos(item) && item.documento?.requiereFirma && !item.documento.firmadoEnSecop && (
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
                    <p className="flex items-center gap-1 text-[11px] text-stone-400">
                      {item.codigoFormato && `${item.codigoFormato} · `}
                      {item.fuente}
                      {item.notaOrigenExterno && (
                        <span title={item.notaOrigenExterno}>
                          <Info className="h-3 w-3 flex-none text-stone-400" aria-hidden />
                        </span>
                      )}
                    </p>
                    {item.documento && !esRequisitoPorPeriodos(item) && (
                      <p className="text-[11px] text-stone-400">
                        Subido por {item.documento.subidoPorNombre} el {formatearFechaHora(item.documento.createdAt)}
                        {item.documento.firmaFechaHora &&
                          ` · Firmado el ${formatearFechaHora(item.documento.firmaFechaHora)} (${etiquetaFormatoFirma(item.documento.firmaFormato ?? "hash-sha256")}${item.documento.totalFirmas > 1 ? `, ${item.documento.totalFirmas} firmantes` : ""})`}
                      </p>
                    )}
                    {item.documento && !esRequisitoPorPeriodos(item) && item.documento.solicitudesFirma.some((s) => s.estado !== "RECHAZADA") && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.documento.solicitudesFirma
                          .filter((s) => s.estado !== "RECHAZADA")
                          .map((s) => (
                            <span key={s.id} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${CLASE_ESTADO_SOLICITUD[s.estado]}`}>
                              {s.usuarioAsignadoNombre} · {etiquetaFirmante(s)} · {ETIQUETA_ESTADO_SOLICITUD[s.estado]}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                  {esRequisitoPorPeriodos(item) ? (
                    <span className="flex-none text-xs text-stone-400">
                      {expediente.documentos.filter((d) => d.requisitoId === item.id).length} informe(s) cargado(s)
                    </span>
                  ) : item.documento ? (
                    <div className="flex flex-none flex-wrap items-center justify-end gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CLASE_ESTADO_VALIDACION[item.documento.estadoValidacion]}`} title={TITULO_ESTADO_VALIDACION[item.documento.estadoValidacion]}>
                        {ETIQUETA_ESTADO_VALIDACION[item.documento.estadoValidacion]}
                      </span>
                      <VistaPreviaDocumento
                        url={`/api/contratacion-documentos/${item.documento.id}${item.documento.mimeType === "application/pdf" && (item.documento.totalFirmas > 0 || item.documento.solicitudesFirma.some((s) => s.rol === "VISTO_BUENO" && s.estado === "COMPLETADA")) ? "/rotulado" : ""}`}
                        nombre={item.documento.nombre}
                        mimeType={item.documento.mimeType}
                      />
                      {puedeValidar && item.documento.estadoValidacion !== "APROBADO" && (
                        <ValidarDocumentoBoton documentoId={item.documento.id} nombre={item.documento.nombre} />
                      )}
                      {item.documento.mimeType === "application/pdf" && (item.documento.totalFirmas > 0 || item.documento.solicitudesFirma.some((s) => s.rol === "VISTO_BUENO" && s.estado === "COMPLETADA")) && (
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
                      {puedeGestionarEtapaCerrada && (() => {
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
                            documentoUrl={`/api/contratacion-documentos/${doc.id}${doc.mimeType === "application/pdf" && (doc.totalFirmas > 0 || doc.solicitudesFirma.some((s) => s.rol === "VISTO_BUENO" && s.estado === "COMPLETADA")) ? "/rotulado" : ""}`}
                            documentoNombre={doc.nombre}
                            documentoMimeType={doc.mimeType}
                          />
                        ) : null;
                      })()}
                      {puedeGestionarEtapaCerrada && puedeAsignarFirmantes && (
                        <AsignarFirmantesModal conCalidad
                          endpointAsignar={`/api/contratacion/documentos/${item.documento.id}/solicitudes-firma`}
                          usuarios={usuariosOpciones}
                          firmantesActuales={item.documento.solicitudesFirma.map((s) => ({
                            id: s.id,
                            usuarioAsignadoId: s.usuarioAsignadoId,
                            usuarioAsignadoNombre: s.usuarioAsignadoNombre,
                            rol: s.rol,
                            orden: s.orden,
                            calidad: s.calidad,
                            estado: s.estado,
                          }))}
                        />
                      )}
                      {puedeGestionarEtapaCerrada && (puedeEditarSinTrazaDocumentoContrato(permisos) || puedeEditarConTrazaDocumentoContrato(permisos, expediente, etapa)) && (
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
                  {esRequisitoPorPeriodos(item) && panelPorPeriodos(item, etapa, puedeSubir, puedeGestionarEtapaCerrada)}
                </li>
                );
              })}
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
                      calidad: s.calidad,
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
                        {solicitudes.some((s) => s.estado !== "RECHAZADA") && (
                          <div className="flex flex-wrap gap-1">
                            {solicitudes
                              .filter((s) => s.estado !== "RECHAZADA")
                              .map((s) => (
                                <span key={s.id} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${CLASE_ESTADO_SOLICITUD[s.estado]}`}>
                                  {s.usuarioAsignadoNombre} · {etiquetaFirmante(s)}
                                </span>
                              ))}
                          </div>
                        )}
                        <VistaPreviaDocumento
                          url={`/api/contratacion-documentos/${doc.id}${doc.mimeType === "application/pdf" && (doc.firmas.length > 0 || doc.solicitudesFirma.some((s) => s.rol === "VISTO_BUENO" && s.estado === "COMPLETADA")) ? "/rotulado" : ""}`}
                          nombre={doc.nombre}
                          mimeType={doc.mimeType}
                        />
                        {puedeValidar && doc.estadoValidacion !== "APROBADO" && <ValidarDocumentoBoton documentoId={doc.id} nombre={doc.nombre} />}
                        {doc.mimeType === "application/pdf" && (doc.firmas.length > 0 || doc.solicitudesFirma.some((s) => s.rol === "VISTO_BUENO" && s.estado === "COMPLETADA")) && (
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
                        {puedeGestionarEtapaCerrada && puedeActuarYo && (
                          <ConfirmarFirmaModal
                            rol={miSolicitud!.rol === "FIRMA" ? "FIRMA" : "VISTO_BUENO"}
                            endpointCompletar={`/api/contratacion/solicitudes-firma/${miSolicitud!.id}/completar`}
                            endpointRechazar={`/api/contratacion/solicitudes-firma/${miSolicitud!.id}/rechazar`}
                            documentoUrl={`/api/contratacion-documentos/${doc.id}${doc.mimeType === "application/pdf" && (doc.firmas.length > 0 || doc.solicitudesFirma.some((s) => s.rol === "VISTO_BUENO" && s.estado === "COMPLETADA")) ? "/rotulado" : ""}`}
                            documentoNombre={doc.nombre}
                            documentoMimeType={doc.mimeType}
                          />
                        )}
                        {puedeGestionarEtapaCerrada && puedeAsignarFirmantes && (
                          <AsignarFirmantesModal conCalidad
                            endpointAsignar={`/api/contratacion/documentos/${doc.id}/solicitudes-firma`}
                            usuarios={usuariosOpciones}
                            firmantesActuales={solicitudes}
                          />
                        )}
                        {puedeGestionarEtapaCerrada && (puedeEditarSinTrazaDocumentoContrato(permisos) || puedeEditarConTrazaDocumentoContrato(permisos, expediente, doc.etapa)) && (
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
          </details>
        );
      })}

      {rechazos.length > 0 && (
        <details className="group rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
          <summary className="mb-2 flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
              <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden />
              Rechazos al firmar/revisar
            </h3>
            <span className="flex items-center gap-1.5 text-xs text-stone-400">
              {rechazos.length} rechazo{rechazos.length === 1 ? "" : "s"}
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
            </span>
          </summary>
          <p className="mb-3 text-xs text-stone-500">
            Mientras está activo, un rechazo aparece como aviso en
            el buzón de quien lo subió y de Administrador/Jefe de Contratación; aquí queda para siempre, aunque el
            aviso ya se haya descartado o se haya limpiado solo al corregir el archivo.
          </p>
          <ul className="divide-y divide-stone-100 text-xs">
            {rechazos.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="min-w-0 flex-1 text-stone-700">{ev.detalle}</span>
                <span className="flex-none text-stone-400">{ev.usuario?.nombre ?? "—"}</span>
                <span className="flex-none text-stone-400">{formatearFechaHora(ev.createdAt)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {trazabilidad.length > 0 && (
        <details className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <summary className="mb-2 flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
              <Hash className="h-4 w-4 text-stone-400" aria-hidden />
              Trazabilidad de los documentos
            </h3>
            <span className="flex items-center gap-1.5 text-xs text-stone-400">
              {trazabilidad.length} movimiento{trazabilidad.length === 1 ? "" : "s"}
              <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
            </span>
          </summary>
          <p className="mb-3 text-xs text-stone-500">
            Registro inalterable con cadena de hash: cada movimiento encadena su hash con el del anterior. Las
            acciones de Administrador y Jefe de Contratación no se registran aquí.
          </p>
          <ul className="divide-y divide-stone-100 text-xs">
            {[...trazabilidad].reverse().map((mov) => (
              <li key={mov.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className={`flex-none rounded-full px-2 py-0.5 font-medium ${CLASE_ACCION_AUDITORIA[mov.accion] ?? "bg-stone-100 text-stone-600"}`}>
                  {ETIQUETA_ACCION_AUDITORIA[mov.accion] ?? mov.accion}
                </span>
                <span className="min-w-0 flex-1 truncate text-stone-700" title={mov.detalle ?? undefined}>{mov.detalle}</span>
                <span className="flex-none text-stone-400">{mov.usuario?.nombre ?? "—"}</span>
                <span className="flex-none text-stone-400">{formatearFechaHora(mov.createdAt)}</span>
                <span className="flex-none font-mono text-[10px] text-stone-300" title={`Hash: ${mov.hash}\nHash anterior: ${mov.hashAnterior ?? "(primer eslabón)"}`}>
                  {mov.hash.slice(0, 10)}…
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
