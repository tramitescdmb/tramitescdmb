import { NextRequest, NextResponse } from "next/server";
import { documentoFirmadoPorCodigo, documentosFirmadosPorHash } from "@/lib/validar-firma";
import { verificarLimiteEnvio } from "@/lib/anti-abuso";
import { datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest) {
  const { ip } = datosPeticion(req.headers);
  const limite = await verificarLimiteEnvio(ip, "validar-firma", { porHora: 60, porDia: 300 });
  if (!limite.permitido) return NextResponse.json({ error: limite.motivo }, { status: 429 });
  const body = await req.json().catch(() => null);
  const hash = typeof body?.hash === "string" ? body.hash.trim().toLowerCase() : "";
  const csv = typeof body?.csv === "string" ? body.csv.trim() : "";
  if (!csv && !/^[0-9a-f]{64}$/.test(hash)) return NextResponse.json({ error: "Indique un archivo o un código seguro de verificación válido." }, { status: 400 });
  const documentos = csv ? await documentoFirmadoPorCodigo(csv) : await documentosFirmadosPorHash(hash);
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
