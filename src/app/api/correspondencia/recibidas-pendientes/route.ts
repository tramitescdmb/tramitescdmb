import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRadicar } from "@/lib/permisos";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeRadicar(permisos)) return NextResponse.json({ error: "No tiene permiso para radicar." }, { status: 403 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ items: [] });

  const recibidas = await db.comunicacion.findMany({
    where: {
      tipo: "RECIBIDA",
      estado: { notIn: ["RESPONDIDA", "ARCHIVADA", "ANULADA"] },
      OR: [
        { radicado: { contains: q, mode: "insensitive" } },
        { asunto: { contains: q, mode: "insensitive" } },
        { terceroNombre: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { fechaRadicacion: "desc" },
    take: 20,
    select: { id: true, radicado: true, asunto: true, terceroNombre: true },
  });

  return NextResponse.json({
    items: recibidas.map((r) => ({
      id: r.id,
      label: `${r.radicado} — ${r.asunto.slice(0, 60)}${r.terceroNombre ? ` (${r.terceroNombre})` : ""}`,
    })),
  });
}
