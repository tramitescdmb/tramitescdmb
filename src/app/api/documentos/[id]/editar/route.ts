import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { deleteDocumento } from "@/lib/storage";
import { documentoEtapaAbierta, puedeIntentarEliminarDocumento } from "@/lib/documentos";
import { editarDocumentoTramite } from "@/lib/tramites-firma";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const documento = await db.expedienteDocumento.findUnique({
    where: { id },
    include: { expediente: { select: { pasoActualNumero: true } } },
  });
  if (!documento) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  const etapaAbierta = documentoEtapaAbierta(documento.pasoNumero, documento.expediente.pasoActualNumero);
  const esAdmin = session.rol === "ADMIN";
  if (!puedeIntentarEliminarDocumento({ esAdmin, esQuienLoSubio: session.userId === documento.subidoPorId, etapaAbierta })) {
    return NextResponse.json(
      etapaAbierta
        ? { error: "Solo quien subió el documento o un administrador puede editarlo." }
        : { error: "Esta etapa ya se cerró — solo un administrador puede editar este documento, y únicamente con el oficio de solicitud del Subdirector." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const oficio = String(body.oficio || "").trim();
  if (!etapaAbierta && !oficio) {
    return NextResponse.json(
      { error: "La etapa ya se cerró: se necesita el oficio de solicitud del Subdirector para editar este documento." },
      { status: 400 }
    );
  }

  const archivo =
    body.archivo && typeof body.archivo.storagePath === "string" && typeof body.archivo.mimeType === "string" && Number.isFinite(body.archivo.tamanoBytes)
      ? {
          storagePath: body.archivo.storagePath as string,
          mimeType: body.archivo.mimeType as string,
          tamanoBytes: Number(body.archivo.tamanoBytes),
          hashSha256: typeof body.archivo.hashSha256 === "string" ? body.archivo.hashSha256 : null,
        }
      : undefined;

  try {
    const { storagePathAnterior } = await editarDocumentoTramite(id, {
      nombre: typeof body.nombre === "string" ? body.nombre : undefined,
      descripcion: "descripcion" in body ? (body.descripcion ? String(body.descripcion) : null) : undefined,
      requiereFirma: "requiereFirma" in body ? Boolean(body.requiereFirma) : undefined,
      archivo,
    });
    if (archivo && storagePathAnterior) {
      await deleteDocumento(storagePathAnterior).catch(() => {});
    }

    const descripcion = [
      `${session.nombre} editó el documento "${documento.nombre}"${documento.pasoNumero ? ` (paso ${documento.pasoNumero})` : " (radicación)"}.`,
      !etapaAbierta ? `Etapa ya cerrada — oficio de solicitud del Subdirector: ${oficio}.` : null,
    ]
      .filter(Boolean)
      .join(" ");
    await db.expedienteEvento.create({
      data: { expedienteId: documento.expedienteId, tipo: "DOCUMENTO_EDITADO", descripcion, pasoNumero: documento.pasoNumero, usuarioId: session.userId },
    });
    await registrarAuditoriaDoc({
      entidad: "ExpedienteDocumento",
      entidadId: id,
      accion: "MODIFICA",
      usuarioId: session.userId,
      ...datosPeticion(req.headers),
      detalle: descripcion,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo editar el documento." }, { status: 400 });
  }
}
