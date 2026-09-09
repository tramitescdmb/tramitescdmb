import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import type { AmbitoCampoMetadato } from "@prisma/client";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { actualizarCampoMetadato, cambiarEstadoCampoMetadato, eliminarCampoMetadato } from "@/lib/metadatos";
import { registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

const AMBITOS: AmbitoCampoMetadato[] = ["COMUNICACION", "EXPEDIENTE", "AMBOS"];

/** Edita / activa / borra un campo de metadato. `accion` = "editar" | "toggle" | "eliminar". */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const volver = new URL("/correspondencia/admin/metadatos", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    await registrarAccesoDenegadoAccion("Administrar campos de metadato", id, session, await headers());
    volver.searchParams.set("error", "No tiene permiso.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const accion = String(form.get("accion") || "editar");
  try {
    if (accion === "toggle") {
      await cambiarEstadoCampoMetadato(id, String(form.get("activo") || "") === "true");
      volver.searchParams.set("ok", "Estado del campo actualizado.");
    } else if (accion === "eliminar") {
      await eliminarCampoMetadato(id);
      volver.searchParams.set("ok", "Campo eliminado (los valores ya guardados se conservan).");
    } else {
      const ambitoRaw = String(form.get("ambito") || "");
      await actualizarCampoMetadato(id, {
        nombre: String(form.get("nombre") || ""),
        ayuda: String(form.get("ayuda") || ""),
        opciones: String(form.get("opciones") || "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
        obligatorio: String(form.get("obligatorio") || "") === "on",
        ambito: AMBITOS.includes(ambitoRaw as AmbitoCampoMetadato) ? (ambitoRaw as AmbitoCampoMetadato) : undefined,
        serieId: String(form.get("serieId") || "") || null,
        valorPorDefecto: String(form.get("valorPorDefecto") || "") || null,
      });
      volver.searchParams.set("ok", "Campo actualizado.");
    }
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo actualizar el campo.");
  }
  return NextResponse.redirect(volver, { status: 303 });
}
