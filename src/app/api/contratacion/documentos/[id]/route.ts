import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { EtapaContratacion } from "@prisma/client";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeEditarSinTrazaDocumentoContrato, puedeEditarConTrazaDocumentoContrato } from "@/lib/permisos";
import {
  editarDocumentoContratoSinTraza,
  editarDocumentoContratoConTraza,
  eliminarDocumentoContratoSinTraza,
  eliminarDocumentoContratoConTraza,
  ETAPAS_ORDEN,
} from "@/lib/contratacion";
import { deleteDocumento } from "@/lib/storage";
import { datosPeticion } from "@/lib/auditoria-doc";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const doc = await db.documentoContrato.findUnique({ where: { id }, select: { expedienteId: true, etapa: true } });
  if (!doc) return NextResponse.json({ error: "El documento no existe." }, { status: 404 });

  const sinTraza = puedeEditarSinTrazaDocumentoContrato(permisos);
  const conTraza = !sinTraza && puedeEditarConTrazaDocumentoContrato(permisos, { id: doc.expedienteId }, doc.etapa);
  if (!sinTraza && !conTraza) {
    return NextResponse.json({ error: "No tiene permiso para editar este documento." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const etapa = body.etapa && (ETAPAS_ORDEN as string[]).includes(body.etapa) ? (body.etapa as EtapaContratacion) : undefined;
  const archivo =
    body.archivo && typeof body.archivo.storagePath === "string" && typeof body.archivo.mimeType === "string" && Number.isFinite(body.archivo.tamanoBytes)
      ? {
          storagePath: body.archivo.storagePath as string,
          mimeType: body.archivo.mimeType as string,
          tamanoBytes: Number(body.archivo.tamanoBytes),
          hashSha256: typeof body.archivo.hashSha256 === "string" ? body.archivo.hashSha256 : null,
        }
      : undefined;
  const datos = {
    nombre: typeof body.nombre === "string" ? body.nombre : undefined,
    categoria: "categoria" in body ? (body.categoria ? String(body.categoria) : null) : undefined,
    etapa,
    requiereFirma: "requiereFirma" in body ? Boolean(body.requiereFirma) : undefined,
    firmadoEnSecop: "firmadoEnSecop" in body ? Boolean(body.firmadoEnSecop) : undefined,
    archivo,
  };

  try {
    const { storagePathAnterior } = sinTraza
      ? await editarDocumentoContratoSinTraza(id, datos)
      : await editarDocumentoContratoConTraza(id, datos, session.userId, datosPeticion(req.headers));
    if (archivo && storagePathAnterior) {
      await deleteDocumento(storagePathAnterior).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo editar el documento." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const doc = await db.documentoContrato.findUnique({ where: { id }, select: { expedienteId: true, etapa: true } });
  if (!doc) return NextResponse.json({ error: "El documento no existe." }, { status: 404 });

  const sinTraza = puedeEditarSinTrazaDocumentoContrato(permisos);
  const conTraza = !sinTraza && puedeEditarConTrazaDocumentoContrato(permisos, { id: doc.expedienteId }, doc.etapa);
  if (!sinTraza && !conTraza) {
    return NextResponse.json({ error: "No tiene permiso para eliminar este documento." }, { status: 403 });
  }

  try {
    const { storagePath } = sinTraza
      ? await eliminarDocumentoContratoSinTraza(id)
      : await eliminarDocumentoContratoConTraza(id, session.userId, datosPeticion(req.headers));
    await deleteDocumento(storagePath).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo eliminar el documento." }, { status: 400 });
  }
}
