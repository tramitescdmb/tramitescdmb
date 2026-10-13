import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeRegistrarContratistaMinimo } from "@/lib/permisos";
import { asegurarContratistaDeUsuario, consultarUsuarioRedContratista } from "@/lib/contratacion";

async function autorizar() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeRegistrarContratistaMinimo(await obtenerPermisosUsuario(session.userId))) {
    return NextResponse.json({ error: "No tiene permiso para registrar contratistas." }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const error = await autorizar();
  if (error) return error;
  const resultado = await consultarUsuarioRedContratista(req.nextUrl.searchParams.get("u") ?? "");
  if (!resultado) return NextResponse.json({ error: "Indique el usuario de red." }, { status: 400 });
  return NextResponse.json(resultado);
}

export async function POST(req: NextRequest) {
  const error = await autorizar();
  if (error) return error;
  const body = await req.json().catch(() => null);
  const consulta = await consultarUsuarioRedContratista(typeof body?.usuarioRed === "string" ? body.usuarioRed : "");
  if (!consulta?.existe) return NextResponse.json({ error: "El usuario de red no existe en la plataforma." }, { status: 404 });
  try {
    const contratista = await asegurarContratistaDeUsuario(consulta.usuarioId);
    return NextResponse.json({ id: contratista.id, nombre: contratista.nombre, identificacion: consulta.documento ?? "" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo vincular." }, { status: 400 });
  }
}
