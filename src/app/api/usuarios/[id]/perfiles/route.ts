import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { guardarPerfilesDeUsuario, type Excepcion } from "@/lib/perfiles-usuario";
import { registrarAuditoria } from "@/lib/auditoria";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador del sistema asigna roles." }, { status: 403 });
  const usuario = await db.usuario.findUnique({ where: { id }, select: { nombre: true } });
  if (!usuario) return NextResponse.json({ error: "El usuario no existe." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const perfilIds = Array.isArray(body.perfilIds) ? body.perfilIds.map(String) : [];
  const excepciones = (Array.isArray(body.excepciones) ? body.excepciones : []).map((e) => {
    const x = e as Record<string, unknown>;
    return {
      funcionalidad: String(x.funcionalidad ?? ""),
      tipo: x.tipo === "QUITAR" ? "QUITAR" : "CONCEDER",
      acciones: Array.isArray(x.acciones) ? x.acciones.map(String) : [],
      motivo: String(x.motivo ?? "").trim() || null,
    } as Excepcion;
  });
  let r: { perfiles: number; excepciones: number };
  try {
    r = await guardarPerfilesDeUsuario(id, perfilIds, excepciones);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudieron guardar los roles." }, { status: 400 });
  }
  const nombres = (await db.perfil.findMany({ where: { id: { in: perfilIds } }, select: { nombre: true } })).map((p) => p.nombre);
  await registrarAuditoria({
    tipo: "USUARIO_ACTUALIZADO",
    descripcion: `Roles de ${usuario.nombre}: ${nombres.join(", ") || "ninguno"}${r.excepciones ? ` · ${r.excepciones} excepción(es)` : ""}`.slice(0, 4000),
    usuarioId: session.userId,
  });
  return NextResponse.json({ ok: true, ...r });
}
