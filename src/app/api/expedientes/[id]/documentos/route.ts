import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { puedeEditarExpediente } from "@/lib/permisos";
import { registrarAuditoriaDoc, datosPeticion } from "@/lib/auditoria-doc";
import { MENSAJE_EXPEDIENTE_CERRADO, tramiteCerrado } from "@/lib/archivo-central";
import { MENSAJE_RUTA_AJENA, problemaArchivoSubido, rutaDeExpediente } from "@/lib/storage";

type ArchivoInput = {
  path: string;
  nombre: string;
  mimeType: string;
  tamanoBytes: number;
  descripcion?: string | null;
  hashSha256?: string | null;
  requiereFirma?: boolean;
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!(await puedeEditarExpediente(session.userId, id))) {
    return NextResponse.json({ error: "Su rol de acceso no le permite gestionar este trámite." }, { status: 403 });
  }
  if (await tramiteCerrado(id)) return NextResponse.json({ error: MENSAJE_EXPEDIENTE_CERRADO }, { status: 409 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const pasoNumero: number | null = body.pasoNumero == null || body.pasoNumero === "" ? null : Number(body.pasoNumero);
  if (pasoNumero !== null) {
    // Solo al paso actual o a uno ya recorrido; un paso futuro o inexistente dejaría el documento fuera de lugar.
    const exp = await db.expediente.findUnique({
      where: { id },
      select: { pasoActualNumero: true, flujo: { select: { pasos: { select: { numero: true } } } } },
    });
    if (!exp || !Number.isInteger(pasoNumero) || pasoNumero > exp.pasoActualNumero || !exp.flujo.pasos.some((p) => p.numero === pasoNumero)) {
      return NextResponse.json({ error: "El paso indicado no es el actual ni uno anterior del trámite. Recargue la página." }, { status: 400 });
    }
  }
  const descripcionDefecto: string | null = body.descripcion?.trim() || null;
  const archivos: ArchivoInput[] = Array.isArray(body.archivos) ? body.archivos : [];

  const validos = archivos.filter((a) => a?.path && a?.nombre);
  if (validos.length === 0) {
    return NextResponse.json({ error: "No hay archivos para guardar." }, { status: 400 });
  }
  if (validos.some((a) => !rutaDeExpediente(a.path, id))) {
    return NextResponse.json({ error: MENSAJE_RUTA_AJENA }, { status: 400 });
  }
  if (new Set(validos.map((a) => a.path)).size !== validos.length) {
    return NextResponse.json({ error: "El mismo archivo aparece dos veces." }, { status: 400 });
  }
  const usados = await db.expedienteDocumento.count({ where: { storagePath: { in: validos.map((a) => a.path) } } });
  for (const a of validos) {
    const problema = await problemaArchivoSubido(a.path, usados);
    if (problema) return NextResponse.json({ error: problema }, { status: 409 });
  }

  const subidos = await db.$transaction(
    validos.map((a) =>
      db.expedienteDocumento.create({
        data: {
          expedienteId: id,
          pasoNumero,
          nombre: a.nombre,
          descripcion: a.descripcion?.trim() || descripcionDefecto,
          storagePath: a.path,
          mimeType: a.mimeType || "application/octet-stream",
          tamanoBytes: a.tamanoBytes || 0,
          hashSha256: a.hashSha256 || null,
          requiereFirma: a.requiereFirma !== false,
          subidoPorId: session.userId,
        },
        select: { id: true, nombre: true },
      })
    )
  );
  const { ip, userAgent } = datosPeticion(req.headers);
  for (const doc of subidos) {
    await registrarAuditoriaDoc({
      entidad: "ExpedienteDocumento",
      entidadId: doc.id,
      accion: "CREA",
      usuarioId: session.userId,
      ip,
      userAgent,
      detalle: `Se subió "${doc.nombre}" al expediente`,
    });
  }

  await db.expedienteEvento.create({
    data: {
      expedienteId: id,
      tipo: "DOCUMENTO_SUBIDO",
      descripcion: `${session.nombre} adjuntó ${validos.length} documento${validos.length === 1 ? "" : "s"}${
        pasoNumero ? ` en el paso ${pasoNumero}` : ""
      }.`,
      pasoNumero,
      usuarioId: session.userId,
    },
  });
  await db.expediente.update({ where: { id }, data: { fechaUltimoMovimiento: new Date() } });

  return NextResponse.json({ ok: true });
}
