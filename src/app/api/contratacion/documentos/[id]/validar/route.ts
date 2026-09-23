import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeValidarDocumentoContrato, puedeEditarSinTrazaDocumentoContrato } from "@/lib/permisos";
import { validarDocumentoContrato } from "@/lib/contratacion";
import { datosPeticion } from "@/lib/auditoria-doc";

/** Validación manual de un documento del checklist (ej. la hoja de vida SIGEP en Precontractual)
 * — Administrador/Jefe/Funcionario de Contratación, ver `puedeValidarDocumentoContrato`.
 * Administrador/Jefe no dejan ninguna traza (ni en la bitácora del expediente ni en la cadena de
 * hash); Funcionario de Contratación sí — misma excepción que editar/eliminar sin traza. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeValidarDocumentoContrato(permisos)) {
    return NextResponse.json({ error: "No tiene permiso para validar documentos." }, { status: 403 });
  }

  const doc = await db.documentoContrato.findUnique({ where: { id }, select: { id: true } });
  if (!doc) return NextResponse.json({ error: "El documento no existe." }, { status: 404 });

  try {
    await validarDocumentoContrato(id, session.userId, {
      sinTraza: puedeEditarSinTrazaDocumentoContrato(permisos),
      ...datosPeticion(req.headers),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo validar el documento." }, { status: 400 });
  }
}
