import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { crearPerfil } from "@/lib/perfiles";
import { MODULOS_PERFIL, type ModuloPerfil } from "@/lib/perfiles-catalogo";
import { registrarAuditoria } from "@/lib/auditoria";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador del sistema gestiona roles." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nombre = String(body.nombre ?? "").trim();
  const modulo = String(body.modulo ?? "GENERAL");
  if (!nombre) return NextResponse.json({ error: "Escriba el nombre del rol." }, { status: 400 });
  if (!(MODULOS_PERFIL as readonly string[]).includes(modulo)) return NextResponse.json({ error: "Módulo no válido." }, { status: 400 });
  try {
    const perfil = await crearPerfil({
      nombre,
      modulo: modulo as ModuloPerfil,
      descripcion: String(body.descripcion ?? "").trim() || null,
      copiarDeId: body.copiarDeId ? String(body.copiarDeId) : null,
    });
    await registrarAuditoria({ tipo: "CONFIGURACION_ACTUALIZADA", descripcion: `Creó el rol «${nombre}»`, usuarioId: session.userId });
    return NextResponse.json({ id: perfil.id });
  } catch (e) {
    const duplicado = e instanceof Error && e.message.includes("Unique constraint");
    return NextResponse.json({ error: duplicado ? "Ya existe un rol con ese nombre." : "No se pudo crear el rol." }, { status: 400 });
  }
}
