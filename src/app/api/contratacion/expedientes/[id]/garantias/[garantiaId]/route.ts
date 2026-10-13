import { NextResponse } from "next/server";
import { aprobarGarantia, eliminarGarantia } from "@/lib/contratacion";
import { autorizarGestionContrato } from "@/lib/api-gestion-contrato";

type Params = { params: Promise<{ id: string; garantiaId: string }> };

export async function PATCH(_req: Request, { params }: Params) {
  const { id, garantiaId } = await params;
  const auth = await autorizarGestionContrato(id, "aprobar");
  if (!auth.ok) return auth.respuesta;
  try {
    await aprobarGarantia(id, garantiaId, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo aprobar." }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, garantiaId } = await params;
  const auth = await autorizarGestionContrato(id, "aprobar");
  if (!auth.ok) return auth.respuesta;
  try {
    await eliminarGarantia(id, garantiaId, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo eliminar." }, { status: 400 });
  }
}
