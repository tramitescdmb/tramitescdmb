import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { deleteDocumento } from "@/lib/storage";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const documento = await db.expedienteDocumento.findUnique({ where: { id } });
  if (!documento) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  if (session.rol !== "ADMIN" && session.userId !== documento.subidoPorId) {
    return NextResponse.json(
      { error: "Solo quien subió el documento o un administrador puede eliminarlo." },
      { status: 403 }
    );
  }

  await deleteDocumento(documento.storagePath).catch(() => {
    // Si ya no existe en el storage (o falla el borrado remoto), igual se quita el registro:
    // lo importante es que deje de aparecer como documento del expediente.
  });

  await db.expedienteDocumento.delete({ where: { id } });

  await db.expedienteEvento.create({
    data: {
      expedienteId: documento.expedienteId,
      tipo: "DOCUMENTO_ELIMINADO",
      descripcion: `${session.nombre} eliminó el documento "${documento.nombre}"${
        documento.pasoNumero ? ` (paso ${documento.pasoNumero})` : ""
      }.`,
      pasoNumero: documento.pasoNumero,
      usuarioId: session.userId,
    },
  });

  return NextResponse.redirect(new URL(`/expedientes/${documento.expedienteId}`, req.url), { status: 303 });
}
