import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { desdeLatLon, esLatLonValido } from "@/lib/coordenadas";
import { puedeEditarExpediente } from "@/lib/permisos";

/** Registra un punto de geoposición capturado en campo (GPS del dispositivo) durante un paso del expediente. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!(await puedeEditarExpediente(session.userId, id))) {
    return NextResponse.json({ error: "Su rol de acceso no le permite gestionar este trámite." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const pasoNumero = Number(body.pasoNumero);
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  const precisionM = body.precisionM != null ? Number(body.precisionM) : null;
  const nota: string | null = body.nota?.trim() || null;

  if (!Number.isFinite(pasoNumero)) {
    return NextResponse.json({ error: "Falta el número de paso." }, { status: 400 });
  }
  if (!esLatLonValido(lat, lon)) {
    return NextResponse.json({ error: "La ubicación recibida no es válida." }, { status: 400 });
  }

  const c = desdeLatLon(lat, lon);

  const visita = await db.visitaTecnica.create({
    data: {
      expedienteId: id,
      pasoNumero,
      lat: c.lat,
      lon: c.lon,
      planaX: c.planaX,
      planaY: c.planaY,
      cartesianaX: c.cartesianaX,
      cartesianaY: c.cartesianaY,
      cartesianaZ: c.cartesianaZ,
      precisionM: Number.isFinite(precisionM) ? precisionM : null,
      nota,
      capturadoPorId: session.userId,
    },
  });

  await db.expedienteEvento.create({
    data: {
      expedienteId: id,
      tipo: "VISITA_REGISTRADA",
      descripcion: `${session.nombre} registró la geoposición de una visita técnica en el paso ${pasoNumero}.`,
      pasoNumero,
      usuarioId: session.userId,
    },
  });
  await db.expediente.update({ where: { id }, data: { fechaUltimoMovimiento: new Date() } });

  return NextResponse.json({ id: visita.id });
}
