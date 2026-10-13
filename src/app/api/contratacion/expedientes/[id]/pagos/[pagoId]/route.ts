import { NextResponse } from "next/server";
import { eliminarPago } from "@/lib/contratacion";
import { autorizarGestionContrato } from "@/lib/api-gestion-contrato";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; pagoId: string }> }) {
  const { id, pagoId } = await params;
  const auth = await autorizarGestionContrato(id, "aprobar");
  if (!auth.ok) return auth.respuesta;
  try {
    await eliminarPago(id, pagoId, auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo eliminar." }, { status: 400 });
  }
}
