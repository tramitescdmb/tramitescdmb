import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";

const TIPOS_VALIDOS = ["tramiteTipo", "documentoRequerido", "requisitoContratacion", "configuracion"] as const;
type TipoClasificacion = (typeof TIPOS_VALIDOS)[number];

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return NextResponse.json({ error: "Solo un administrador puede clasificar la TRD." }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const tipo: TipoClasificacion | undefined = TIPOS_VALIDOS.includes(body.tipo) ? body.tipo : undefined;
  if (!tipo) return NextResponse.json({ error: "Tipo de clasificación inválido." }, { status: 400 });

  const valor: string | null = body.valor ? String(body.valor) : null;

  if (tipo === "configuracion") {
    await db.configuracionSitio.update({ where: { id: "singleton" }, data: { subserieContratacionId: valor } });
    return NextResponse.json({ ok: true });
  }

  const id: string = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Falta el identificador del registro a clasificar." }, { status: 400 });

  if (tipo === "tramiteTipo") {
    await db.tramiteTipo.update({ where: { id }, data: { subserieId: valor } });
  } else if (tipo === "documentoRequerido") {
    await db.documentoRequeridoDefinicion.update({ where: { id }, data: { tipoDocumentalId: valor } });
  } else if (tipo === "requisitoContratacion") {
    await db.requisitoDocumentoContratacion.update({ where: { id }, data: { tipoDocumentalId: valor } });
  }

  return NextResponse.json({ ok: true });
}
