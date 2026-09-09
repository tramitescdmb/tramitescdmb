import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeDistribuir } from "@/lib/permisos";
import { etiquetarComunicacion } from "@/lib/correspondencia";
import { registrarAuditoriaDoc, datosPeticion, registrarErrorEjecucion } from "@/lib/auditoria-doc";

/**
 * Fija las palabras clave (vocabulario controlado, MoReq 5.5) de una comunicación.
 * Reservado a quien distribuye/gestiona correspondencia — es catalogación descriptiva.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL(`/correspondencia/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeDistribuir(permisos)) {
    volver.searchParams.set("error", "No tiene permiso para catalogar comunicaciones.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const propuestas = form.getAll("palabra").map((v) => String(v));

  let resultado: { validas: string[]; rechazadas: string[] };
  try {
    resultado = await etiquetarComunicacion(id, propuestas);
  } catch (err) {
    await registrarErrorEjecucion("Comunicacion", id, "etiquetado con palabras clave", session.userId, req.headers, err);
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudieron guardar las palabras clave.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: id,
    accion: "MODIFICA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Palabras clave: ${resultado.validas.length ? resultado.validas.join(", ") : "(ninguna)"}`,
  }).catch((err) => console.error("registrarAuditoriaDoc (palabras-clave) falló:", err));

  volver.searchParams.set(
    "ok",
    resultado.rechazadas.length
      ? `Palabras clave guardadas. No están en el vocabulario y se ignoraron: ${resultado.rechazadas.join(", ")}.`
      : "Palabras clave guardadas."
  );
  return NextResponse.redirect(volver, { status: 303 });
}
