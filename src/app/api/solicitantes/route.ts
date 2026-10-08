import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSolicitantes } from "@/lib/permisos";
import { correoValido, leerDatosPersona, TIPOS_IDENTIFICACION_USUARIO } from "@/lib/datos-persona";
import { datosSolicitante, errorSolicitante } from "@/lib/solicitante";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederSolicitantes(permisos)) {
    return NextResponse.json({ error: "No tiene acceso a ningún trámite." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  const p = leerDatosPersona(body.persona, TIPOS_IDENTIFICACION_USUARIO);

  if (!p.identificacion) return NextResponse.json({ error: "La identificación es obligatoria." }, { status: 400 });
  const error = errorSolicitante(p);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!correoValido(p.email)) return NextResponse.json({ error: "El correo electrónico no es válido." }, { status: 400 });

  const existente = await db.solicitante.findUnique({ where: { identificacion: p.identificacion } });
  if (existente) {
    return NextResponse.json({ error: "Ya existe un solicitante con esta identificación.", id: existente.id }, { status: 409 });
  }

  const creado = await db.solicitante.create({ data: { ...datosSolicitante(p), tipo: p.tipoPersona, identificacion: p.identificacion } });
  return NextResponse.json({ id: creado.id }, { status: 201 });
}
