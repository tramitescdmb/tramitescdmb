import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";

/**
 * Busca en el maestro de terceros (Solicitante) por identificación, para
 * autocompletar los datos de un peticionario recurrente al radicar — así no hay
 * que volver a digitar todo. Si es la primera vez, no devuelve nada y los datos
 * quedan guardados al radicar (resolverOCrearTercero).
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) {
    return NextResponse.json({ error: "Sin acceso." }, { status: 403 });
  }

  const identificacion = (req.nextUrl.searchParams.get("identificacion") || "").trim();
  if (identificacion.length < 4) return NextResponse.json({ tercero: null });

  const s = await db.solicitante.findUnique({
    where: { identificacion },
    select: {
      tipo: true,
      razonSocial: true,
      nombres: true,
      apellidos: true,
      email: true,
      telefono: true,
      direccion: true,
      municipio: true,
      departamento: true,
    },
  });
  if (!s) return NextResponse.json({ tercero: null });

  const nombre = s.razonSocial?.trim() || [s.nombres, s.apellidos].filter(Boolean).join(" ").trim() || "";
  return NextResponse.json({
    tercero: {
      tipo: s.tipo,
      nombre,
      email: s.email ?? "",
      telefono: s.telefono ?? "",
      direccion: s.direccion ?? "",
      municipio: s.municipio ?? "",
      departamento: s.departamento ?? "",
    },
  });
}
