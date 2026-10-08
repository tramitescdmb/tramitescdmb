import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRadicar } from "@/lib/permisos";
import { correoValido, leerDatosPersona, nombreCompletoPersona } from "@/lib/datos-persona";
import { datosTercero } from "@/lib/terceros";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeRadicar(permisos)) return NextResponse.json({ error: "No tiene permiso para registrar terceros." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const p = leerDatosPersona(body?.persona);
  if (!p.identificacion) return NextResponse.json({ error: "Indique el número de documento." }, { status: 400 });
  if (!nombreCompletoPersona(p)) return NextResponse.json({ error: p.tipoPersona === "JURIDICA" ? "Indique la razón social." : "Indique nombres y apellidos." }, { status: 400 });
  if (!correoValido(p.email)) return NextResponse.json({ error: "El correo electrónico no es válido." }, { status: 400 });

  const existente = await db.tercero.findUnique({ where: { identificacion: p.identificacion }, select: { id: true } });
  if (existente) return NextResponse.json({ error: "Ya existe un tercero con ese documento.", id: existente.id }, { status: 409 });

  const creado = await db.tercero.create({ data: { ...datosTercero(p), identificacion: p.identificacion, creadoPorId: session.userId } });
  const { ip, userAgent } = datosPeticion(req.headers);
  await registrarAuditoriaDoc({
    entidad: "Tercero",
    entidadId: creado.id,
    accion: "CREA",
    usuarioId: session.userId,
    ip,
    userAgent,
    detalle: `Registró el tercero ${nombreCompletoPersona(p)} (${p.identificacion}).`,
  });
  return NextResponse.json({ id: creado.id }, { status: 201 });
}
