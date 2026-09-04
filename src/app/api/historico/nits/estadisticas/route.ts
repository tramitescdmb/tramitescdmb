import { NextResponse } from "next/server";
import { sincaConfigurado } from "@/lib/sinca";
import { obtenerSnapshotNit } from "@/lib/sinca-nit-stats";
import { contarVinculadas } from "@/lib/sinca-nit";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederSeccion } from "@/lib/permisos";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederSeccion(permisos, "SINCA_BASE")) return NextResponse.json({ message: "No autorizado." }, { status: 403 });
  if (!sincaConfigurado()) return NextResponse.json({ message: "SINCA 1.0 no está configurado." }, { status: 503 });

  try {
    const { entidades, totalVinculaciones, calculadoEn } = await obtenerSnapshotNit();
    const totalTerceros = entidades.length;
    const conVinculacion = entidades.filter((e) => contarVinculadas(e) > 0).length;
    const sinVinculacion = totalTerceros - conVinculacion;
    return NextResponse.json({
      totalTerceros,
      conVinculacion,
      sinVinculacion,
      porcentajeSinVinculacion: totalTerceros > 0 ? sinVinculacion / totalTerceros : 0,
      totalVinculaciones,
      calculadoEn,
    });
  } catch {
    return NextResponse.json({ message: "No se pudieron calcular las estadísticas." }, { status: 502 });
  }
}
