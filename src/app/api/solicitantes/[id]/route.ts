import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.rol !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede editar el registro de un solicitante." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const existente = await db.solicitante.findUnique({ where: { id }, select: { tipo: true } });
  if (!existente) return NextResponse.json({ error: "Solicitante no encontrado." }, { status: 404 });

  const esJuridica = existente.tipo === "JURIDICA";
  const nombres = String(body.nombres || "").trim();
  const apellidos = String(body.apellidos || "").trim();
  const razonSocial = String(body.razonSocial || "").trim();
  const municipio = String(body.municipio || "").trim();

  if (esJuridica ? !razonSocial : !nombres || !apellidos) {
    return NextResponse.json(
      { error: esJuridica ? "La razón social no puede quedar vacía." : "Los nombres y apellidos no pueden quedar vacíos." },
      { status: 400 }
    );
  }
  if (!municipio) {
    return NextResponse.json({ error: "El municipio no puede quedar vacío." }, { status: 400 });
  }

  const actualizado = await db.solicitante
    .update({
      where: { id },
      data: {
        nombres: nombres || null,
        apellidos: apellidos || null,
        razonSocial: razonSocial || null,
        email: String(body.email || "").trim() || null,
        telefono: String(body.telefono || "").trim() || null,
        direccion: String(body.direccion || "").trim() || null,
        municipio,
        regimenTributario: body.regimenTributario || null,
        granContribuyente: Boolean(body.granContribuyente),
      },
    })
    .catch(() => null);

  if (!actualizado) return NextResponse.json({ error: "Solicitante no encontrado." }, { status: 404 });

  return NextResponse.json(actualizado);
}
