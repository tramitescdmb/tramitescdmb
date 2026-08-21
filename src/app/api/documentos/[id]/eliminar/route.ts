import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { deleteDocumento } from "@/lib/storage";
import { documentoEtapaAbierta } from "@/lib/documentos";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const oficio = String(body?.oficio || "").trim();

  const documento = await db.expedienteDocumento.findUnique({
    where: { id },
    include: { expediente: { select: { pasoActualNumero: true } } },
  });
  if (!documento) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  const etapaAbierta = documentoEtapaAbierta(documento.pasoNumero, documento.expediente.pasoActualNumero);
  const esAdmin = session.rol === "ADMIN";

  if (etapaAbierta) {
    // Dentro de la etapa actual: quien lo subió puede corregir su propio error, o un admin.
    if (!esAdmin && session.userId !== documento.subidoPorId) {
      return NextResponse.json(
        { error: "Solo quien subió el documento o un administrador puede eliminarlo." },
        { status: 403 }
      );
    }
  } else {
    // Etapa ya cerrada: solo un admin, y con el oficio de solicitud del Subdirector de por medio.
    if (!esAdmin) {
      return NextResponse.json(
        { error: "Esta etapa ya se cerró — solo un administrador puede eliminar este documento." },
        { status: 403 }
      );
    }
    if (!oficio) {
      return NextResponse.json(
        { error: "La etapa ya se cerró: se necesita el oficio de solicitud del Subdirector para eliminar este documento." },
        { status: 400 }
      );
    }
  }

  await deleteDocumento(documento.storagePath).catch(() => {
    // Si ya no existe en el storage (o falla el borrado remoto), igual se quita el registro:
    // lo importante es que deje de aparecer como documento del expediente.
  });

  await db.expedienteDocumento.delete({ where: { id } });

  const descripcion = [
    `${session.nombre} eliminó el documento "${documento.nombre}"${
      documento.pasoNumero ? ` (paso ${documento.pasoNumero})` : " (radicación)"
    }.`,
    !etapaAbierta ? `Etapa ya cerrada — oficio de solicitud del Subdirector: ${oficio}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  await db.expedienteEvento.create({
    data: {
      expedienteId: documento.expedienteId,
      tipo: "DOCUMENTO_ELIMINADO",
      descripcion,
      pasoNumero: documento.pasoNumero,
      usuarioId: session.userId,
    },
  });

  return NextResponse.json({ ok: true });
}
