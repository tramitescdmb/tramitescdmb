import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { ESTADOS_EXPEDIENTE, ESTADOS_TERMINALES_EXPEDIENTE } from "@/lib/estados-expediente";

const ESTADOS_VALIDOS: string[] = [...ESTADOS_EXPEDIENTE];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.rol !== "ADMIN") {
    const url = new URL(`/expedientes/${id}`, req.url);
    url.searchParams.set("error", "sin-permiso-estado");
    return NextResponse.redirect(url, { status: 303 });
  }

  const form = await req.formData();
  const nuevoEstado = String(form.get("estado") || "");
  const motivo = String(form.get("motivo") || "").trim();

  if (!ESTADOS_VALIDOS.includes(nuevoEstado)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  const expediente = await db.expediente.findUnique({ where: { id } });
  if (!expediente) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const esTerminal = (ESTADOS_TERMINALES_EXPEDIENTE as readonly string[]).includes(nuevoEstado);
  await db.expediente.update({
    where: { id },
    data: {
      estado: nuevoEstado as typeof expediente.estado,
      fechaUltimoMovimiento: new Date(),
      fechaCierre: esTerminal ? new Date() : null,
    },
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
