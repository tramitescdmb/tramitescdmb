import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRegistrarContratistaMinimo } from "@/lib/permisos";
import { crearContratistaMinimo, ContratistaDuplicadoError } from "@/lib/contratacion";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeRegistrarContratistaMinimo(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para registrar contratistas." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  try {
    const creado = await crearContratistaMinimo(body.persona, body.representanteLegal);
    return NextResponse.json({ id: creado.id, nombre: creado.nombre }, { status: 201 });
  } catch (err) {
    if (err instanceof ContratistaDuplicadoError) {
      return NextResponse.json({ error: err.message, contratistaId: err.contratistaId }, { status: 409 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo registrar el contratista." }, { status: 400 });
  }
}
