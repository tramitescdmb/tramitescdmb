import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function celda(v: string | number | boolean) {
  return `"${String(v).replace(/"/g, '""')}"`;
}

/** Organigrama de dependencias en CSV o XML (MoReq 3.27: puntos de intercambio XML). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });

  const deps = await db.dependencia.findMany({
    orderBy: [{ nivel: "asc" }, { orden: "asc" }, { codigo: "asc" }],
    include: { parent: { select: { codigo: true } } },
  });
  const xml = new URL(req.url).searchParams.get("formato") === "xml";

  if (xml) {
    const filas = deps
      .map(
        (d) =>
          `  <dependencia codigo="${esc(d.codigo)}" nivel="${d.nivel}" activa="${d.activo}" dependeDe="${esc(d.parent?.codigo ?? "")}">${esc(d.nombre)}</dependencia>`,
      )
      .join("\n");
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<organigrama entidad="CDMB" generado="${new Date().toISOString()}">\n${filas}\n</organigrama>\n`;
    return new NextResponse(body, {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": 'attachment; filename="dependencias.xml"' },
    });
  }

  const filas = [
    ["codigo", "nombre", "nivel", "depende_de", "activa"].join(";"),
    ...deps.map((d) => [celda(d.codigo), celda(d.nombre), d.nivel, celda(d.parent?.codigo ?? ""), d.activo ? "SI" : "NO"].join(";")),
  ].join("\r\n");
  return new NextResponse("﻿" + filas, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="dependencias.csv"' },
  });
}
