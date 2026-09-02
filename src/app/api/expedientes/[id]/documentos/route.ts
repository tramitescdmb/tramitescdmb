import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { puedeAccederExpediente } from "@/lib/permisos";

type ArchivoInput = { path: string; nombre: string; mimeType: string; tamanoBytes: number; descripcion?: string | null };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!(await puedeAccederExpediente(session.userId, id))) {
    return NextResponse.json({ error: "Su rol de acceso no le permite gestionar este trámite." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const pasoNumero: number | null = body.pasoNumero ?? null;
  const descripcionDefecto: string | null = body.descripcion?.trim() || null;
  const archivos: ArchivoInput[] = Array.isArray(body.archivos) ? body.archivos : [];

  const validos = archivos.filter((a) => a?.path && a?.nombre);
  if (validos.length === 0) {
    return NextResponse.json({ error: "No hay archivos para guardar." }, { status: 400 });
  }

  await db.expedienteDocumento.createMany({
    data: validos.map((a) => ({
      expedienteId: id,
      pasoNumero,
      nombre: a.nombre,
      descripcion: a.descripcion?.trim() || descripcionDefecto,
      storagePath: a.path,
      mimeType: a.mimeType || "application/octet-stream",
      tamanoBytes: a.tamanoBytes || 0,
      subidoPorId: session.userId,
    })),
  });

  await db.expedienteEvento.create({
    data: {
      expedienteId: id,
      tipo: "DOCUMENTO_SUBIDO",
      descripcion: `${session.nombre} adjuntó ${validos.length} documento${validos.length === 1 ? "" : "s"}${
        pasoNumero ? ` en el paso ${pasoNumero}` : ""
      }.`,
      pasoNumero,
      usuarioId: session.userId,
    },
  });
  await db.expediente.update({ where: { id }, data: { fechaUltimoMovimiento: new Date() } });

  return NextResponse.json({ ok: true });
}
