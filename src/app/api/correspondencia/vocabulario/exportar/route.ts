import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function celda(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

/** Vocabulario controlado en CSV o XML (MoReq 3.27 / 1.17). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) return NextResponse.json({ error: "Sin permiso." }, { status: 403 });

  const terminos = await db.terminoControlado.findMany({ orderBy: [{ categoria: "asc" }, { termino: "asc" }] });
  const xml = new URL(req.url).searchParams.get("formato") === "xml";

  if (xml) {
    const filas = terminos
      .map((t) => `  <termino categoria="${esc(t.categoria ?? "")}" activo="${t.activo}">${esc(t.termino)}</termino>`)
      .join("\n");
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<vocabularioControlado generado="${new Date().toISOString()}">\n${filas}\n</vocabularioControlado>\n`;
    return new NextResponse(body, {
      headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": 'attachment; filename="vocabulario.xml"' },
    });
  }

  const filas = [
    ["termino", "categoria", "activo"].join(";"),
    ...terminos.map((t) => [celda(t.termino), celda(t.categoria ?? ""), t.activo ? "SI" : "NO"].join(";")),
  ].join("\r\n");
  return new NextResponse("﻿" + filas, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="vocabulario.csv"' },
  });
}
