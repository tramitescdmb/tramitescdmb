import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, FileText, Download, Printer, Send, ShieldCheck, User, Building2, Archive, Reply, PauseCircle, PlayCircle, Clock, Ban, FolderTree, Lock, Compass, CheckCircle2, MailCheck, Users, Undo2, Workflow, History, PenTool, Tag } from "lucide-react";
import { PestanasDetalle } from "@/components/sgdea/PestanasDetalle";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import {
  obtenerPermisosUsuario,
  puedeAccederCorrespondencia,
  puedeDistribuir,
  puedeAdministrarArchivo,
  puedeRadicar,
  puedeResponderComoAsignado,
  puedeDevolverReparto,
  puedeAsignarFirmantesComunicacion,
  puedeFirmarComunicacionDirecto,
  puedeSubdistribuirInternamente,
} from "@/lib/permisos";
import { puedeActuarSolicitud } from "@/lib/solicitudes-firma";
import { AsignarFirmantesModal } from "@/components/AsignarFirmantesModal";
import { ConfirmarFirmaModal } from "@/components/ConfirmarFirmaModal";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { listarSeriesVigentes } from "@/lib/trd";
import { subserieBuscable } from "@/lib/trd-presentacion";
import { listarPlantillas } from "@/lib/plantillas";
import { listarTerminos } from "@/lib/vocabulario";
import { ETIQUETA_TIPO_PQRSD, estadoVencimiento, devolucionDeReparoPermitida } from "@/lib/pqrsd";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { ETIQUETA_NIVEL_ACCESO, CLASE_NIVEL_ACCESO } from "@/lib/nivel-acceso";
import { Field, SectionHelp } from "@/components/Field";
import { ProgresoCorrespondencia } from "@/components/ProgresoCorrespondencia";
import { VistaPreviaDocumento } from "@/components/VistaPreviaDocumento";
import { RespuestaFuncionarioForm } from "@/components/RespuestaFuncionarioForm";
import { FlujoTrabajoComunicacion } from "@/components/FlujoTrabajoComunicacion";
import { MetadatosComunicacion } from "@/components/MetadatosComunicacion";
import { PanelFirmas } from "@/components/PanelFirmas";
import { BotonFirmarDirecto } from "@/components/BotonFirmarDirecto";
import { construirFilasFirmantes } from "@/lib/panel-firmas";
import { DistribuirForm } from "@/components/DistribuirForm";
import { BuscadorSubserieTRD } from "@/components/BuscadorSubserieTRD";
import { ETIQUETA_MEDIO_DESPACHO, motivoBloqueoRespuesta } from "@/lib/correspondencia";
import { puedeDespachar } from "@/lib/permisos";
import { puedeOperarFlujos } from "@/lib/flujos";
import { formatearFechaHora as fechaHora } from "@/lib/fecha";
import { headers } from "next/headers";

const ETIQUETA_ESTADO: Record<string, string> = {
  RADICADA: "Radicada", EN_REPARTO: "En reparto", ASIGNADA: "Asignada", EN_TRAMITE: "En trámite",
  INFORMACION_ADICIONAL_REQUERIDA: "Información adicional requerida", RESPONDIDA: "Respondida",
  ARCHIVADA: "Archivada", ANULADA: "Anulada",
};
const ETIQUETA_ACCION: Record<string, string> = {
  CREA: "Radicación", LEE: "Consulta", MODIFICA: "Modificación", EXPORTA: "Exportación",
  ELIMINA: "Eliminación", DISTRIBUYE: "Distribución", FIRMA: "Firma", CLASIFICA: "Clasificación",
  ARCHIVA: "Archivo", ANULA: "Anulación", SUSPENDE: "Suspensión de término", REACTIVA: "Reactivación de término",
  TRANSFIERE: "Transferencia a archivo central", DISPONE: "Disposición final",
  RESPONDE: "Respuesta del funcionario", DESPACHA: "Despacho efectivo", FLUJO: "Flujo de trabajo",
  DEVUELVE_REPARTO: "Devolución del reparto",
};
const ETIQUETA_TIPO: Record<string, string> = { RECIBIDA: "Comunicación recibida", ENVIADA: "Comunicación enviada", INTERNA: "Memorando interno" };
const ESTADOS_CERRADOS = ["RESPONDIDA", "ARCHIVADA", "ANULADA"];

type ProximoPaso = { texto: string; accionHref?: string; accionTexto?: string; cerrado?: boolean };

function proximoPaso(c: {
  tipo: string;
  estado: string;
  respuestaTexto: string | null;
  respuestaFirmada: boolean;
  respuestas: { despachadaEn: Date | string | null }[];
  respondeAId: string | null;
  despachadaEn: Date | string | null;
  devuelta: boolean;
}, permisos: { puedeDistribuir: boolean; puedeResponder: boolean; puedeRadicar: boolean; puedeDespachar: boolean }): ProximoPaso {
  if (c.tipo === "INTERNA") {
    return { texto: "El memorando ya quedó firmado y radicado — es un documento definitivo. Si lo distribuyó, es solo para seguimiento interno.", cerrado: true };
  }
  if (c.tipo === "ENVIADA") {
    if (c.estado === "ANULADA") return { texto: "El oficio quedó anulado — no requiere ninguna acción más.", cerrado: true };
    if (c.despachadaEn) return { texto: "Radicado, firmado y despachado al destinatario — el ciclo está cerrado.", cerrado: true };
    if (permisos.puedeDespachar) {
      return {
        texto: c.respondeAId
          ? "El oficio ya está firmado y radicado. Paso final de la ventanilla de salida: registrar el despacho efectivo (envío al peticionario) — eso cierra el ciclo de la recibida."
          : "El oficio ya está firmado y radicado. Cuando se envíe al destinatario, registre el despacho efectivo para dejar constancia.",
        accionHref: "#despacho",
        accionTexto: "Ir a registrar el despacho",
      };
    }
    return { texto: "El oficio ya está firmado y radicado. Falta que la ventanilla de salida registre el despacho efectivo al destinatario." };
  }
  if (c.estado === "ANULADA") return { texto: "Quedó anulada — no requiere ninguna acción más.", cerrado: true };
  if (c.estado === "ARCHIVADA") return { texto: "Quedó archivada — el ciclo de esta comunicación está cerrado.", cerrado: true };
  if (c.estado === "RESPONDIDA") {
    const despachada = c.respuestas.some((r) => r.despachadaEn);
    if (despachada) return { texto: "Se respondió y el oficio de salida ya se despachó al peticionario — el ciclo de esta recibida está cerrado.", cerrado: true };
    return permisos.puedeDespachar
      ? { texto: "Ya se radicó el oficio de respuesta. Falta registrar su despacho efectivo (abra la enviada de «Respondida por» y registre el envío) para cerrar el ciclo." }
      : { texto: "Ya se radicó el oficio de respuesta. Falta que la ventanilla de salida registre el despacho al peticionario.", cerrado: true };
  }
  if (c.estado === "INFORMACION_ADICIONAL_REQUERIDA") {
    return { texto: "El trámite está detenido (vea el motivo más abajo). Se reanuda cuando se resuelva lo que lo detuvo; si tenía término de ley, se reanuda por lo que faltaba." };
  }
  if (c.estado === "RADICADA" || c.estado === "EN_REPARTO") {
    const devueltaTxt = c.devuelta ? "Fue devuelta a la ventanilla (vea el motivo en «Distribución / reparto»). " : "";
    return permisos.puedeDistribuir
      ? { texto: `${devueltaTxt}${c.devuelta ? "Repártala de nuevo" : "Todavía no se ha repartido. Siguiente paso: asígnela"} a la dependencia o funcionario(s) que deben atenderla.`, accionHref: "#distribucion", accionTexto: "Ir a Distribución / reparto" }
      : { texto: `${devueltaTxt}La ventanilla ${c.devuelta ? "debe repartirla de nuevo" : "aún no la ha repartido"}.` };
  }
  if (!c.respuestaTexto) {
    return permisos.puedeResponder
      ? { texto: "Ya está asignada a usted. Siguiente paso: escriba su respuesta más abajo, en «Respuesta del funcionario». Es un borrador; la ventanilla de salida la radica y la despacha.", accionHref: "#respuesta", accionTexto: "Ir a Respuesta del funcionario" }
      : { texto: "Ya está repartida — falta que el funcionario a cargo escriba el borrador de respuesta." };
  }
  if (!c.respuestaFirmada) {
    return permisos.puedeResponder
      ? { texto: "Ya hay respuesta. Siguiente paso: fírmela y solicite las firmas que correspondan (Revisó, Firma principal).", accionHref: "#firmas", accionTexto: "Ir a Firmas de la respuesta" }
      : { texto: "Ya hay respuesta, pero le faltan firmas: gestión documental la radica como salida cuando tenga la firma principal y ninguna pendiente." };
  }
  return permisos.puedeRadicar
    ? { texto: "La respuesta está firmada. Siguiente paso de gestión documental: radicarla como oficio de salida y luego registrar el despacho.", accionHref: "#respuesta", accionTexto: "Ir a radicar la respuesta" }
    : { texto: "La respuesta está firmada. Falta que gestión documental la radique como oficio de salida y la despache." };
}

function Campo({ k, v }: { k: string; v: ReactNode }) {
  if (v == null || v === "") return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] leading-tight text-stone-400">{k}</dt>
      <dd className="text-sm text-stone-800">{v}</dd>
    </div>
  );
}

function Tarjeta({ titulo, children, extra, id, icono }: { titulo: string; children: ReactNode; extra?: ReactNode; id?: string; icono?: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 rounded-xl border border-stone-200 bg-white shadow-soft p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
          {icono && <span className="text-cdmb-600">{icono}</span>}
          {titulo}
        </h3>
        {extra}
      </div>
      {children}
    </section>
  );
}

export default async function CorrespondenciaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/");

  const c = await db.comunicacion.findUnique({
    where: { id },
    include: {
      documentos: { orderBy: { createdAt: "asc" } },
      dependenciaOrigen: { select: { nombre: true } },
      dependenciaDestino: { select: { nombre: true } },
      serie: { select: { codigo: true, nombre: true } },
      subserie: { select: { codigo: true, nombre: true } },
      radicadoPor: { select: { nombre: true } },
      expediente: { select: { id: true, numero: true } },
      expedienteDocumental: { select: { id: true, numero: true } },
      respondeA: { select: { id: true, radicado: true, asunto: true, distribuciones: { where: { activa: true }, select: { usuarioId: true } } } },
      respuestas: { select: { id: true, radicado: true, asunto: true, despachadaEn: true } },
      respuestaPor: { select: { nombre: true } },
      despachadaPor: { select: { nombre: true } },
      firmas: {
        orderBy: { fechaHora: "asc" },
        include: { usuario: { select: { id: true, nombre: true, denominacionEmpleo: true, denominacionComplemento: true, sexo: true, rolContratacion: true, dependencia: { select: { nombre: true } } } } },
      },
      solicitudesFirma: {
        orderBy: { orden: "asc" },
        include: { usuarioAsignado: { select: { id: true, nombre: true, denominacionEmpleo: true, denominacionComplemento: true, sexo: true, rolContratacion: true } }, asignadoPor: { select: { nombre: true } } },
      },
      distribuciones: {
        orderBy: { fechaAsignacion: "desc" },
        include: { dependencia: { select: { nombre: true } }, usuario: { select: { nombre: true } }, asignadoPor: { select: { nombre: true } } },
      },
    },
  });
  if (!c) notFound();

  const { ip, userAgent } = datosPeticion(await headers());

  const puedeDistribuirUsuario = puedeDistribuir(permisos);
  const puedeAdministrarArchivoUsuario = puedeAdministrarArchivo(permisos);
  const puedeRadicarUsuario = puedeRadicar(permisos);
  const puedeDespacharUsuario = puedeDespachar(permisos);
  const hayRespuestaParaFirmar =
    c.tipo === "RECIBIDA" && c.respuestas.length === 0 && (Boolean(c.respuestaTexto) || c.documentos.some((d) => d.esRespuesta));
  const firmasHabilitadas = c.estado !== "ANULADA" && !c.despachadaEn && (c.tipo !== "RECIBIDA" || hayRespuestaParaFirmar);
  const puedeAsignarFirmantesUsuario = firmasHabilitadas && puedeAsignarFirmantesComunicacion(permisos, c, session.userId);
  const puedeFirmarDirectoUsuario = firmasHabilitadas && puedeFirmarComunicacionDirecto(permisos, c, session.userId);
  const filasFirmantes = construirFilasFirmantes(c.solicitudesFirma, c.firmas, "SGDEA");
  const miSolicitudFirma = c.solicitudesFirma.find(
    (s) => s.usuarioAsignadoId === session.userId && s.estado === "PENDIENTE" && s.rol !== "LECTURA"
  );
  const puedoActuarMiSolicitud = miSolicitudFirma && puedeActuarSolicitud(c.solicitudesFirma, miSolicitudFirma);
  const puedeOperarFlujosUsuario = puedeOperarFlujos(permisos);
  const distribucionesVigentes = c.distribuciones.filter((d) => d.activa);
  const puedeSubdistribuirUsuario = puedeSubdistribuirInternamente(permisos, session.userId, c, distribucionesVigentes);
  const puedeResponder = c.tipo === "RECIBIDA" && puedeResponderComoAsignado(permisos, session.userId, distribucionesVigentes);
  const devolucionesPrevias = c.distribuciones.filter((d) => d.devueltaEn);
  const documentosOriginales = c.documentos.filter((d) => !d.esRespuesta);
  const pdfPrincipal = documentosOriginales.find((d) => d.mimeType === "application/pdf") ?? null;
  const documentosRespuesta = c.documentos.filter((d) => d.esRespuesta);
  const bloqueoRespuesta =
    c.tipo === "RECIBIDA"
      ? motivoBloqueoRespuesta(
          c.firmas,
          c.solicitudesFirma.filter((s) => s.estado === "PENDIENTE" && s.rol !== "LECTURA").map((s) => s.usuarioAsignado.nombre)
        )
      : null;
  const pdfAFirmar =c.tipo === "RECIBIDA" ? (documentosRespuesta.find((d) => d.mimeType === "application/pdf") ?? null) : pdfPrincipal;
  const mostrarRespuesta =
    c.tipo === "RECIBIDA" &&
    (puedeResponder ||
      Boolean(c.respuestaTexto) ||
      documentosRespuesta.length > 0 ||
      (puedeRadicarUsuario && ["ASIGNADA", "EN_TRAMITE", "INFORMACION_ADICIONAL_REQUERIDA", "RESPONDIDA"].includes(c.estado)));

  const [
    ,
    bitacora,
    usuariosOpcionesCrudo,
    colaboradoresDependencia,
    calendario,
    plantillasRespuesta,
    terminosVocabulario,
    [dependencias, usuarios],
    seriesVigentes,
  ] = await Promise.all([
    registrarAuditoriaDoc({ entidad: "Comunicacion", entidadId: id, accion: "LEE", usuarioId: session.userId, ip, userAgent, detalle: `Consultó ${c.radicado}` }),
    db.auditoriaDoc.findMany({
      where: { entidad: "Comunicacion", entidadId: id },
      orderBy: { secuencia: "desc" },
      take: 50,
      include: { usuario: { select: { nombre: true } } },
    }),
    puedeAsignarFirmantesUsuario
      ? db.usuario.findMany({
          where: { activo: true },
          select: { id: true, nombre: true, dependencia: { select: { nombre: true } } },
          orderBy: { nombre: "asc" },
        })
      : Promise.resolve([]),
    puedeSubdistribuirUsuario
      ? db.usuario.findMany({
          where: { activo: true, dependenciaId: permisos.dependenciaId, OR: [{ rol: "ADMIN" }, { rolCorrespondencia: { not: null } }] },
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true },
        })
      : Promise.resolve([]),
    getCalendarioLaboral(),
    puedeResponder ? listarPlantillas("RESPUESTA") : Promise.resolve([]),
    puedeDistribuirUsuario && c.estado !== "ANULADA" ? listarTerminos() : Promise.resolve([]),
    puedeDistribuirUsuario
      ? Promise.all([
          listarDependenciasActivas(),
          db.usuario.findMany({
            where: { activo: true, OR: [{ rol: "ADMIN" }, { rolCorrespondencia: { not: null } }] },
            orderBy: { nombre: "asc" },
            select: { id: true, nombre: true },
          }),
        ])
      : Promise.resolve([[], []]),
    puedeAdministrarArchivoUsuario ? listarSeriesVigentes() : Promise.resolve([]),
  ]);
  const usuariosOpciones = usuariosOpcionesCrudo.map((u) => ({ id: u.id, nombre: u.nombre, dependenciaNombre: u.dependencia?.nombre ?? null }));
  const puedeDevolverUsuario =
    c.tipo === "RECIBIDA" &&
    !["RESPONDIDA", "ARCHIVADA", "ANULADA"].includes(c.estado) &&
    puedeDevolverReparto(permisos, session.userId, distribucionesVigentes);
  const devolucionATiempo = devolucionDeReparoPermitida(c.fechaVencimiento, calendario);
  const seriesBuscables = seriesVigentes.map((s) => ({
    id: s.id,
    codigo: s.codigo,
    nombre: s.nombre,
    dependenciaId: s.dependencia?.id ?? null,
    dependenciaNombre: s.dependencia?.nombre ?? null,
    subseries: s.subseries.map(subserieBuscable),
  }));

  const tieneTercero = c.tipo !== "INTERNA";
  const vencimiento = estadoVencimiento(c.fechaVencimiento, undefined, calendario);
  const siguientePaso = proximoPaso(
    { ...c, devuelta: devolucionesPrevias.length > 0 && distribucionesVigentes.length === 0, respuestaFirmada: bloqueoRespuesta === null },
    {
      puedeDistribuir: puedeDistribuirUsuario,
      puedeResponder,
      puedeRadicar: puedeRadicarUsuario,
      puedeDespachar: puedeDespacharUsuario,
    },
  );

  return (
    <div className="space-y-4">
      <Link href="/correspondencia" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Volver a la bandeja
      </Link>

      {sp.ok && <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{sp.ok}</div>}
      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      {c.estado === "ANULADA" && (
        <div className="flex items-start gap-2 rounded-md border border-stone-200 bg-stone-100 px-3 py-2 text-sm text-stone-700">
          <Ban className="mt-0.5 h-4 w-4 flex-none text-stone-500" aria-hidden />
          <span>
            <strong>Esta comunicación está anulada.</strong> {c.motivoAnulacion ? `Motivo: ${c.motivoAnulacion}` : ""} No se borró:
            queda trazada como constancia (Ley 594/2000).
          </span>
        </div>
      )}

      <div className="rounded-xl border border-stone-200 bg-white shadow-soft p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">{c.radicado}</h2>
            <p className="text-xs text-stone-400">
              {ETIQUETA_TIPO[c.tipo] ?? c.tipo}
              {c.tipoPqrsd ? ` · ${ETIQUETA_TIPO_PQRSD[c.tipoPqrsd]}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {vencimiento && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${vencimiento.clase}`}>
                <Clock className="h-3 w-3" aria-hidden />
                {vencimiento.texto}
              </span>
            )}
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">{ETIQUETA_ESTADO[c.estado] ?? c.estado}</span>
            {c.nivelAcceso !== "PUBLICA" && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASE_NIVEL_ACCESO[c.nivelAcceso]}`}>
                {ETIQUETA_NIVEL_ACCESO[c.nivelAcceso]}
              </span>
            )}
            <Link href={`/correspondencia/${id}/constancia`} className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Constancia
            </Link>
            <Link href={`/correspondencia/${id}/rotulo`} className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Rótulo con código de barras
            </Link>
          </div>
        </div>
        <div className="mt-3 max-w-md">
          <ProgresoCorrespondencia estado={c.estado} tipo={c.tipo} tamaño="grande" />
        </div>
        {c.estado !== "ANULADA" && (
          <div
            className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
              siguientePaso.cerrado ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-cdmb-200 bg-cdmb-50 text-cdmb-900"
            }`}
          >
            {siguientePaso.cerrado ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" aria-hidden />
            ) : (
              <Compass className="mt-0.5 h-4 w-4 flex-none text-cdmb-600" aria-hidden />
            )}
            <span>
              {siguientePaso.texto}
              {siguientePaso.accionHref && (
                <>
                  {" "}
                  <a href={siguientePaso.accionHref} className="font-medium underline hover:no-underline">
                    {siguientePaso.accionTexto}
                  </a>
                </>
              )}
            </span>
          </div>
        )}
        <p className="mt-3 text-sm text-stone-700">{c.asunto}</p>
        {c.contenido && <p className="mt-2 whitespace-pre-wrap rounded-md bg-stone-50 p-3 text-sm text-stone-700">{c.contenido}</p>}
        {c.palabrasClave.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {c.palabrasClave.map((p) => (
              <span key={p} className="rounded-full bg-cdmb-50 px-2 py-0.5 text-xs font-medium text-cdmb-700">{p}</span>
            ))}
          </div>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
          <Campo k="Fecha de radicación" v={fechaHora(c.fechaRadicacion)} />
          <Campo k="Medio" v={c.medio} />
          <Campo k="Folios" v={c.folios} />
          <Campo k="Anexos" v={c.anexosDescripcion} />
          <Campo k="Radicado por" v={c.radicadoPor?.nombre ?? (c.origen === "WEB_PQRSD" ? "Ciudadano (formulario público)" : null)} />
          <Campo k="Dependencia origen" v={c.dependenciaOrigen?.nombre} />
          <Campo k="Dependencia destino" v={c.dependenciaDestino?.nombre} />
          <Campo k="Término de ley" v={c.terminoDiasHabiles ? `${c.terminoDiasHabiles} días hábiles` : null} />
          <Campo k="Vence" v={c.fechaVencimiento ? fechaHora(c.fechaVencimiento) : null} />
          <Campo k="Serie (TRD)" v={c.serie ? `${c.serie.codigo} — ${c.serie.nombre}` : null} />
          <Campo k="Subserie" v={c.subserie ? `${c.subserie.codigo} — ${c.subserie.nombre}` : null} />
          <Campo k="Nivel de acceso (Ley 1712/2014)" v={ETIQUETA_NIVEL_ACCESO[c.nivelAcceso]} />
          {c.fundamentoNivelAcceso && <Campo k="Fundamento" v={c.fundamentoNivelAcceso} />}
          <Campo
            k="Archivada en expediente"
            v={c.expediente ? <Link href={`/expedientes/${c.expediente.id}`} className="text-cdmb-700 hover:underline">{c.expediente.numero}</Link> : null}
          />
          <Campo
            k="Responde a"
            v={c.respondeA ? <Link href={`/correspondencia/${c.respondeA.id}`} className="text-cdmb-700 hover:underline">{c.respondeA.radicado}</Link> : null}
          />
        </dl>
        {c.respuestas.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
            <Reply className="h-3.5 w-3.5 text-stone-400" aria-hidden />
            <span className="text-xs text-stone-500">Respondida por:</span>
            {c.respuestas.map((r) => (
              <Link key={r.id} href={`/correspondencia/${r.id}`} className="rounded-full bg-cdmb-50 px-2.5 py-0.5 text-xs font-medium text-cdmb-700 hover:underline">
                {r.radicado}
              </Link>
            ))}
          </div>
        )}
      </div>

      {tieneTercero && (
        <Tarjeta titulo={c.tipo === "ENVIADA" ? "Destinatario" : "Remitente"} icono={<User className="h-3.5 w-3.5" aria-hidden />}>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-cdmb-50 text-cdmb-700">
              {c.terceroTipo === "JURIDICA" ? <Building2 className="h-4 w-4" aria-hidden /> : <User className="h-4 w-4" aria-hidden />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-900">{c.terceroNombre ?? "—"}</p>
              <p className="text-xs text-stone-400">
                {[c.terceroTipoIdentificacion, c.terceroIdentificacion].filter(Boolean).join(" ")}
                {c.terceroMunicipio ? ` · ${c.terceroMunicipio}` : ""}
              </p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            <Campo k="Correo" v={c.terceroEmail} />
            <Campo k="Teléfono" v={c.terceroTelefono} />
            <Campo k="Dirección" v={c.terceroDireccion} />
          </dl>
        </Tarjeta>
      )}

      <PestanasDetalle
        grupos={[
          {
            id: "tramite",
            label: c.tipo === "RECIBIDA" ? "Trámite y respuesta" : "Firmas y despacho",
            icono: <Workflow className="h-4 w-4" aria-hidden />,
            contenido: (
              <>
            {(c.tipo === "RECIBIDA" || c.distribuciones.length > 0) && (
              <Tarjeta id="distribucion" titulo="Distribución / reparto" icono={<Users className="h-3.5 w-3.5" aria-hidden />}>
                <SectionHelp>
                  El reparto lo hace la ventanilla — decide quién atiende el trámite y puede asignarlo a varias
                  personas a la vez. Quien lo recibe puede devolverlo a la ventanilla con un motivo si no le
                  corresponde (salvo que falten 3 días hábiles o menos para el vencimiento). Los repartos anteriores
                  quedan como historial.
                </SectionHelp>
                {c.distribuciones.length === 0 ? (
                  <p className="text-sm text-stone-400">Sin repartir todavía.</p>
                ) : (
                  <ul className="space-y-2">
                    {c.distribuciones.map((d) => (
                      <li key={d.id} className="rounded-lg border border-stone-200 px-3 py-2 text-sm">
                        <p className="flex items-center gap-2 font-medium text-stone-800">
                          <Users className="h-3.5 w-3.5 flex-none text-stone-400" aria-hidden />
                          {[d.dependencia?.nombre, d.usuario?.nombre].filter(Boolean).join(" · ") || "—"}
                          {d.activa && <span className="rounded-full bg-cdmb-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cdmb-700">Vigente</span>}
                          {d.devueltaEn && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Devuelta</span>}
                        </p>
                        <p className="text-xs text-stone-500">
                          {fechaHora(d.fechaAsignacion)}{d.asignadoPor ? ` · por ${d.asignadoPor.nombre}` : ""}{d.termino ? ` · término ${d.termino} días` : ""}
                        </p>
                        {d.instrucciones && <p className="mt-1 text-xs text-stone-600">{d.instrucciones}</p>}
                        {d.devueltaEn && (
                          <p className="mt-1 flex items-start gap-1 text-xs text-amber-700">
                            <Undo2 className="mt-0.5 h-3 w-3 flex-none" aria-hidden />
                            Devuelta a la ventanilla el {fechaHora(d.devueltaEn)}{d.motivoDevolucion ? ` — ${d.motivoDevolucion}` : ""}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {puedeDistribuirUsuario && c.tipo === "RECIBIDA" && !ESTADOS_CERRADOS.includes(c.estado) && (
                  <DistribuirForm comunicacionId={id} dependencias={dependencias} usuarios={usuarios} />
                )}
                {puedeDistribuirUsuario && c.tipo === "RECIBIDA" && ESTADOS_CERRADOS.includes(c.estado) && (
                  <p className="mt-4 border-t border-stone-100 pt-4 text-xs text-stone-400">
                    Ya no se puede repartir: quedó {ETIQUETA_ESTADO[c.estado]?.toLowerCase() ?? c.estado.toLowerCase()}.
                  </p>
                )}
                {!puedeDistribuirUsuario && puedeSubdistribuirUsuario && !ESTADOS_CERRADOS.includes(c.estado) && (
                  <DistribuirForm
                    comunicacionId={id}
                    dependencias={[]}
                    usuarios={colaboradoresDependencia}
                    dependenciaFija={{ id: permisos.dependenciaId!, nombre: c.dependenciaDestino?.nombre ?? "Mi dependencia" }}
                    tituloLista="Colaborador(es) a cargo"
                  />
                )}

                {puedeDevolverUsuario && (
                  <div className="mt-4 border-t border-stone-100 pt-4">
                    {devolucionATiempo ? (
                      <form action={`/api/correspondencia/${id}/devolver-reparto`} method="post" className="flex flex-wrap items-end gap-3">
                        <div className="min-w-[260px] flex-1">
                          <Field label="Devolver a la ventanilla — motivo" required help="Por qué esta comunicación no le corresponde.">
                            <input name="motivo" required className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
                          </Field>
                        </div>
                        <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50">
                          <Undo2 className="h-3.5 w-3.5" aria-hidden />
                          Devolver a la ventanilla
                        </button>
                      </form>
                    ) : (
                      <p className="text-xs text-amber-700">
                        Ya no se puede devolver a la ventanilla: faltan 3 días hábiles o menos para el vencimiento del
                        término de ley. Atiéndala o coordínelo directamente con la ventanilla.
                      </p>
                    )}
                  </div>
                )}
              </Tarjeta>
            )}

            {mostrarRespuesta && (
              <Tarjeta id="respuesta" titulo="Respuesta del funcionario" icono={<Reply className="h-3.5 w-3.5" aria-hidden />}>
                <SectionHelp>
                  {puedeResponder
                    ? "Escriba aquí su respuesta. Después fírmela y solicite las firmas que correspondan en «Firmas de la respuesta». Con la firma principal completa, gestión documental la radica como oficio de salida y registra su envío."
                    : "Respuesta del funcionario asignado. Se firma antes de salir; con la firma principal completa, gestión documental la radica como oficio de salida y registra su envío."}
                </SectionHelp>
                {c.respuestaTexto && (
                  <div className="mb-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                    <p className="whitespace-pre-wrap text-sm text-stone-700">{c.respuestaTexto}</p>
                    <p className="mt-2 text-xs text-stone-400">
                      {c.respuestaPor?.nombre ?? "—"} · {fechaHora(c.respuestaEn)}
                    </p>
                  </div>
                )}
                {documentosRespuesta.length > 0 && (
                  <ul className="mb-3 space-y-2">
                    {documentosRespuesta.map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
                          <span className="truncate text-sm text-stone-800" title={doc.nombre}>{doc.nombre}</span>
                        </span>
                        <span className="flex flex-none items-center gap-1.5">
                          <VistaPreviaDocumento url={`/api/correspondencia-documentos/${doc.id}`} nombre={doc.nombre} mimeType={doc.mimeType} miniatura />
                          <a href={`/api/correspondencia-documentos/${doc.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-menu-500 bg-white px-2.5 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50">
                            <Download className="h-3.5 w-3.5" aria-hidden />
                            Abrir
                          </a>
                          {doc.mimeType === "application/pdf" && (
                            <a
                              href={`/api/correspondencia-documentos/${doc.id}/rotulado`}
                              target="_blank"
                              rel="noreferrer"
                              title="PDF con el rótulo de radicación (número, código de barras y QR) y, si aplica, el sello de firma electrónica estampados"
                              className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
                            >
                              <Printer className="h-3.5 w-3.5" aria-hidden />
                              Con rótulo
                            </a>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {puedeResponder && c.estado !== "ANULADA" && c.respuestas.length === 0 ? (
                  <RespuestaFuncionarioForm
                    comunicacionId={id}
                    textoInicial={c.respuestaTexto ?? ""}
                    plantillas={plantillasRespuesta}
                    contexto={{
                      RADICADO: c.radicado,
                      ASUNTO: c.asunto,
                      DESTINATARIO: c.terceroNombre ?? "",
                      REMITENTE: c.terceroNombre ?? "",
                      FUNCIONARIO: session.nombre,
                    }}
                  />
                ) : (
                  !c.respuestaTexto && <p className="text-sm text-stone-400">Todavía no hay respuesta.</p>
                )}
                {puedeRadicarUsuario && c.respuestaTexto && c.respuestas.length === 0 && (
                  bloqueoRespuesta ? (
                    <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">{bloqueoRespuesta}</p>
                  ) : (
                    <Link
                      href={`/correspondencia/nueva/enviada?respondeAId=${id}`}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-menu-500 bg-white px-4 py-2 text-sm font-medium text-cdmb-700 hover:bg-cdmb-50"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden />
                      Radicar como oficio de salida
                    </Link>
                  )
                )}
                {puedeResponder && !puedeRadicarUsuario && c.respuestaTexto && c.respuestas.length === 0 && (
                  <p className={`mt-3 rounded-md px-3 py-2 text-xs ${bloqueoRespuesta ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                    {bloqueoRespuesta
                      ? <>Su respuesta quedó guardada. Siguiente paso: fírmela y solicite las firmas que correspondan en <a href="#firmas" className="font-medium underline">Firmas de la respuesta</a>. {bloqueoRespuesta}</>
                      : "La respuesta está firmada. Gestión documental la radicará como oficio de salida y registrará su envío al peticionario."}
                  </p>
                )}
              </Tarjeta>
            )}

            {(c.tipo !== "RECIBIDA" || hayRespuestaParaFirmar || c.firmas.length > 0) && (
              <Tarjeta
                id="firmas"
          icono={<PenTool className="h-3.5 w-3.5" aria-hidden />}
                titulo={c.tipo === "RECIBIDA" ? "Firmas de la respuesta" : "Firma electrónica"}
                extra={
                  c.firmas.length > 0 ? (
                    <Link href={`/correspondencia/${id}/ficha-firma`} className="text-xs font-medium text-cdmb-700 hover:underline">
                      Ficha técnica completa
                    </Link>
                  ) : undefined
                }
              >
                {c.tipo === "RECIBIDA" && (
                  <SectionHelp>
                    Quien proyecta la respuesta la firma (Proyectó) y solicita las firmas que correspondan (Revisó, Firma principal). Cualquier
                    funcionario puede firmar y solicitar firmas; la ventanilla de radicación no. Gestión documental solo la radica como salida
                    cuando tiene la firma principal y ninguna firma o visto bueno pendiente; al radicarla, estas firmas pasan al oficio.
                  </SectionHelp>
                )}
                {c.tipo === "ENVIADA" && !c.despachadaEn && (
                  <SectionHelp>
                    El oficio se firma antes de enviarlo: la firma sella el contenido y los PDF adjuntos. Para despacharlo debe tener la firma del
                    firmante principal y ninguna firma o visto bueno pendiente.
                  </SectionHelp>
                )}
                <PanelFirmas
                  filas={filasFirmantes}
                  vacio={c.tipo === "ENVIADA" ? "El oficio todavía no está firmado." : c.tipo === "RECIBIDA" ? "La respuesta todavía no está firmada." : undefined}
                  acciones={
                    <>
                      {puedoActuarMiSolicitud && (
                        <ConfirmarFirmaModal
                          rol={miSolicitudFirma!.rol === "FIRMA" ? "FIRMA" : "VISTO_BUENO"}
                          endpointCompletar={`/api/correspondencia/solicitudes-firma/${miSolicitudFirma!.id}/completar`}
                          endpointRechazar={`/api/correspondencia/solicitudes-firma/${miSolicitudFirma!.id}/rechazar`}
                          documentoNombre={c.tipo === "RECIBIDA" ? `Respuesta a ${c.radicado}` : c.asunto}
                          documentoUrl={pdfAFirmar ? `/api/correspondencia-documentos/${pdfAFirmar.id}/rotulado` : undefined}
                          documentoMimeType={pdfAFirmar ? "application/pdf" : undefined}
                          contenidoTexto={pdfAFirmar ? undefined : ((c.tipo === "RECIBIDA" ? c.respuestaTexto : c.contenido) ?? "")}
                        />
                      )}
                      {!miSolicitudFirma &&
                        puedeFirmarDirectoUsuario &&
                        !c.firmas.some((f) => f.usuarioId === session.userId) && (
                          <BotonFirmarDirecto
                            endpoint={`/api/correspondencia/${id}/firmar`}
                            conCalidad
                            calidadInicial={c.tipo === "RECIBIDA" ? "PROYECTO" : "PRINCIPAL"}
                            descripcion={
                              c.tipo === "RECIBIDA"
                                ? `Va a firmar la respuesta a ${c.radicado}${documentosRespuesta.length > 0 ? ` y sus ${documentosRespuesta.length} documento(s)` : ""}.`
                                : `Va a firmar ${c.radicado} — ${c.asunto}${documentosOriginales.length > 0 ? ` y sus ${documentosOriginales.length} documento(s) adjunto(s)` : ""}.`
                            }
                          />
                        )}
                      {puedeAsignarFirmantesUsuario && (
                        <AsignarFirmantesModal
                          endpointAsignar={`/api/correspondencia/${id}/solicitudes-firma`}
                          usuarios={usuariosOpciones}
                          conCalidad
                          firmantesActuales={c.solicitudesFirma.map((s) => ({
                            id: s.id,
                            usuarioAsignadoId: s.usuarioAsignadoId,
                            usuarioAsignadoNombre: s.usuarioAsignado.nombre,
                            calidad: s.calidad,
                            rol: s.rol,
                            orden: s.orden,
                            estado: s.estado,
                            completadoEn: s.completadoEn ? fechaHora(s.completadoEn) : null,
                          }))}
                        />
                      )}
                    </>
                  }
                />
              </Tarjeta>
            )}

            {c.tipo === "ENVIADA" && c.firmas.length > 0 && c.estado !== "ANULADA" && (
              <Tarjeta id="despacho" titulo="Despacho — envío efectivo" icono={<MailCheck className="h-3.5 w-3.5" aria-hidden />}>
                <SectionHelp>
                  El oficio ya está radicado y firmado, pero eso no significa que haya salido. La ventanilla de salida /
                  gestión documental registra aquí el envío real al destinatario (correo, físico, mensajería). Este paso
                  es el que cierra el ciclo de la comunicación recibida a la que responde.
                </SectionHelp>
                {c.despachadaEn ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-stone-700">
                    <p className="flex items-center gap-1.5 font-medium text-emerald-800">
                      <MailCheck className="h-4 w-4 flex-none" aria-hidden />
                      Despachado el {fechaHora(c.despachadaEn)}
                      {c.despachadaPor ? ` por ${c.despachadaPor.nombre}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      Medio: {ETIQUETA_MEDIO_DESPACHO[c.despachoMedio as keyof typeof ETIQUETA_MEDIO_DESPACHO] ?? c.despachoMedio ?? "—"}
                      {c.despachoDestino ? ` · a ${c.despachoDestino}` : ""}
                    </p>
                    {c.despachoObservacion && <p className="mt-1 text-xs text-stone-600">{c.despachoObservacion}</p>}
                    {c.expedienteDocumental && (
                      <p className="mt-1 text-xs text-stone-500">
                        Archivada en el expediente{" "}
                        <Link href={`/correspondencia/expedientes/${c.expedienteDocumental.id}`} className="font-medium text-cdmb-700 hover:underline">
                          {c.expedienteDocumental.numero}
                        </Link>.
                      </p>
                    )}
                  </div>
                ) : puedeDespacharUsuario ? (
                  <form action={`/api/correspondencia/${id}/despachar`} method="post" className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Medio de envío" required>
                        <select name="medio" required defaultValue="" className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm">
                          <option value="" disabled>— Seleccione —</option>
                          {Object.entries(ETIQUETA_MEDIO_DESPACHO).map(([v, etq]) => (
                            <option key={v} value={v}>{etq}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Destino" help="Correo o dirección a la que se envió.">
                        <input
                          name="destino"
                          defaultValue={c.terceroEmail ?? c.terceroDireccion ?? ""}
                          className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm"
                        />
                      </Field>
                    </div>
                    <Field label="Observación" help="Opcional — guía de envío, número de radicado de la empresa de mensajería, etc.">
                      <input name="observacion" className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
                    </Field>
                    {c.subserieId && (
                      <label className="flex items-start gap-2 text-sm text-stone-700">
                        <input type="checkbox" name="archivarEnExpediente" defaultChecked className="mt-0.5 rounded border-stone-200" />
                        <span>
                          Archivar la comunicación recibida y esta respuesta en un expediente documental de la subserie
                          {c.subserie ? ` «${c.subserie.codigo} — ${c.subserie.nombre}»` : ""} (se crea si no existe).
                        </span>
                      </label>
                    )}
                    <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600">
                      <MailCheck className="h-3.5 w-3.5" aria-hidden />
                      Registrar despacho
                    </button>
                  </form>
                ) : (
                  <p className="text-sm text-stone-400">
                    Falta que la ventanilla de salida registre el despacho efectivo al destinatario.
                  </p>
                )}
              </Tarjeta>
            )}

            {puedeDistribuirUsuario && c.tipo === "RECIBIDA" && !["ANULADA", "ARCHIVADA", "RESPONDIDA"].includes(c.estado) && (
              <Tarjeta titulo={c.fechaVencimiento ? "Término de ley y estado del trámite" : "Estado del trámite"} icono={<Clock className="h-3.5 w-3.5" aria-hidden />}>
                <SectionHelp>
                  {c.fechaVencimiento
                    ? "Plazo legal de respuesta (Ley 1755/2015). Al detener el trámite por falta de información, el conteo del término se congela y se reanuda por lo que faltaba — no se reinicia (Art. 17 CPACA)."
                    : "Esta recibida no tiene un término de ley, pero su trámite sí se puede detener (con motivo) mientras se resuelve algo externo — ej. un requerimiento a otra dependencia."}
                </SectionHelp>
                {c.fechaVencimiento && (
                  <p className="text-sm text-stone-600">
                    {vencimiento?.texto === "Vencido" ? "El término de respuesta venció" : "Vence"} el{" "}
                    <span className="font-medium">{fechaHora(c.fechaVencimiento)}</span>
                    {c.terminoDiasHabiles ? ` (${c.terminoDiasHabiles} días hábiles desde la radicación)` : ""}.
                  </p>
                )}
                {c.estado === "INFORMACION_ADICIONAL_REQUERIDA" ? (
                  <>
                    <p className="mt-1 text-xs text-stone-500">
                      <strong className="text-stone-700">Trámite detenido</strong> desde el {fechaHora(c.fechaSuspensionTermino)}
                      {c.motivoSuspension ? ` — ${c.motivoSuspension}` : ""}.
                      {c.fechaVencimiento ? " Al reanudarlo, el término se reanuda por los días hábiles que faltaban (Art. 17 CPACA)." : ""}
                    </p>
                    <form action={`/api/correspondencia/${id}/reactivar`} method="post" className="mt-3">
                      <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-4 py-2 text-sm font-medium text-white hover:bg-acento-600">
                        <PlayCircle className="h-3.5 w-3.5" aria-hidden />
                        Reanudar el trámite
                      </button>
                    </form>
                  </>
                ) : (
                  <form action={`/api/correspondencia/${id}/suspender`} method="post" className="mt-3 flex flex-wrap items-end gap-3">
                    <div className="min-w-[260px] flex-1">
                      <Field label="Motivo" required help={c.fechaVencimiento ? "Ej. se solicitó información adicional al peticionario." : "Por qué se detiene el trámite."}>
                        <input name="motivo" required className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
                      </Field>
                    </div>
                    <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
                      <PauseCircle className="h-3.5 w-3.5" aria-hidden />
                      Detener el trámite
                    </button>
                  </form>
                )}
              </Tarjeta>
            )}

            <FlujoTrabajoComunicacion
              comunicacionId={c.id}
              tipo={c.tipo}
              estado={c.estado}
              puedeOperar={puedeOperarFlujosUsuario}
            />

              </>
            ),
          },
          {
            id: "documentos",
            label: "Documentos",
            icono: <FileText className="h-4 w-4" aria-hidden />,
            contador: c.documentos.length,
            contenido: (
              <>
            <Tarjeta icono={<FileText className="h-3.5 w-3.5" aria-hidden />} titulo={`Documentos adjuntos (${documentosOriginales.length})`}>
              {documentosOriginales.length > 0 && (
                <SectionHelp>El código SHA-256 es la huella de integridad de cada archivo — cambia si se altera.</SectionHelp>
              )}
              {documentosOriginales.length === 0 ? (
                <p className="text-sm text-stone-400">La comunicación no tiene documentos adjuntos.</p>
              ) : (
                <ul className="space-y-2">
                  {documentosOriginales.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 flex-none text-cdmb-600" aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-stone-800" title={doc.nombre}>{doc.nombre}</span>
                          {doc.hashSha256 && (
                            <span className="flex items-center gap-1 text-[10px] text-stone-400" title={doc.hashSha256}>
                              <ShieldCheck className="h-3 w-3" aria-hidden /> SHA-256 {doc.hashSha256.slice(0, 12)}…
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="flex flex-none items-center gap-1.5">
                        <VistaPreviaDocumento url={`/api/correspondencia-documentos/${doc.id}`} nombre={doc.nombre} mimeType={doc.mimeType} miniatura />
                        <a href={`/api/correspondencia-documentos/${doc.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-menu-500 bg-white px-2.5 py-1 text-xs font-medium text-cdmb-700 hover:bg-cdmb-50">
                          <Download className="h-3.5 w-3.5" aria-hidden />
                          Abrir
                        </a>
                        {doc.mimeType === "application/pdf" && (
                          <a
                            href={`/api/correspondencia-documentos/${doc.id}/rotulado`}
                            target="_blank"
                            rel="noreferrer"
                            title="PDF con el rótulo de radicación (número, código de barras y QR) y, si aplica, el sello de firma electrónica estampados"
                            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
                          >
                            <Printer className="h-3.5 w-3.5" aria-hidden />
                            Con rótulo
                          </a>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>

              </>
            ),
          },
          {
            id: "expediente",
            label: "Expediente y clasificación",
            icono: <FolderTree className="h-4 w-4" aria-hidden />,
            contenido: (
              <>
            {puedeDistribuirUsuario && (
              <Tarjeta titulo="Expediente de trámite (Trámites 2.0)" icono={<Archive className="h-3.5 w-3.5" aria-hidden />}>
                {c.expediente ? (
                  <p className="text-sm text-stone-600">
                    Ya está archivada en el expediente{" "}
                    <Link href={`/expedientes/${c.expediente.id}`} className="font-medium text-cdmb-700 hover:underline">{c.expediente.numero}</Link>.
                  </p>
                ) : (
                  <>
                    <SectionHelp>Vincula esta comunicación a un expediente de Trámites Ambientales 2.0 ya existente.</SectionHelp>
                    <form action={`/api/correspondencia/${id}/archivar`} method="post" className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[220px] flex-1">
                        <Field label="Número de expediente">
                          <input name="numeroExpediente" placeholder="Ej. M-DA-PR05-2026-0001" className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
                        </Field>
                      </div>
                      <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-menu-500 bg-white px-4 py-2 text-sm font-medium text-cdmb-700 hover:bg-cdmb-50">
                        <Archive className="h-3.5 w-3.5" aria-hidden />
                        Archivar
                      </button>
                    </form>
                  </>
                )}
              </Tarjeta>
            )}

            {puedeDistribuirUsuario && (
              <Tarjeta titulo="Expediente documental (archivo general)" icono={<Archive className="h-3.5 w-3.5" aria-hidden />}>
                {c.expedienteDocumental ? (
                  <p className="text-sm text-stone-600">
                    Ya está archivada en el expediente{" "}
                    <Link href={`/correspondencia/expedientes/${c.expedienteDocumental.id}`} className="font-medium text-cdmb-700 hover:underline">
                      {c.expedienteDocumental.numero}
                    </Link>.
                  </p>
                ) : (
                  <>
                    <SectionHelp>
                      Archivo general de una dependencia (Art. 4.3.2 Acuerdo 001/2024 AGN), para gestiones que no son un
                      trámite ambiental. O{" "}
                      <Link href="/correspondencia/expedientes/nuevo" className="underline">abra uno nuevo</Link>.
                    </SectionHelp>
                    <form action={`/api/correspondencia/${id}/archivar-expediente-documental`} method="post" className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[220px] flex-1">
                        <Field label="Número de expediente">
                          <input name="numeroExpedienteDocumental" placeholder="Ej. CDMB-X-2026-000001" className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
                        </Field>
                      </div>
                      <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-menu-500 bg-white px-4 py-2 text-sm font-medium text-cdmb-700 hover:bg-cdmb-50">
                        <Archive className="h-3.5 w-3.5" aria-hidden />
                        Archivar
                      </button>
                    </form>
                  </>
                )}
              </Tarjeta>
            )}

            {puedeAdministrarArchivoUsuario && c.estado !== "ANULADA" && (
              <Tarjeta titulo="Reclasificación (TRD)" icono={<FolderTree className="h-3.5 w-3.5" aria-hidden />}>
                <SectionHelp>
                  Corrige la clasificación TRD. Queda en la bitácora con la clasificación anterior, la nueva y el motivo;
                  aplican los tiempos de retención de la nueva subserie.
                </SectionHelp>
                <form action={`/api/correspondencia/${id}/reclasificar`} method="post" className="space-y-3">
                  <Field label="Nueva subserie" required help="Elija primero la dependencia, luego la serie y la subserie.">
                    <BuscadorSubserieTRD series={seriesBuscables} nameSubserie="subserieId" requerido />
                  </Field>
                  <Field label="Motivo" required help="Por qué se reclasifica este radicado.">
                    <input name="motivo" required className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
                  </Field>
                  <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
                    <FolderTree className="h-3.5 w-3.5" aria-hidden />
                    Reclasificar
                  </button>
                </form>
              </Tarjeta>
            )}

            <MetadatosComunicacion
              comunicacionId={c.id}
              serieId={c.serieId}
              metadatos={(c.metadatos as Record<string, unknown> | null) ?? null}
              puedeEditar={puedeDistribuirUsuario}
            />

            {puedeDistribuirUsuario && c.estado !== "ANULADA" && (
              <Tarjeta titulo="Palabras clave (vocabulario controlado)" icono={<Tag className="h-3.5 w-3.5" aria-hidden />}>
                <SectionHelp>
                  Etiquetas descriptivas para encontrar esta comunicación por tema (MoReq 5.5). Solo se pueden usar
                  términos del <strong>vocabulario controlado</strong>, que administra el archivo. Guardar reemplaza la
                  selección completa.
                </SectionHelp>
                {terminosVocabulario.length === 0 ? (
                  <p className="text-sm text-stone-400">El vocabulario controlado está vacío — pídale a un administrador de archivo que agregue términos.</p>
                ) : (
                  <form action={`/api/correspondencia/${id}/palabras-clave`} method="post" className="space-y-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {terminosVocabulario.map((t) => (
                        <label key={t.id} className="flex items-center gap-1.5 text-sm text-stone-700">
                          <input type="checkbox" name="palabra" value={t.termino} defaultChecked={c.palabrasClave.includes(t.termino)} className="rounded border-stone-200" />
                          {t.termino}
                          {t.categoria && <span className="text-[11px] text-stone-400">({t.categoria})</span>}
                        </label>
                      ))}
                    </div>
                    <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
                      Guardar palabras clave
                    </button>
                  </form>
                )}
              </Tarjeta>
            )}

            {puedeAdministrarArchivoUsuario && c.estado !== "ANULADA" && (
              <Tarjeta titulo="Nivel de acceso a la información (Ley 1712/2014)" icono={<Lock className="h-3.5 w-3.5" aria-hidden />}>
                <SectionHelp>
                  Pública por defecto (Ley 1712/2014). <strong>Clasificada</strong>: protege un derecho particular.{" "}
                  <strong>Reservada</strong>: protege un interés público (seguridad, investigaciones en curso). Ambas
                  exigen fundamento escrito.
                </SectionHelp>
                <form action={`/api/correspondencia/${id}/nivel-acceso`} method="post" className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[200px]">
                    <Field label="Nivel de acceso" required>
                      <select name="nivelAcceso" required defaultValue={c.nivelAcceso} className="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm">
                        {(["PUBLICA", "CLASIFICADA", "RESERVADA"] as const).map((n) => (
                          <option key={n} value={n}>{ETIQUETA_NIVEL_ACCESO[n]}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="min-w-[260px] flex-1">
                    <Field label="Fundamento" help="Obligatorio si elige clasificada o reservada; puede dejarlo vacío para pública.">
                      <input name="fundamento" defaultValue={c.fundamentoNivelAcceso ?? ""} className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
                    </Field>
                  </div>
                  <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
                    <Lock className="h-3.5 w-3.5" aria-hidden />
                    Guardar
                  </button>
                </form>
              </Tarjeta>
            )}

            {puedeAdministrarArchivoUsuario && c.estado !== "ANULADA" && (
              <Tarjeta titulo="Anulación" icono={<Ban className="h-3.5 w-3.5" aria-hidden />}>
                <SectionHelp>
                  Solo para radicados por error (duplicados, datos equivocados). No se borra: queda marcada como anulada,
                  con motivo, en la bitácora (Ley 594/2000).
                </SectionHelp>
                <form action={`/api/correspondencia/${id}/anular`} method="post" className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[260px] flex-1">
                    <Field label="Motivo" required help="Por qué se anula este radicado.">
                      <input name="motivo" required className="w-full rounded-md border border-stone-200 px-3 py-2 text-sm" />
                    </Field>
                  </div>
                  <button type="submit" className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                    <Ban className="h-3.5 w-3.5" aria-hidden />
                    Anular esta comunicación
                  </button>
                </form>
              </Tarjeta>
            )}

              </>
            ),
          },
          {
            id: "historial",
            label: "Historial",
            icono: <History className="h-4 w-4" aria-hidden />,
            contenido: (
              <>
            <Tarjeta titulo="Bitácora de auditoría (inalterable)" icono={<History className="h-3.5 w-3.5" aria-hidden />}>
              <SectionHelp>Quién radicó, consultó, distribuyó, firmó o archivó esta comunicación, y cuándo — inalterable.</SectionHelp>
              <ul className="divide-y divide-stone-100">
                {bitacora.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
                    <span className="text-stone-700">
                      <span className="font-medium">{ETIQUETA_ACCION[b.accion] ?? b.accion}</span>
                      {b.detalle ? ` — ${b.detalle}` : ""}
                    </span>
                    <span className="text-xs text-stone-400">
                      {b.usuario?.nombre ?? "—"} · {fechaHora(b.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-stone-400">
                <ShieldCheck className="h-3 w-3" aria-hidden />
                Cada registro va encadenado por hash SHA-256; alterar o borrar uno rompe la cadena y queda en evidencia.
              </p>
            </Tarjeta>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
