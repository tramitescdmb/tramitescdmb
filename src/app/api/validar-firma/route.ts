import { NextRequest, NextResponse } from "next/server";
import { documentosFirmadosPorHash } from "@/lib/validar-firma";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const hash = typeof body?.hash === "string" ? body.hash.trim().toLowerCase() : "";
  if (!/^[0-9a-f]{64}$/.test(hash)) return NextResponse.json({ error: "Huella SHA-256 inválida." }, { status: 400 });
  const documentos = await documentosFirmadosPorHash(hash);
  return NextResponse.json(
    {
      documentos: documentos.map((d) => ({
        ...d,
        firmas: d.firmas.map((f) => ({ ...f, fechaHora: f.fechaHora.toISOString(), selloTiempoEn: f.selloTiempoEn?.toISOString() ?? null })),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
