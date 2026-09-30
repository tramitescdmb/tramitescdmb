import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarExpedienteDeDependencia } from "@/lib/permisos";
import { crearExpedienteDocumental } from "@/lib/expedientes-documentales";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest) {
  const session = await getSession();
  // El formulario original hace un POST tradicional (application/x-www-form-urlencoded) y espera
  // una redirección; el formulario ahora también puede enviar JSON para subir el primer documento
  // en el mismo paso (ver NuevoExpedienteDocumentalForm) y espera la respuesta como JSON.
  const esJson = (req.headers.get("content-type") || "").includes("application/json");
  const volver = new URL("/correspondencia/expedientes/nuevo", req.url);

  if (!session) {
    if (esJson) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  }
  const permisos = await obtenerPermisosUsuario(session.userId);

  let asunto: string;
  let descripcion: string;
  let dependenciaId: string;
  let serieId: string;
  let subserieId: string;
  if (esJson) {
    const body = await req.json().catch(() => null);
    asunto = String(body?.asunto || "");
    descripcion = String(body?.descripcion || "");
    dependenciaId = String(body?.dependenciaId || "");
    serieId = String(body?.serieId || "");
    subserieId = String(body?.subserieId || "");
  } else {
    const form = await req.formData();
    asunto = String(form.get("asunto") || "");
    descripcion = String(form.get("descripcion") || "");
    dependenciaId = String(form.get("dependenciaId") || "");
    serieId = String(form.get("serieId") || "");
    subserieId = String(form.get("subserieId") || "");
  }

  const fallar = (mensaje: string, status: number) => {
    if (esJson) return NextResponse.json({ error: mensaje }, { status });
    volver.searchParams.set("error", mensaje);
    return NextResponse.redirect(volver, { status: 303 });
  };

  if (!dependenciaId) return fallar("Indique la dependencia dueña del expediente.", 400);
  if (!puedeGestionarExpedienteDeDependencia(permisos, dependenciaId)) {
    return fallar("No tiene permiso para abrir un expediente de esa dependencia.", 403);
  }

  let expediente;
  try {
    expediente = await crearExpedienteDocumental({
      asunto,
      descripcion: descripcion || null,
      dependenciaId,
      serieId: serieId || null,
      subserieId: subserieId || null,
      creadoPorId: session.userId,
    });
  } catch (err) {
    return fallar(err instanceof Error ? err.message : "No se pudo abrir el expediente.", 400);
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "ExpedienteDocumental",
    entidadId: expediente.id,
    accion: "CREA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Abrió el expediente ${expediente.numero}: "${expediente.asunto.slice(0, 200)}"`,
  });

  if (esJson) return NextResponse.json({ id: expediente.id, numero: expediente.numero });

  const destino = new URL(`/correspondencia/expedientes/${expediente.id}`, req.url);
  destino.searchParams.set("ok", `Expediente ${expediente.numero} abierto.`);
  return NextResponse.redirect(destino, { status: 303 });
}
