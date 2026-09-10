import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeDespachar } from "@/lib/permisos";
import { despacharComunicacion } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion, registrarErrorEjecucion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";
import { ETIQUETA_MEDIO_DESPACHO, type MedioDespacho } from "@/lib/correspondencia";

/**
 * Registra el despacho efectivo de un oficio de salida (ya radicado y firmado):
 * la ventanilla de salida confirma que se envió al destinatario. Cierra el ciclo
 * de la recibida a la que responde. Opcionalmente archiva la recibida + la
 * respuesta en un expediente documental de la subserie.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeDespachar(permisos)) {
    await registrarAccesoDenegadoAccion("despachar el oficio de salida", id, session, req.headers);
    volver.searchParams.set("error", "Solo la ventanilla de salida o gestión documental registra el despacho.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const medio = String(form.get("medio") || "");
  const destino = String(form.get("destino") || "").trim() || null;
  const observacion = String(form.get("observacion") || "").trim() || null;
  const archivarEnExpediente = form.get("archivarEnExpediente") === "on";

  let resultado;
  try {
    resultado = await despacharComunicacion({
      comunicacionId: id,
      usuarioId: session.userId,
      medio,
      destino,
      observacion,
      archivarEnExpediente,
    });
  } catch (err) {
    await registrarErrorEjecucion("Comunicacion", id, "despacho de oficio de salida", session.userId, req.headers, err);
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo registrar el despacho.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const etiquetaMedio = ETIQUETA_MEDIO_DESPACHO[medio as MedioDespacho] ?? medio;
  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "DESPACHA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle:
      `Despachó ${resultado.radicado} por ${etiquetaMedio}${destino ? ` a ${destino}` : ""}` +
      (resultado.expedienteNumero ? ` — archivada en el expediente ${resultado.expedienteNumero}` : ""),
  });

  const partes = [`${resultado.radicado} despachada por ${etiquetaMedio}.`];
  if (resultado.expedienteNumero) partes.push(`Archivada en el expediente ${resultado.expedienteNumero}.`);
  if (resultado.avisoExpediente) partes.push(resultado.avisoExpediente);
  volver.searchParams.set(resultado.avisoExpediente ? "error" : "ok", partes.join(" "));
  return NextResponse.redirect(volver, { status: 303 });
}
