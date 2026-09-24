import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Eye, Lock, MapPin, Hand, User, FileText, Clock, AlertTriangle, Check, Inbox, Tag, Printer, Hash, ChevronDown } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { EstadoBadge } from "@/components/EstadoBadge";
import { infoEvento } from "@/components/EventoIcono";
import { Field, SectionHelp } from "@/components/Field";
import { SubirDocumentoPasoForm } from "@/components/SubirDocumentoPasoForm";
import { cargoCoincideConPaso, cargoCanonico, cargosEnTexto, puedeGestionarPaso } from "@/lib/cargos";
import { ProgresoExpediente } from "@/components/ProgresoExpediente";
import { documentoEtapaAbierta, puedeIntentarEliminarDocumento } from "@/lib/documentos";
import {
  obtenerPermisosUsuario,
  puedeAccederTramite,
  puedeEditarTramite,
  puedeAsignarFirmantesDocumentoTramite,
  puedeValidarDocumentoTramite,
} from "@/lib/permisos";
import { puedeActuarSolicitud } from "@/lib/solicitudes-firma";
import { EliminarDocumentoBoton } from "@/components/EliminarDocumentoBoton";
import { AsignacionExpedienteForm } from "@/components/AsignacionExpedienteForm";
import { EditarDocumentoBoton } from "@/components/EditarDocumentoBoton";
import { ValidarDocumentoBoton } from "@/components/ValidarDocumentoBoton";
import { AsignarFirmantesModal } from "@/components/AsignarFirmantesModal";
import { ConfirmarFirmaModal } from "@/components/ConfirmarFirmaModal";
import { VistaPreviaDocumento } from "@/components/VistaPreviaDocumento";
import { MapaSoloLectura } from "@/components/MapaSoloLectura";
import { CapturarVisitaTecnica } from "@/components/CapturarVisitaTecnica";
import { regimenTributarioLabel } from "@/lib/regimen-tributario";
import { formatearFecha, formatearFechaHora } from "@/lib/fecha";

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
const ETIQUETA_ROL_FIRMANTE: Record<string, string> = { FIRMA: "firma", VISTO_BUENO: "visto bueno", LECTURA: "lectura" };
const ETIQUETA_ESTADO_SOLICITUD: Record<string, string> = { PENDIENTE: "pendiente", COMPLETADA: "completada", RECHAZADA: "rechazada" };
const CLASE_ESTADO_SOLICITUD: Record<string, string> = {
  PENDIENTE: "bg-amber-50 text-amber-700",
  COMPLETADA: "bg-emerald-50 text-emerald-700",
  RECHAZADA: "bg-red-50 text-red-700",
};
const ETIQUETA_ACCION_AUDITORIA: Record<string, string> = { CREA: "Subió", MODIFICA: "Editó", ELIMINA: "Eliminó", VALIDA: "Validó" };
const CLASE_ACCION_AUDITORIA: Record<string, string> = {
  CREA: "bg-cdmb-50 text-cdmb-700",
  MODIFICA: "bg-amber-50 text-amber-700",
  ELIMINA: "bg-red-50 text-red-700",
  VALIDA: "bg-emerald-50 text-emerald-700",
};

const ESTADOS = [
  "RADICADO",
  "EN_TRAMITE",
  "INFORMACION_ADICIONAL_REQUERIDA",
  "SUSPENDIDO",
  "APROBADO",
  "NEGADO",
  "DESISTIDO",
  "ARCHIVADO",
  "RECHAZADO",
] as const;

type Opcion = { respuesta: string; siguientePaso: number | null; resultado?: string };

const formatoFechaHistoria = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function ExpedienteDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [expediente, usuariosActivos, cargos] = await Promise.all([
    db.expediente.findUnique({
      where: { id },
      include: {
        tramiteTipo: true,
        flujo: { include: { pasos: { orderBy: { numero: "asc" } } } },
        documentos: {
          orderBy: { createdAt: "desc" },
          include: {
            subidoPor: true,
            firmas: true,
            solicitudesFirma: { include: { usuarioAsignado: { select: { nombre: true } } }, orderBy: { orden: "asc" } },
          },
        },
        eventos: { orderBy: { createdAt: "asc" }, include: { usuario: true } },
        visitasTecnicas: { orderBy: { createdAt: "desc" }, include: { capturadoPor: true } },
        creadoPor: true,
        responsableActual: true,
        usuariosAsignados: true,
        cargosAsignados: true,
        solicitante: true,
        comunicaciones: { orderBy: { fechaRadicacion: "desc" }, select: { id: true, tipo: true, radicado: true, asunto: true, fechaRadicacion: true, estado: true } },
      },
    }),
    db.usuario.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, cargos: { select: { nombre: true } }, dependencia: { select: { nombre: true } } },
    }),
    db.cargo.findMany({ orderBy: { orden: "asc" } }),
  ]);

  if (!expediente) notFound();

  const session = await getSession();
  let puedeEditar = true;
  let puedeAsignarFirmantes = false;
  let puedeValidar = false;
  if (session) {
    const permisos = await obtenerPermisosUsuario(session.userId);
    if (!puedeAccederTramite(permisos, expediente.tramiteTipoId)) notFound();
    puedeEditar = puedeEditarTramite(permisos, expediente.tramiteTipoId);
    puedeAsignarFirmantes = puedeAsignarFirmantesDocumentoTramite(permisos);
    puedeValidar = puedeValidarDocumentoTramite(permisos);
  }

  const idsDocumentos = expediente.documentos.map((d) => d.id);
  const [rechazos, trazabilidad] = await Promise.all([
    db.expedienteEvento.findMany({
      where: { expedienteId: id, tipo: "DOCUMENTO_RECHAZADO" },
      orderBy: { createdAt: "desc" },
      include: { usuario: { select: { nombre: true } } },
    }),
    idsDocumentos.length > 0
      ? db.auditoriaDoc.findMany({
          where: { entidad: "ExpedienteDocumento", entidadId: { in: idsDocumentos } },
          orderBy: { secuencia: "asc" },
          include: { usuario: { select: { nombre: true } } },
        })
      : Promise.resolve([]),
  ]);
  const usuariosOpciones = usuariosActivos.map((u) => ({ id: u.id, nombre: u.nombre, dependenciaNombre: u.dependencia?.nombre ?? null }));
  const pasos = expediente.flujo.pasos;
  const currentIndex = pasos.findIndex((p) => p.numero === expediente.pasoActualNumero);
  const pasoActual = currentIndex >= 0 ? pasos[currentIndex] : null;
  const siguientePaso = currentIndex >= 0 ? pasos[currentIndex + 1] : null;
  const esTerminal = ["APROBADO", "NEGADO", "DESISTIDO", "ARCHIVADO", "RECHAZADO"].includes(expediente.estado);
  const esMiPaso = pasoActual ? cargoCoincideConPaso(session?.cargos, pasoActual.responsables) : false;
  const puedeAvanzar = puedeEditar && pasoActual ? puedeGestionarPaso(session, pasoActual.responsables) : false;
  const cargosDelPasoActual = pasoActual ? cargosEnTexto(pasoActual.responsables.join(" | ")) : [];
  const visitasDelPasoActual = pasoActual
    ? expediente.visitasTecnicas.filter((v) => v.pasoNumero === pasoActual.numero)
    : [];

  const gruposDocumentos: Array<[number | null, typeof expediente.documentos]> = [];
  for (const doc of expediente.documentos) {
    let grupo = gruposDocumentos.find(([num]) => num === doc.pasoNumero);
    if (!grupo) {
      grupo = [doc.pasoNumero, []];
      gruposDocumentos.push(grupo);
    }
    grupo[1].push(doc);
  }
  gruposDocumentos.sort(([a], [b]) => (a ?? -1) - (b ?? -1));

  const documentosPasoActual = pasoActual ? expediente.documentos.filter((d) => d.pasoNumero === pasoActual.numero) : [];

  const filaDocumento = (doc:(typeof expediente.documentos)[number]) => {
    const abierta = documentoEtapaAbierta(doc.pasoNumero, expediente.pasoActualNumero);
    const puede =
      puedeEditar &&
      puedeIntentarEliminarDocumento({
        esAdmin: session?.rol === "ADMIN",
        esQuienLoSubio: session?.userId === doc.subidoPorId,
        etapaAbierta: abierta,
      });
    const solicitudes = doc.solicitudesFirma.map((s) => ({
      id: s.id,
      usuarioAsignadoId: s.usuarioAsignadoId,
      usuarioAsignadoNombre: s.usuarioAsignado.nombre,
      rol: s.rol,
      orden: s.orden,
      estado: s.estado,
    }));
    const miSolicitud = session
      ? solicitudes.find((s) => s.usuarioAsignadoId === session.userId && s.estado === "PENDIENTE" && s.rol !== "LECTURA")
      : undefined;
    const puedeActuarYo = miSolicitud && puedeActuarSolicitud(solicitudes, miSolicitud);
    const firmado = doc.mimeType === "application/pdf" && doc.firmas.length > 0;
    return (
      <li key={doc.id} className="flex flex-col gap-2 px-4 py-2.5 text-sm lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 lg:flex-1">
          <a
            href={`/api/documentos/${doc.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-cdmb-700 hover:underline"
          >
            <FileText className="h-3.5 w-3.5 flex-none" aria-hidden />
            {doc.nombre}
          </a>
          {doc.descripcion && <p className="text-xs text-stone-500">{doc.descripcion}</p>}
          <p className="text-xs text-stone-400">
            {doc.subidoPor.nombre} · {formatearFecha(doc.createdAt)}
          </p>
          {solicitudes.some((s) => s.estado !== "RECHAZADA") && (
            <div className="mt-1 flex flex-wrap gap-1">
              {solicitudes
                .filter((s) => s.estado !== "RECHAZADA")
                .map((s) => (
                  <span key={s.id} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${CLASE_ESTADO_SOLICITUD[s.estado]}`}>
                    {s.usuarioAsignadoNombre} · {ETIQUETA_ROL_FIRMANTE[s.rol]} · {ETIQUETA_ESTADO_SOLICITUD[s.estado]}
                  </span>
                ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 lg:max-w-[60%] lg:justify-end">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CLASE_ESTADO_VALIDACION[doc.estadoValidacion]}`}>
            {ETIQUETA_ESTADO_VALIDACION[doc.estadoValidacion]}
          </span>
          {doc.requiereFirma && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                solicitudes.some((s) => s.rol === "FIRMA") ? "bg-emerald-50 text-emerald-700" : "animate-pulse bg-amber-100 text-amber-800"
              }`}
            >
              {solicitudes.some((s) => s.rol === "FIRMA") ? "Firmante asignado" : "Requiere asignar firmante"}
            </span>
          )}
          <VistaPreviaDocumento
            url={`/api/documentos/${doc.id}${firmado ? "/rotulado" : ""}`}
            nombre={doc.nombre}
            mimeType={doc.mimeType}
          />
          {puedeValidar && doc.estadoValidacion !== "APROBADO" && (
            <ValidarDocumentoBoton documentoId={doc.id} nombre={doc.nombre} endpoint={`/api/documentos/${doc.id}/validar`} />
          )}
          {firmado && (
            <a
              href={`/api/documentos/${doc.id}/rotulado`}
              target="_blank"
              rel="noreferrer"
              title="PDF con el sello de firma electrónica y el QR de verificación estampados"
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Con firma
            </a>
          )}
          {miSolicitud && puedeActuarYo && (
            <ConfirmarFirmaModal
              rol={miSolicitud.rol === "FIRMA" ? "FIRMA" : "VISTO_BUENO"}
              endpointCompletar={`/api/solicitudes-firma/${miSolicitud.id}/completar`}
              endpointRechazar={`/api/solicitudes-firma/${miSolicitud.id}/rechazar`}
              documentoUrl={`/api/documentos/${doc.id}`}
              documentoNombre={doc.nombre}
              documentoMimeType={doc.mimeType}
            />
          )}
          {puedeAsignarFirmantes && (
            <AsignarFirmantesModal
              endpointAsignar={`/api/documentos/${doc.id}/solicitudes-firma`}
              usuarios={usuariosOpciones}
              firmantesActuales={solicitudes}
            />
          )}
          <EditarDocumentoBoton
            documentoId={doc.id}
            expedienteId={expediente.id}
            nombreActual={doc.nombre}
            requiereFirmaActual={doc.requiereFirma}
            etapaAbierta={abierta}
            puedeEditar={puede}
          />
          <EliminarDocumentoBoton documentoId={doc.id} nombre={doc.nombre} etapaAbierta={abierta} puedeEliminar={puede} />
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/expedientes" className="text-sm text-cdmb-700 hover:underline">
          ← Expedientes
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-stone-900">{expediente.numero}</h1>
          <EstadoBadge estado={expediente.estado} />
          <Link
            href={`/expedientes/${expediente.id}/ficha-firma`}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden />
            Ficha técnica de firmas
          </Link>
        </div>
        <p className="text-sm text-stone-500">
          <Link href={`/tramites/${expediente.tramiteTipo.slug}`} className="hover:text-cdmb-700">
            {expediente.tramiteTipo.nombre}
          </Link>{" "}
          · Flujo: {expediente.flujo.nombre}
        </p>
        <div className="mt-3 max-w-md">
          <ProgresoExpediente pasoActualNumero={expediente.pasoActualNumero} totalPasos={pasos.length} estado={expediente.estado} tamaño="grande" />
        </div>
      </div>

      {!puedeEditar && (
        <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <Eye className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
          Solo puede consultar este expediente — su acceso a este trámite es de solo lectura. No puede
          adjuntar documentos, comentar, ni avanzar pasos.
        </div>
      )}
      {error === "sin-permiso-paso" && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Lock className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
          No pudo avanzarse el paso: según el procedimiento, este paso le corresponde a{" "}
          <strong>{cargosDelPasoActual.join(", ") || "otro cargo"}</strong>, y su cargo actual no coincide. Solo un
          administrador o un funcionario con ese cargo puede completarlo.
        </div>
      )}
      {error === "sin-permiso-estado" && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Lock className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
          Solo un administrador puede cambiar el estado del expediente manualmente.
        </div>
      )}

      <div className="space-y-6">
        <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
          <h2 className="mb-2 text-sm font-semibold text-stone-900">Solicitante</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">
                {expediente.solicitanteTipo === "JURIDICA" ? "NIT" : "Cédula de ciudadanía"}
              </dt>
              <dd className="break-words text-stone-800">{expediente.solicitanteIdentificacion}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">Nombre / razón social</dt>
              <dd className="break-words text-stone-800">{expediente.solicitanteNombre}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">Correo</dt>
              <dd className="break-all text-stone-800">{expediente.solicitanteEmail ?? "—"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">Teléfono</dt>
              <dd className="break-words text-stone-800">{expediente.solicitanteTelefono ?? "—"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">Municipio</dt>
              <dd className="break-words text-stone-800">{expediente.municipio}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">Dirección del solicitante</dt>
              <dd className="break-words text-stone-800">{expediente.solicitanteDireccion ?? "—"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">Dirección donde se adelanta el trámite</dt>
              <dd className="break-words text-stone-800">{expediente.predioDireccion ?? "—"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">Régimen tributario</dt>
              <dd className="break-words text-stone-800">{regimenTributarioLabel(expediente.solicitante?.regimenTributario)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-stone-400">Gran contribuyente</dt>
              <dd className="text-stone-800">{expediente.solicitante?.granContribuyente ? "Sí" : "No"}</dd>
            </div>
          </dl>

          <BloqueDatosPredio
            claseSolicitud={expediente.claseSolicitud}
            nombre={expediente.predioNombre}
            catastral={expediente.predioCatastral}
            matricula={expediente.predioMatricula}
            areaM2={expediente.predioAreaM2}
            areaCultivosM2={expediente.predioAreaCultivosM2}
            areaBosqueM2={expediente.predioAreaBosqueM2}
            viviendas={expediente.predioViviendas}
          />

          <BloqueUbicacion
            titulo={
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                Ubicación del lugar del trámite
              </span>
            }
            lat={expediente.ubicacionLat}
            lon={expediente.ubicacionLon}
            planaX={expediente.ubicacionPlanaX}
            planaY={expediente.ubicacionPlanaY}
            cartX={expediente.ubicacionCartesianaX}
            cartY={expediente.ubicacionCartesianaY}
            cartZ={expediente.ubicacionCartesianaZ}
          />
          <BloqueUbicacion
            titulo={
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                Ubicación del solicitante
              </span>
            }
            lat={expediente.solicitanteUbicacionLat}
            lon={expediente.solicitanteUbicacionLon}
            planaX={expediente.solicitanteUbicacionPlanaX}
            planaY={expediente.solicitanteUbicacionPlanaY}
            cartX={expediente.solicitanteUbicacionCartesianaX}
            cartY={expediente.solicitanteUbicacionCartesianaY}
            cartZ={expediente.solicitanteUbicacionCartesianaZ}
          />
        </section>

        {esTerminal && (
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
            Este expediente ya llegó a un estado final (<EstadoBadge estado={expediente.estado} />) — se
            puede seguir documentando (por ejemplo, el seguimiento posterior), pero ya no está activo.
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-start">
          <div className="rounded-xl md:col-span-1 border border-stone-200 bg-white shadow-soft p-4 text-xs text-stone-500">
            <p>
              <span className="font-medium text-stone-700">Radicado:</span>{" "}
              {formatearFecha(expediente.fechaRadicacion)}
            </p>
            <p>
              <span className="font-medium text-stone-700">Creado por:</span> {expediente.creadoPor.nombre}
            </p>
            {expediente.responsableActual && (
              <p>
                <span className="font-medium text-stone-700">A cargo de:</span> {expediente.responsableActual.nombre}
              </p>
            )}
          </div>
          <div className="rounded-xl md:col-span-2 border border-stone-200 bg-white shadow-soft p-4">
            <h3 className="text-sm font-semibold text-stone-900">Asignado a</h3>
            <p className="mb-2 text-xs text-stone-500">
              Quién(es) deben trabajar este expediente — usuarios puntuales y/o cargos completos.
              Es informativo: cualquier funcionario sigue pudiendo actuar sobre el expediente.
            </p>
            {expediente.usuariosAsignados.length === 0 && expediente.cargosAsignados.length === 0 ? (
              <p className="text-sm text-stone-400">Sin asignar todavía.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {expediente.usuariosAsignados.map((u) => (
                  <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-cdmb-50 px-2.5 py-1 text-xs font-medium text-cdmb-800">
                    <User className="h-3 w-3" aria-hidden />
                    {u.nombre}
                  </span>
                ))}
                {expediente.cargosAsignados.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">
                    <Tag className="h-3 w-3" aria-hidden />
                    {c.nombre}
                  </span>
                ))}
              </div>
            )}

            {session?.rol === "ADMIN" && (
              <details className="mt-3 group">
                <summary className="cursor-pointer text-xs font-medium text-cdmb-700 [&::-webkit-details-marker]:hidden">
                  Editar asignación
                </summary>
                <AsignacionExpedienteForm
                  expedienteId={expediente.id}
                  usuarios={usuariosActivos.map((u) => ({ id: u.id, nombre: u.nombre, detalle: u.cargos.map((c) => c.nombre).join(", ") || null }))}
                  cargos={cargos.map((c) => ({ id: c.id, nombre: c.nombre }))}
                  usuariosIniciales={expediente.usuariosAsignados.map((u) => u.id)}
                  cargosIniciales={expediente.cargosAsignados.map((c) => c.id)}
                />
              </details>
            )}
          </div>
        </div>

        {pasoActual ? (
          <section className="rounded-xl border border-cdmb-300 bg-white p-5">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-cdmb-600">
                Paso actual ({pasoActual.numero} de {pasos.length})
              </p>
              {esMiPaso && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  <Hand className="h-3 w-3" aria-hidden />
                  Corresponde a su cargo ({session?.cargos.join(", ")})
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-stone-900">{pasoActual.titulo}</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-stone-600">{pasoActual.descripcion}</p>

            <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              {pasoActual.responsables.length > 0 && (
                <div>
                  <dt className="flex items-center gap-1 font-medium text-stone-500">
                    <User className="h-3 w-3" aria-hidden />
                    Responsable
                  </dt>
                  <dd className="text-stone-700">
                    {Array.from(new Set(pasoActual.responsables.map(cargoCanonico))).join(", ")}
                  </dd>
                </div>
              )}
              {pasoActual.documentos.length > 0 && (
                <div>
                  <dt className="flex items-center gap-1 font-medium text-stone-500">
                    <FileText className="h-3 w-3" aria-hidden />
                    Documentos/registros de este paso
                  </dt>
                  <dd className="text-stone-700">{pasoActual.documentos.join(", ")}</dd>
                </div>
              )}
              {pasoActual.tiempo && (
                <div>
                  <dt className="flex items-center gap-1 font-medium text-stone-500">
                    <Clock className="h-3 w-3" aria-hidden />
                    Tiempo estimado
                  </dt>
                  <dd className="text-stone-700">{pasoActual.tiempo}</dd>
                </div>
              )}
            </dl>

            {puedeEditar && (
              <div className="mt-4 border-t border-stone-100 pt-4">
                <SubirDocumentoPasoForm
                  expedienteId={expediente.id}
                  pasoNumero={pasoActual.numero}
                  documentosDelPaso={pasoActual.documentos}
                  documentosCargados={documentosPasoActual.map((d) => d.descripcion ?? "")}
                />
              </div>
            )}

            {documentosPasoActual.length > 0 && (
              <div className="mt-4 border-t border-stone-100 pt-4">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Documentos cargados en este paso ({documentosPasoActual.length})
                </h3>
                <p className="mb-2 text-xs text-stone-500">
                  Desde aquí se asignan firmantes, se firma, se da visto bueno o se valida cada archivo.
                </p>
                <ul className="divide-y divide-stone-100 rounded-lg border border-stone-100">
                  {documentosPasoActual.map((doc) => filaDocumento(doc))}
                </ul>
              </div>
            )}

            <div className="mt-4 border-t border-stone-100 pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                Geoposición de la visita técnica (opcional)
              </h3>
              {visitasDelPasoActual.length > 0 && (
                <ul className="mb-3 space-y-3">
                  {visitasDelPasoActual.map((v) => (
                    <li key={v.id} className="rounded-lg border border-stone-200 bg-stone-50/60 p-3">
                      <MapaSoloLectura lat={v.lat} lon={v.lon} />
                      <p className="mt-2 text-xs text-stone-600">
                        Latitud/longitud: {v.lat.toFixed(6)}, {v.lon.toFixed(6)}
                        {v.precisionM != null && <> · Precisión reportada: ±{Math.round(v.precisionM)} m</>}
                      </p>
                      {v.nota && <p className="text-xs text-stone-600">Nota: {v.nota}</p>}
                      <p className="mt-0.5 text-xs text-stone-400">
                        {v.capturadoPor.nombre} · {formatoFechaHistoria.format(v.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {puedeEditar && <CapturarVisitaTecnica expedienteId={expediente.id} pasoNumero={pasoActual.numero} />}
            </div>

            <div className="mt-4 border-t border-stone-100 pt-4">
              {!puedeEditar ? (
                <p className="flex items-start gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-500">
                  <Eye className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
                  Su acceso a este trámite es de solo lectura — no puede avanzar este paso.
                </p>
              ) : !puedeAvanzar ? (
                <p className="flex items-start gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-500">
                  <Lock className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
                  Este paso solo puede avanzarlo{" "}
                  <strong className="text-stone-700">{cargosDelPasoActual.join(", ")}</strong>
                  {session && session.cargos.length > 0 ? (
                    <> — su(s) cargo(s) actual(es): &quot;{session.cargos.join(", ")}&quot;.</>
                  ) : (
                    " — no tiene un cargo asignado."
                  )}{" "}
                  Puede seguir adjuntando documentos y registrando la visita técnica; para avanzar el paso, pídale
                  a la persona con ese cargo (o a un administrador) que lo haga.
                </p>
              ) : pasoActual.esDecision ? (
                <div className="space-y-2">
                  <p className="flex items-start gap-1.5 text-xs font-medium text-stone-500">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
                    Este paso requiere una decisión. Seleccione la opción correspondiente para que el
                    expediente siga el camino correcto:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(pasoActual.opciones) &&
                      (pasoActual.opciones as unknown as Opcion[]).map((op, idx) => (
                        <form key={idx} action={`/api/expedientes/${expediente.id}/avanzar`} method="post">
                          {op.siguientePaso != null && (
                            <input type="hidden" name="siguientePasoNumero" value={op.siguientePaso} />
                          )}
                          {op.resultado && <input type="hidden" name="resultado" value={op.resultado} />}
                          <button
                            type="submit"
                            className="rounded-md border border-cdmb-300 bg-cdmb-50 px-3 py-1.5 text-sm font-medium text-cdmb-800 hover:bg-cdmb-100"
                          >
                            {op.respuesta}
                          </button>
                        </form>
                      ))}
                    {!Array.isArray(pasoActual.opciones) && siguientePaso && (
                      <form action={`/api/expedientes/${expediente.id}/avanzar`} method="post">
                        <input type="hidden" name="siguientePasoNumero" value={siguientePaso.numero} />
                        <button
                          type="submit"
                          className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
                        >
                          Continuar al paso {siguientePaso.numero}
                        </button>
                      </form>
                    )}
                  </div>
                  <p className="text-xs text-stone-400">
                    Si ninguna opción corresponde, utilice &quot;Cambiar estado manualmente&quot; más abajo.
                  </p>
                </div>
              ) : siguientePaso ? (
                <form action={`/api/expedientes/${expediente.id}/avanzar`} method="post">
                  <input type="hidden" name="siguientePasoNumero" value={siguientePaso.numero} />
                  <button
                    type="submit"
                    className="rounded-md bg-cdmb-600 px-4 py-2 text-sm font-medium text-white hover:bg-cdmb-700"
                  >
                    Marcar paso {pasoActual.numero} como completado → continuar al paso {siguientePaso.numero}
                  </button>
                </form>
              ) : (
                <p className="rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-500">
                  Este es el último paso del flujo. Si el trámite ya quedó resuelto, debe definirse el
                  estado final mediante &quot;Cambiar estado manualmente&quot; más abajo.
                </p>
              )}
            </div>
          </section>
        ) : (
          <SectionHelp>Este expediente no tiene un paso activo (el flujo no tiene pasos definidos).</SectionHelp>
        )}

        <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-stone-900">Documentos del expediente</h2>
              <p className="text-xs text-stone-500">Agrupados por etapa, de la radicación en adelante. Haga clic en una etapa para desplegarla.</p>
            </div>
            <span className="text-xs text-stone-400">
              {expediente.documentos.length} documento{expediente.documentos.length === 1 ? "" : "s"}
            </span>
          </div>
          {expediente.documentos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-200 px-4 py-6 text-center text-sm text-stone-400">Sin documentos todavía.</p>
          ) : (
            <div className="space-y-2">
              {gruposDocumentos.map(([numeroPaso, docs]) => {
                const tituloPaso = numeroPaso == null ? null : pasos.find((p) => p.numero === numeroPaso)?.titulo;
                const esActual = numeroPaso === expediente.pasoActualNumero;
                const sinFirmante = docs.filter((d) => d.requiereFirma && !d.solicitudesFirma.some((s) => s.rol === "FIRMA")).length;
                return (
                  <details key={numeroPaso ?? "radicacion"} open={esActual} className="group rounded-lg border border-stone-200">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                      <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-cdmb-700">
                        {numeroPaso == null ? (
                          <>
                            <Inbox className="h-3.5 w-3.5 flex-none" aria-hidden />
                            Documentos de radicación
                          </>
                        ) : (
                          `Paso ${numeroPaso}${tituloPaso ? ` · ${tituloPaso}` : ""}`
                        )}
                        {esActual && (
                          <span className="rounded-full bg-cdmb-600 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-white">Paso actual</span>
                        )}
                      </span>
                      <span className="flex flex-none items-center gap-2 text-xs text-stone-400">
                        {sinFirmante > 0 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                            {sinFirmante} sin firmante
                          </span>
                        )}
                        {docs.length} documento{docs.length === 1 ? "" : "s"}
                        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
                      </span>
                    </summary>
                    <ul className="divide-y divide-stone-100">{docs.map((doc) => filaDocumento(doc))}</ul>
                  </details>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Todos los pasos del flujo
          </h2>
          <ol className="space-y-1.5">
            {pasos.map((p) => {
              const estadoPaso =
                p.numero < expediente.pasoActualNumero
                  ? "completado"
                  : p.numero === expediente.pasoActualNumero
                    ? "actual"
                    : "pendiente";
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                    estadoPaso === "actual"
                      ? "bg-cdmb-50 text-cdmb-900"
                      : estadoPaso === "completado"
                        ? "text-stone-400"
                        : "text-stone-400"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-semibold ${
                      estadoPaso === "completado"
                        ? "bg-green-100 text-green-700"
                        : estadoPaso === "actual"
                          ? "bg-cdmb-600 text-white"
                          : "bg-stone-100 text-stone-400"
                    }`}
                  >
                    {estadoPaso === "completado" ? <Check className="h-3 w-3" aria-hidden /> : p.numero}
                  </span>
                  <span className={estadoPaso === "completado" ? "line-through decoration-stone-300" : ""}>
                    {p.titulo}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
          <h2 className="text-sm font-semibold text-stone-900">Cambiar estado manualmente</h2>
          <p className="mb-3 text-xs text-stone-500">
            Utilice esta opción para cerrar el expediente cuando el flujo no cuenta con un botón de
            decisión que corresponda (por ejemplo, un archivo por desistimiento tácito, o para
            suspenderlo mientras se espera información externa).
          </p>
          {session?.rol !== "ADMIN" ? (
            <p className="flex items-start gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-500">
              <Lock className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
              Solo un administrador puede cambiar el estado a mano — esta opción salta el paso a paso
              del flujo. Gestione el expediente desde &quot;Paso actual&quot; más arriba.
            </p>
          ) : (
          <form action={`/api/expedientes/${expediente.id}/estado`} method="post" className="flex flex-wrap items-end gap-3">
            <Field label="Nuevo estado" required>
              <select
                name="estado"
                defaultValue={expediente.estado}
                className="rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Motivo (opcional)" help="Queda registrado en la bitácora del expediente.">
              <input
                name="motivo"
                className="w-64 rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
            </Field>
            <button
              type="submit"
              className="rounded-md border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Guardar estado
            </button>
          </form>
          )}
        </section>

        {expediente.comunicaciones.length > 0 && (
          <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
            <h2 className="text-sm font-semibold text-stone-900">Correspondencia asociada ({expediente.comunicaciones.length})</h2>
            <p className="mb-3 text-xs text-stone-500">Comunicaciones del módulo de Correspondencia archivadas en este expediente.</p>
            <ul className="space-y-1.5">
              {expediente.comunicaciones.map((com) => (
                <li key={com.id}>
                  <Link href={`/correspondencia/${com.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2 text-sm hover:bg-stone-50">
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-cdmb-700">{com.radicado}</span>
                      <span className="ml-2 text-stone-500">{com.asunto}</span>
                    </span>
                    <span className="flex-none text-xs text-stone-400">{formatoFechaHistoria.format(com.fechaRadicacion)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
          <h2 className="text-sm font-semibold text-stone-900">Historia del expediente</h2>
          <p className="mb-3 text-xs text-stone-500">
            La hoja de vida completa: qué pasó, cuándo y quién lo hizo — desde que se radicó hasta hoy.
          </p>
          {puedeEditar && (
            <form action={`/api/expedientes/${expediente.id}/comentario`} method="post" className="mb-4 flex gap-2">
              <input
                name="texto"
                placeholder="Agregar una nota o comentario al expediente…"
                className="flex-1 rounded-md border border-stone-200 px-3 py-2 text-sm focus:border-cdmb-500 focus:outline-none focus:ring-1 focus:ring-cdmb-500"
              />
              <button type="submit" className="rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50">
                Comentar
              </button>
            </form>
          )}

          <ol>
            {expediente.eventos.map((ev, idx) => {
              const info = infoEvento(ev.tipo);
              const Icono = info.icono;
              const esUltimo = idx === expediente.eventos.length - 1;
              return (
                <li key={ev.id} className="relative flex gap-3 pb-5">
                  {!esUltimo && (
                    <span className="absolute left-[15px] top-8 bottom-0 w-px bg-stone-200" aria-hidden />
                  )}
                  <span
                    className={`relative z-10 flex h-8 w-8 flex-none items-center justify-center rounded-full ${info.clase}`}
                    aria-hidden
                  >
                    <Icono className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="text-sm text-stone-700">{ev.descripcion}</p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      <span className="font-medium text-stone-500">{ev.usuario.nombre}</span>
                      {" · "}
                      {formatoFechaHistoria.format(ev.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

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
            Mientras está activo, un rechazo aparece como aviso en el buzón de firmas de quien subió el
            documento; aquí queda para siempre, aunque el aviso ya se haya descartado o se haya limpiado
            solo al corregir el archivo.
          </p>
          <ul className="divide-y divide-stone-100 text-xs">
            {rechazos.map((ev) => (
              <li key={ev.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="min-w-0 flex-1 text-stone-700">{ev.descripcion}</span>
                <span className="flex-none text-stone-400">{ev.usuario.nombre}</span>
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
            Registro inalterable con cadena de hash (cada movimiento encadena su hash con el del anterior) —
            el mismo mecanismo del SGDEA.
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
    </div>
  );
}

function BloqueDatosPredio({
  claseSolicitud,
  nombre,
  catastral,
  matricula,
  areaM2,
  areaCultivosM2,
  areaBosqueM2,
  viviendas,
}: {
  claseSolicitud: string | null;
  nombre: string | null;
  catastral: string | null;
  matricula: string | null;
  areaM2: number | null;
  areaCultivosM2: number | null;
  areaBosqueM2: number | null;
  viviendas: number | null;
}) {
  const hayDatos =
    claseSolicitud || nombre || catastral || matricula || areaM2 != null || areaCultivosM2 != null || areaBosqueM2 != null || viviendas != null;
  if (!hayDatos) return null;

  return (
    <div className="mt-3 border-t border-stone-100 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Datos adicionales del predio</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        {claseSolicitud && (
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Clase de solicitud</dt>
            <dd className="text-stone-800">{claseSolicitud === "RENOVACION" ? "Renovación" : "Nueva"}</dd>
          </div>
        )}
        {nombre && (
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Nombre del predio</dt>
            <dd className="break-words text-stone-800">{nombre}</dd>
          </div>
        )}
        {catastral && (
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Nro. Catastral</dt>
            <dd className="break-words text-stone-800">{catastral}</dd>
          </div>
        )}
        {matricula && (
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Matrícula inmobiliaria</dt>
            <dd className="break-words text-stone-800">{matricula}</dd>
          </div>
        )}
        {areaM2 != null && (
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Área predial</dt>
            <dd className="text-stone-800">{areaM2.toLocaleString("es-CO")} m²</dd>
          </div>
        )}
        {areaCultivosM2 != null && (
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Área en cultivos</dt>
            <dd className="text-stone-800">{areaCultivosM2.toLocaleString("es-CO")} m²</dd>
          </div>
        )}
        {areaBosqueM2 != null && (
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Área en bosque</dt>
            <dd className="text-stone-800">{areaBosqueM2.toLocaleString("es-CO")} m²</dd>
          </div>
        )}
        {viviendas != null && (
          <div className="min-w-0">
            <dt className="text-xs text-stone-400">Nro. de viviendas</dt>
            <dd className="text-stone-800">{viviendas.toLocaleString("es-CO")}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function BloqueUbicacion({
  titulo,
  lat,
  lon,
  planaX,
  planaY,
  cartX,
  cartY,
  cartZ,
}: {
  titulo: ReactNode;
  lat: number | null;
  lon: number | null;
  planaX: number | null;
  planaY: number | null;
  cartX: number | null;
  cartY: number | null;
  cartZ: number | null;
}) {
  if (lat == null || lon == null) return null;
  return (
    <details className="mt-3 border-t border-stone-100 pt-3 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-stone-500 [&::-webkit-details-marker]:hidden">
        {titulo} — {lat.toFixed(6)}, {lon.toFixed(6)} <span className="text-cdmb-700">(ver mapa y coordenadas)</span>
      </summary>
      <div className="mt-2 space-y-2">
        <MapaSoloLectura lat={lat} lon={lon} />
        <div className="space-y-0.5 text-stone-700">
          <p>
            Elipsoidales (lat/lon, WGS84): {lat.toFixed(6)}, {lon.toFixed(6)}
          </p>
          {planaX != null && planaY != null && (
            <p>
              Planas (MAGNA-SIRGAS Origen-Nacional): X {planaX.toLocaleString("es-CO")} m, Y{" "}
              {planaY.toLocaleString("es-CO")} m
            </p>
          )}
          {cartX != null && cartY != null && cartZ != null && (
            <p>
              Cartesianas (ECEF): X {cartX.toLocaleString("es-CO")} m, Y {cartY.toLocaleString("es-CO")} m, Z{" "}
              {cartZ.toLocaleString("es-CO")} m
            </p>
          )}
          <a
            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-cdmb-700 hover:underline"
          >
            Abrir en OpenStreetMap ↗
          </a>
        </div>
      </div>
    </details>
  );
}
