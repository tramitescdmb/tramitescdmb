import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { BUCKETS_PUBLICOS, almacenLocal, firmaValida, firmar, rutaFisica, tipoPorExtension } from "@/lib/almacen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ bucket: string; ruta: string[] }> };

// Tope por archivo para las subidas al almacenamiento local (NAS). Los formularios ya limitan
// a 2 MB por archivo; este tope evita que una subida directa, con un
// token válido, llene el disco o la memoria del proceso. Ajustable con ALMACEN_MAX_MB.
function topeBytes(): number {
  const mb = Number(process.env.ALMACEN_MAX_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : 2) * 1024 * 1024;
}

function demasiadoGrande() {
  return NextResponse.json({ message: `El archivo supera el máximo de ${Math.round(topeBytes() / (1024 * 1024))} MB.` }, { status: 413 });
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
    },
  });
}

async function recibir(req: NextRequest, { params }: Params) {
  if (!almacenLocal()) return noEncontrado();
  const { bucket, ruta: partes } = await params;
  const ruta = partes.join("/");
  const [exp, firma] = (req.nextUrl.searchParams.get("token") ?? "").split(".");
  if (!/^\d+$/.test(exp ?? "") || Number(exp) < Date.now() / 1000 || !firmaValida(firmar("subir", bucket, ruta, exp), firma ?? null)) {
    return NextResponse.json({ message: "Token de subida no válido o vencido" }, { status: 403 });
  }
  const declarado = Number(req.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > topeBytes() + 64 * 1024) return demasiadoGrande();
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
  if (contenido.length > topeBytes()) return demasiadoGrande();
  const destino = rutaFisica(bucket, ruta);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  try {
    await fs.writeFile(destino, contenido, { flag: req.headers.get("x-upsert") === "true" ? "w" : "wx" });
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
