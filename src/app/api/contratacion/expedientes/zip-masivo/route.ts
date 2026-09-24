import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario } from "@/lib/permisos";
import { construirWhereExpedienteContractual, type FiltrosContratacion } from "@/lib/contratacion";
import { construirZipMasivo, MAX_EXPEDIENTES_ZIP_MASIVO } from "@/lib/zip-contratacion";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const sp = req.nextUrl.searchParams;
  const filtro: FiltrosContratacion = {
    q: sp.get("q") ?? undefined,
    etapa: sp.get("etapa") ?? undefined,
    modalidad: sp.get("modalidad") ?? undefined,
    contratistaId: sp.get("contratistaId") ?? undefined,
    dependenciaId: sp.get("dependenciaId") ?? undefined,
  };
  const where = construirWhereExpedienteContractual(filtro, permisos);

  const total = await db.expedienteContractual.count({ where });
  if (total === 0) return NextResponse.json({ error: "Ningún expediente coincide con este filtro." }, { status: 404 });
  if (total > MAX_EXPEDIENTES_ZIP_MASIVO) {
    return NextResponse.json(
      {
        error: `Su filtro trae ${total} expedientes; el máximo por descarga es ${MAX_EXPEDIENTES_ZIP_MASIVO}. Acótelo por dependencia, etapa o número de contrato e intente de nuevo.`,
      },
      { status: 400 }
    );
  }

  const expedientes = await db.expedienteContractual.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, numero: true, numeroContrato: true },
  });

  try {
    const h = await headers();
    const baseUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
    const zip = await construirZipMasivo(expedientes, baseUrl);
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="expedientes-sigec.zip"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo generar el ZIP." }, { status: 500 });
  }
}
