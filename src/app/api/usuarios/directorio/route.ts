import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { consultarDirectorioPorDocumento } from "@/lib/directorio-activo";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return NextResponse.json({ error: "Solo un administrador puede consultar el directorio activo." }, { status: 403 });
  const documento = (req.nextUrl.searchParams.get("documento") ?? "").replace(/\D/g, "");
  const existente = documento ? await db.usuario.findFirst({ where: { cedulaONit: documento }, select: { id: true, nombre: true } }) : null;
  if (existente) return NextResponse.json({ ok: false, existente, mensaje: `Ya existe un usuario con la cédula ${documento}: ${existente.nombre}.` });
  const r = await consultarDirectorioPorDocumento(documento);
  if (!r.ok) return NextResponse.json({ ok: false, mensaje: r.mensaje, noDisponible: r.noDisponible ?? false });
  const usuarioRed = r.perfil.usuarioRed?.toLowerCase();
  const conRed = usuarioRed ? await db.usuario.findUnique({ where: { email: usuarioRed }, select: { id: true, nombre: true } }) : null;
  if (conRed) return NextResponse.json({ ok: false, existente: conRed, mensaje: `El usuario de red ${usuarioRed} ya tiene cuenta: ${conRed.nombre}.` });
  return NextResponse.json({ ok: true, perfil: r.perfil });
}
