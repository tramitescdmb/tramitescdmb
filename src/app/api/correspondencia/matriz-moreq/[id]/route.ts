import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";
import { actualizarRequisitoMoreq, esEstadoMoreq } from "@/lib/matriz-moreq";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    await registrarAccesoDenegadoAccion("editar la matriz de cumplimiento MoReq", id, session, req.headers);
    return NextResponse.json({ error: "Solo el administrador de archivo puede editar la matriz." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !esEstadoMoreq(body.estado) || typeof body.titulo !== "string" || typeof body.nota !== "string") {
    return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
  }

  try {
    const { numero, cambios } = await actualizarRequisitoMoreq(id, { titulo: body.titulo, estado: body.estado, nota: body.nota }, session.userId);
    if (cambios.length > 0) {
      const { ip, userAgent } = datosPeticion(req.headers);
      await registrarAuditoriaDoc({
        entidad: "RequisitoMoreq",
        entidadId: numero,
        accion: "MODIFICA",
        usuarioId: session.userId,
        ip,
        userAgent,
        detalle: `Matriz MoReq ${numero}: ${cambios.join("; ")}`,
      });
    }
    return NextResponse.json({ ok: true, cambios: cambios.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo guardar." }, { status: 400 });
  }
}
