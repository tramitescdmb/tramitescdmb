import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario } from "@/lib/permisos";
import { crearFlujo, cargarPlantillasFlujo } from "@/lib/flujos";
import { aplicaAFormulario, puedeAdministrarFlujosModulo, RUTA_FLUJOS, type ModuloFlujo } from "@/lib/flujos-modulos";
import { registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

const MODULOS: ModuloFlujo[] = ["SGDEA", "GECON", "TRAMITES"];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const form = await req.formData();
  const moduloRaw = String(form.get("modulo") || "SGDEA");
  const modulo: ModuloFlujo = MODULOS.includes(moduloRaw as ModuloFlujo) ? (moduloRaw as ModuloFlujo) : "SGDEA";
  const volver = new URL(RUTA_FLUJOS[modulo], req.url);
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarFlujosModulo(permisos, modulo)) {
    await registrarAccesoDenegadoAccion("Administrar flujos de trabajo", `flujos-${modulo}`, session, await headers());
    volver.searchParams.set("error", "No tiene permiso para administrar flujos de trabajo.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const accion = String(form.get("accion") || "crear");
  try {
    if (accion === "cargar-plantillas") {
      const n = await cargarPlantillasFlujo(session.userId, modulo);
      volver.searchParams.set(
        "ok",
        n === 0 ? "Las plantillas ya estaban cargadas." : `Se cargaron ${n} flujo(s) de plantilla (quedan inactivos hasta que los revise).`,
      );
      return NextResponse.redirect(volver, { status: 303 });
    }

    const flujo = await crearFlujo(
      { nombre: String(form.get("nombre") || ""), descripcion: String(form.get("descripcion") || ""), ...aplicaAFormulario(String(form.get("aplicaA") || ""), modulo) },
      session.userId,
    );
    return NextResponse.redirect(new URL(`${RUTA_FLUJOS[modulo]}/${flujo.id}?ok=Flujo+creado`, req.url), { status: 303 });
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo completar la acción.");
    return NextResponse.redirect(volver, { status: 303 });
  }
}
