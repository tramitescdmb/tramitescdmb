import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeGestionarContratistas } from "@/lib/permisos";
import { guardarTopeCuantia } from "@/lib/contratacion";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeGestionarContratistas(await obtenerPermisosUsuario(session.userId))) {
    return NextResponse.json({ error: "Solo el administrador o el jefe de contratación registran los topes de cuantía." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  try {
    await guardarTopeCuantia(
      { anio: Number(body?.anio), menorCuantia: Number(body?.menorCuantia), soporte: typeof body?.soporte === "string" ? body.soporte : null },
      session.userId
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo guardar el tope." }, { status: 400 });
  }
}
