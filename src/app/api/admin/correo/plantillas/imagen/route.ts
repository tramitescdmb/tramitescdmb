import { NextRequest, NextResponse } from "next/server";
import { verificarSesion as getSession } from "@/lib/permisos";
import { buildBrandingPath, crearUrlSubidaFirmadaBranding, getBrandingPublicUrl } from "@/lib/branding-storage";

// Las imágenes de los correos van al bucket público «branding» (carpeta correo/): los clientes de
// correo las cargan por su dirección pública; Outlook bloquea las imágenes incrustadas en base64.
const TIPOS = ["image/png", "image/jpeg", "image/gif"];
const MAX_IMAGEN_BYTES = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "ADMIN") return NextResponse.json({ error: "Solo el administrador del sistema sube imágenes a las plantillas." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { fileName?: unknown; tipo?: unknown; tamano?: unknown } | null;
  const fileName = typeof body?.fileName === "string" ? body.fileName : "";
  const tipo = typeof body?.tipo === "string" ? body.tipo : "";
  const tamano = Number(body?.tamano ?? 0);
  if (!fileName || !TIPOS.includes(tipo)) return NextResponse.json({ error: "Use una imagen PNG, JPG o GIF (Outlook no muestra WebP ni SVG)." }, { status: 400 });
  if (!(tamano > 0) || tamano > MAX_IMAGEN_BYTES) return NextResponse.json({ error: "La imagen no puede superar 2 MB." }, { status: 400 });
  const path = buildBrandingPath("correo", fileName);
  const { token } = await crearUrlSubidaFirmadaBranding(path);
  return NextResponse.json({ path, token, url: getBrandingPublicUrl(path) });
}
