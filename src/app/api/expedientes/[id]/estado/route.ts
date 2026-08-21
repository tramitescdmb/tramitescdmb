import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

const ESTADOS_VALIDOS = [
  "RADICADO",
  "EN_TRAMITE",
  "INFORMACION_ADICIONAL_REQUERIDA",
  "SUSPENDIDO",
  "APROBADO",
  "NEGADO",
  "DESISTIDO",
  "ARCHIVADO",
  "RECHAZADO",
];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const form = await req.formData();
  const nuevoEstado = String(form.get("estado") || "");
  const motivo = String(form.get("motivo") || "").trim();

  if (!ESTADOS_VALIDOS.includes(nuevoEstado)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  const expediente = await db.expediente.findUnique({ where: { id } });
  if (!expediente) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  await db.expediente.update({
    where: { id },
    data: { estado: nuevoEstado as typeof expediente.estado, fechaUltimoMovimiento: new Date() },
  });

  await db.expedienteEvento.create({
    data: {
      expedienteId: id,
      tipo: "CAMBIO_ESTADO",
      descripcion: [
        `${session.nombre} cambió el estado manualmente.`,
        motivo && `Motivo: ${motivo}`,
      ]
        .filter(Boolean)
        .join(" "),
      estadoAnterior: expediente.estado,
      estadoNuevo: nuevoEstado as typeof expediente.estado,
      usuarioId: session.userId,
    },
  });

  return NextResponse.redirect(new URL(`/expedientes/${id}`, req.url), { status: 303 });
}
