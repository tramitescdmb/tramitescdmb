import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeVerExpedienteTramite, puedeEditarTramite, puedePlanearVisitas } from "@/lib/permisos";
import { etiquetaConcepto } from "@/lib/concepto-tecnico";
import { AsignarNumeroConcepto } from "@/components/formatos/AsignarNumeroConcepto";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { estructuraDesdeJson, precargaDeVisita } from "@/lib/formatos-visita-db";
import { sanearRespuestas } from "@/lib/formato-visita";
import { DocumentoFormato } from "@/components/formatos/DocumentoFormato";
import { EstiloImpresionFormato } from "@/components/formatos/EstiloImpresionFormato";
import { BotonImprimir } from "@/components/BotonImprimir";
import { FinalizarConcepto } from "@/components/formatos/FinalizarConcepto";
import { accesoCorreccionConcepto, equipoDeVisita, firmantesParaDocumento } from "@/lib/concepto-visita-db";
import { ReabrirConcepto } from "@/components/formatos/ReabrirConcepto";
import { AccionesRevisionConcepto } from "@/components/formatos/AccionesRevisionConcepto";
import { LineaEstadoConcepto } from "@/components/formatos/LineaEstadoConcepto";
import { etapaConcepto, puedeEnviarARevision, puedeFinalizarSegunRevision } from "@/lib/revision-concepto";
import { RecordarFirmasConcepto } from "@/components/formatos/RecordarFirmasConcepto";
import { PanelFirmas } from "@/components/PanelFirmas";
import { construirFilasFirmantes } from "@/lib/panel-firmas";
import { puedeActuarSolicitud } from "@/lib/solicitudes-firma";
import { ETIQUETA_ROL_PARTICIPANTE } from "@/lib/participantes-visita";

export default async function FormatoVisitaDiligenciadoPage({ params }: { params: Promise<{ id: string; visitaId: string }> }) {
  const { id, visitaId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const visita = await db.visitaProgramada.findUnique({
    where: { id: visitaId },
    select: {
      id: true,
      expedienteId: true,
      profesionalId: true,
      expediente: { select: { numero: true, tramiteTipoId: true } },
      visitaTecnica: {
        select: {
          inicioReal: true,
          capturadoEn: true,
          respuestas: true,
          conceptoNumero: true,
          conceptoFecha: true,
          finalizadaEn: true,
          estadoRevision: true,
          revisiones: { orderBy: { createdAt: "asc" }, select: { id: true, accion: true, comentario: true, createdAt: true, usuario: { select: { nombre: true } } } },
          documentoConceptoId: true,
          documentoConcepto: {
            select: {
              solicitudesFirma: {
                orderBy: [{ orden: "asc" }, { asignadoEn: "asc" }],
                select: { id: true, rol: true, calidad: true, orden: true, estado: true, completadoEn: true, comentario: true, recordadoEn: true, usuarioAsignadoId: true, usuarioAsignado: { select: { id: true, nombre: true, denominacionEmpleo: true, denominacionComplemento: true, denominacionEncargo: true, sexo: true, rolesContratacion: true } } },
              },
              firmas: { select: { id: true, calidad: true, fechaHora: true, usuario: { select: { id: true, nombre: true, denominacionEmpleo: true, denominacionComplemento: true, denominacionEncargo: true, sexo: true, rolesContratacion: true } } } },
            },
          },
          fotos: { select: { id: true, pie: true }, orderBy: { createdAt: "asc" } },
          formatoVersion: { select: { numero: true, estructura: true, formato: { select: { codigo: true, titulo: true, versionDocumento: true, fechaDocumento: true } } } },
        },
      },
    },
  });
  if (!visita || visita.expedienteId !== id) notFound();
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeVerExpedienteTramite(permisos, { id: visita.expedienteId, tramiteTipoId: visita.expediente.tramiteTipoId })) notFound();
  const vt = visita.visitaTecnica;
  if (!vt?.formatoVersion) notFound();

  const estructura = estructuraDesdeJson(vt.formatoVersion.estructura);
  const [precarga, config] = await Promise.all([precargaDeVisita(visita.id, vt.inicioReal ?? vt.capturadoEn), getConfiguracionSitio()]);
  const f = vt.formatoVersion.formato;
  const puedeAsignar =
    !vt.conceptoNumero && (puedePlanearVisitas(permisos) || session.userId === visita.profesionalId) && (session.userId === visita.profesionalId || puedeEditarTramite(permisos, visita.expediente.tramiteTipoId));
  const { lista, porId } = await equipoDeVisita(visita.id, visita.profesionalId);
  const firmantesDoc = firmantesParaDocumento(lista, porId);
  const correccion = await accesoCorreccionConcepto(visita.id, session.userId, puedePlanearVisitas(permisos));
  const puedeCorregir = !("error" in correccion);
  const firmasConcepto = (vt.documentoConcepto?.solicitudesFirma ?? []).filter((s) => s.rol !== "LECTURA");
  const puedeReabrir =
    Boolean(vt.finalizadaEn) &&
    !(firmasConcepto.length > 0 && firmasConcepto.every((s) => s.estado === "COMPLETADA")) &&
    puedePlanearVisitas(permisos) &&
    puedeEditarTramite(permisos, visita.expediente.tramiteTipoId);
  const filasFirma = vt.documentoConcepto ? construirFilasFirmantes(vt.documentoConcepto.solicitudesFirma, vt.documentoConcepto.firmas, "TRAMITES") : [];
  const faltan = filasFirma.filter((f) => f.estado === "TURNO" || f.estado === "EN_ESPERA");
  const rechazados = filasFirma.filter((f) => f.estado === "RECHAZADO");
  const miSolicitud = vt.documentoConcepto?.solicitudesFirma.find((s) => s.usuarioAsignadoId === session.userId && s.estado === "PENDIENTE" && s.rol !== "LECTURA");
  const miTurno = miSolicitud && puedeActuarSolicitud(vt.documentoConcepto!.solicitudesFirma, miSolicitud);
  const puedeRecordar =
    faltan.some((f) => f.estado === "TURNO" && f.usuarioId !== session.userId) &&
    (puedePlanearVisitas(permisos) || session.userId === visita.profesionalId || lista.some((p) => p.usuarioId === session.userId));
  const puedeFinalizar =
    Boolean(vt.conceptoNumero) &&
    !vt.finalizadaEn &&
    puedeFinalizarSegunRevision(vt.estadoRevision) &&
    puedePlanearVisitas(permisos) &&
    puedeEditarTramite(permisos, visita.expediente.tramiteTipoId);
  const etapa = etapaConcepto({
    estadoRevision: vt.estadoRevision,
    finalizadaEn: vt.finalizadaEn,
    firmado: firmasConcepto.length > 0 && firmasConcepto.every((s) => s.estado === "COMPLETADA"),
  });
  const puedeEnviarRevision = puedeCorregir && puedeEnviarARevision(vt.estadoRevision, Boolean(vt.finalizadaEn));
  const puedeDevolverRevision = !vt.finalizadaEn && vt.estadoRevision === "EN_REVISION" && puedePlanearVisitas(permisos) && puedeEditarTramite(permisos, visita.expediente.tramiteTipoId);

  return (
    <div className="space-y-3">
      <EstiloImpresionFormato />
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/expedientes/${id}/visitas/${visita.id}`} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Hoja de visita · {visita.expediente.numero}
        </Link>
        <span className="flex flex-wrap items-start gap-2">
          <AccionesRevisionConcepto visitaId={visita.id} puedeEnviar={puedeEnviarRevision} puedeDevolver={puedeDevolverRevision} />
          {puedeCorregir && (
            <Link href={`/expedientes/${id}/visitas/${visita.id}/formato/corregir`} className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Corregir concepto
            </Link>
          )}
          {puedeReabrir && <ReabrirConcepto visitaId={visita.id} />}
          {puedeAsignar && <AsignarNumeroConcepto visitaId={visita.id} />}
          {puedeFinalizar && (
            <FinalizarConcepto
              visitaId={visita.id}
              expedienteId={id}
              numero={vt.conceptoNumero!}
              firmantes={lista.map((p) => ({ nombre: porId.get(p.usuarioId)?.nombre ?? "—", rol: ETIQUETA_ROL_PARTICIPANTE[p.rol] }))}
            />
          )}
          {vt.documentoConceptoId && (
            <a href={`/api/documentos/${vt.documentoConceptoId}/rotulado`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              {faltan.length === 0 && rechazados.length === 0 ? "PDF firmado" : "PDF enviado a firma"}
            </a>
          )}
          <BotonImprimir variante="secundario">Descargar / imprimir</BotonImprimir>
        </span>
      </div>
      <LineaEstadoConcepto etapa={etapa} revisiones={vt.revisiones} />

      {vt.documentoConcepto && (
        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-soft print:hidden">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-stone-900">Estado de las firmas</h3>
            {rechazados.length > 0 ? (
              <span className="rounded-sm bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Rechazado por {rechazados.map((f) => f.nombre).join(", ")}</span>
            ) : faltan.length > 0 ? (
              <span className="rounded-sm bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                Faltan {faltan.length} de {filasFirma.length}: {faltan.map((f) => f.nombre).join(", ")}
              </span>
            ) : (
              <span className="rounded-sm bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Firmado por todos</span>
            )}
          </div>
          <PanelFirmas
            filas={filasFirma}
            acciones={
              <>
                {miTurno && (
                  <Link href={`/firmas/firmar/${miSolicitud!.id}`} className="inline-flex items-center gap-1.5 rounded-md bg-acento-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-acento-600">
                    {miSolicitud!.rol === "VISTO_BUENO" ? "Dar visto bueno ahora" : "Firmar ahora"}
                  </Link>
                )}
                {puedeRecordar && <RecordarFirmasConcepto visitaId={visita.id} />}
              </>
            }
          />
        </section>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-soft print:border-0 print:p-0 print:shadow-none">
        <DocumentoFormato
          encabezado={{ codigo: f.codigo, titulo: f.titulo, versionDocumento: f.versionDocumento, fechaDocumento: f.fechaDocumento, logoUrl: config.logoUrl }}
          estructura={estructura}
          respuestas={sanearRespuestas(estructura, vt.respuestas)}
          precarga={precarga}
          numeroConcepto={vt.conceptoNumero ? etiquetaConcepto(vt.conceptoNumero, vt.conceptoFecha) : null}
          fotos={vt.fotos.map((foto) => ({ id: foto.id, url: `/api/visitas-fotos/${foto.id}?directo`, pie: foto.pie ?? undefined }))}
          firmantes={firmantesDoc}
        />
      </div>
    </div>
  );
}
