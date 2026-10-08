import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { correoValido, leerDatosPersona, TIPOS_IDENTIFICACION_USUARIO } from "@/lib/datos-persona";
import { datosSolicitante, errorSolicitante } from "@/lib/solicitante";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede editar el registro de un solicitante." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const existente = await db.solicitante.findUnique({ where: { id }, select: { tipo: true } });
  if (!existente) return NextResponse.json({ error: "Solicitante no encontrado." }, { status: 404 });

  const p = leerDatosPersona({ ...body.persona, tipoPersona: existente.tipo }, TIPOS_IDENTIFICACION_USUARIO);
  const error = errorSolicitante(p);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!correoValido(p.email)) return NextResponse.json({ error: "El correo electrónico no es válido." }, { status: 400 });

  const actualizado = await db.solicitante.update({ where: { id }, data: datosSolicitante(p) }).catch(() => null);
  if (!actualizado) return NextResponse.json({ error: "Solicitante no encontrado." }, { status: 404 });
  return NextResponse.json(actualizado);
}
