import { etiquetaModalidadConCodigo } from "@/lib/codigo-proceso";
import { whereDesignacionGecon } from "@/lib/gecon-designaciones";
import Link from "next/link";
import { RegistrarReciente } from "@/components/RegistrarReciente";
import type { EtapaContratacion } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { Briefcase, QrCode, Wallet, CalendarDays, Building2, UserCog, UserCheck, User, ShieldCheck, AlertTriangle, Lock, FileCheck2, Printer, Hash, ChevronDown, Info, ArrowRight, FolderTree, ClipboardList, FileSignature, FolderCheck, History, Settings2, Paperclip, PenLine } from "lucide-react";
import { PanelGestionDocumental } from "@/components/gestion-documental/PanelGestionDocumental";
import { fichaArchivoDe, firmasPendientesContrato, mensajeFirmasPendientes } from "@/lib/archivo-central";
import { PestanasDetalle } from "@/components/sgdea/PestanasDetalle";
import { etiquetaTipoConCodigo } from "@/lib/tipo-contrato";
import { causalDe } from "@/lib/compatibilidad-modalidad";
import { SecopPanel } from "@/components/SecopPanel";
import { CODIGO_ACTA_LIQUIDACION, ETIQUETA_FASE_LIQUIDACION, estadoLiquidacion, plazosLiquidacion } from "@/lib/liquidacion";
import { subseriesPorModalidad } from "@/lib/trd-clasificacion";
import { DetallesPerezosos } from "@/components/trd/CatalogoTrd";
import { resumenRetencion, subserieBuscable } from "@/lib/trd-presentacion";
import { ReclasificarTrdContratoForm } from "@/components/ReclasificarTrdContratoForm";
import { db } from "@/lib/db";
import { verificarSesion as getSession, puedeAccederCorrespondencia } from "@/lib/permisos";
import {
  obtenerPermisosUsuario,
  puedeVerExpedienteContractual,
  tieneSolicitudFirmaEnExpedienteContractual,
  puedeRegistrarModificacionContrato,
  puedeSubirDocumentoContrato,
  puedeAsignarFirmantesDocumentoContrato,
  puedeEditarSinTrazaDocumentoContrato,
  puedeEditarConTrazaDocumentoContrato,
  puedeAprobarEtapaContratacion,
  puedeGestionarEtapasContratacion,
  puedeEliminarExpedienteContractual,
  puedeGestionarContratistas,
  puedeGestionarExpedienteCompleto,
  puedeEditarDatosContrato,
  puedeSubirEnCualquierEtapaContrato,
  puedeAsignarPersonalContrato,
  puedeGestionarPeriodosInforme,
  puedeValidarDocumentoContrato,
  esContratistaGecon,
  supervisaElExpediente,
} from "@/lib/permisos";
import { registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";
import {
  listarTopesCuantia,
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
import { formatearFechaCalendario, formatearFechaHora, formatearFechaSolo } from "@/lib/fecha";
import { formatearPesosCO } from "@/lib/moneda";
import { TituloSeccion } from "@/components/sgdea/ui";
import { VistaPreviaDocumento } from "@/components/VistaPreviaDocumento";
import { SubirDocumentosContratoForm } from "@/components/SubirDocumentosContratoForm";
import { SubirDocumentoRequisitoForm } from "@/components/SubirDocumentoRequisitoForm";
import { EditarEliminarDocumentoContrato } from "@/components/AccionesDocumentoContrato";
import { AsignarFirmantesModal } from "@/components/AsignarFirmantesModal";
import { ProveedorUsuariosFirma } from "@/components/UsuariosFirmaContexto";
import { ConfirmarFirmaModal } from "@/components/ConfirmarFirmaModal";
import { AprobarEtapaContratoBoton } from "@/components/AprobarEtapaContratoBoton";
import { RetrocederEtapaBoton } from "@/components/RetrocederEtapaBoton";
import { EliminarExpedienteBoton } from "@/components/EliminarExpedienteBoton";
import { VincularContratistaForm } from "@/components/VincularContratistaForm";
import { VincularExpedienteRelacionadoForm } from "@/components/VincularExpedienteRelacionadoForm";
import { EditarSupervisoresForm } from "@/components/EditarSupervisoresForm";
import { EditarPersonalAsignadoForm } from "@/components/EditarPersonalAsignadoForm";
import { EditarDatosContratoForm } from "@/components/EditarDatosContratoForm";
import { NuevoEspacioInformeForm, EspacioEventualAcciones } from "@/components/EspaciosInformeAcciones";
import { ValidarDocumentoBoton } from "@/components/ValidarDocumentoBoton";
import { MarcaRequiereFirma } from "@/components/MarcaRequiereFirma";

const ETIQUETA_ESTADO_VALIDACION: Record<string, string> = {
  PENDIENTE: "Pendiente de revisión",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};
const TITULO_ESTADO_VALIDACION: Record<string, string> = {
  PENDIENTE: "Se aprueba con un solo paso: al firmarse (si requiere firma), al validarlo o al cerrar la etapa.",
  APROBADO: "Ya fue revisado y aprobado.",
  RECHAZADO: "Quien lo revisó lo rechazó — vea el motivo en la trazabilidad, al final de la página.",
};
const TITULO_SIN_VALIDACION = "Desde Contractual los documentos no se validan: se firman cuando lo requieren.";

function EstadoFirmaDocumento({
  requiereFirma,
  cargadoEnSecop,
  solicitudes,
  totalFirmas,
}: {
  requiereFirma: boolean;
  cargadoEnSecop: boolean;
  solicitudes: { rol: string; estado: string }[];
  totalFirmas: number;
}) {
  if (!requiereFirma || cargadoEnSecop) return null;
  const firmantes = solicitudes.filter((s) => s.rol === "FIRMA" && s.estado !== "RECHAZADA");
  const hechas = firmantes.filter((s) => s.estado === "COMPLETADA").length;
  const [texto, clase, titulo] =
    firmantes.length === 0
      ? totalFirmas > 0
        ? ["Firmado", "bg-emerald-50 text-emerald-700", "Firmado electrónicamente"]
        : ["Requiere asignar firmante", "animate-pulse bg-amber-100 text-amber-800", "Falta asignar quién debe firmarlo"]
      : hechas === firmantes.length
        ? ["Firmado", "bg-emerald-50 text-emerald-700", "Firmaron todos los firmantes asignados"]
        : [`Firma en curso · ${hechas} de ${firmantes.length}`, "bg-sky-50 text-sky-700", "Faltan firmantes por firmar"];
  return (
    <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${clase}`} title={titulo}>
      {texto}
    </span>
  );
}

function EstadoDocumento({ estado, etapa }: { estado: string; etapa: EtapaContratacion }) {
  const conValidacion = etapa === "PRECONTRACTUAL" || estado !== "PENDIENTE";
  return (
    <span
      className={`rounded-sm px-2 py-0.5 text-[11px] font-medium ${conValidacion ? CLASE_ESTADO_VALIDACION[estado] : "bg-stone-100 text-stone-600"}`}
      title={conValidacion ? TITULO_ESTADO_VALIDACION[estado] : TITULO_SIN_VALIDACION}
    >
      {conValidacion ? ETIQUETA_ESTADO_VALIDACION[estado] : "Cargado"}
    </span>
  );
}
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

export default async function DetalleExpedienteContractualPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string; periodo?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);

  const expediente = await db.expedienteContractual.findUnique({
    where: { id },
    include: {
      dependenciaSolicitante: { select: { nombre: true } },
      subserie: {
        select: {
          codigo: true,
          nombre: true,
          serieId: true,
          retencionGestionAnios: true,
          retencionCentralAnios: true,
          disposicionesFinal: true,
          serie: { select: { nombre: true, dependencia: { select: { nombre: true } } } },
        },
      },
      contratista: { select: { id: true, nombreORazonSocial: true, identificacion: true } },
      expedienteRelacionado: { select: { numero: true } },
      expedientesQueLoReferencian: { select: { id: true, numero: true } },
      supervisores: { include: { usuario: { select: { nombre: true, cedulaONit: true } } } },
      asignados: { include: { usuario: { select: { nombre: true } } } },
      periodosEventuales: { orderBy: { createdAt: "asc" } },
      secop: true,
      documentos: {
        orderBy: { createdAt: "asc" },
        include: {
          subidoPor: { select: { nombre: true } },
          verificacionRecepcionPor: { select: { nombre: true } },
          firmas: true,
          solicitudesFirma: { include: { usuarioAsignado: { select: { nombre: true } } }, orderBy: { orden: "asc" } },
        },
      },
    },
  });
  if (!expediente) notFound();
  if (expediente.eliminado) notFound();
  if (
    !puedeVerExpedienteContractual(permisos, expediente) &&
    !(await tieneSolicitudFirmaEnExpedienteContractual(session.userId, id))
  ) {
    await registrarAccesoDenegadoAccion("ver el detalle de un expediente de contratación", id, session, await headers());
    redirect("/contratacion");
  }

  const cerrado = expediente.cerrado;
  const supervisorSecopPendiente =
    Boolean(expediente.supervisorSecopNombre) &&
    !expediente.supervisores.some((s) => expediente.supervisorSecopDocumento && s.usuario.cedulaONit?.replace(/\D/g, "") === expediente.supervisorSecopDocumento);
  const puedeGestionar = puedeGestionarContratistas(permisos);
  const puedeGestionDocumental = puedeGestionarExpedienteCompleto(permisos, expediente);
  const puedeEditarDatosGenerales = puedeEditarDatosContrato(permisos, expediente) && !cerrado;
  const puedeVerListaUsuarios = puedeGestionar || puedeAsignarFirmantesDocumentoContrato(permisos, expediente);
  const puedeAsignarPersonal = puedeAsignarPersonalContrato(permisos);
  const ocultaPrecontractualParaMi = esContratistaGecon(permisos);
  const idsDocumentos = expediente.documentos.filter((d) => !ocultaPrecontractualParaMi || d.etapa !== "PRECONTRACTUAL").map((d) => d.id);
  const [topesCuantia, subseriePorModalidadTrd, supervisoresDisponibles, personalDisponible, usuariosOpcionesCrudo, otrosContratosDelContratista, trazabilidad, dependencias, fichaSgdea, firmasPendientes, eventoCierre] = await Promise.all([
    puedeEditarDatosGenerales ? listarTopesCuantia() : Promise.resolve([]),
    puedeEditarDatosGenerales ? subseriesPorModalidad() : Promise.resolve({}),
    puedeGestionar
      ? db.usuario.findMany({
          where: { AND: [await whereDesignacionGecon("SUPERVISOR_INTERVENTOR")], activo: true },
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true, dependencia: { select: { nombre: true } } },
        })
      : Promise.resolve([]),
    puedeAsignarPersonal
      ? db.usuario.findMany({
          where: { AND: [await whereDesignacionGecon("FUNCIONARIO_CONTRATACION")], activo: true },
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
    puedeAccederCorrespondencia(permisos) ? fichaArchivoDe(id) : Promise.resolve(null),
    cerrado ? Promise.resolve(0) : firmasPendientesContrato(id),
    cerrado
      ? db.eventoContratacion.findFirst({
          where: { expedienteId: id, tipo: "EXPEDIENTE_CERRADO" },
          orderBy: { createdAt: "desc" },
          select: { usuario: { select: { nombre: true } } },
        })
      : Promise.resolve(null),
  ]);
  const usuariosOpciones = usuariosOpcionesCrudo.map((u) => ({ id: u.id, nombre: u.nombre, dependenciaNombre: u.dependencia?.nombre ?? null }));
  const supervisoresOpciones = supervisoresDisponibles.map((s) => ({ id: s.id, nombre: s.nombre, dependenciaNombre: s.dependencia?.nombre ?? null }));
  const personalOpciones = personalDisponible.map((s) => ({ id: s.id, nombre: s.nombre, dependenciaNombre: s.dependencia?.nombre ?? null }));

  const periodosMensuales = calcularPeriodosInforme(expediente.fechaInicio, expediente.fechaFinEstimada);
  const datosSecop = (expediente.secop?.datos ?? null) as Record<string, unknown> | null;
  const hoy = new Date();

  const idxActual = ETAPAS_ORDEN.indexOf(expediente.etapaActual);
  const puedeAprobar = puedeAprobarEtapaContratacion(permisos);
  const puedeAsignarFirmantes = !cerrado && puedeAsignarFirmantesDocumentoContrato(permisos, expediente);
  const puedeValidarEn = (etapa: EtapaContratacion) => !cerrado && puedeValidarDocumentoContrato(permisos, expediente, etapa);
  const puedeMarcarFirmaEn = (etapa: EtapaContratacion) => !cerrado && puedeSubirDocumentoContrato(permisos, expediente, etapa);
  const marcaFirma = (
    doc: { id: string; requiereFirma: boolean; cargadoEnSecop: boolean; solicitudesFirma: { rol: string; estado: string }[] },
    totalFirmas: number,
    etapa: EtapaContratacion
  ) =>
    puedeMarcarFirmaEn(etapa) && !doc.cargadoEnSecop ? (
      <MarcaRequiereFirma
        documentoId={doc.id}
        marcado={doc.requiereFirma}
        puedeQuitar={totalFirmas === 0 && !doc.solicitudesFirma.some((s) => s.rol === "FIRMA" && s.estado !== "RECHAZADA")}
      />
    ) : null;
  const puedeRetroceder = !cerrado && puedeGestionarEtapasContratacion(permisos) && idxActual > 0;
  const siguienteEtapa = !expediente.cerrado && idxActual < ETAPAS_ORDEN.length - 1 ? ETAPAS_ORDEN[idxActual + 1] : null;
  const esUltimaEtapa = idxActual === ETAPAS_ORDEN.length - 1;
  const faltaContratista = !expediente.contratista && expediente.etapaActual === "PRECONTRACTUAL" && !expediente.cerrado;
  const puedeSubirEtapaActual = !expediente.cerrado && puedeSubirDocumentoContrato(permisos, expediente, expediente.etapaActual);
  const puedeAprobarDesdeBotonera = !expediente.cerrado && puedeAprobar && !faltaContratista && Boolean(siguienteEtapa);
  const motivoEtapaOculta = expediente.cerrado
    ? null
    : !puedeAprobar
      ? "Solo el administrador o el jefe de contratación pueden aprobar el paso de etapa."
      : faltaContratista
        ? null
        : null;

  const requisitosPorEtapa = await Promise.all(ETAPAS_ORDEN.map((etapa) => obtenerRequisitosDeEtapa(expediente.modalidadSeleccion, etapa, expediente.tipoContrato, expediente.terminadoAnticipadamente)));
  const idsActaLiquidacion = new Set(requisitosPorEtapa.flat().filter((r) => r.codigoFormato?.includes(CODIGO_ACTA_LIQUIDACION)).map((r) => r.id));
  const liquidacion = estadoLiquidacion({
    terminacion: expediente.fechaFinEstimada,
    tipoContrato: expediente.tipoContrato,
    terminadoAnticipadamente: expediente.terminadoAnticipadamente,
    liquidado: expediente.cerrado || expediente.documentos.some((d) => d.requisitoId && idsActaLiquidacion.has(d.requisitoId)),
  });
  const plazosLiq = expediente.fechaFinEstimada ? plazosLiquidacion(expediente.fechaFinEstimada) : null;
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
      completadoEn: s.completadoEn ? formatearFechaHora(s.completadoEn) : null,
    }));
    const miSolicitud = solicitudes.find((s) => s.usuarioAsignadoId === session.userId && s.estado === "PENDIENTE" && s.rol !== "LECTURA");
    const puedeActuarYo = miSolicitud && puedeActuarSolicitud(solicitudes, miSolicitud);
    const firmado = doc.mimeType === "application/pdf" && (doc.firmas.length > 0 || doc.solicitudesFirma.some((s) => s.rol === "VISTO_BUENO" && s.estado === "COMPLETADA"));
    return (
      <div className="flex flex-none flex-wrap items-center justify-end gap-1.5">
        <EstadoDocumento estado={doc.estadoValidacion} etapa={etapa} />
        <EstadoFirmaDocumento requiereFirma={doc.requiereFirma} cargadoEnSecop={doc.cargadoEnSecop} solicitudes={solicitudes} totalFirmas={doc.firmas.length} />
        {marcaFirma(doc, doc.firmas.length, etapa)}
        <VistaPreviaDocumento url={`/api/contratacion-documentos/${doc.id}${firmado ? "/rotulado" : ""}`} nombre={doc.nombre} mimeType={doc.mimeType} />
        {puedeValidarEn(etapa) && doc.estadoValidacion !== "APROBADO" && <ValidarDocumentoBoton documentoId={doc.id} nombre={doc.nombre} />}
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
          <AsignarFirmantesModal conCalidad contratistaPrincipal endpointAsignar={`/api/contratacion/documentos/${doc.id}/solicitudes-firma`} firmantesActuales={solicitudes} />
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

  const anclaUsada = new Set<string>();
  const anclaPeriodo = (clave: string) => {
    if (anclaUsada.has(clave)) return undefined;
    anclaUsada.add(clave);
    return `periodo-${clave}`;
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
      extra?: React.ReactNode,
      ancla?: string
    ) => (
      <li
        key={key}
        id={doc ? `documento-${doc.id}` : ancla}
        className="flex flex-wrap items-center gap-2 rounded-md p-2 scroll-mt-28 target:bg-amber-50 target:ring-1 target:ring-amber-300"
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-stone-800">
            {titulo}
            {!doc && pendiente && <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">Por radicar</span>}
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
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Para generar los espacios mensuales de este informe, registre la <strong>fecha de inicio</strong> y la <strong>fecha de fin</strong> del contrato
            (se ajustan en «Datos del contrato», más arriba). Mientras tanto puede usar espacios eventuales.
          </p>
        ) : (
          <details className="group/periodos" open={Boolean(sp.periodo && periodosMensuales.some((p) => p.clave === sp.periodo))}>
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
                  p.radicaDesde <= hoy,
                  undefined,
                  doc ? undefined : anclaPeriodo(p.clave)
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
    <ProveedorUsuariosFirma usuarios={usuariosOpciones}>
    <section className="space-y-5">
      <RegistrarReciente
        href={`/contratacion/expedientes/${id}`}
        titulo={expediente.numeroContrato ? `Contrato N.° ${expediente.numeroContrato}` : expediente.numero}
        detalle={[expediente.numero, expediente.contratista?.nombreORazonSocial].filter(Boolean).join(" · ")}
        modulo="GECON"
      />
      <TituloSeccion icon={Briefcase}>
        <span className="font-mono text-base">{expediente.codigoProceso ?? expediente.numero}</span>
        {expediente.numeroContrato && <span className="ml-2 text-base font-normal text-stone-500">Contrato N.° {expediente.numeroContrato}</span>}
        {expediente.codigoProceso && <span className="ml-2 font-mono text-xs font-normal text-stone-400">{expediente.numero}</span>}
      </TituloSeccion>

      {sp.ok && <div className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

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
            {puedeEditarDatosGenerales && (
              <EditarDatosContratoForm
                expedienteId={id}
                modalidadActual={expediente.modalidadSeleccion}
                tipoContratoActual={expediente.tipoContrato}
                causalActual={expediente.causalContratacionDirecta}
                codigoProcesoActual={expediente.codigoProceso}
                enlazadoSecop={Boolean(expediente.idContratoSecop)}
                topes={topesCuantia}
                modalidades={ORDEN_MODALIDADES.map((valor) => ({ valor, etiqueta: etiquetaModalidadConCodigo(valor, ETIQUETA_MODALIDAD[valor]) }))}
                valorActual={expediente.valor?.toString() ?? null}
                dependenciaActualId={expediente.dependenciaSolicitanteId}
                dependencias={dependencias}
                numeroContratoActual={expediente.numeroContrato}
                numeroProcesoSecopActual={expediente.numeroProcesoSecop}
                fechaSuscripcionActual={expediente.fechaSuscripcion ? expediente.fechaSuscripcion.toISOString().slice(0, 10) : null}
                fechaInicioActual={expediente.fechaInicio ? expediente.fechaInicio.toISOString().slice(0, 10) : null}
                fechaFinEstimadaActual={expediente.fechaFinEstimada ? expediente.fechaFinEstimada.toISOString().slice(0, 10) : null}
              />
            )}
            {!cerrado && puedeEliminarExpedienteContractual(permisos) && (
              <EliminarExpedienteBoton expedienteId={id} numero={expediente.numero} numeroContrato={expediente.numeroContrato} />
            )}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Dependencia:</dt><dd className="font-medium text-stone-800">{expediente.dependenciaSolicitante.nombre}</dd></div>
          <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Tipo de contrato:</dt><dd className="font-medium text-stone-800">{etiquetaTipoConCodigo(expediente.tipoContrato)}</dd></div>
          <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Modalidad:</dt><dd className="font-medium text-stone-800">{etiquetaModalidadConCodigo(expediente.modalidadSeleccion, ETIQUETA_MODALIDAD[expediente.modalidadSeleccion])}{causalDe(expediente.causalContratacionDirecta) && <span className="font-normal text-stone-500"> · {causalDe(expediente.causalContratacionDirecta)!.codigo} {causalDe(expediente.causalContratacionDirecta)!.etiqueta}</span>}</dd></div>
          <div className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Valor:</dt><dd className="font-medium text-stone-800">{formatearPesosCO(expediente.valor?.toString())}</dd></div>
          <div className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">N.º proceso SECOP:</dt><dd className="font-medium text-stone-800">{expediente.numeroProcesoSecop ?? "Por definir"}</dd></div>
          <div className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">N.º contrato:</dt><dd className="font-medium text-stone-800">{expediente.numeroContrato ?? "Por definir"}</dd></div>
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-stone-400" aria-hidden />
            <dt className="text-stone-500">Suscripción:</dt>
            <dd className="font-medium text-stone-800">{formatearFechaCalendario(expediente.fechaSuscripcion)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-stone-400" aria-hidden />
            <dt className="text-stone-500">Vigencia:</dt>
            <dd className="font-medium text-stone-800">
              {!expediente.fechaInicio && expediente.etapaActual === "CONTRACTUAL" && !expediente.cerrado ? (
                <span
                  className="rounded-sm bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
                  title="Sin fecha de inicio (acta de inicio) no se calculan plazos ni vencimientos."
                >
                  Pendiente de inicio
                </span>
              ) : (
                <>{formatearFechaCalendario(expediente.fechaInicio)} – {formatearFechaCalendario(expediente.fechaFinEstimada)}</>
              )}
            </dd>
          </div>
          <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-stone-400" aria-hidden /><dt className="text-stone-500">Contratista:</dt><dd className="font-medium text-stone-800">{expediente.contratista ? <Link href={`/contratacion/contratistas/${expediente.contratista.id}`} className="text-cdmb-700 hover:underline">{expediente.contratista.nombreORazonSocial} ({expediente.contratista.identificacion})</Link> : "Por definir"}</dd></div>
          <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2 lg:col-span-1">
            <UserCog className="h-3.5 w-3.5 text-stone-400" aria-hidden />
            <dt className="text-stone-500">Supervisor(es):</dt>
            <dd className="font-medium text-stone-800">
              {expediente.supervisores.length ? expediente.supervisores.map((s) => s.usuario.nombre).join(", ") : supervisorSecopPendiente ? null : "—"}
            </dd>
            {supervisorSecopPendiente && (
              <span
                className="whitespace-nowrap rounded-sm bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                title={`Reportado por SECOP II${expediente.supervisorSecopDocumento ? ` (C.C. ${expediente.supervisorSecopDocumento})` : ""}. Se vincula automáticamente cuando exista en Usuarios una cuenta con ese número de documento (alta manual o primer ingreso por directorio activo).`}
              >
                {expediente.supervisorSecopNombre} · sin usuario
              </span>
            )}
            {puedeGestionarContratistas(permisos) && (
              <EditarSupervisoresForm
                expedienteId={id}
                supervisoresDisponibles={supervisoresOpciones}
                supervisoresActualesIds={expediente.supervisores.map((s) => s.usuarioId)}
              />
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:col-span-2 lg:col-span-1">
            <UserCheck className="h-3.5 w-3.5 text-stone-400" aria-hidden />
            <dt className="text-stone-500">Personal asignado:</dt>
            <dd className="font-medium text-stone-800">{expediente.asignados.length ? expediente.asignados.map((a) => a.usuario.nombre).join(", ") : "—"}</dd>
            {puedeAsignarPersonal && (
              <EditarPersonalAsignadoForm
                expedienteId={id}
                personalDisponible={personalOpciones}
                asignadosActualesIds={expediente.asignados.map((a) => a.usuarioId)}
              />
            )}
          </div>
        </dl>

        <div className="mt-3 border-t border-stone-100 pt-3 text-sm">
          <div className="flex flex-wrap items-start gap-1.5">
            <FolderTree className="mt-0.5 h-3.5 w-3.5 text-stone-400" aria-hidden />
            <span className="text-stone-500">Clasificación TRD:</span>
            {expediente.subserie ? (
              <span className="min-w-0">
                <span className="font-medium text-stone-800">
                  {expediente.subserie.serie.dependencia?.nombre} · {expediente.subserie.serie.nombre} · {expediente.subserie.codigo} — {expediente.subserie.nombre}
                </span>
                <span className="block text-xs text-stone-500">{resumenRetencion(subserieBuscable({ id: expediente.subserieId!, ...expediente.subserie }))}</span>
              </span>
            ) : (
              <span className="rounded-sm bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Sin clasificar</span>
            )}
            {!esContratistaGecon(permisos) && (
              <a href="#gestion-documental" className="text-xs font-medium text-cdmb-700 hover:underline">
                {puedeEditarDatosGenerales ? (expediente.subserie ? "Reclasificar" : "Clasificar") : "Gestión documental"}
              </a>
            )}
          </div>
        </div>

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
            {!cerrado && puedeGestionarContratistas(permisos) && otrosContratosDelContratista.length > 0 && (
              <VincularExpedienteRelacionadoForm
                expedienteId={id}
                opciones={otrosContratosDelContratista}
                actualId={expediente.expedienteRelacionadoId}
              />
            )}
          </div>
        )}

        {faltaContratista && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
              <span>
                Falta el contratista para pasar a Contractual.
              </span>
            </div>
            {puedeEditarDatosGenerales && !expediente.idContratoSecop && <VincularContratistaForm expedienteId={id} />}
          </div>
        )}

        {!faltaContratista && puedeEditarDatosGenerales && !expediente.idContratoSecop && (
          <details className="group mt-3 text-xs" open={!expediente.contratista}>
            <summary className="cursor-pointer font-medium text-cdmb-700 [&::-webkit-details-marker]:hidden">
              {expediente.contratista ? "Cambiar el contratista" : "Vincular un contratista"}
            </summary>
            <p className="mt-1.5 text-stone-500">
              Contratista entre los usuarios registrados.
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
                className={`rounded-sm px-3 py-1 text-xs font-medium ${
                  actual ? "bg-menu-500 text-stone-900" : pasada ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-400"
                }`}
              >
                {ETIQUETA_ETAPA[etapa]}
              </span>
            );
          })}
          {expediente.cerrado && <span className="rounded-sm bg-stone-800 px-3 py-1 text-xs font-medium text-white">Cerrado</span>}
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
                etiquetaActual={ETIQUETA_ETAPA[expediente.etapaActual]}
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

      {plazosLiq && ["mutuo-acuerdo", "unilateral", "residual", "sin-competencia"].includes(liquidacion.fase) && (
        <section className={`rounded-xl border p-4 shadow-sm ${liquidacion.fase === "sin-competencia" || liquidacion.dias <= 30 ? "border-red-200 bg-red-50/40" : "border-amber-200 bg-amber-50/40"}`}>
          <h2 className="text-sm font-semibold text-stone-900">
            {ETIQUETA_FASE_LIQUIDACION[liquidacion.fase]}
            {liquidacion.fase !== "sin-competencia" && liquidacion.limite && (
              <span className="ml-2 text-xs font-normal text-stone-600">
                hasta el {formatearFechaCalendario(liquidacion.limite)} · {liquidacion.dias} día(s)
              </span>
            )}
          </h2>
          <p className="mt-1 text-xs text-stone-600">
            Mutuo acuerdo hasta {formatearFechaCalendario(plazosLiq.mutuoAcuerdo)} · unilateral hasta {formatearFechaCalendario(plazosLiq.unilateral)} · término residual hasta{" "}
            {formatearFechaCalendario(plazosLiq.residual)}. Se cumple al cargar el acta de liquidación (A-BS-FO135) en Postcontractual (Ley 1150 de 2007, art. 11;
            Manual A-BS-MA01, cap. 10).
            {expediente.terminadoAnticipadamente && " El contrato terminó anticipadamente: debe liquidarse aunque sea de prestación de servicios o compraventa."}
          </p>
        </section>
      )}



      <SecopPanel
        expedienteId={id}
        espejo={
          expediente.secop
            ? {
                idContrato: expediente.secop.idContrato,
                datos: datosSecop ?? {},
                facturas: expediente.secop.facturas as Record<string, unknown>[],
                garantias: expediente.secop.garantias as Record<string, unknown>[],
                modificaciones: expediente.secop.modificaciones as Record<string, unknown>[],
                adiciones: expediente.secop.adiciones as Record<string, unknown>[],
                suspensiones: expediente.secop.suspensiones as Record<string, unknown>[],
                sincronizadoEn: expediente.secop.sincronizadoEn,
              }
            : null
        }
        puedeSincronizar={puedeRegistrarModificacionContrato(permisos, expediente)}
      />

      <PestanasDetalle
        inicial={expediente.cerrado ? "POSTCONTRACTUAL" : expediente.etapaActual}
        grupos={[
          ...ETAPAS_ORDEN.map((etapa, i) => ({
            id: etapa,
            label: ETIQUETA_ETAPA[etapa],
            icono: etapa === "PRECONTRACTUAL" ? <ClipboardList className="h-4 w-4" aria-hidden /> : etapa === "CONTRACTUAL" ? <FileSignature className="h-4 w-4" aria-hidden /> : <FolderCheck className="h-4 w-4" aria-hidden />,
            contador: etapa === "PRECONTRACTUAL" && ocultaPrecontractualParaMi ? undefined : expediente.documentos.filter((d) => d.etapa === etapa).length,
            contenido: (() => {
                const estado = expediente.cerrado || i < idxActual ? "completada" : i === idxActual ? "actual" : "bloqueada";
                const puedeGestionarPrivilegiado = puedeGestionarExpedienteCompleto(permisos, expediente);
                const ocultaPorRol = etapa === "PRECONTRACTUAL" && ocultaPrecontractualParaMi;
                const puedeVerEtapaCompleta =
                  !ocultaPorRol &&
                  (estado !== "bloqueada" ||
                    puedeGestionarPrivilegiado ||
                    (supervisaElExpediente(permisos, expediente.id)));

                if (ocultaPorRol) {
                  return (
                    <div key={etapa} className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/60 p-5 opacity-70">
                      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-stone-500">
                        <Lock className="h-3.5 w-3.5" aria-hidden />
                        {ETIQUETA_ETAPA[etapa]} — no disponible para el contratista
                      </h3>
                    </div>
                  );
                }

                if (!puedeVerEtapaCompleta) {
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
                const puedeSubir =
                  (estado !== "bloqueada" || puedeSubirEnCualquierEtapaContrato(permisos)) &&
                  (estado === "actual" || puedeGestionarPrivilegiado) &&
                  !expediente.cerrado &&
                  puedeSubirDocumentoContrato(permisos, expediente, etapa);
                const etapaInfo =
                  estado === "completada" ? "border-emerald-100 bg-emerald-50/20" : estado === "bloqueada" ? "border-dashed border-amber-200 bg-amber-50/10" : "border-stone-200 bg-white";
                const puedeGestionarEtapaCerrada =
                  !cerrado &&
                  !(etapa === "PRECONTRACTUAL" && esContratistaGecon(permisos)) &&
                  (estado === "actual" || puedeGestionarPrivilegiado || (supervisaElExpediente(permisos, expediente.id)));

                return (
                  <details key={etapa} open className={`group rounded-2xl border p-5 shadow-sm ${etapaInfo}`}>
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
                              <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${item.obligatorio ? "bg-red-50 text-red-600" : "bg-stone-100 text-stone-500"}`}>
                                {item.obligatorio ? "Obligatorio" : "Opcional"}
                              </span>
                              {item.gestionadoEnSecop && (
                                <span className="rounded-sm bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">Se gestiona en SECOP II</span>
                              )}
                              {!esRequisitoPorPeriodos(item) && item.documento && (
                                <>
                                  <EstadoFirmaDocumento
                                    requiereFirma={item.documento.requiereFirma}
                                    cargadoEnSecop={item.documento.cargadoEnSecop}
                                    solicitudes={item.documento.solicitudesFirma}
                                    totalFirmas={item.documento.totalFirmas}
                                  />
                                  {marcaFirma(item.documento, item.documento.totalFirmas, etapa)}
                                </>
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
                                    <span key={s.id} className={`rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${CLASE_ESTADO_SOLICITUD[s.estado]}`}>
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
                              <EstadoDocumento estado={item.documento.estadoValidacion} etapa={etapa} />
                              <VistaPreviaDocumento
                                url={`/api/contratacion-documentos/${item.documento.id}${item.documento.mimeType === "application/pdf" && (item.documento.totalFirmas > 0 || item.documento.solicitudesFirma.some((s) => s.rol === "VISTO_BUENO" && s.estado === "COMPLETADA")) ? "/rotulado" : ""}`}
                                nombre={item.documento.nombre}
                                mimeType={item.documento.mimeType}
                              />
                              {puedeValidarEn(etapa) && item.documento.estadoValidacion !== "APROBADO" && (
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
                                <AsignarFirmantesModal conCalidad contratistaPrincipal
                                  endpointAsignar={`/api/contratacion/documentos/${item.documento.id}/solicitudes-firma`}
                                 
                                  firmantesActuales={item.documento.solicitudesFirma.map((s) => ({
                                    id: s.id,
                                    usuarioAsignadoId: s.usuarioAsignadoId,
                                    usuarioAsignadoNombre: s.usuarioAsignadoNombre,
                                    rol: s.rol,
                                    orden: s.orden,
                                    calidad: s.calidad,
                                    estado: s.estado,
                                    completadoEn: s.completadoEn ? formatearFechaHora(s.completadoEn) : null,
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
                                {doc.categoria && <span className="rounded-sm bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">{doc.categoria}</span>}
                                <EstadoFirmaDocumento requiereFirma={doc.requiereFirma} cargadoEnSecop={doc.cargadoEnSecop} solicitudes={solicitudes} totalFirmas={doc.firmas.length} />
                                {marcaFirma(doc, doc.firmas.length, etapa)}
                                {solicitudes.some((s) => s.estado !== "RECHAZADA") && (
                                  <div className="flex flex-wrap gap-1">
                                    {solicitudes
                                      .filter((s) => s.estado !== "RECHAZADA")
                                      .map((s) => (
                                        <span key={s.id} className={`rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${CLASE_ESTADO_SOLICITUD[s.estado]}`}>
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
                                {puedeValidarEn(etapa) && doc.estadoValidacion !== "APROBADO" && <ValidarDocumentoBoton documentoId={doc.id} nombre={doc.nombre} />}
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
                                  <AsignarFirmantesModal conCalidad contratistaPrincipal
                                    endpointAsignar={`/api/contratacion/documentos/${doc.id}/solicitudes-firma`}
                                   
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
                      <details id={`subir-${etapa}`} className="group scroll-mt-28">
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
            })(),
          })),
          {
            id: "trazabilidad",
            label: "Trazabilidad",
            icono: <History className="h-4 w-4" aria-hidden />,
            oculta: trazabilidad.length === 0,
            contenido: (
                <details open className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
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
                    Registro encadenado por hash.
                  </p>
                  <ul className="divide-y divide-stone-100 text-xs">
                    {[...trazabilidad].reverse().map((mov) => (
                      <li key={mov.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                        <span className={`flex-none rounded-sm px-2 py-0.5 font-medium ${CLASE_ACCION_AUDITORIA[mov.accion] ?? "bg-stone-100 text-stone-600"}`}>
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
            ),
          },
          {
            id: "administracion",
            label: "Administración",
            icono: <Settings2 className="h-4 w-4" aria-hidden />,
            oculta: esContratistaGecon(permisos),
            contenido: (
              <PanelGestionDocumental
                accion={`/api/contratacion/expedientes/${id}/gestion-documental`}
                clasificacion={
                  expediente.subserie
                    ? {
                        dependencia: expediente.subserie.serie.dependencia?.nombre ?? null,
                        serie: expediente.subserie.serie.nombre,
                        subserie: `${expediente.subserie.codigo} — ${expediente.subserie.nombre}`,
                        retencion: resumenRetencion(subserieBuscable({ id: expediente.subserieId!, ...expediente.subserie })),
                      }
                    : null
                }
                formularioTrd={
                  <DetallesPerezosos
                    className="text-xs"
                    abiertoInicial={!expediente.subserie}
                    resumen={expediente.subserie ? "Cambiar clasificación" : "Clasificar este expediente"}
                  >
                    <ReclasificarTrdContratoForm
                      expedienteId={id}
                      subseriePorModalidad={subseriePorModalidadTrd}
                      modalidad={expediente.modalidadSeleccion}
                      modalidadEtiqueta={ETIQUETA_MODALIDAD[expediente.modalidadSeleccion]}
                      serieIdActual={expediente.subserie?.serieId ?? null}
                      subserieIdActual={expediente.subserieId}
                    />
                  </DetallesPerezosos>
                }
                nivelAcceso={expediente.nivelAcceso}
                fundamentoNivelAcceso={expediente.fundamentoNivelAcceso}
                puedeEditar={puedeGestionDocumental}
                cerrado={cerrado}
                cerradoEn={expediente.fechaCierre}
                cerradoPor={eventoCierre?.usuario?.nombre ?? null}
                fichaSgdea={fichaSgdea}
                puedeReabrir={puedeGestionarEtapasContratacion(permisos)}
                cierre={{
                  descripcion:
                    "Se cierra al aprobar Postcontractual y se archiva en el SGDEA. Requiere TRD y firmas completas.",
                  bloqueo: !esUltimaEtapa
                    ? "Disponible al llegar a la etapa Postcontractual."
                    : !expediente.subserieId
                      ? "Asigne la clasificación TRD."
                      : firmasPendientes > 0
                        ? mensajeFirmasPendientes(firmasPendientes)
                        : null,
                  control:
                    esUltimaEtapa && puedeAprobar && expediente.subserieId && firmasPendientes === 0 ? (
                      <AprobarEtapaContratoBoton expedienteId={id} etiquetaActual={ETIQUETA_ETAPA[expediente.etapaActual]} etiquetaSiguiente="Cierre del expediente" />
                    ) : null,
                }}
              />
            ),
          },
        ]}
      />

      {!expediente.cerrado && (puedeSubirEtapaActual || puedeAprobarDesdeBotonera || puedeRetroceder) && (
        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-200 bg-white px-4 py-2.5 shadow-soft-lg print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            {puedeSubirEtapaActual && (
              <a
                href={`#subir-${expediente.etapaActual}`}
                className="inline-flex items-center gap-1.5 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                <Paperclip className="h-4 w-4" aria-hidden />
                Subir documento
              </a>
            )}
            <Link
              prefetch={false}
              href="/contratacion/buzon"
              className="inline-flex items-center gap-1.5 rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              <PenLine className="h-4 w-4" aria-hidden />
              Buzón de firmas
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {puedeRetroceder && (
              <RetrocederEtapaBoton expedienteId={id} etiquetaAnterior={ETIQUETA_ETAPA[ETAPAS_ORDEN[idxActual - 1]!]} />
            )}
            {puedeAprobarDesdeBotonera && (
              <AprobarEtapaContratoBoton
                expedienteId={id}
                etiquetaActual={ETIQUETA_ETAPA[expediente.etapaActual]}
                etiquetaSiguiente={ETIQUETA_ETAPA[siguienteEtapa!]}
              />
            )}
          </div>
        </div>
      )}
    </section>
    </ProveedorUsuariosFirma>
  );
}
