import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario } from "@/lib/permisos";
import { obtenerFlujo, puedeAdministrarFlujos } from "@/lib/flujos";
import { flujoABpmn } from "@/lib/flujos-bpmn";

/** Descarga el flujo como BPMN 2.0 XML (MoReq 7.13). Solo administrador de archivo. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarFlujos(permisos)) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });

  const flujo = await obtenerFlujo(id);
  if (!flujo) return NextResponse.json({ error: "No existe." }, { status: 404 });

  const xml = flujoABpmn({
    id: flujo.id,
    nombre: flujo.nombre,
    pasos: flujo.pasos.map((p) => ({
      id: p.id,
      orden: p.orden,
      nombre: p.nombre,
      tipo: p.tipo,
      posX: p.posX,
      posY: p.posY,
      transiciones: p.transiciones.map((t) => ({ haciaPasoId: t.haciaPasoId, etiqueta: t.etiqueta })),
    })),
  });

  const slug = flujo.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "flujo";
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.bpmn"`,
    },
  });
}
