import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario } from "@/lib/permisos";
import { contextoMemorandos } from "@/lib/memorandos";
import { WHERE_MEMORANDO_EN_FIRMA } from "@/lib/memorandos-envio";
import { anularComunicacion } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

/**
 * Anula un memorando que todavía no se ha entregado (espera firmas de proyectó / revisó, o alguna se
 * rechazó). Lo hace quien lo firmó, o gestión documental. Un memorando ya entregado no se anula aquí.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const volver = new URL(`/memorandos/${id}`, req.url);
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const ctx = await contextoMemorandos(session.userId, await obtenerPermisosUsuario(session.userId));
  const form = await req.formData();
  const motivo = String(form.get("motivo") || "").trim();

  const memo = await db.comunicacion.findFirst({
    where: { id, tipo: "INTERNA", estado: { not: "ANULADA" }, AND: [WHERE_MEMORANDO_EN_FIRMA] },
    select: { radicado: true, radicadoPorId: true },
  });
  if (!memo) {
    volver.searchParams.set("error", "Solo se puede anular un memorando que aún no se ha entregado.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (!ctx.acceso || (memo.radicadoPorId !== session.userId && !ctx.archivo)) {
    await registrarAccesoDenegadoAccion("anular el memorando", id, session, req.headers);
    volver.searchParams.set("error", "Solo quien firmó el memorando puede anularlo.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (!motivo) {
    volver.searchParams.set("error", "Indique el motivo de la anulación.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  try {
    await anularComunicacion(id, motivo, session.userId);
    // Las firmas que quedaban pendientes ya no tienen objeto: salen de «Por firmar» de esas personas.
    await db.solicitudFirma.deleteMany({ where: { comunicacionId: id, estado: "PENDIENTE" } });
  } catch (e) {
    volver.searchParams.set("error", e instanceof Error ? e.message : "No se pudo anular el memorando.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "ANULA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Anuló el memorando ${memo.radicado} antes de entregarlo: ${motivo.slice(0, 300)}`,
  }).catch((e) => console.error("registrarAuditoriaDoc (anular memorando) falló:", e));
  volver.searchParams.set("ok", "Memorando anulado. No se entregó a nadie.");
  return NextResponse.redirect(volver, { status: 303 });
}
