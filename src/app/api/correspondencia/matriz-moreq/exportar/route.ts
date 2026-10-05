import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { asegurarMatrizMoreq, csvMatrizMoreq } from "@/lib/matriz-moreq";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });

  await asegurarMatrizMoreq();
  const requisitos = await db.requisitoMoreq.findMany({
    orderBy: [{ categoria: "asc" }, { orden: "asc" }],
    select: { numero: true, categoria: true, titulo: true, estado: true, nota: true, actualizadoEn: true, actualizadoPor: { select: { nombre: true } } },
  });
  const csv = csvMatrizMoreq(requisitos.map((r) => ({ ...r, actualizadoPor: r.actualizadoPor?.nombre ?? null })));
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="matriz-moreq.csv"' },
  });
}
