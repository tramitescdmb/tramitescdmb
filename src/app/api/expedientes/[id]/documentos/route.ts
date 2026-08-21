import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { buildStoragePath, uploadDocumento } from "@/lib/storage";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const form = await req.formData();
  const pasoNumeroRaw = form.get("pasoNumero");
  const pasoNumero = pasoNumeroRaw ? Number(pasoNumeroRaw) : null;
  const descripcion = String(form.get("descripcion") || "").trim() || null;
  const files = form.getAll("archivo");

  let subidos = 0;
  for (const file of files) {
    if (file instanceof File && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const path = buildStoragePath(id, file.name);
      await uploadDocumento(path, buffer, file.type || "application/octet-stream");
      await db.expedienteDocumento.create({
        data: {
          expedienteId: id,
          pasoNumero,
          nombre: file.name,
          descripcion,
          storagePath: path,
          mimeType: file.type || "application/octet-stream",
          tamanoBytes: file.size,
          subidoPorId: session.userId,
        },
      });
      subidos++;
    }
  }

  if (subidos > 0) {
    await db.expedienteEvento.create({
      data: {
        expedienteId: id,
        tipo: "DOCUMENTO_SUBIDO",
        descripcion: `${session.nombre} adjuntó ${subidos} documento${subidos === 1 ? "" : "s"}${
          pasoNumero ? ` en el paso ${pasoNumero}` : ""
        }.`,
        pasoNumero,
        usuarioId: session.userId,
      },
    });
    await db.expediente.update({ where: { id }, data: { fechaUltimoMovimiento: new Date() } });
  }

  return NextResponse.redirect(new URL(`/expedientes/${id}`, req.url), { status: 303 });
}
