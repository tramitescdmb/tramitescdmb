import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { esModuloFirma, identidadParaFirmar } from "@/lib/identidad-para-firmar";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const modulo = sp.get("modulo");
  const identidad = await identidadParaFirmar(session.userId, {
    modulo: esModuloFirma(modulo) ? modulo : "SGDEA",
    solicitudId: sp.get("solicitudId"),
  });
  if (!identidad) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  return NextResponse.json(identidad);
}
