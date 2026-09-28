import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "documentos";
const VIGENCIA_URL_SEGUNDOS = 600;

function cliente() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase no está configurado.");
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function huellaDerivado(...partes: unknown[]): string {
  return crypto.createHash("sha256").update(JSON.stringify(partes)).digest("hex").slice(0, 16);
}

function nombreSeguro(nombre: string): string {
  return nombre.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
}

export async function servirDerivado(opciones: {
  carpeta: string;
  huella: string;
  nombreArchivo: string;
  contentType: string;
  descargar?: boolean;
  comoJson?: boolean;
  generar: () => Promise<Uint8Array>;
}): Promise<NextResponse> {
  const supabase = cliente();
  const carpeta = `derivados/${opciones.carpeta}`;
  const archivo = `${opciones.huella}-${nombreSeguro(opciones.nombreArchivo)}`;
  const ruta = `${carpeta}/${archivo}`;

  const { data: existentes } = await supabase.storage.from(BUCKET).list(carpeta, { limit: 100 });
  if (!existentes?.some((f) => f.name === archivo)) {
    const contenido = await opciones.generar();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, Buffer.from(contenido), { contentType: opciones.contentType, upsert: true });
    if (error) {
      console.error(`servirDerivado: no se pudo guardar ${ruta}, se entrega directo:`, error.message);
      return new NextResponse(Buffer.from(contenido), {
        headers: {
          "Content-Type": opciones.contentType,
          "Content-Disposition": `${opciones.descargar ? "attachment" : "inline"}; filename="${nombreSeguro(opciones.nombreArchivo)}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    const viejos = (existentes ?? []).filter((f) => f.name !== archivo).map((f) => `${carpeta}/${f.name}`);
    if (viejos.length > 0) await supabase.storage.from(BUCKET).remove(viejos);
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(ruta, VIGENCIA_URL_SEGUNDOS, opciones.descargar ? { download: opciones.nombreArchivo } : undefined);
  if (error || !data) throw error ?? new Error("No se pudo firmar la URL del archivo.");

  const respuesta = opciones.comoJson ? NextResponse.json({ url: data.signedUrl }) : NextResponse.redirect(data.signedUrl, 302);
  respuesta.headers.set("Cache-Control", "private, no-store");
  return respuesta;
}
