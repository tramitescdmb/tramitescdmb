import { NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { asignarPerfilesSegunRoles } from "@/lib/perfiles-usuario";
import { registrarAuditoria } from "@/lib/auditoria";

export async function POST() {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador del sistema asigna perfiles." }, { status: 403 });
  const r = await asignarPerfilesSegunRoles();
  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: `Asignó perfiles según los roles actuales: ${r.asignaciones} asignación(es) nuevas en ${r.usuarios} usuario(s)`,
    usuarioId: session.userId,
  });
  return NextResponse.json(r);
}
