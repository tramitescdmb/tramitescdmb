import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { puedeEditarExpediente } from "@/lib/permisos";
import { MAX_FOTOS_VISITA, TAMANO_MAXIMO_FOTO_VISITA_BYTES, mensajeFotoGrande, mensajeDemasiadasFotos } from "@/lib/visita-tecnica-fotos";
import { MENSAJE_EXPEDIENTE_CERRADO, tramiteCerrado } from "@/lib/archivo-central";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; visitaId: string }> }) {
  const { id, visitaId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!(await puedeEditarExpediente(session.userId, id))) {
    return NextResponse.json({ error: "Su rol de acceso no le permite gestionar este trámite." }, { status: 403 });
  }
  if (await tramiteCerrado(id)) return NextResponse.json({ error: MENSAJE_EXPEDIENTE_CERRADO }, { status: 409 });

  const visita = await db.visitaTecnica.findUnique({ where: { id: visitaId }, select: { expedienteId: true, _count: { select: { fotos: true } } } });
  if (!visita || visita.expedienteId !== id) {
    return NextResponse.json({ error: "La visita técnica indicada no existe." }, { status: 404 });
  }
  if (visita._count.fotos >= MAX_FOTOS_VISITA) {
    return NextResponse.json({ error: mensajeDemasiadasFotos() }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const storagePath: string = String(body.storagePath || "");
  const mimeType: string = String(body.mimeType || "");
  const tamanoBytes = Number(body.tamanoBytes);
  const nombre: string = String(body.nombre || "foto");
  const tomadaEn = body.tomadaEn ? new Date(body.tomadaEn) : null;
  const latExif = body.latExif != null ? Number(body.latExif) : null;
  const lonExif = body.lonExif != null ? Number(body.lonExif) : null;

  if (!storagePath || !mimeType || !Number.isFinite(tamanoBytes)) {
    return NextResponse.json({ error: "Faltan datos del archivo subido." }, { status: 400 });
  }
  if (tamanoBytes > TAMANO_MAXIMO_FOTO_VISITA_BYTES) {
    return NextResponse.json({ error: mensajeFotoGrande(nombre) }, { status: 400 });
  }

  const foto = await db.visitaTecnicaFoto.create({
    data: {
      visitaId,
      storagePath,
      mimeType,
      tamanoBytes,
      tomadaEn: tomadaEn && !Number.isNaN(tomadaEn.getTime()) ? tomadaEn : null,
      latExif: latExif != null && Number.isFinite(latExif) ? latExif : null,
      lonExif: lonExif != null && Number.isFinite(lonExif) ? lonExif : null,
    },
  });

  return NextResponse.json({ id: foto.id });
}
