import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { sincronizarUsuarioConDirectorio } from "@/lib/directorio-usuarios";
import { registrarAuditoria } from "@/lib/auditoria";

export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return NextResponse.json({ error: "Solo un administrador puede sincronizar usuarios." }, { status: 403 });
  const r = await sincronizarUsuarioConDirectorio(id);
  if (r.ok) {
    await registrarAuditoria({ tipo: "USUARIO_ACTUALIZADO", descripcion: `${session.nombre} sincronizó un usuario con el directorio activo. ${r.mensaje}`, usuarioId: session.userId });
  }
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
