import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario } from "@/lib/permisos";

/**
 * Guarda a mano el enlace directo a la ficha de VITAL/SILPA que sí muestra los adjuntos
 * (ReportetramiteCPDetalle.aspx) — no se puede derivar automáticamente de `idVital`, ver
 * `SolicitudVital.enlaceDocumentosSilpa` en el schema. Solo ADMIN (mismo nivel que "Sincronizar"
 * en /vital), porque es dato curado a mano, no algo que la sincronización pueda verificar.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await params;
  const volver = new URL(`/vital/${id}`, req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });

  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!permisos.esAdmin) {
    volver.searchParams.set("error", "Solo un administrador puede guardar este enlace.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const enlace = String(form.get("enlace") || "").trim();

  if (enlace) {
    let url: URL;
    try {
      url = new URL(enlace);
    } catch {
      volver.searchParams.set("error", "Eso no es una URL válida.");
      return NextResponse.redirect(volver, { status: 303 });
    }
    if (url.hostname !== "vital.minambiente.gov.co") {
      volver.searchParams.set("error", "El enlace debe ser de vital.minambiente.gov.co.");
      return NextResponse.redirect(volver, { status: 303 });
    }
  }

  const solicitud = await db.solicitudVital.findUnique({ where: { id }, select: { id: true } });
  if (!solicitud) return NextResponse.json({ error: "No existe esa solicitud." }, { status: 404 });

  await db.solicitudVital.update({
    where: { id },
    data: { enlaceDocumentosSilpa: enlace || null },
  });

  volver.searchParams.set("ok", enlace ? "Enlace guardado." : "Enlace borrado.");
  return NextResponse.redirect(volver, { status: 303 });
}
