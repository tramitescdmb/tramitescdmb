import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRadicar } from "@/lib/permisos";
import { correoValido, leerDatosPersona, nombreCompletoPersona } from "@/lib/datos-persona";
import { datosTercero } from "@/lib/terceros";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeRadicar(permisos)) return NextResponse.json({ error: "No tiene permiso para modificar terceros." }, { status: 403 });

  const actual = await db.tercero.findUnique({ where: { id }, select: { identificacion: true } });
  if (!actual) return NextResponse.json({ error: "Tercero no encontrado." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const p = leerDatosPersona(body?.persona);
  if (!nombreCompletoPersona(p)) return NextResponse.json({ error: p.tipoPersona === "JURIDICA" ? "Indique la razón social." : "Indique nombres y apellidos." }, { status: 400 });
  if (!correoValido(p.email)) return NextResponse.json({ error: "El correo electrónico no es válido." }, { status: 400 });

  await db.tercero.update({ where: { id }, data: datosTercero(p) });
  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Tercero",
    entidadId: id,
    accion: "MODIFICA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Actualizó los datos del tercero ${nombreCompletoPersona(p)} (${actual.identificacion}).`,
  });
  return NextResponse.json({ ok: true });
}
