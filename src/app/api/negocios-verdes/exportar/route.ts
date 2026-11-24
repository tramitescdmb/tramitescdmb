import { NextResponse } from "next/server";
import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { accedePanelNV } from "@/lib/negocios-verdes-permisos";
import { negociosParaCsv } from "@/lib/negocios-verdes-admin";
import { construirCsvNV } from "@/lib/negocios-verdes-csv";
import { auditarNV } from "@/lib/negocios-verdes-api";

/** CSV con los datos públicos y la clasificación de todos los negocios (no incluye la ficha técnica). */
export async function GET() {
  const session = await verificarSesion();
  if (!session) return NextResponse.json({ error: "Sesión vencida." }, { status: 401 });
  if (!accedePanelNV(await obtenerPermisosUsuario(session.userId))) return NextResponse.json({ error: "Sin acceso." }, { status: 403 });
  const negocios = await negociosParaCsv();
  await auditarNV({ entidad: "NvNegocio", entidadId: "todos", accion: "EXPORTA", usuarioId: session.userId, detalle: `${session.nombre} exportó ${negocios.length} negocios verdes a CSV` });
  const fecha = new Date().toISOString().slice(0, 10);
  return new NextResponse(construirCsvNV(negocios), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="negocios-verdes-${fecha}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
