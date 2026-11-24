import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subir } from "@/lib/almacen";
import { nombreArchivo } from "@/lib/carpetas-almacen";
import { BUCKET_NEGOCIOS_VERDES, urlImagenNV } from "@/lib/negocios-verdes";
import { exigirPermisoNV } from "@/lib/negocios-verdes-api";
import { tipoImagenPorFirma } from "@/lib/negocios-verdes-imagen";

export const runtime = "nodejs";

function topeMb(): number {
  const mb = Number(process.env.ALMACEN_MAX_MB);
  return Number.isFinite(mb) && mb > 0 ? mb : 2;
}

/**
 * Sube una imagen del negocio al almacén público del NAS (negocios-fotos/<id>/…). Solo JPG, PNG o
 * WebP, comprobados por su contenido y no por el nombre. Queda en uso cuando se guarda el formulario.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const acceso = await exigirPermisoNV("ACTUALIZAR");
  if ("error" in acceso) return acceso.error;
  const { id } = await params;
  if (!(await db.nvNegocio.findUnique({ where: { id }, select: { id: true } }))) return NextResponse.json({ error: "El negocio ya no existe." }, { status: 404 });
  const form = await req.formData().catch(() => null);
  const archivo = form?.get("archivo");
  if (!archivo || typeof archivo === "string") return NextResponse.json({ error: "Falta la imagen." }, { status: 400 });
  const tope = topeMb();
  if (archivo.size > tope * 1024 * 1024) return NextResponse.json({ error: `La imagen supera ${tope} MB.` }, { status: 413 });
  const contenido = Buffer.from(await archivo.arrayBuffer());
  const tipo = tipoImagenPorFirma(contenido);
  if (!tipo) return NextResponse.json({ error: "Solo se aceptan imágenes JPG, PNG o WebP." }, { status: 400 });
  const base = nombreArchivo(archivo.name || "imagen").replace(/\.[A-Za-z0-9]+$/, "").slice(0, 60) || "imagen";
  const ruta = `negocios-fotos/${id}/${Date.now()}-${base}.${tipo.extension}`;
  await subir(BUCKET_NEGOCIOS_VERDES, ruta, contenido, tipo.mime);
  return NextResponse.json({ ruta, url: urlImagenNV(ruta) });
}
