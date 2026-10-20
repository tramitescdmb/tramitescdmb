import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerModulosPorPerfil } from "@/lib/permisos";
import { usuariosSinPerfil } from "@/lib/perfiles-usuario";
import { registrarAuditoria } from "@/lib/auditoria";

const ACTIVABLES = ["SGDEA", "GECON", "TRAMITES", "VITAL", "SINCA"];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador del sistema activa los perfiles." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const modulo = String(body.modulo ?? "");
  const activo = body.activo === true;
  if (!ACTIVABLES.includes(modulo)) return NextResponse.json({ error: "Ese módulo todavía no se puede regir por perfiles." }, { status: 400 });

  if (activo) {
    const faltan = await usuariosSinPerfil(modulo);
    if (faltan.length > 0) {
      return NextResponse.json(
        { error: `Estas personas perderían accesos que hoy tienen por su rol: ${faltan.map((u) => u.nombre).join(", ")}. Asígneles el perfil correspondiente antes de activar.`, faltan },
        { status: 409 }
      );
    }
  }

  const actuales = new Set(await obtenerModulosPorPerfil());
  if (activo) actuales.add(modulo);
  else actuales.delete(modulo);
  await db.configuracionSitio.upsert({
    where: { id: "singleton" },
    update: { modulosPorPerfil: [...actuales] },
    create: { id: "singleton", modulosPorPerfil: [...actuales] },
  });
  revalidateTag("configuracion-sitio");
  await registrarAuditoria({
    tipo: "CONFIGURACION_ACTUALIZADA",
    descripcion: activo ? `Activó los perfiles en ${modulo}: los accesos del módulo salen de la matriz de perfiles` : `Desactivó los perfiles en ${modulo}: los accesos vuelven a salir de los roles`,
    usuarioId: session.userId,
  });
  return NextResponse.json({ ok: true, modulosPorPerfil: [...actuales] });
}
