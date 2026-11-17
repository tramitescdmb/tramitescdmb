import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { BUCKETS_PUBLICOS, almacenLocal, escribirArchivo, firmaValida, firmar, rutaFisica, tipoPorExtension } from "@/lib/almacen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ bucket: string; ruta: string[] }> };

// Tope por archivo para las subidas al almacenamiento local (NAS). Los formularios ya limitan
// a 2 MB por archivo; este tope evita que una subida directa, con un
// token válido, llene el disco o la memoria del proceso. Ajustable con ALMACEN_MAX_MB.
function topePorDefectoMb(): number {
  const mb = Number(process.env.ALMACEN_MAX_MB);
  return Number.isFinite(mb) && mb > 0 ? mb : 2;
}

function demasiadoGrande(topeMb: number) {
  return NextResponse.json({ message: `El archivo supera el máximo de ${topeMb} MB.` }, { status: 413 });
}

function noEncontrado() {
  return NextResponse.json({ error: "No encontrado" }, { status: 404 });
}

export async function GET(req: NextRequest, { params }: Params) {
  if (!almacenLocal()) return noEncontrado();
  const { bucket, ruta: partes } = await params;
  const ruta = partes.join("/");
  const sp = req.nextUrl.searchParams;
  const descargar = sp.get("descargar") ?? "";
  if (!BUCKETS_PUBLICOS.has(bucket)) {
    const exp = sp.get("exp") ?? "";
    if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) {
      return NextResponse.json({ error: "Enlace vencido" }, { status: 403 });
    }
    if (!firmaValida(firmar("leer", bucket, ruta, exp, descargar), sp.get("firma"))) {
      return NextResponse.json({ error: "Firma no válida" }, { status: 403 });
    }
  }
  let contenido: Buffer;
  try {
    contenido = await fs.readFile(rutaFisica(bucket, ruta));
  } catch {
    return noEncontrado();
  }
  const nombre = descargar || path.basename(ruta);
  return new NextResponse(new Uint8Array(contenido), {
    headers: {
      "Content-Type": tipoPorExtension(ruta),
      "Content-Length": String(contenido.length),
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": BUCKETS_PUBLICOS.has(bucket) ? "public, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Un HTML, SVG o XML subido no debe ejecutar código con la sesión de la plataforma.
      ...(/^(text\/html|image\/svg|application\/xml)/.test(tipoPorExtension(ruta)) ? { "Content-Security-Policy": "sandbox; default-src 'none'" } : {}),
    },
  });
}

async function recibir(req: NextRequest, { params }: Params) {
  if (!almacenLocal()) return noEncontrado();
  const { bucket, ruta: partes } = await params;
  const ruta = partes.join("/");
  // Token: "exp.firma" (tope por defecto) o "exp.topeMb.firma" (tope ampliado, p. ej. el PDF del concepto técnico).
  const trozos = (req.nextUrl.searchParams.get("token") ?? "").split(".");
  const [exp, mb, firma] = trozos.length === 3 ? trozos : [trozos[0], undefined, trozos[1]];
  const firmaEsperada = mb === undefined ? firmar("subir", bucket, ruta, exp ?? "") : firmar("subir", bucket, ruta, exp ?? "", mb);
  if (
    trozos.length < 2 ||
    trozos.length > 3 ||
    !/^\d+$/.test(exp ?? "") ||
    (mb !== undefined && !/^\d+$/.test(mb)) ||
    Number(exp) < Date.now() / 1000 ||
    !firmaValida(firmaEsperada, firma ?? null)
  ) {
    return NextResponse.json({ message: "Token de subida no válido o vencido" }, { status: 403 });
  }
  const topeMb = mb !== undefined ? Number(mb) : topePorDefectoMb();
  const topeBytes = topeMb * 1024 * 1024;
  const declarado = Number(req.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > topeBytes + 64 * 1024) return demasiadoGrande(topeMb);
  let contenido: Buffer;
  const tipo = req.headers.get("content-type") ?? "";
  if (tipo.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const archivo = [...form.values()].find((v): v is File => typeof v !== "string");
    if (!archivo) return NextResponse.json({ message: "Falta el archivo" }, { status: 400 });
    contenido = Buffer.from(await archivo.arrayBuffer());
  } else {
    contenido = Buffer.from(await req.arrayBuffer());
  }
  if (contenido.length > topeBytes) return demasiadoGrande(topeMb);
  if (contenido.length === 0) return NextResponse.json({ message: "El archivo está vacío (0 bytes). Revíselo y vuelva a subirlo." }, { status: 400 });
  const destino = rutaFisica(bucket, ruta);
  try {
    // Nunca se sobrescribe: el token de subida dura 2 horas y, con "x-upsert", quien subió un archivo
    // podía reemplazarlo después de registrado (incluso ya firmado) sin dejar rastro.
    await escribirArchivo(destino, contenido, "wx");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST") {
      return NextResponse.json({ message: "El archivo ya existe" }, { status: 409 });
    }
    throw e;
  }
  return NextResponse.json({ Key: `${bucket}/${ruta}` });
}

export const PUT = recibir;
export const POST = recibir;
