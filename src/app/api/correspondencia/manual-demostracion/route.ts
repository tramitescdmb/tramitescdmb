import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeEditarManualDemostracion } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion, registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";
import { crearApartadoManual, moduloManualValido } from "@/lib/manual-demostracion";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeEditarManualDemostracion(permisos, moduloManualValido(body.modulo))) {
    await registrarAccesoDenegadoAccion("agregar un apartado al manual de demostración", "manual-demostracion", session, req.headers);
    return NextResponse.json({ error: "No tiene permiso para editar este manual." }, { status: 403 });
  }

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
