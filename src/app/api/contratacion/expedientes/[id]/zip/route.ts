import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeVerExpedienteContractual } from "@/lib/permisos";
import { registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";
import { construirZipExpediente } from "@/lib/zip-contratacion";
import { servirDerivado, huellaDerivado } from "@/lib/derivados";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const expediente = await db.expedienteContractual.findUnique({
    where: { id },
    select: { numero: true, contratistaId: true, dependenciaSolicitanteId: true, etapaActual: true, eliminado: true },
  });
  if (!expediente) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
  if (!puedeVerExpedienteContractual(permisos, { id, ...expediente })) {
    await registrarAccesoDenegadoAccion("descargar el ZIP de un expediente", id, session, req.headers);
    return NextResponse.json({ error: "No tiene acceso a este expediente." }, { status: 403 });
  }

  try {
    const h = await headers();
    const baseUrl = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
    return await servirDerivado({
      carpeta: `zip/${session.userId}`,
      huella: huellaDerivado(id, Date.now()),
      nombreArchivo: `${expediente.numero}.zip`,
      contentType: "application/zip",
      descargar: true,
      comoJson: req.headers.get("accept")?.includes("application/json") ?? false,
      generar: async () => new Uint8Array(await construirZipExpediente(id, expediente.numero, baseUrl, permisos.contratacion === "CONTRATISTA")),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo generar el ZIP." }, { status: 500 });
  }
}
