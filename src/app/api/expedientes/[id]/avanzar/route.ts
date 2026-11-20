import { NextRequest, NextResponse } from "next/server";
import { EstadoExpediente } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { puedeGestionarPaso } from "@/lib/cargos";
import { puedeEditarExpediente } from "@/lib/permisos";
import { ESTADOS_TERMINALES_EXPEDIENTE, tramiteFinalizado } from "@/lib/estados-expediente";
import { documentosObligatoriosFaltantes } from "@/lib/documentos-obligatorios-paso";
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
  const finalizar = form.get("finalizar") === "1";

  const expediente = await db.expediente.findUnique({
    where: { id },
    include: {
      flujo: { include: { pasos: { orderBy: { numero: "asc" } } } },
      tramiteTipo: { select: { codigo: true } },
      documentos: { select: { pasoNumero: true, descripcion: true } },
      visitasTecnicas: { select: { pasoNumero: true } },
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
  // Resuelto (aprobado/negado) con pasos por cumplir: solo se puede seguir al paso siguiente o finalizar.
  const resuelto = ESTADOS_TERMINALES.includes(expediente.estado);
  if (resuelto && resultado) {
    return errorEn("La decisión del trámite ya está registrada; continúe con los pasos que faltan (notificación).");
  }

  const pasoActual = expediente.flujo.pasos.find((p) => p.numero === expediente.pasoActualNumero);

  if (pasoActual && !puedeGestionarPaso(session, pasoActual.responsables)) {
    const url = new URL(`/expedientes/${id}`, req.url);
    url.searchParams.set("error", "sin-permiso-paso");
    return NextResponse.redirect(url, { status: 303 });
  }

  const pasoDesde = form.get("pasoDesde") ? Number(form.get("pasoDesde")) : null;
  const siguientePasoNumero = siguientePasoRaw ? Number(siguientePasoRaw) : null;
  const hayPasoSiguiente = expediente.flujo.pasos.some((p) => p.numero > expediente.pasoActualNumero);
  const desactualizado = "El avance pedido no corresponde al paso actual (la página pudo quedar desactualizada). Recárguela e inténtelo de nuevo.";
  if (pasoDesde !== null && pasoDesde !== expediente.pasoActualNumero) return errorEn(desactualizado);
  if (finalizar) {
    // «Finalizar trámite»: solo en el último paso y con la decisión ya tomada.
    if (hayPasoSiguiente || resultado || siguientePasoNumero !== null) return errorEn(desactualizado);
    if (!resuelto) return errorEn("Para finalizar, el trámite debe tener primero su estado final (defínalo en la pestaña Administración).");
  } else if (!avanceValido(expediente.flujo.pasos, expediente.pasoActualNumero, siguientePasoNumero, resultado)) {
    return errorEn(desactualizado);
  }
  const siguienteExiste = siguientePasoNumero
    ? expediente.flujo.pasos.some((p) => p.numero === siguientePasoNumero)
    : false;

  if (pasoActual) {
    const faltan = documentosObligatoriosFaltantes(
      expediente.tramiteTipo.codigo,
      pasoActual,
      expediente.documentos,
      resultado,
      expediente.visitasTecnicas.some((v) => v.pasoNumero === pasoActual.numero)
    );
    if (faltan.length > 0) {
      return errorEn(
        `Antes de completar el paso ${pasoActual.numero} cargue ${faltan.length === 1 ? "el documento obligatorio" : "los documentos obligatorios"}: ${faltan.join("; ")}.`
      );
    }
  }

  const nuevoPasoNumero = siguienteExiste ? siguientePasoNumero! : expediente.pasoActualNumero;
  const resultadoValido =
    resultado && esEstadoValido(resultado) && ESTADOS_TERMINALES.includes(resultado) && resultadosDelPaso(pasoActual).includes(resultado)
      ? resultado
      : null;
  const nuevoEstado: EstadoExpediente =
    resultadoValido ?? (expediente.estado === "RADICADO" ? "EN_TRAMITE" : expediente.estado);

  // El trámite finaliza (fechaCierre) al completar el último paso, o cuando la decisión no deja
  // pasos por delante (p. ej. «Archiva el trámite»). Aprobar/negar con notificación pendiente deja
  // el estado final pero sin fecha de cierre: el trámite sigue hasta notificar.
  const finaliza = finalizar || (resultadoValido !== null && !siguienteExiste);

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
      tipo: resultadoValido ? "CAMBIO_ESTADO" : "AVANCE_PASO",
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
