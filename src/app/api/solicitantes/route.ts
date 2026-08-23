import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * Crea un Solicitante directamente (sin pasar por un expediente) — para darlo de alta antes de que
 * llegue su primer trámite. Cualquier funcionario puede crear uno, igual que ya podía hacerlo de forma
 * implícita al radicar (ver el upsert en POST /api/expedientes) — no tiene sentido restringir esto a
 * ADMIN si radicar ya crea el mismo registro sin esa restricción.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const identificacion = String(body.identificacion || "").trim();
  const nombre = String(body.nombre || "").trim();
  if (!identificacion || !nombre) {
    return NextResponse.json({ error: "La identificación y el nombre son obligatorios." }, { status: 400 });
  }

  const existente = await db.solicitante.findUnique({ where: { identificacion } });
  if (existente) {
    return NextResponse.json(
      { error: "Ya existe un solicitante con esta identificación.", id: existente.id },
      { status: 409 }
    );
  }

  const creado = await db.solicitante.create({
    data: {
      tipo: body.tipo === "JURIDICA" ? "JURIDICA" : "NATURAL",
      identificacion,
      nombre,
      regimenTributario: body.regimenTributario || null,
      granContribuyente: Boolean(body.granContribuyente),
      email: String(body.email || "").trim() || null,
      telefono: String(body.telefono || "").trim() || null,
      direccion: String(body.direccion || "").trim() || null,
      municipio: String(body.municipio || "").trim() || null,
    },
  });

  return NextResponse.json({ id: creado.id }, { status: 201 });
}
