import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { puedeEditarExpediente } from "@/lib/permisos";
import { tramiteCerrado } from "@/lib/archivo-central";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!(await puedeEditarExpediente(session.userId, id))) {
    return NextResponse.json({ error: "Su rol de acceso no le permite gestionar este trámite." }, { status: 403 });
  }
  if (await tramiteCerrado(id)) {
    const url = new URL(`/expedientes/${id}`, req.url);
    url.searchParams.set("error", "cerrado");
    return NextResponse.redirect(url, { status: 303 });
  }

  const form = await req.formData();
  const texto = String(form.get("texto") || "").trim();

  if (texto) {
    await db.expedienteEvento.create({
      data: {
        expedienteId: id,
        tipo: "COMENTARIO",
        descripcion: `${session.nombre}: ${texto}`,
        usuarioId: session.userId,
      },
    });
    await db.expediente.update({ where: { id }, data: { fechaUltimoMovimiento: new Date() } });
  }

  return NextResponse.redirect(new URL(`/expedientes/${id}`, req.url), { status: 303 });
}
