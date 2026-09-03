import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { buildStoragePath, crearUrlSubidaFirmada } from "@/lib/storage";
import { extensionPermitida, mensajeTipoNoPermitido } from "@/lib/uploads-config";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const expedienteId = body?.expedienteId ? String(body.expedienteId) : "";
  const fileName = body?.fileName ? String(body.fileName) : "";
  // Al radicar un expediente nuevo, los documentos se suben ANTES de crear el
  // expediente (el cliente ya generó su UUID) — ver NuevoExpedienteForm.tsx.
  const esExpedienteNuevo = body?.nuevo === true;

  if (!expedienteId || !fileName) {
    return NextResponse.json({ error: "Faltan expedienteId o fileName." }, { status: 400 });
  }

  // El navegador ya valida esto (src/lib/uploads-client.ts), pero esa validación se puede saltar
  // (otro cliente HTTP, devtools) — el servidor es quien de verdad decide qué se puede subir.
  if (!extensionPermitida(fileName)) {
    return NextResponse.json({ error: mensajeTipoNoPermitido(fileName) }, { status: 400 });
  }

  // El expedienteId siempre queda como carpeta del archivo en Storage — se exige que
  // sea un UUID bien formado para que no se pueda escribir fuera de "expedientes/<uuid>/".
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(expedienteId)) {
    return NextResponse.json({ error: "El identificador del expediente no es válido." }, { status: 400 });
  }

  const expediente = await db.expediente.findUnique({ where: { id: expedienteId }, select: { id: true } });
  if (esExpedienteNuevo) {
    // Radicación en curso: el expediente todavía no existe, pero tampoco puede existir
    // ya (evita subir archivos a la carpeta de un expediente ajeno pasando "nuevo").
    if (expediente) {
      return NextResponse.json({ error: "Ya existe un expediente con ese identificador." }, { status: 409 });
    }
  } else if (!expediente) {
    return NextResponse.json({ error: "El expediente indicado no existe." }, { status: 404 });
  }

  const path = buildStoragePath(expedienteId, fileName);
  const { token } = await crearUrlSubidaFirmada(path);

  return NextResponse.json({ path, token });
}
