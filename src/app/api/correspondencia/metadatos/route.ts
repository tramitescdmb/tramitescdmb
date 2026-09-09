import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import type { AmbitoCampoMetadato, TipoCampoMetadato } from "@prisma/client";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAdministrarArchivo } from "@/lib/permisos";
import { crearCampoMetadato } from "@/lib/metadatos";
import { registrarAccesoDenegadoAccion } from "@/lib/auditoria-doc";

const TIPOS: TipoCampoMetadato[] = ["TEXTO", "NUMERO", "FECHA", "LISTA", "BOOLEANO"];
const AMBITOS: AmbitoCampoMetadato[] = ["COMUNICACION", "EXPEDIENTE", "AMBOS"];

/** Crea un campo de metadato adicional. Solo administrador de archivo. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  const volver = new URL("/correspondencia/admin/metadatos", req.url);
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAdministrarArchivo(permisos)) {
    await registrarAccesoDenegadoAccion("Administrar campos de metadato", "metadatos", session, await headers());
    volver.searchParams.set("error", "No tiene permiso.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const tipoRaw = String(form.get("tipo") || "TEXTO");
  const ambitoRaw = String(form.get("ambito") || "AMBOS");
  try {
    await crearCampoMetadato({
      nombre: String(form.get("nombre") || ""),
      ayuda: String(form.get("ayuda") || ""),
      tipo: TIPOS.includes(tipoRaw as TipoCampoMetadato) ? (tipoRaw as TipoCampoMetadato) : "TEXTO",
      opciones: String(form.get("opciones") || "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
      obligatorio: String(form.get("obligatorio") || "") === "on",
      ambito: AMBITOS.includes(ambitoRaw as AmbitoCampoMetadato) ? (ambitoRaw as AmbitoCampoMetadato) : "AMBOS",
      serieId: String(form.get("serieId") || "") || null,
      valorPorDefecto: String(form.get("valorPorDefecto") || "") || null,
    });
    volver.searchParams.set("ok", "Campo de metadato creado.");
  } catch (err) {
    volver.searchParams.set("error", err instanceof Error ? err.message : "No se pudo crear el campo.");
  }
  return NextResponse.redirect(volver, { status: 303 });
}
