import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSignedDownloadUrl } from "@/lib/storage";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const documento = await db.expedienteDocumento.findUnique({ where: { id } });
  if (!documento) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  const url = await getSignedDownloadUrl(documento.storagePath);
  return NextResponse.redirect(url);
}
