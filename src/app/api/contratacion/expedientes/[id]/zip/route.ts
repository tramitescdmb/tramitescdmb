import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeVerExpedienteContractual } from "@/lib/permisos";
import { construirZipExpediente } from "@/lib/zip-contratacion";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const expediente = await db.expedienteContractual.findUnique({
    where: { id },
    select: { numero: true, contratistaId: true, dependenciaSolicitanteId: true },
  });
  if (!expediente) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
  if (!puedeVerExpedienteContractual(permisos, { id, ...expediente })) {
    return NextResponse.json({ error: "No tiene acceso a este expediente." }, { status: 403 });
  }

  try {
    const h = await headers();
    const baseUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
    const zip = await construirZipExpediente(id, expediente.numero, baseUrl);
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${expediente.numero}.zip"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo generar el ZIP." }, { status: 500 });
  }
}
