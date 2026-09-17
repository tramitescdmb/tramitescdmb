import { NextRequest, NextResponse } from "next/server";
import type { EtapaContratacion } from "@prisma/client";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeEditarSinTrazaDocumentoContrato } from "@/lib/permisos";
import { editarDocumentoContratoSinTraza, eliminarDocumentoContratoSinTraza, ETAPAS_ORDEN } from "@/lib/contratacion";
import { deleteDocumento } from "@/lib/storage";

/**
 * EXCEPCIÓN deliberada de este módulo (ver permisos.ts
 * `puedeEditarSinTrazaDocumentoContrato` y el plan de la sesión): editar o
 * eliminar un documento aquí NO deja ninguna fila en `EventoContratacion`.
 * Solo Administrador de Contratación y Jefe de Contratación pueden llamar a
 * esta ruta — confirmado explícitamente por el usuario tras advertir el
 * riesgo de auditoría. NUNCA replicar este patrón fuera de Contratación.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeEditarSinTrazaDocumentoContrato(permisos)) {
    return NextResponse.json({ error: "Solo Administrador o Jefe de Contratación pueden editar un documento." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const etapa = body.etapa && (ETAPAS_ORDEN as string[]).includes(body.etapa) ? (body.etapa as EtapaContratacion) : undefined;

  try {
    await editarDocumentoContratoSinTraza(id, {
      nombre: typeof body.nombre === "string" ? body.nombre : undefined,
      categoria: "categoria" in body ? (body.categoria ? String(body.categoria) : null) : undefined,
      etapa,
      requiereFirma: "requiereFirma" in body ? Boolean(body.requiereFirma) : undefined,
      firmadoEnSecop: "firmadoEnSecop" in body ? Boolean(body.firmadoEnSecop) : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo editar el documento." }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeEditarSinTrazaDocumentoContrato(permisos)) {
    return NextResponse.json({ error: "Solo Administrador o Jefe de Contratación pueden eliminar un documento." }, { status: 403 });
  }

  try {
    const { storagePath } = await eliminarDocumentoContratoSinTraza(id);
    await deleteDocumento(storagePath).catch(() => {}); // best-effort: la fila ya se borró, un residuo en storage no es visible en la app
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo eliminar el documento." }, { status: 400 });
  }
}
