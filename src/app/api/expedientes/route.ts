import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { generarNumeroExpediente } from "@/lib/expedientes";
import { sincronizarAvisoVisita } from "@/lib/notificaciones";
import { iniciarFlujoAutomaticoEnObjeto } from "@/lib/flujos";
import { avisarRadicadoTramite } from "@/lib/avisos-externos";
import { esMunicipioValido } from "@/lib/municipios";
import { desdeLatLon, esLatLonValido } from "@/lib/coordenadas";
import { nombreCompletoSolicitante } from "@/lib/solicitante";
import { buscarSolicitantePorDocumento } from "@/lib/solicitante-db";
import { obtenerPermisosUsuario, puedeEditarTramite } from "@/lib/permisos";
import { MENSAJE_RUTA_AJENA, problemaArchivoSubido, rutaDeExpediente } from "@/lib/storage";

type DocumentoInput = {
  path: string;
  nombre: string;
  descripcion?: string | null;
  mimeType: string;
  tamanoBytes: number;
  documentoRequeridoId?: string;
  hashSha256?: string | null;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const {
    id: expedienteId,
    tramiteTipoId,
    flujoId,
    solicitante,
    municipio,
    predioDireccion,
    predio,
    claseSolicitud,
    ubicacion,
    solicitanteUbicacion,
    documentos,
  }: {
    id: string;
    tramiteTipoId: string;
    flujoId: string;
    solicitante: {
      tipo: "NATURAL" | "JURIDICA";
      nombres?: string;
      apellidos?: string;
      razonSocial?: string;
      representanteLegal?: string;
      representanteIdentificacion?: string;
      identificacion: string;
      email?: string;
      telefono?: string;
      direccion?: string;
      municipio: string;
      regimenTributario?: "RESPONSABLE_IVA" | "NO_RESPONSABLE_IVA" | "SIMPLE_TRIBUTACION" | "REGIMEN_ESPECIAL" | "OTRO" | null;
      granContribuyente?: boolean;
    };
    municipio: string;
    predioDireccion: string;
    predio?: {
      nombre?: string;
      catastral?: string;
      matricula?: string;
      areaM2?: number | null;
      areaCultivosM2?: number | null;
      areaBosqueM2?: number | null;
      viviendas?: number | null;
    };
    claseSolicitud?: "NUEVA" | "RENOVACION" | null;
    ubicacion?: { lat: number | null; lon: number | null };
    solicitanteUbicacion?: { lat: number | null; lon: number | null };
    documentos: DocumentoInput[];
  } = body;

  if (!expedienteId || !tramiteTipoId || !flujoId || !solicitante?.identificacion?.trim()) {
    return NextResponse.json({ error: "Faltan campos obligatorios del solicitante." }, { status: 400 });
  }
  const esJuridica = solicitante.tipo === "JURIDICA";
  if (esJuridica ? !solicitante.razonSocial?.trim() : !solicitante.nombres?.trim() || !solicitante.apellidos?.trim()) {
    return NextResponse.json(
      { error: esJuridica ? "Falta la razón social del solicitante." : "Faltan los nombres o apellidos del solicitante." },
      { status: 400 }
    );
  }
  if (!solicitante.municipio?.trim()) {
    return NextResponse.json({ error: "Falta el municipio del solicitante." }, { status: 400 });
  }
  if (!predioDireccion?.trim()) {
    return NextResponse.json({ error: "Falta la dirección donde se adelantará el trámite." }, { status: 400 });
  }

  if (!esMunicipioValido(municipio)) {
    return NextResponse.json(
      { error: "El municipio debe ser uno de los 13 de la jurisdicción de la CDMB." },
      { status: 400 }
    );
  }

  const tramite = await db.tramiteTipo.findUnique({
    where: { id: tramiteTipoId },
    include: {
      flujos: { include: { pasos: { orderBy: { numero: "asc" }, take: 1 } } },
      documentosRequeridos: true,
    },
  });
  if (!tramite) return NextResponse.json({ error: "Trámite no encontrado." }, { status: 404 });

  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeEditarTramite(permisos, tramite.id)) {
    return NextResponse.json({ error: "No tiene permiso de edición sobre este trámite." }, { status: 403 });
  }

  const flujo = tramite.flujos.find((f) => f.id === flujoId);
  if (!flujo) return NextResponse.json({ error: "Flujo no encontrado." }, { status: 404 });

  // Solo cuentan los documentos con archivo: un requisito "aportado" sin archivo no cumple.
  const documentosValidos = (Array.isArray(documentos) ? documentos : []).filter(
    (d) => d && typeof d.path === "string" && d.path && typeof d.nombre === "string" && d.nombre.trim()
  );
  const idsDocumentosAportados = new Set(
    documentosValidos.map((d) => d.documentoRequeridoId).filter((id): id is string => Boolean(id))
  );
  const documentosFaltantes = tramite.documentosRequeridos.filter(
    (d) => d.obligatorio && (d.aplicaA === null || d.aplicaA === solicitante.tipo) && !idsDocumentosAportados.has(d.id)
  );
  if (documentosFaltantes.length > 0) {
    return NextResponse.json(
      { error: `Faltan documentos obligatorios para radicar: ${documentosFaltantes.map((d) => d.nombre).join(", ")}.` },
      { status: 400 }
    );
  }

  // El identificador lo genera el navegador (para la carpeta de los archivos): debe ser nuevo, o el trámite
  // compartiría carpeta con un contrato o expediente existente y podría registrar sus archivos.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expedienteId)) {
    return NextResponse.json({ error: "Identificador de radicación no válido. Recargue la página." }, { status: 400 });
  }
  const [yaTramite, yaContrato, yaDocumental] = await Promise.all([
    db.expediente.count({ where: { id: expedienteId } }),
    db.expedienteContractual.count({ where: { id: expedienteId } }),
    db.expedienteDocumental.count({ where: { id: expedienteId } }),
  ]);
  if (yaTramite + yaContrato + yaDocumental > 0) {
    return NextResponse.json({ error: "Esta radicación ya se registró. Recargue la página antes de radicar otra." }, { status: 409 });
  }
  if (documentosValidos.some((d) => !rutaDeExpediente(d.path, expedienteId))) {
    return NextResponse.json({ error: MENSAJE_RUTA_AJENA }, { status: 400 });
  }
  if (new Set(documentosValidos.map((d) => d.path)).size !== documentosValidos.length) {
    return NextResponse.json({ error: "El mismo archivo aparece dos veces." }, { status: 400 });
  }
  const requisitosDelTramite = new Set(tramite.documentosRequeridos.map((r) => r.id));
  if (documentosValidos.some((d) => d.documentoRequeridoId && !requisitosDelTramite.has(d.documentoRequeridoId))) {
    return NextResponse.json({ error: "Uno de los documentos no corresponde a los requisitos de este trámite. Recargue la página." }, { status: 400 });
  }
  // Antes de tomar el número: cada archivo debe haber llegado al almacén (si no, el trámite quedaría con documentos rotos).
  for (const d of documentosValidos) {
    const problema = await problemaArchivoSubido(d.path, 0);
    if (problema) return NextResponse.json({ error: `«${d.nombre}»: ${problema}` }, { status: 409 });
  }
  const numeroONulo = (v: unknown, entero = false): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return entero ? Math.round(n) : n;
  };

  const primerPaso = flujo.pasos[0]?.numero ?? 1;
  const numero = await generarNumeroExpediente(tramite.codigo);

  function calcularUbicacion(prefijo: string, punto?: { lat: number | null; lon: number | null }) {
    const datos: Record<string, number | null> = {
      [`${prefijo}Lat`]: null,
      [`${prefijo}Lon`]: null,
      [`${prefijo}PlanaX`]: null,
      [`${prefijo}PlanaY`]: null,
      [`${prefijo}CartesianaX`]: null,
      [`${prefijo}CartesianaY`]: null,
      [`${prefijo}CartesianaZ`]: null,
    };
    if (punto?.lat != null && punto?.lon != null && esLatLonValido(punto.lat, punto.lon)) {
      const c = desdeLatLon(punto.lat, punto.lon);
      datos[`${prefijo}Lat`] = c.lat;
      datos[`${prefijo}Lon`] = c.lon;
      datos[`${prefijo}PlanaX`] = c.planaX;
      datos[`${prefijo}PlanaY`] = c.planaY;
      datos[`${prefijo}CartesianaX`] = c.cartesianaX;
      datos[`${prefijo}CartesianaY`] = c.cartesianaY;
      datos[`${prefijo}CartesianaZ`] = c.cartesianaZ;
    }
    return datos;
  }

  const datosUbicacion = {
    ...calcularUbicacion("ubicacion", ubicacion),
    ...calcularUbicacion("solicitanteUbicacion", solicitanteUbicacion),
  };

  const identificacionSolicitante = (await buscarSolicitantePorDocumento(solicitante.identificacion, esJuridica ? "JURIDICA" : "NATURAL"))?.identificacion ?? solicitante.identificacion.trim();
  const nombresTrim = solicitante.nombres?.trim() || null;
  const apellidosTrim = solicitante.apellidos?.trim() || null;
  const razonSocialTrim = solicitante.razonSocial?.trim() || null;
  const representanteLegal = esJuridica ? String(solicitante.representanteLegal ?? "").trim().slice(0, 200) || null : null;
  const representanteIdentificacion = esJuridica ? String(solicitante.representanteIdentificacion ?? "").trim().slice(0, 30) || null : null;
  const solicitanteRecord = await db.solicitante.upsert({
    where: { identificacion: identificacionSolicitante },
    create: {
      tipo: solicitante.tipo === "JURIDICA" ? "JURIDICA" : "NATURAL",
      identificacion: identificacionSolicitante,
      nombres: nombresTrim,
      apellidos: apellidosTrim,
      razonSocial: razonSocialTrim,
      regimenTributario: solicitante.regimenTributario || null,
      granContribuyente: Boolean(solicitante.granContribuyente),
      email: solicitante.email?.trim() || null,
      telefono: solicitante.telefono?.trim() || null,
      direccion: solicitante.direccion?.trim() || null,
      municipio: solicitante.municipio.trim(),
      representanteLegal,
      representanteIdentificacion,
    },
    update: {
      nombres: nombresTrim ?? undefined,
      apellidos: apellidosTrim ?? undefined,
      razonSocial: razonSocialTrim ?? undefined,
      email: solicitante.email?.trim() || undefined,
      telefono: solicitante.telefono?.trim() || undefined,
      direccion: solicitante.direccion?.trim() || undefined,
      municipio: solicitante.municipio.trim() || undefined,
      representanteLegal: representanteLegal ?? undefined,
      representanteIdentificacion: representanteIdentificacion ?? undefined,
      ...(solicitante.regimenTributario ? { regimenTributario: solicitante.regimenTributario } : {}),
      ...(solicitante.granContribuyente != null ? { granContribuyente: solicitante.granContribuyente } : {}),
    },
  });

  const nombreCompleto = nombreCompletoSolicitante({
    tipo: solicitante.tipo,
    nombres: nombresTrim,
    apellidos: apellidosTrim,
    razonSocial: razonSocialTrim,
  });

  const tipoDocumentalPorRequisito = new Map(tramite.documentosRequeridos.map((r) => [r.id, r.tipoDocumentalId]));
  // Expediente, evento y documentos en una sola transacción: si algo falla no queda un trámite radicado sin sus documentos.
  const expediente = await db.$transaction(async (tx) => {
    const creado = await tx.expediente.create({
      data: {
        id: expedienteId,
        numero,
        tramiteTipoId: tramite.id,
        flujoId: flujo.id,
        solicitanteId: solicitanteRecord.id,
        solicitanteTipo: solicitante.tipo === "JURIDICA" ? "JURIDICA" : "NATURAL",
        solicitanteNombre: nombreCompleto,
        solicitanteIdentificacion: identificacionSolicitante,
        solicitanteEmail: solicitante.email?.trim() || null,
        solicitanteTelefono: solicitante.telefono?.trim() || null,
        solicitanteDireccion: solicitante.direccion?.trim() || null,
        predioDireccion: predioDireccion.trim(),
        predioNombre: predio?.nombre?.trim() || null,
        predioCatastral: predio?.catastral?.trim() || null,
        predioMatricula: predio?.matricula?.trim() || null,
        predioAreaM2: numeroONulo(predio?.areaM2),
        predioAreaCultivosM2: numeroONulo(predio?.areaCultivosM2),
        predioAreaBosqueM2: numeroONulo(predio?.areaBosqueM2),
        predioViviendas: numeroONulo(predio?.viviendas, true),
        claseSolicitud: claseSolicitud || null,
        municipio,
        ...datosUbicacion,
        subserieId: tramite.subserieId,
        estado: "RADICADO",
        pasoActualNumero: primerPaso,
        createdById: session.userId,
        responsableActualId: session.userId,
      },
  });

  await tx.expedienteEvento.create({
    data: {
      expedienteId: creado.id,
      tipo: "CREACION",
      descripcion: `Expediente radicado por ${session.nombre} para el trámite "${tramite.nombre}" (flujo: ${flujo.nombre}).`,
      estadoNuevo: "RADICADO",
      usuarioId: session.userId,
    },
  });

  if (documentosValidos.length > 0) {
    await tx.expedienteDocumento.createMany({
      data: documentosValidos
        .map((d) => ({
          expedienteId: creado.id,
          pasoNumero: null,
          requisitoId: d.documentoRequeridoId || null,
          tipoDocumentalId: d.documentoRequeridoId ? tipoDocumentalPorRequisito.get(d.documentoRequeridoId) ?? null : null,
          nombre: d.nombre,
          descripcion: d.descripcion || null,
          storagePath: d.path,
          mimeType: d.mimeType || "application/octet-stream",
          tamanoBytes: d.tamanoBytes || 0,
          hashSha256: typeof d.hashSha256 === "string" && /^[0-9a-f]{64}$/.test(d.hashSha256) ? d.hashSha256 : null,
          subidoPorId: session.userId,
        })),
    });
  }
  return creado;
  });
  await sincronizarAvisoVisita(expediente.id);
  await iniciarFlujoAutomaticoEnObjeto("TRAMITE", expediente.id, session.userId).catch((e) => console.error("iniciarFlujoAutomaticoEnObjeto falló:", e));
  avisarRadicadoTramite({
    id: expediente.id,
    numero: expediente.numero,
    tramite: tramite.nombre,
    solicitante: nombreCompleto,
    correo: expediente.solicitanteEmail,
    fecha: expediente.createdAt,
  });

  return NextResponse.json({ id: expediente.id, numero: expediente.numero });
}
