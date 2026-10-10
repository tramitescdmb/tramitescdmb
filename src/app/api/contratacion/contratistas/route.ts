import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeGestionarContratistas, tieneRolContratacion } from "@/lib/permisos";
import { crearContratistaMinimo, ContratistaDuplicadoError } from "@/lib/contratacion";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await obtenerPermisosUsuario(session.userId);

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  // Sin expedienteId (se está registrando desde el formulario de un expediente nuevo, que todavía
  // no existe) solo lo puede hacer quien ya puede crear expedientes. Con expedienteId (se está
  // registrando desde un expediente ya creado) también lo puede hacer el Personal de Contratación
  // asignado a ESE expediente puntual.
  const expedienteId = typeof body.expedienteId === "string" ? body.expedienteId.trim() : "";
  let autorizado = puedeGestionarContratistas(permisos);
  if (!autorizado && expedienteId && tieneRolContratacion(permisos, "FUNCIONARIO_CONTRATACION")) {
    autorizado = permisos.asignadoExpedientes.has(expedienteId);
  }
  if (!autorizado) {
    return NextResponse.json({ error: "No tiene permiso para registrar contratistas." }, { status: 403 });
  }

  try {
    const creado = await crearContratistaMinimo(body.persona, body.representanteLegal);
    return NextResponse.json({ id: creado.id, nombre: creado.nombre }, { status: 201 });
  } catch (err) {
    if (err instanceof ContratistaDuplicadoError) {
      return NextResponse.json({ error: err.message, contratistaId: err.contratistaId }, { status: 409 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo registrar el contratista." }, { status: 400 });
  }
}
