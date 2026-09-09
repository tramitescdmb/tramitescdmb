import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { ejecutarDisposicionFinalLote } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion, registrarErrorEjecucion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

/** Disposición final de varias comunicaciones a la vez (MoReq 2.9). Ver ejecutarDisposicionFinalLote. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    await registrarAccesoDenegadoAccion("ejecutar disposición final por lote", "(lote)", session, req.headers);
    return NextResponse.json({ error: "No tiene permiso para administrar el archivo." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const comunicacionIds: string[] = Array.isArray(body?.comunicacionIds)
    ? body.comunicacionIds.filter((v: unknown): v is string => typeof v === "string")
    : [];
  if (comunicacionIds.length === 0) {
    return NextResponse.json({ error: "No hay comunicaciones seleccionadas." }, { status: 400 });
  }
  const responsable = typeof body?.responsable === "string" ? body.responsable : "";
  const motivacion = typeof body?.motivacion === "string" ? body.motivacion : null;

  let resultado;
  try {
    resultado = await ejecutarDisposicionFinalLote({ comunicacionIds, responsable, motivacion, aprobadaPorId: session.userId });
  } catch (err) {
    await registrarErrorEjecucion("Comunicacion", comunicacionIds[0] ?? "(lote)", "disposición final por lote", session.userId, req.headers, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo ejecutar la disposición final." }, { status: 400 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  const detalleLote = resultado.dispuestas.length > 1 ? ` (lote de ${resultado.dispuestas.length})` : "";
  await Promise.all(
    resultado.dispuestas.map((c) =>
      registrarAuditoriaDoc({
        entidad: "Comunicacion",
        entidadId: c.id,
        accion: "DISPONE",
        usuarioId: session.userId,
        ip,
        userAgent,
        detalle: `Ejecutó la disposición final de ${c.radicado}${detalleLote}${c.requirioActa && responsable ? ` — aprobada por ${responsable}` : ""}`,
      }).catch((err) => console.error("registrarAuditoriaDoc (disponer-lote) falló:", err))
    )
  );

  return NextResponse.json({
    ok: true,
    dispuestas: resultado.dispuestas.length,
    omitidas: resultado.omitidas,
    actaId: resultado.actaId,
  });
}
