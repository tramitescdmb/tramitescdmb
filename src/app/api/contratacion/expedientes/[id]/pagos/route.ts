import { NextRequest, NextResponse } from "next/server";
import { registrarPago } from "@/lib/contratacion";
import { autorizarGestionContrato, fechaDe } from "@/lib/api-gestion-contrato";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizarGestionContrato(id, "registrar");
  if (!auth.ok) return auth.respuesta;
  const body = await req.json().catch(() => null);
  try {
    await registrarPago(
      id,
      {
        fecha: fechaDe(body?.fecha) ?? new Date(NaN),
        valor: Number(body?.valor),
        periodoMes: typeof body?.periodoMes === "string" ? body.periodoMes : null,
        observacion: typeof body?.observacion === "string" ? body.observacion : null,
      },
      auth.userId
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo registrar el pago." }, { status: 400 });
  }
}
