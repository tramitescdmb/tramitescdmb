import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { eliminarPerfil, guardarPerfil, obtenerPerfil } from "@/lib/perfiles";
import { FUNCIONALIDAD_POR_CLAVE, ETIQUETA_ACCION, type Accion } from "@/lib/perfiles-catalogo";
import { registrarAuditoria } from "@/lib/auditoria";

function describirCambios(antes: Record<string, string[]>, despues: Record<string, string[]>): string {
  const claves = new Set([...Object.keys(antes), ...Object.keys(despues)]);
  const partes: string[] = [];
  for (const clave of claves) {
    const a = new Set(antes[clave] ?? []);
    const d = new Set(despues[clave] ?? []);
    const nombre = FUNCIONALIDAD_POR_CLAVE.get(clave)?.nombre ?? clave;
    const mas = [...d].filter((x) => !a.has(x)).map((x) => ETIQUETA_ACCION[x as Accion]);
    const menos = [...a].filter((x) => !d.has(x)).map((x) => ETIQUETA_ACCION[x as Accion]);
    if (mas.length) partes.push(`+${nombre} (${mas.join(", ")})`);
    if (menos.length) partes.push(`−${nombre} (${menos.join(", ")})`);
  }
  return partes.join("; ");
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador del sistema gestiona perfiles." }, { status: 403 });
  const actual = await obtenerPerfil(id);
  if (!actual) return NextResponse.json({ error: "El perfil no existe." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nombre = String(body.nombre ?? "").trim();
  if (!nombre) return NextResponse.json({ error: "Escriba el nombre del perfil." }, { status: 400 });
  const matrizEntrada = (body.matriz && typeof body.matriz === "object" ? body.matriz : {}) as Record<string, string[]>;
  try {
    const matriz = await guardarPerfil(id, { nombre, descripcion: String(body.descripcion ?? "").trim() || null, matriz: matrizEntrada });
    const cambios = describirCambios(actual.matriz, matriz);
    await registrarAuditoria({
      tipo: "CONFIGURACION_ACTUALIZADA",
      descripcion: `Actualizó el perfil «${nombre}»${cambios ? `: ${cambios}` : ""}`.slice(0, 4000),
      usuarioId: session.userId,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const duplicado = e instanceof Error && e.message.includes("Unique constraint");
    return NextResponse.json({ error: duplicado ? "Ya existe un perfil con ese nombre." : "No se pudo guardar el perfil." }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador del sistema gestiona perfiles." }, { status: 403 });
  try {
    const nombre = await eliminarPerfil(id);
    await registrarAuditoria({ tipo: "CONFIGURACION_ACTUALIZADA", descripcion: `Eliminó el perfil «${nombre}»`, usuarioId: session.userId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo eliminar." }, { status: 400 });
  }
}
