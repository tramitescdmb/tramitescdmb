import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeEditarExpediente, puedePlanearVisitas } from "@/lib/permisos";
import { buildStoragePath, crearUrlSubidaFirmada } from "@/lib/storage";
import { TAMANO_MAXIMO_CONCEPTO_MB, TAMANO_MAXIMO_PLANO_MB, esRequisitoPlano, extensionPermitidaEn, mensajeTipoNoPermitidoEn } from "@/lib/uploads-config";
import { getConfiguracionSitio } from "@/lib/config-sitio";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const expedienteId = body?.expedienteId ? String(body.expedienteId) : "";
  const fileName = body?.fileName ? String(body.fileName) : "";
  const esExpedienteNuevo = body?.nuevo === true;

  if (!expedienteId || !fileName) {
    return NextResponse.json({ error: "Faltan expedienteId o fileName." }, { status: 400 });
  }

  const { extensionesPermitidas } = await getConfiguracionSitio();
  if (!extensionPermitidaEn(fileName, extensionesPermitidas)) {
    return NextResponse.json({ error: mensajeTipoNoPermitidoEn(fileName, extensionesPermitidas) }, { status: 400 });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(expedienteId)) {
    return NextResponse.json({ error: "El identificador del expediente no es válido." }, { status: 400 });
  }

  const expediente = await db.expediente.findUnique({ where: { id: expedienteId }, select: { id: true } });
  if (esExpedienteNuevo) {
    if (expediente) {
      return NextResponse.json({ error: "Ya existe un expediente con ese identificador." }, { status: 409 });
    }
    // Radicar exige poder editar algún trámite: sin eso no se suben archivos al NAS.
    const p = await obtenerPermisosUsuario(session.userId);
    if (!p.esAdmin && ![...p.tramites.values()].includes("EDITAR")) {
      return NextResponse.json({ error: "Su rol de acceso no le permite radicar trámites." }, { status: 403 });
    }
  } else if (!expediente) {
    return NextResponse.json({ error: "El expediente indicado no existe." }, { status: 404 });
  } else if (!(await puedeEditarExpediente(session.userId, expedienteId))) {
    // Sin permiso de gestión, solo quien participa en una visita del trámite (fotos y concepto) o quien planea visitas.
    const participa = await db.visitaProgramada.count({
      where: { expedienteId, OR: [{ profesionalId: session.userId }, { participantes: { some: { usuarioId: session.userId } } }] },
    });
    if (participa === 0 && !puedePlanearVisitas(await obtenerPermisosUsuario(session.userId))) {
      return NextResponse.json({ error: "Su rol de acceso no le permite subir archivos a este trámite." }, { status: 403 });
    }
  }

  // Solo el PDF del concepto técnico, y solo para quien puede finalizarlo, tiene un tope mayor.
  let topeMb: number | undefined;
  if (body?.conceptoTecnico === true) {
    if (esExpedienteNuevo || !fileName.toLowerCase().endsWith(".pdf") || !puedePlanearVisitas(await obtenerPermisosUsuario(session.userId))) {
      return NextResponse.json({ error: "Solo quien finaliza el concepto técnico puede subir su PDF." }, { status: 403 });
    }
    topeMb = TAMANO_MAXIMO_CONCEPTO_MB;
  } else if (typeof body?.requisitoPlanoId === "string" && body.requisitoPlanoId) {
    // Los planos aportados como requisito del trámite admiten hasta 10 MB.
    const requisito = await db.documentoRequeridoDefinicion.findUnique({ where: { id: body.requisitoPlanoId }, select: { nombre: true } });
    if (!requisito || !esRequisitoPlano(requisito.nombre)) {
      return NextResponse.json({ error: "El requisito indicado no es de planos." }, { status: 400 });
    }
    topeMb = TAMANO_MAXIMO_PLANO_MB;
  }

  const path = buildStoragePath(expedienteId, fileName);
  const { token } = await crearUrlSubidaFirmada(path, topeMb);

  return NextResponse.json({ path, token });
}
