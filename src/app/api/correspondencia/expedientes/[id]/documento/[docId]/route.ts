import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarExpedienteDeDependencia } from "@/lib/permisos";
import { editarDocumentoArchivo, retirarDocumentoArchivo } from "@/lib/expedientes-documentales";
import { parsearFechaLocal } from "@/lib/periodo-dashboard";
import { registrarAuditoriaDoc, datosPeticion, registrarErrorEjecucion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

/** Corrige (metadata) o retira del índice un archivo de un expediente ABIERTO. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/expedientes/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const doc = await db.documentoArchivo.findUnique({
    where: { id: docId },
    select: { expedienteDocumentalId: true, nombre: true, expediente: { select: { numero: true, dependenciaId: true } } },
  });
  if (!doc || doc.expedienteDocumentalId !== id) {
    volver.searchParams.set("error", "El documento no pertenece a este expediente.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (!puedeGestionarExpedienteDeDependencia(permisos, doc.expediente.dependenciaId)) {
    await registrarAccesoDenegadoAccion("corregir o retirar un archivo del expediente", id, session, req.headers);
    volver.searchParams.set("error", "No tiene permiso para modificar los documentos de este expediente.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const accion = String(form.get("accion") || "");
  const { ip, userAgent } = datosPeticion(req.headers);

  try {
    if (accion === "retirar") {
      const motivo = String(form.get("motivo") || "");
      const r = await retirarDocumentoArchivo(docId, session.userId, motivo);
      await registrarAuditoriaDoc({
        entidad: "ExpedienteDocumental", entidadId: id, accion: "RETIRA_DOCUMENTO", usuarioId: session.userId, ip, userAgent,
        detalle: `Retiró "${r.nombre}" del índice de ${doc.expediente.numero} — motivo: ${motivo.trim().slice(0, 300)}`,
      });
      volver.searchParams.set("ok", `"${r.nombre}" retirado del índice.`);
    } else if (accion === "editar") {
      const nombre = String(form.get("nombre") || "").trim() || undefined;
      const tipoRaw = form.get("tipoDocumentalId");
      const tipoDocumentalId = tipoRaw === null ? undefined : (String(tipoRaw) || null);
      const foliosRaw = Number(form.get("numeroFolios"));
      const numeroFolios = Number.isFinite(foliosRaw) && foliosRaw > 0 ? foliosRaw : undefined;
      const fechaRaw = String(form.get("fechaDocumento") || "");
      const fechaDocumento = form.get("fechaDocumento") === null ? undefined : fechaRaw ? parsearFechaLocal(fechaRaw) : null;
      await editarDocumentoArchivo(docId, { nombre, tipoDocumentalId, numeroFolios, fechaDocumento });
      await registrarAuditoriaDoc({
        entidad: "ExpedienteDocumental", entidadId: id, accion: "MODIFICA", usuarioId: session.userId, ip, userAgent,
        detalle: `Corrigió la metadata de "${nombre ?? doc.nombre}" en ${doc.expediente.numero}`,
      });
      volver.searchParams.set("ok", "Datos del documento corregidos.");
    } else {
      volver.searchParams.set("error", "Acción no reconocida.");
    }
  } catch (err) {
    await registrarErrorEjecucion("ExpedienteDocumental", id, `${accion} de documento del expediente`, session.userId, req.headers, err);
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo completar la operación.");
  }

  return NextResponse.redirect(volver, { status: 303 });
}
