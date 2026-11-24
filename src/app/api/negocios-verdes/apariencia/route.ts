import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eliminar, subir } from "@/lib/almacen";
import { nombreArchivo } from "@/lib/carpetas-almacen";
import { BUCKET_NEGOCIOS_VERDES, urlExternaSegura } from "@/lib/negocios-verdes";
import { auditarNV, exigirPermisoNV } from "@/lib/negocios-verdes-api";
import { tipoImagenPorFirma } from "@/lib/negocios-verdes-imagen";
import { refrescarSitioNV } from "@/lib/negocios-verdes-admin";

export const runtime = "nodejs";

const CAMPOS_LOGO = { logo: "logoRuta", govco: "logoGovcoRuta", colombia: "logoColombiaRuta", potencia: "logoPotenciaRuta" } as const;
type CampoLogo = keyof typeof CAMPOS_LOGO;
const esCampoLogo = (v: unknown): v is CampoLogo => typeof v === "string" && v in CAMPOS_LOGO;

function topeMb(): number {
  const mb = Number(process.env.ALMACEN_MAX_MB);
  return Number.isFinite(mb) && mb > 0 ? mb : 2;
}

async function guardarImagen(archivo: File): Promise<string | { error: string }> {
  if (archivo.size > topeMb() * 1024 * 1024) return { error: `La imagen supera ${topeMb()} MB.` };
  const contenido = Buffer.from(await archivo.arrayBuffer());
  const tipo = tipoImagenPorFirma(contenido);
  if (!tipo) return { error: "Solo se aceptan imágenes JPG, PNG o WebP." };
  const base = nombreArchivo(archivo.name || "imagen").replace(/\.[A-Za-z0-9]+$/, "").slice(0, 60) || "imagen";
  const ruta = `sitio-assets/${Date.now()}-${base}.${tipo.extension}`;
  await subir(BUCKET_NEGOCIOS_VERDES, ruta, contenido, tipo.mime);
  return ruta;
}

/**
 * Apariencia del sitio público (perfil de configuración):
 * - multipart con `logo` = logo|govco|colombia|potencia y `archivo`: cambia ese logo.
 * - multipart con `banner` = "nuevo" y `archivo`: agrega un banner.
 */
export async function POST(req: NextRequest) {
  const acceso = await exigirPermisoNV("CONFIGURAR");
  if ("error" in acceso) return acceso.error;
  const form = await req.formData().catch(() => null);
  const archivo = form?.get("archivo");
  if (!form || !archivo || typeof archivo === "string") return NextResponse.json({ error: "Falta la imagen." }, { status: 400 });
  const ruta = await guardarImagen(archivo);
  if (typeof ruta !== "string") return NextResponse.json(ruta, { status: 400 });
  const logo = form.get("logo");
  if (esCampoLogo(logo)) {
    const campo = CAMPOS_LOGO[logo];
    const antes = await db.nvConfiguracion.findUnique({ where: { id: "singleton" } });
    await db.nvConfiguracion.upsert({ where: { id: "singleton" }, create: { id: "singleton", [campo]: ruta }, update: { [campo]: ruta } });
    const anterior = antes?.[campo];
    if (anterior) await eliminar(BUCKET_NEGOCIOS_VERDES, [anterior]).catch(() => {});
    await auditarNV({ entidad: "NvConfiguracion", entidadId: "singleton", accion: "MODIFICA", usuarioId: acceso.session.userId, detalle: `${acceso.session.nombre} cambió la imagen «${logo}» del sitio de Negocios Verdes` });
  } else {
    const orden = (await db.nvBanner.aggregate({ _max: { orden: true } }))._max.orden ?? -1;
    const b = await db.nvBanner.create({ data: { imagenRuta: ruta, orden: orden + 1 } });
    await auditarNV({ entidad: "NvBanner", entidadId: b.id, accion: "CREA", usuarioId: acceso.session.userId, detalle: `${acceso.session.nombre} agregó un banner al sitio de Negocios Verdes` });
  }
  refrescarSitioNV();
  return NextResponse.json({ ok: true });
}

/** Edita un banner: enlace, orden, activo, pestaña nueva. */
export async function PUT(req: NextRequest) {
  const acceso = await exigirPermisoNV("CONFIGURAR");
  if ("error" in acceso) return acceso.error;
  const b = await req.json().catch(() => ({}));
  if (typeof b.id !== "string") return NextResponse.json({ error: "Falta el banner." }, { status: 400 });
  const url = typeof b.urlDestino === "string" && b.urlDestino.trim() ? (b.urlDestino.trim().startsWith("/") ? b.urlDestino.trim().slice(0, 300) : urlExternaSegura(b.urlDestino)) : null;
  if (typeof b.urlDestino === "string" && b.urlDestino.trim() && !url) return NextResponse.json({ error: "El enlace no es válido." }, { status: 400 });
  try {
    await db.nvBanner.update({
      where: { id: b.id },
      data: { urlDestino: url, orden: Math.max(0, Math.trunc(Number(b.orden) || 0)), activo: b.activo !== false, abrirEnPestanaNueva: b.abrirEnPestanaNueva !== false },
    });
  } catch {
    return NextResponse.json({ error: "El banner ya no existe." }, { status: 404 });
  }
  await auditarNV({ entidad: "NvBanner", entidadId: b.id, accion: "MODIFICA", usuarioId: acceso.session.userId, detalle: `${acceso.session.nombre} editó un banner del sitio de Negocios Verdes` });
  refrescarSitioNV();
  return NextResponse.json({ ok: true });
}

/** ?banner=<id> elimina un banner; ?logo=<campo> quita ese logo. La imagen se borra del NAS. */
export async function DELETE(req: NextRequest) {
  const acceso = await exigirPermisoNV("CONFIGURAR");
  if ("error" in acceso) return acceso.error;
  const sp = req.nextUrl.searchParams;
  let ruta: string | null = null;
  const logo = sp.get("logo");
  if (esCampoLogo(logo)) {
    const c = await db.nvConfiguracion.findUnique({ where: { id: "singleton" } });
    ruta = c?.[CAMPOS_LOGO[logo]] ?? null;
    if (c) await db.nvConfiguracion.update({ where: { id: "singleton" }, data: { [CAMPOS_LOGO[logo]]: null } });
  } else {
    const b = await db.nvBanner.delete({ where: { id: sp.get("banner") ?? "" } }).catch(() => null);
    if (!b) return NextResponse.json({ error: "El banner ya no existe." }, { status: 404 });
    ruta = b.imagenRuta;
  }
  if (ruta) await eliminar(BUCKET_NEGOCIOS_VERDES, [ruta]).catch(() => {});
  await auditarNV({ entidad: "NvConfiguracion", entidadId: "singleton", accion: "ELIMINA", usuarioId: acceso.session.userId, detalle: `${acceso.session.nombre} quitó ${logo ? `la imagen «${logo}»` : "un banner"} del sitio de Negocios Verdes` });
  refrescarSitioNV();
  return NextResponse.json({ ok: true });
}
