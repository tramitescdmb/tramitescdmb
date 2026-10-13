import { NextResponse } from "next/server";
import { sincronizarExpedienteSecop } from "@/lib/contratacion";
import { autorizarGestionContrato } from "@/lib/api-gestion-contrato";

export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizarGestionContrato(id, "registrar");
  if (!auth.ok) return auth.respuesta;
  try {
    return NextResponse.json(await sincronizarExpedienteSecop(id, auth.userId));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo sincronizar con SECOP II." }, { status: 400 });
  }
}
