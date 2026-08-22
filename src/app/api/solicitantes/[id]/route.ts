import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const nombre = String(body.nombre || "").trim();
  if (!nombre) {
    return NextResponse.json({ error: "El nombre no puede quedar vacío." }, { status: 400 });
  }

  const actualizado = await db.solicitante
    .update({
      where: { id },
      data: {
        nombre,
        email: String(body.email || "").trim() || null,
        telefono: String(body.telefono || "").trim() || null,
        direccion: String(body.direccion || "").trim() || null,
        municipio: String(body.municipio || "").trim() || null,
        regimenTributario: body.regimenTributario || null,
        granContribuyente: Boolean(body.granContribuyente),
      },
    })
    .catch(() => null);

  if (!actualizado) return NextResponse.json({ error: "Solicitante no encontrado." }, { status: 404 });

  return NextResponse.json(actualizado);
}
