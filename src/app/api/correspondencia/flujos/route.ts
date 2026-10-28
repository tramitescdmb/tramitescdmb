import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario } from "@/lib/permisos";
import { crearFlujo, cargarPlantillasFlujo, puedeAdministrarFlujos, aplicaAFormulario } from "@/lib/flujos";
import { registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/correspondencia/admin/flujos", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarFlujos(permisos)) {
    await registrarAccesoDenegadoAccion("Administrar flujos de trabajo", "flujos", session, await headers());
    volver.searchParams.set("error", "No tiene permiso para administrar flujos de trabajo.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const accion = String(form.get("accion") || "crear");
  try {
    if (accion === "cargar-plantillas") {
      const n = await cargarPlantillasFlujo(session.userId);
      volver.searchParams.set(
        "ok",
        n === 0 ? "Las plantillas ya estaban cargadas." : `Se cargaron ${n} flujo(s) de plantilla (quedan inactivos hasta que los revise).`,
      );
      return NextResponse.redirect(volver, { status: 303 });
    }

    const flujo = await crearFlujo(
      { nombre: String(form.get("nombre") || ""), descripcion: String(form.get("descripcion") || ""), ...aplicaAFormulario(String(form.get("aplicaA") || "")) },
      session.userId,
    );
    return NextResponse.redirect(new URL(`/correspondencia/admin/flujos/${flujo.id}?ok=Flujo+creado`, req.url), { status: 303 });
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo completar la acción.");
    return NextResponse.redirect(volver, { status: 303 });
  }
}
