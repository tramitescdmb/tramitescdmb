import { NextRequest, NextResponse } from "next/server";
import { EstadoExpediente } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { puedeGestionarPaso } from "@/lib/cargos";
import { puedeEditarExpediente } from "@/lib/permisos";

const ESTADOS_TERMINALES: EstadoExpediente[] = ["APROBADO", "NEGADO", "DESISTIDO", "ARCHIVADO", "RECHAZADO"];

function esEstadoValido(valor: string): valor is EstadoExpediente {
  return (Object.values(EstadoExpediente) as string[]).includes(valor);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!(await puedeEditarExpediente(session.userId, id))) {
    return NextResponse.json({ error: "Su rol de acceso no le permite gestionar este trámite." }, { status: 403 });
  }

  const form = await req.formData();
  const siguientePasoRaw = form.get("siguientePasoNumero");
  const resultado = form.get("resultado") ? String(form.get("resultado")) : null;
  const comentario = String(form.get("comentario") || "").trim();

  const expediente = await db.expediente.findUnique({
    where: { id },
    include: { flujo: { include: { pasos: { orderBy: { numero: "asc" } } } } },
  });
  if (!expediente) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const pasoActual = expediente.flujo.pasos.find((p) => p.numero === expediente.pasoActualNumero);

  if (pasoActual && !puedeGestionarPaso(session, pasoActual.responsables)) {
    const url = new URL(`/expedientes/${id}`, req.url);
    url.searchParams.set("error", "sin-permiso-paso");
    return NextResponse.redirect(url, { status: 303 });
  }

  const siguientePasoNumero = siguientePasoRaw ? Number(siguientePasoRaw) : null;
  const siguienteExiste = siguientePasoNumero
    ? expediente.flujo.pasos.some((p) => p.numero === siguientePasoNumero)
    : false;

  const nuevoPasoNumero = siguienteExiste ? siguientePasoNumero! : expediente.pasoActualNumero;
  const resultadoValido = resultado && esEstadoValido(resultado) && ESTADOS_TERMINALES.includes(resultado)
    ? resultado
    : null;
  const nuevoEstado: EstadoExpediente =
    resultadoValido ?? (expediente.estado === "RADICADO" ? "EN_TRAMITE" : expediente.estado);

  await db.expediente.update({
    where: { id },
    data: {
      pasoActualNumero: nuevoPasoNumero,
      estado: nuevoEstado,
      fechaUltimoMovimiento: new Date(),
      responsableActualId: session.userId,
    },
  });

  const descripcionBase = pasoActual
    ? `Paso ${pasoActual.numero} ("${pasoActual.titulo}") gestionado por ${session.nombre}.`
    : `Avance registrado por ${session.nombre}.`;

  await db.expedienteEvento.create({
    data: {
      expedienteId: id,
      tipo: resultadoValido ? "CAMBIO_ESTADO" : "AVANCE_PASO",
      descripcion: [descripcionBase, comentario].filter(Boolean).join(" "),
      pasoNumero: pasoActual?.numero ?? null,
      estadoAnterior: expediente.estado,
      estadoNuevo: nuevoEstado,
      usuarioId: session.userId,
    },
  });

  return NextResponse.redirect(new URL(`/expedientes/${id}`, req.url), { status: 303 });
}
