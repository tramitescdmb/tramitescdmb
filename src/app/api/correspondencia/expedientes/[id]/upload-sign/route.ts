import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarExpedienteDeDependencia } from "@/lib/permisos";
import { buildStoragePath, crearUrlSubidaFirmada } from "@/lib/storage";
import { extensionPermitidaEn, mensajeTipoNoPermitidoEn } from "@/lib/uploads-config";
import { getConfiguracionSitio } from "@/lib/config-sitio";

/** Firma de subida para un archivo que va DIRECTO a un expediente documental (no vía correspondencia). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const expediente = await db.expedienteDocumental.findUnique({ where: { id }, select: { id: true, dependenciaId: true, estado: true } });
  if (!expediente) return NextResponse.json({ error: "El expediente no existe." }, { status: 404 });
  if (expediente.estado === "CERRADO") return NextResponse.json({ error: "Este expediente está cerrado." }, { status: 409 });
  if (!puedeGestionarExpedienteDeDependencia(permisos, expediente.dependenciaId)) {
    return NextResponse.json({ error: "No tiene permiso para subir documentos a este expediente." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const fileName = body?.fileName ? String(body.fileName) : "";
  if (!fileName) return NextResponse.json({ error: "Falta fileName." }, { status: 400 });
  const { extensionesPermitidas } = await getConfiguracionSitio();
  if (!extensionPermitidaEn(fileName, extensionesPermitidas)) {
    return NextResponse.json({ error: mensajeTipoNoPermitidoEn(fileName, extensionesPermitidas) }, { status: 400 });
  }

  const path = buildStoragePath(id, fileName);
  const { token } = await crearUrlSubidaFirmada(path);
  return NextResponse.json({ path, token });
}
