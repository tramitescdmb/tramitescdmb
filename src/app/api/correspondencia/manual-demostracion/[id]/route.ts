import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";
import { actualizarApartadoManual, eliminarApartadoManual } from "@/lib/manual-demostracion";

async function autorizar(req: NextRequest, id: string, operacion: string) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    await registrarAccesoDenegadoAccion(operacion, id, session, req.headers);
    return { error: NextResponse.json({ error: "Solo el administrador de archivo puede editar el manual." }, { status: 403 }) };
  }
  return { session };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acceso = await autorizar(req, id, "editar un apartado del manual de demostración");
  if ("error" in acceso) return acceso.error;
  const { session } = acceso;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });

  try {
    const { titulo, cambios } = await actualizarApartadoManual(id, body, session.userId);
    if (cambios.length > 0) {
      const { ip, userAgent } = datosPeticion(req.headers);
      await registrarAuditoriaDoc({
        entidad: "ApartadoManual",
        entidadId: id,
        accion: "MODIFICA",
        usuarioId: session.userId,
        ip,
        userAgent,
        detalle: `Manual de demostración, «${titulo}»: ${cambios.join(", ")}`,
      });
    }
    return NextResponse.json({ ok: true, cambios: cambios.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo guardar." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acceso = await autorizar(req, id, "eliminar un apartado del manual de demostración");
  if ("error" in acceso) return acceso.error;
  const { session } = acceso;

  try {
    const eliminado = await eliminarApartadoManual(id);
    const { ip, userAgent } = datosPeticion(req.headers);
    await registrarAuditoriaDoc({
      entidad: "ApartadoManual",
      entidadId: id,
      accion: "ELIMINA",
      usuarioId: session.userId,
      ip,
      userAgent,
      detalle: `Manual de demostración: se eliminó el apartado ${eliminado.orden} «${eliminado.titulo}»`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo eliminar." }, { status: 400 });
  }
}
