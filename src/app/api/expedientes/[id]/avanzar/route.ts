import { NextRequest, NextResponse } from "next/server";
import { EstadoExpediente } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { puedeGestionarPaso } from "@/lib/cargos";
import { puedeEditarExpediente } from "@/lib/permisos";
import { ESTADOS_TERMINALES_EXPEDIENTE, tramiteFinalizado } from "@/lib/estados-expediente";
import { tramiteCerrado } from "@/lib/archivo-central";
import { sincronizarAvisoVisita } from "@/lib/notificaciones";
import { CIERRES_ANTICIPADOS, avanceValido, opcionFinalizar, resultadosDelPaso } from "@/lib/reglas-estado";

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
  const finalizar = form.get("finalizar") === "1";

  const expediente = await db.expediente.findUnique({
    where: { id },
    include: {
      flujo: { include: { pasos: { orderBy: { numero: "asc" } } } },
    },
  });
  if (!expediente) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const errorEn = (mensaje: string) => {
    const url = new URL(`/expedientes/${id}`, req.url);
    url.searchParams.set("error", mensaje);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (tramiteFinalizado(expediente)) {
    return errorEn("El trámite ya finalizó; para modificarlo, cambie primero el estado en la pestaña Administración.");
  }
  // Desistido/archivado/rechazado sin finalizar (p. ej. falta el auto de desistimiento): ese paso es
  // el último de esa rama; no se sigue con los pasos del trámite normal, solo se finaliza.
  const cierreAnticipado = (CIERRES_ANTICIPADOS as readonly string[]).includes(expediente.estado);

  const pasoActual = expediente.flujo.pasos.find((p) => p.numero === expediente.pasoActualNumero);

  if (pasoActual && !puedeGestionarPaso(session, pasoActual.responsables)) {
    const url = new URL(`/expedientes/${id}`, req.url);
    url.searchParams.set("error", "sin-permiso-paso");
    return NextResponse.redirect(url, { status: 303 });
  }

  const pasoDesde = form.get("pasoDesde") ? Number(form.get("pasoDesde")) : null;
  const siguientePasoNumero = siguientePasoRaw ? Number(siguientePasoRaw) : null;
  const desactualizado = "El avance pedido no corresponde al paso actual (la página pudo quedar desactualizada). Recárguela e inténtelo de nuevo.";
  if (pasoDesde !== null && pasoDesde !== expediente.pasoActualNumero) return errorEn(desactualizado);
  let resultadoFinal: EstadoExpediente | null = null;
  if (finalizar) {
    // «Finalizar trámite»: en el último paso (o en la rama de desistimiento/archivo).
    const opcion = opcionFinalizar(expediente.flujo.pasos, expediente.pasoActualNumero, expediente.estado);
    if (!opcion.puede || resultado || siguientePasoNumero !== null) return errorEn(desactualizado);
    if (opcion.resultados.length > 0) {
      const pedido = String(form.get("resultadoFinal") || "");
      if (!opcion.resultados.includes(pedido) || !esEstadoValido(pedido)) return errorEn(desactualizado);
      resultadoFinal = pedido;
    }
  } else if (cierreAnticipado) {
    return errorEn("El trámite ya quedó con estado final en este paso: use «Finalizar el trámite».");
  } else if (!avanceValido(expediente.flujo.pasos, expediente.pasoActualNumero, siguientePasoNumero, resultado)) {
    return errorEn(desactualizado);
  }
  const siguienteExiste = siguientePasoNumero
    ? expediente.flujo.pasos.some((p) => p.numero === siguientePasoNumero)
    : false;

  const nuevoPasoNumero = siguienteExiste ? siguientePasoNumero! : expediente.pasoActualNumero;
  const resultadoValido =
    resultado && esEstadoValido(resultado) && ESTADOS_TERMINALES.includes(resultado) && resultadosDelPaso(pasoActual).includes(resultado)
      ? resultado
      : null;
  // Una opción de decisión sin paso siguiente termina el trámite. Si su resultado no es un estado
  // del sistema (p. ej. «Da por terminado el trámite»), queda archivado en vez de quedar atascado.
  const decisionSinSiguiente = Boolean(pasoActual?.esDecision) && !finalizar && !siguienteExiste;
  const estadoActual = ESTADOS_TERMINALES.includes(expediente.estado) ? expediente.estado : null;
  const nuevoEstado: EstadoExpediente =
    resultadoFinal ??
    resultadoValido ??
    (decisionSinSiguiente ? (estadoActual ?? "ARCHIVADO") : expediente.estado === "RADICADO" ? "EN_TRAMITE" : expediente.estado);

  // El trámite finaliza (fechaCierre) al completar el último paso, o cuando la decisión no deja
  // pasos por delante (p. ej. «Archiva el trámite»). Aprobar/negar con notificación pendiente deja
  // el estado final pero sin fecha de cierre: el trámite sigue hasta notificar.
  const finaliza = finalizar || decisionSinSiguiente;

  // Condicional: si otra persona avanzó el trámite al mismo tiempo, este avance no se aplica dos veces.
  const { count } = await db.expediente.updateMany({
    where: { id, pasoActualNumero: expediente.pasoActualNumero, estado: expediente.estado, archivado: false, fechaCierre: expediente.fechaCierre },
    data: {
      pasoActualNumero: nuevoPasoNumero,
      estado: nuevoEstado,
      fechaUltimoMovimiento: new Date(),
      responsableActualId: session.userId,
      fechaCierre: finaliza ? new Date() : null,
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
      tipo: nuevoEstado !== expediente.estado ? "CAMBIO_ESTADO" : "AVANCE_PASO",
      descripcion: [descripcionBase, finaliza ? "Trámite finalizado." : "", comentario].filter(Boolean).join(" "),
      pasoNumero: pasoActual?.numero ?? null,
      estadoAnterior: expediente.estado,
      estadoNuevo: nuevoEstado,
      usuarioId: session.userId,
    },
  });
  await sincronizarAvisoVisita(id);

  return NextResponse.redirect(new URL(`/expedientes/${id}`, req.url), { status: 303 });
}
