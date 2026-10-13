import { NextRequest, NextResponse } from "next/server";
import { registrarGarantia } from "@/lib/contratacion";
import { autorizarGestionContrato, fechaDe } from "@/lib/api-gestion-contrato";
import { AMPAROS_GARANTIA } from "@/lib/garantias-pagos";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizarGestionContrato(id, "registrar");
  if (!auth.ok) return auth.respuesta;
  const body = await req.json().catch(() => null);
  const valor = Number(body?.valorAsegurado);
  try {
    await registrarGarantia(
      id,
      {
        aseguradora: String(body?.aseguradora ?? ""),
        numeroPoliza: String(body?.numeroPoliza ?? ""),
        amparos: Array.isArray(body?.amparos) ? body.amparos.filter((a: unknown) => AMPAROS_GARANTIA.some((x) => x.valor === a)) : [],
        valorAsegurado: Number.isFinite(valor) && valor > 0 ? Math.round(valor) : null,
        vigenciaDesde: fechaDe(body?.vigenciaDesde),
        vigenciaHasta: fechaDe(body?.vigenciaHasta) ?? new Date(NaN),
      },
      auth.userId
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo registrar la garantía." }, { status: 400 });
  }
}
