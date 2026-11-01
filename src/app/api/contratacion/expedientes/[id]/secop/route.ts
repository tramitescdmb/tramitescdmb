import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anotarContratosSecop, desvincularExpedienteSecop, sincronizarExpedienteSecop } from "@/lib/contratacion";
import { autorizarGestionContrato } from "@/lib/api-gestion-contrato";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeEditarDatosContrato } from "@/lib/permisos";
import { buscarContratosSecop } from "@/lib/secop-datos";
import { MENSAJE_EXPEDIENTE_CERRADO } from "@/lib/archivo-central";

export const maxDuration = 60;

async function autorizarEnlace(id: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, respuesta: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  const [permisos, expediente] = await Promise.all([
    obtenerPermisosUsuario(session.userId),
    db.expedienteContractual.findFirst({
      where: { id, eliminado: false },
      select: { id: true, cerrado: true, numeroContrato: true, numeroProcesoSecop: true, contratista: { select: { identificacion: true } } },
    }),
  ]);
  if (!expediente) return { ok: false as const, respuesta: NextResponse.json({ error: "El expediente no existe." }, { status: 404 }) };
  if (!puedeEditarDatosContrato(permisos, expediente)) {
    return { ok: false as const, respuesta: NextResponse.json({ error: "No tiene permiso para cambiar el enlace de este expediente con SECOP II." }, { status: 403 }) };
  }
  if (expediente.cerrado) return { ok: false as const, respuesta: NextResponse.json({ error: MENSAJE_EXPEDIENTE_CERRADO }, { status: 409 }) };
  return { ok: true as const, userId: session.userId, expediente };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizarEnlace(id);
  if (!auth.ok) return auth.respuesta;
  const consulta =
    req.nextUrl.searchParams.get("q")?.trim() ||
    auth.expediente.contratista?.identificacion ||
    auth.expediente.numeroContrato ||
    auth.expediente.numeroProcesoSecop ||
    "";
  if (!consulta) return NextResponse.json({ consulta, contratos: [] });
  try {
    return NextResponse.json({ consulta, contratos: await anotarContratosSecop(await buscarContratosSecop(consulta), id) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo consultar SECOP II." }, { status: 502 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const idElegido = typeof body?.idContrato === "string" ? body.idContrato.trim() : "";
  const auth = idElegido ? await autorizarEnlace(id) : await autorizarGestionContrato(id, "registrar");
  if (!auth.ok) return auth.respuesta;
  try {
    return NextResponse.json(await sincronizarExpedienteSecop(id, auth.userId, idElegido || undefined));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo sincronizar con SECOP II." }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizarEnlace(id);
  if (!auth.ok) return auth.respuesta;
  try {
    await desvincularExpedienteSecop(id, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo desvincular de SECOP II." }, { status: 400 });
  }
}
