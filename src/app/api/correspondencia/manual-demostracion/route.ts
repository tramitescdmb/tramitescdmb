import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";
import { crearApartadoManual } from "@/lib/manual-demostracion";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    await registrarAccesoDenegadoAccion("agregar un apartado al manual de demostración", "manual-demostracion", session, req.headers);
    return NextResponse.json({ error: "Solo el administrador de archivo puede editar el manual." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });

  try {
    const creado = await crearApartadoManual(body, session.userId);
    const { ip, userAgent } = datosPeticion(req.headers);
    await registrarAuditoriaDoc({
      entidad: "ApartadoManual",
      entidadId: creado.id,
      accion: "CREA",
      usuarioId: session.userId,
      ip,
      userAgent,
      detalle: `Manual de demostración: nuevo apartado ${creado.orden} «${creado.titulo}»`,
    });
    return NextResponse.json({ ok: true, id: creado.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo agregar." }, { status: 400 });
  }
}
