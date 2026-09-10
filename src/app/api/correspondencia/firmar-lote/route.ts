import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeFirmar } from "@/lib/permisos";
import { firmarEnLote } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

/** Firma varias comunicaciones a la vez (MoReq 3.17). Gateado por puedeFirmar (Usuario.accesoFirma). */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/correspondencia", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeFirmar(permisos)) {
    await registrarAccesoDenegadoAccion("Firma en lote", "-", session, await headers());
    volver.searchParams.set("error", "No tiene permiso para firmar.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const ids = form.getAll("comunicacionId").map(String);
  const { ip, userAgent } = datosPeticion(await headers());
  try {
    const { firmadas, omitidas } = await firmarEnLote(ids, session.userId, ip);
    if (firmadas.length > 0) {
      await registrarAuditoriaDoc({
        entidad: "Comunicacion",
        entidadId: firmadas.join(","),
        accion: "FIRMA",
        usuarioId: session.userId,
        ip,
        userAgent,
        detalle: `Firma en lote: ${firmadas.length} comunicación(es) — ${firmadas.join(", ")}`,
      });
    }
    volver.searchParams.set(
      "ok",
      `${firmadas.length} firmada(s)${omitidas.length ? `; ${omitidas.length} omitida(s): ${omitidas.map((o) => `${o.radicado} (${o.motivo})`).join("; ")}` : "."}`,
    );
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo firmar el lote.");
  }
  return NextResponse.redirect(volver, { status: 303 });
}
