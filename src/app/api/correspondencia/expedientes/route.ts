import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarExpedienteDeDependencia } from "@/lib/permisos";
import { crearExpedienteDocumental } from "@/lib/expedientes-documentales";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

/** Abre un expediente documental (Art. 4.3.2.1 Acuerdo 001/2024 AGN) para una dependencia. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/correspondencia/expedientes/nuevo", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const form = await req.formData();
  const asunto = String(form.get("asunto") || "");
  const descripcion = String(form.get("descripcion") || "");
  const dependenciaId = String(form.get("dependenciaId") || "");
  const serieId = String(form.get("serieId") || "");
  const subserieId = String(form.get("subserieId") || "");

  if (!dependenciaId) {
    volver.searchParams.set("error", "Indique la dependencia dueña del expediente.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (!puedeGestionarExpedienteDeDependencia(permisos, dependenciaId)) {
    volver.searchParams.set("error", "No tiene permiso para abrir un expediente de esa dependencia.");
    return NextResponse.redirect(volver, { status: 303 });
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
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo abrir el expediente.");
    return NextResponse.redirect(volver, { status: 303 });
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

  const destino = new URL(`/correspondencia/expedientes/${expediente.id}`, req.url);
  destino.searchParams.set("ok", `Expediente ${expediente.numero} abierto.`);
  return NextResponse.redirect(destino, { status: 303 });
}
