import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeCrearExpedienteContractual } from "@/lib/permisos";
import { buscarContratosSecop } from "@/lib/secop-datos";
import { anotarContratosSecop } from "@/lib/contratacion";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeCrearExpedienteContractual(await obtenerPermisosUsuario(session.userId))) {
    return NextResponse.json({ error: "No tiene permiso para consultar SECOP II desde GECON." }, { status: 403 });
  }
  const ref = req.nextUrl.searchParams.get("ref") ?? "";
  try {
    return NextResponse.json({ contratos: await anotarContratosSecop(await buscarContratosSecop(ref)) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo consultar SECOP II." }, { status: 502 });
  }
}
