import { NextRequest, NextResponse } from "next/server";
import { EstadoExpediente } from "@prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { puedeGestionarPaso } from "@/lib/cargos";
import { puedeEditarExpediente } from "@/lib/permisos";
import { ESTADOS_TERMINALES_EXPEDIENTE } from "@/lib/estados-expediente";
import { tramiteCerrado } from "@/lib/archivo-central";
import { sincronizarAvisoVisita } from "@/lib/notificaciones";
import { avanceValido, resultadosDelPaso } from "@/lib/reglas-estado";

const ESTADOS_TERMINALES = ESTADOS_TERMINALES_EXPEDIENTE as readonly EstadoExpediente[];

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
  if (await tramiteCerrado(id)) {
    const url = new URL(`/expedientes/${id}`, req.url);
    url.searchParams.set("error", "cerrado");
    return NextResponse.redirect(url, { status: 303 });
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

  if (ESTADOS_TERMINALES.includes(expediente.estado)) {
    const url = new URL(`/expedientes/${id}`, req.url);
    url.searchParams.set("error", "El expediente ya tiene un estado final; cámbielo primero en la pestaña Administración.");
    return NextResponse.redirect(url, { status: 303 });
  }

  const pasoActual = expediente.flujo.pasos.find((p) => p.numero === expediente.pasoActualNumero);

  if (pasoActual && !puedeGestionarPaso(session, pasoActual.responsables)) {
    const url = new URL(`/expedientes/${id}`, req.url);
    url.searchParams.set("error", "sin-permiso-paso");
    return NextResponse.redirect(url, { status: 303 });
  }

  const pasoDesde = form.get("pasoDesde") ? Number(form.get("pasoDesde")) : null;
  const siguientePasoNumero = siguientePasoRaw ? Number(siguientePasoRaw) : null;
  if ((pasoDesde !== null && pasoDesde !== expediente.pasoActualNumero) || !avanceValido(expediente.flujo.pasos, expediente.pasoActualNumero, siguientePasoNumero, resultado)) {
    const url = new URL(`/expedientes/${id}`, req.url);
    url.searchParams.set("error", "El avance pedido no corresponde al paso actual (la página pudo quedar desactualizada). Recárguela e inténtelo de nuevo.");
    return NextResponse.redirect(url, { status: 303 });
  }
  const siguienteExiste = siguientePasoNumero
    ? expediente.flujo.pasos.some((p) => p.numero === siguientePasoNumero)
    : false;

  const nuevoPasoNumero = siguienteExiste ? siguientePasoNumero! : expediente.pasoActualNumero;
  const resultadoValido =
    resultado && esEstadoValido(resultado) && ESTADOS_TERMINALES.includes(resultado) && resultadosDelPaso(pasoActual).includes(resultado)
      ? resultado
      : null;
  const nuevoEstado: EstadoExpediente =
    resultadoValido ?? (expediente.estado === "RADICADO" ? "EN_TRAMITE" : expediente.estado);

  // Condicional: si otra persona avanzó el trámite al mismo tiempo, este avance no se aplica dos veces.
  const { count } = await db.expediente.updateMany({
    where: { id, pasoActualNumero: expediente.pasoActualNumero, estado: expediente.estado, archivado: false },
    data: {
      pasoActualNumero: nuevoPasoNumero,
      estado: nuevoEstado,
      fechaUltimoMovimiento: new Date(),
      responsableActualId: session.userId,
      fechaCierre: ESTADOS_TERMINALES.includes(nuevoEstado) ? new Date() : null,
    },
  });
  if (count === 0) {
    const url = new URL(`/expedientes/${id}`, req.url);
    url.searchParams.set("error", "Otra persona avanzó o cambió este trámite al mismo tiempo. Recargue la página y revise el paso actual.");
    return NextResponse.redirect(url, { status: 303 });
  }

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
  await sincronizarAvisoVisita(id);

  return NextResponse.redirect(new URL(`/expedientes/${id}`, req.url), { status: 303 });
}
