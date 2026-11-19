import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeConvertirSolicitudVital, puedeEditarTramite } from "@/lib/permisos";
import { radicarExpediente, type EntradaRadicacion } from "@/lib/radicar-expediente";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as EntradaRadicacion | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const resultado = await radicarExpediente(body, {
    usuario: { id: session.userId, nombre: session.nombre },
    verificarPermiso: async (tramiteId, esConversionVital) => {
      const permisos = await obtenerPermisosUsuario(session.userId);
      if (esConversionVital && !puedeConvertirSolicitudVital(permisos)) {
        return { ok: false, status: 403, error: "Solo el administrador y el Subdirector(a) de Evaluación y Control Ambiental convierten solicitudes de VITAL en trámite." };
      }
      if (!esConversionVital && !puedeEditarTramite(permisos, tramiteId)) {
        return { ok: false, status: 403, error: "No tiene permiso de edición sobre este trámite." };
      }
      return null;
    },
  });
  if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  return NextResponse.json({ id: resultado.id, numero: resultado.numero });
}
