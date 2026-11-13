import crypto from "crypto";
import { NextResponse } from "next/server";
import { eliminar, listar, subir, urlFirmada } from "@/lib/almacen";

const BUCKET = "documentos";
const VIGENCIA_URL_SEGUNDOS = 600;

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
  const carpeta = `derivados/${opciones.carpeta}`;
  const archivo = `${opciones.huella}-${nombreSeguro(opciones.nombreArchivo)}`;
  const ruta = `${carpeta}/${archivo}`;

  const existentes = await listar(BUCKET, carpeta);
  if (!existentes.includes(archivo)) {
    const contenido = await opciones.generar();
    try {
      await subir(BUCKET, ruta, Buffer.from(contenido), opciones.contentType, true);
    } catch (e) {
      console.error(`servirDerivado: no se pudo guardar ${ruta}, se entrega directo:`, e instanceof Error ? e.message : e);
      return new NextResponse(Buffer.from(contenido), {
        headers: {
          "Content-Type": opciones.contentType,
          "Content-Disposition": `${opciones.descargar ? "attachment" : "inline"}; filename="${nombreSeguro(opciones.nombreArchivo)}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    const viejos = existentes.filter((f) => f !== archivo).map((f) => `${carpeta}/${f}`);
    if (viejos.length > 0) await eliminar(BUCKET, viejos);
  }

  const url = await urlFirmada(BUCKET, ruta, VIGENCIA_URL_SEGUNDOS, opciones.descargar ? opciones.nombreArchivo : undefined);

  const respuesta = opciones.comoJson ? NextResponse.json({ url }) : NextResponse.redirect(url, 302);
  respuesta.headers.set("Cache-Control", "private, no-store");
  return respuesta;
}
