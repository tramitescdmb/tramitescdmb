import { NextRequest, NextResponse } from "next/server";
import { EstadoExpediente } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { ESTADOS_TERMINALES_EXPEDIENTE } from "@/lib/estados-expediente";
import { tramiteCerrado } from "@/lib/archivo-central";
import { sincronizarAvisoVisita } from "@/lib/notificaciones";

const ESTADOS_TERMINALES = ESTADOS_TERMINALES_EXPEDIENTE as readonly EstadoExpediente[];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const volver = new URL(`/expedientes/${id}`, req.url);
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  if (session.rol !== "ADMIN") {
    volver.searchParams.set("error", "Solo el administrador puede devolver el expediente a un paso anterior.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (await tramiteCerrado(id)) {
    volver.searchParams.set("error", "cerrado");
    return NextResponse.redirect(volver, { status: 303 });
  }

  const form = await req.formData();
  const destino = Number(form.get("pasoNumero"));
  const motivo = String(form.get("motivo") || "").trim();
  const expediente = await db.expediente.findUnique({
    where: { id },
    select: { estado: true, pasoActualNumero: true, flujo: { select: { pasos: { select: { numero: true, titulo: true } } } } },
  });
  if (!expediente) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
  const pasoDestino = expediente.flujo.pasos.find((p) => p.numero === destino);
  const pasoActual = expediente.flujo.pasos.find((p) => p.numero === expediente.pasoActualNumero);
  if (!pasoDestino || destino >= expediente.pasoActualNumero) {
    volver.searchParams.set("error", "Elija un paso anterior al actual.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (!motivo) {
    volver.searchParams.set("error", "Indique el motivo para devolver el expediente.");
    return NextResponse.redirect(volver, { status: 303 });
  }
  if (ESTADOS_TERMINALES.includes(expediente.estado)) {
    volver.searchParams.set("error", "El expediente ya tiene un estado final; cámbielo primero en la pestaña Administración.");
    return NextResponse.redirect(volver, { status: 303 });
  }

  await db.$transaction([
    db.expediente.update({
      where: { id },
      data: { pasoActualNumero: destino, fechaUltimoMovimiento: new Date(), responsableActualId: session.userId },
    }),
    db.expedienteEvento.create({
      data: {
        expedienteId: id,
        tipo: "AVANCE_PASO",
        descripcion: `${session.nombre} devolvió el expediente del paso ${expediente.pasoActualNumero}${pasoActual ? ` ("${pasoActual.titulo}")` : ""} al paso ${destino} ("${pasoDestino.titulo}"). Motivo: ${motivo}`,
        pasoNumero: expediente.pasoActualNumero,
        estadoAnterior: expediente.estado,
        estadoNuevo: expediente.estado,
        usuarioId: session.userId,
      },
    }),
  ]);
  await sincronizarAvisoVisita(id);
  volver.searchParams.set("ok", `El expediente volvió al paso ${destino}.`);
  return NextResponse.redirect(volver, { status: 303 });
}
