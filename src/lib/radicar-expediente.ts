import { nombreFlujo } from "@/lib/flujo-nombre";
import { db } from "@/lib/db";
import { generarNumeroExpediente } from "@/lib/expedientes";
import { notificar, sincronizarAvisoVisita } from "@/lib/notificaciones";
import { iniciarFlujoAutomaticoEnObjeto } from "@/lib/flujos";
import { avisarRadicadoTramite } from "@/lib/avisos-externos";
import { esMunicipioValido, FUERA_DE_JURISDICCION } from "@/lib/municipios";
import { desdeLatLon, esLatLonValido } from "@/lib/coordenadas";
import { nombreCompletoSolicitante } from "@/lib/solicitante";
import { buscarSolicitantePorDocumento } from "@/lib/solicitante-db";
import { MENSAJE_RUTA_AJENA, inspeccionarDocumento, problemaArchivoSubido, rutaDeExpediente } from "@/lib/storage";
import { organizarTrasRegistro } from "@/lib/organizar-archivos";
import { resolverAvisoSolicitudVital, destinatariosSolicitudVital } from "@/lib/vital-gestion";
import { TAMANO_MAXIMO_BYTES, TAMANO_MAXIMO_PLANO_BYTES, esRequisitoPlano, extensionDe, extensionPermitida } from "@/lib/uploads-config";
import { MIME_POR_EXTENSION, contenidoCorrespondeAExtension } from "@/lib/solicitud-ambiental";

/**
 * Radicación de un expediente de Trámites 2.0. La usan la radicación de funcionarios
 * (POST /api/expedientes, incluida «Convertir en trámite» desde VITAL) y la vista pública
 * «Solicitud ambiental» (POST /api/solicitud-ambiental/radicar), con las mismas reglas de
 * datos obligatorios, documentos requeridos y almacenamiento en el NAS.
 */

export type DocumentoInput = {
  path: string;
  nombre: string;
  descripcion?: string | null;
  mimeType: string;
  tamanoBytes: number;
  documentoRequeridoId?: string;
  hashSha256?: string | null;
};

export type EntradaRadicacion = {
  id: string;
  solicitudVitalId?: string | null;
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
};

export type ResultadoRadicacion = { ok: true; id: string; numero: string } | { ok: false; error: string; status: number };

const REGIMENES = new Set(["RESPONSABLE_IVA", "NO_RESPONSABLE_IVA", "SIMPLE_TRIBUTACION", "REGIMEN_ESPECIAL", "OTRO"]);
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Tope de documentos por radicación en línea (requisitos + otros). */
export const MAX_DOCUMENTOS_SOLICITUD_PUBLICA = 40;

const falla = (error: string, status = 400): ResultadoRadicacion => ({ ok: false, error, status });

/** Texto recortado; vacío → null. Evita que un formulario público guarde textos desmedidos. */
function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t || null;
}

export async function radicarExpediente(
  body: EntradaRadicacion,
  opciones: {
    /** Quien radica: el funcionario en sesión o el usuario de sistema «Ventanilla virtual». */
    usuario: { id: string; nombre: string };
    /** Permiso del funcionario sobre el trámite (no aplica en la radicación en línea). */
    verificarPermiso?: (tramiteId: string, esConversionVital: boolean) => Promise<ResultadoRadicacion | null>;
    /** Radicación en línea desde la vista pública «Solicitud ambiental». */
    publico?: { numeroSolicitud: string; cuentaCiudadanaId?: string | null };
  }
): Promise<ResultadoRadicacion> {
  const { id: expedienteId, tramiteTipoId, flujoId, solicitante, municipio, predioDireccion, predio, claseSolicitud, ubicacion, solicitanteUbicacion, documentos } = body;
  const publico = opciones.publico ?? null;
  // En línea no se convierte nada de VITAL: se ignora aunque lo envíen.
  const solicitudVitalId = publico ? null : body.solicitudVitalId ?? null;

  if (!expedienteId || !tramiteTipoId || !flujoId || typeof solicitante?.identificacion !== "string" || !solicitante.identificacion.trim()) {
    return falla("Faltan campos obligatorios del solicitante.");
  }
  if (typeof solicitante.tipo !== "string") return falla("Indique el tipo de solicitante.");
  const esJuridica = solicitante.tipo === "JURIDICA";
  if (esJuridica ? !solicitante.razonSocial?.trim() : !solicitante.nombres?.trim() || !solicitante.apellidos?.trim()) {
    return falla(esJuridica ? "Falta la razón social del solicitante." : "Faltan los nombres o apellidos del solicitante.");
  }
  if (typeof solicitante.municipio !== "string" || !solicitante.municipio.trim()) return falla("Falta el municipio del solicitante.");
  if (typeof predioDireccion !== "string" || !predioDireccion.trim()) return falla("Falta la dirección donde se adelantará el trámite.");
  if (typeof municipio !== "string" || !esMunicipioValido(municipio)) return falla("El municipio debe ser uno de los 13 de la jurisdicción de la CDMB.");

  if (publico) {
    if (solicitante.municipio !== FUERA_DE_JURISDICCION && !esMunicipioValido(solicitante.municipio)) {
      return falla("Seleccione el municipio del solicitante de la lista.");
    }
    if (!/^[0-9.\-\s]{5,20}$/.test(solicitante.identificacion.trim())) {
      return falla(esJuridica ? "Escriba el NIT solo con números (puede incluir el dígito de verificación con guion)." : "Escriba la cédula solo con números.");
    }
    const correo = texto(solicitante.email, 200);
    if (correo && !CORREO_RE.test(correo)) return falla("El correo electrónico no es válido.");
    if (!correo && !texto(solicitante.telefono, 40)) {
      return falla("Indique al menos un medio de contacto (correo electrónico o teléfono) para poder comunicarle novedades de su solicitud.");
    }
  }

  const tramite = await db.tramiteTipo.findUnique({
    where: { id: String(tramiteTipoId) },
    include: {
      flujos: { include: { pasos: { orderBy: { numero: "asc" }, take: 1 } } },
      documentosRequeridos: true,
    },
  });
  if (!tramite || (publico && !tramite.activo)) return falla("Trámite no encontrado.", 404);

  if (opciones.verificarPermiso) {
    const negado = await opciones.verificarPermiso(tramite.id, Boolean(solicitudVitalId));
    if (negado) return negado;
  }

  const flujo = tramite.flujos.find((f) => f.id === flujoId);
  if (!flujo) return falla("Flujo no encontrado.", 404);

  // Radicación desde una solicitud de VITAL: sus anexos quedan enlazados desde VITAL
  // (no se copian al NAS), así que no se exige volver a subir los requisitos.
  const solicitudVital = solicitudVitalId
    ? await db.solicitudVital.findUnique({ where: { id: String(solicitudVitalId) }, select: { id: true, idVital: true, expedienteId: true } })
    : null;
  if (solicitudVitalId && !solicitudVital) return falla("No se encontró la solicitud de VITAL.", 404);
  if (solicitudVital?.expedienteId) return falla("Esta solicitud de VITAL ya se convirtió en trámite.", 409);

  // Solo cuentan los documentos con archivo: un requisito "aportado" sin archivo no cumple.
  const documentosValidos = (Array.isArray(documentos) ? documentos : []).filter(
    (d) => d && typeof d.path === "string" && d.path && typeof d.nombre === "string" && d.nombre.trim()
  );
  if (publico && documentosValidos.length > MAX_DOCUMENTOS_SOLICITUD_PUBLICA) {
    return falla(`Se admiten como máximo ${MAX_DOCUMENTOS_SOLICITUD_PUBLICA} documentos por solicitud.`);
  }
  const idsDocumentosAportados = new Set(documentosValidos.map((d) => d.documentoRequeridoId).filter((id): id is string => Boolean(id)));
  const documentosFaltantes = tramite.documentosRequeridos.filter(
    (d) => d.obligatorio && (d.aplicaA === null || d.aplicaA === solicitante.tipo) && !idsDocumentosAportados.has(d.id)
  );
  if (documentosFaltantes.length > 0 && !solicitudVital) {
    return falla(`Faltan documentos obligatorios para radicar: ${documentosFaltantes.map((d) => d.nombre).join(", ")}.`);
  }

  // El identificador lo genera el navegador (para la carpeta de los archivos): debe ser nuevo, o el trámite
  // compartiría carpeta con un contrato o expediente existente y podría registrar sus archivos.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expedienteId)) {
    return falla("Identificador de radicación no válido. Recargue la página.");
  }
  const [yaTramite, yaContrato, yaDocumental] = await Promise.all([
    db.expediente.count({ where: { id: expedienteId } }),
    db.expedienteContractual.count({ where: { id: expedienteId } }),
    db.expedienteDocumental.count({ where: { id: expedienteId } }),
  ]);
  if (yaTramite + yaContrato + yaDocumental > 0) return falla("Esta radicación ya se registró. Recargue la página antes de radicar otra.", 409);
  if (documentosValidos.some((d) => !rutaDeExpediente(d.path, expedienteId))) return falla(MENSAJE_RUTA_AJENA);
  if (new Set(documentosValidos.map((d) => d.path)).size !== documentosValidos.length) return falla("El mismo archivo aparece dos veces.");
  const requisitosDelTramite = new Map(tramite.documentosRequeridos.map((r) => [r.id, r]));
  if (documentosValidos.some((d) => d.documentoRequeridoId && !requisitosDelTramite.has(d.documentoRequeridoId))) {
    return falla("Uno de los documentos no corresponde a los requisitos de este trámite. Recargue la página.");
  }
  // Antes de tomar el número: cada archivo debe haber llegado al almacén (si no, el trámite quedaría con documentos rotos).
  for (const d of documentosValidos) {
    const problema = await problemaArchivoSubido(d.path, 0);
    if (problema) return falla(`«${d.nombre}»: ${problema}`, 409);
  }
  // En línea no se confía en lo que declara el navegador: tamaño real, tope por tipo de requisito y
  // contenido acorde con la extensión (un ejecutable renombrado a .pdf no pasa).
  if (publico) {
    for (const d of documentosValidos) {
      const nombre = d.nombre.trim().slice(0, 200);
      if (!extensionPermitida(nombre) || extensionDe(nombre) !== extensionDe(d.path)) return falla(`«${nombre}» no es un tipo de archivo permitido.`);
      const info = await inspeccionarDocumento(d.path);
      if (!info) return falla(`«${nombre}»: el archivo no terminó de subirse. Vuelva a subirlo.`, 409);
      const requisito = d.documentoRequeridoId ? requisitosDelTramite.get(d.documentoRequeridoId) : undefined;
      const tope = requisito && esRequisitoPlano(requisito.nombre) ? TAMANO_MAXIMO_PLANO_BYTES : TAMANO_MAXIMO_BYTES;
      if (info.tamano === 0) return falla(`«${nombre}» está vacío.`);
      if (info.tamano > tope) return falla(`«${nombre}» supera el tamaño máximo permitido (${tope / (1024 * 1024)} MB).`);
      if (!contenidoCorrespondeAExtension(nombre, info.cabecera)) {
        return falla(`«${nombre}» no parece un archivo ${extensionDe(nombre).toUpperCase()} válido. Revise el archivo y vuelva a cargarlo.`);
      }
      d.nombre = nombre;
      d.tamanoBytes = info.tamano;
      d.mimeType = MIME_POR_EXTENSION[extensionDe(nombre)] ?? "application/octet-stream";
      d.descripcion = texto(d.descripcion, 300);
    }
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
    const lat = punto?.lat == null ? null : Number(punto.lat);
    const lon = punto?.lon == null ? null : Number(punto.lon);
    if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) && esLatLonValido(lat, lon)) {
      const c = desdeLatLon(lat, lon);
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

  const identificacionSolicitante =
    (await buscarSolicitantePorDocumento(solicitante.identificacion, esJuridica ? "JURIDICA" : "NATURAL"))?.identificacion ?? solicitante.identificacion.trim().slice(0, 30);
  const nombresTrim = texto(solicitante.nombres, 120);
  const apellidosTrim = texto(solicitante.apellidos, 120);
  const razonSocialTrim = texto(solicitante.razonSocial, 200);
  const emailTrim = texto(solicitante.email, 200);
  const telefonoTrim = texto(solicitante.telefono, 40);
  const direccionTrim = texto(solicitante.direccion, 300);
  const municipioSolicitante = solicitante.municipio.trim().slice(0, 100);
  const representanteLegal = esJuridica ? texto(solicitante.representanteLegal, 200) : null;
  const representanteIdentificacion = esJuridica ? texto(solicitante.representanteIdentificacion, 30) : null;
  const regimen = solicitante.regimenTributario && REGIMENES.has(solicitante.regimenTributario) ? solicitante.regimenTributario : null;
  const granContribuyente = solicitante.granContribuyente === true;

  // En línea, un registro de solicitante existente no se modifica con lo que escriba cualquiera:
  // los datos que trae la solicitud quedan en el expediente y un funcionario los actualiza si corresponde.
  const solicitanteRecord = publico
    ? (await db.solicitante.findUnique({ where: { identificacion: identificacionSolicitante }, select: { id: true } })) ??
      (await db.solicitante.create({
        data: {
          tipo: esJuridica ? "JURIDICA" : "NATURAL",
          identificacion: identificacionSolicitante,
          nombres: nombresTrim,
          apellidos: apellidosTrim,
          razonSocial: razonSocialTrim,
          regimenTributario: regimen,
          granContribuyente,
          email: emailTrim,
          telefono: telefonoTrim,
          direccion: direccionTrim,
          municipio: municipioSolicitante,
          representanteLegal,
          representanteIdentificacion,
        },
        select: { id: true },
      }))
    : await db.solicitante.upsert({
        where: { identificacion: identificacionSolicitante },
        create: {
          tipo: esJuridica ? "JURIDICA" : "NATURAL",
          identificacion: identificacionSolicitante,
          nombres: nombresTrim,
          apellidos: apellidosTrim,
          razonSocial: razonSocialTrim,
          regimenTributario: regimen,
          granContribuyente,
          email: emailTrim,
          telefono: telefonoTrim,
          direccion: direccionTrim,
          municipio: municipioSolicitante,
          representanteLegal,
          representanteIdentificacion,
        },
        update: {
          nombres: nombresTrim ?? undefined,
          apellidos: apellidosTrim ?? undefined,
          razonSocial: razonSocialTrim ?? undefined,
          email: emailTrim ?? undefined,
          telefono: telefonoTrim ?? undefined,
          direccion: direccionTrim ?? undefined,
          municipio: municipioSolicitante || undefined,
          representanteLegal: representanteLegal ?? undefined,
          representanteIdentificacion: representanteIdentificacion ?? undefined,
          ...(regimen ? { regimenTributario: regimen } : {}),
          ...(solicitante.granContribuyente != null ? { granContribuyente } : {}),
        },
      });

  const nombreCompleto = nombreCompletoSolicitante({
    tipo: esJuridica ? "JURIDICA" : "NATURAL",
    nombres: nombresTrim,
    apellidos: apellidosTrim,
    razonSocial: razonSocialTrim,
  });

  const { usuario } = opciones;
  const descripcionCreacion = publico
    ? `Solicitud radicada en línea por el solicitante desde «Solicitud ambiental» (número de solicitud ${publico.numeroSolicitud}) para el trámite "${tramite.nombre}" (${nombreFlujo(flujo.nombre)}).`
    : `Expediente radicado por ${usuario.nombre} para el trámite "${tramite.nombre}" (${nombreFlujo(flujo.nombre)})${solicitudVital ? `, desde la solicitud VITAL n.º ${solicitudVital.idVital}` : ""}.`;

  const tipoDocumentalPorRequisito = new Map(tramite.documentosRequeridos.map((r) => [r.id, r.tipoDocumentalId]));
  // Expediente, evento y documentos en una sola transacción: si algo falla no queda un trámite radicado sin sus documentos.
  const VITAL_YA_CONVERTIDA = "VITAL_YA_CONVERTIDA";
  let expediente;
  try {
    expediente = await db.$transaction(async (tx) => {
      const creado = await tx.expediente.create({
        data: {
          id: expedienteId,
          numero,
          tramiteTipoId: tramite.id,
          flujoId: flujo.id,
          solicitanteId: solicitanteRecord.id,
          solicitanteTipo: esJuridica ? "JURIDICA" : "NATURAL",
          solicitanteNombre: nombreCompleto,
          solicitanteIdentificacion: identificacionSolicitante,
          solicitanteEmail: emailTrim,
          solicitanteTelefono: telefonoTrim,
          solicitanteDireccion: direccionTrim,
          predioDireccion: predioDireccion.trim().slice(0, 300),
          predioNombre: texto(predio?.nombre, 200),
          predioCatastral: texto(predio?.catastral, 60),
          predioMatricula: texto(predio?.matricula, 60),
          predioAreaM2: numeroONulo(predio?.areaM2),
          predioAreaCultivosM2: numeroONulo(predio?.areaCultivosM2),
          predioAreaBosqueM2: numeroONulo(predio?.areaBosqueM2),
          predioViviendas: numeroONulo(predio?.viviendas, true),
          claseSolicitud: claseSolicitud === "NUEVA" || claseSolicitud === "RENOVACION" ? claseSolicitud : null,
          municipio,
          ...datosUbicacion,
          subserieId: tramite.subserieId,
          estado: "RADICADO",
          pasoActualNumero: primerPaso,
          createdById: usuario.id,
          // En línea nadie lo tiene todavía: lo toma quien reciba el aviso.
          responsableActualId: publico ? null : usuario.id,
          codigoSolicitudPublica: publico?.numeroSolicitud ?? null,
          cuentaCiudadanaId: publico?.cuentaCiudadanaId ?? null,
        },
      });

      await tx.expedienteEvento.create({
        data: {
          expedienteId: creado.id,
          tipo: "CREACION",
          descripcion: descripcionCreacion,
          estadoNuevo: "RADICADO",
          usuarioId: usuario.id,
        },
      });

      if (documentosValidos.length > 0) {
        await tx.expedienteDocumento.createMany({
          data: documentosValidos.map((d) => ({
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
            subidoPorId: usuario.id,
          })),
        });
      }
      if (solicitudVital) {
        const marcada = await tx.solicitudVital.updateMany({
          where: { id: solicitudVital.id, expedienteId: null },
          data: { gestion: "CONVERTIDA", expedienteId: creado.id, gestionadaEn: new Date(), gestionadaPorId: usuario.id, motivoDescarte: null },
        });
        if (marcada.count !== 1) throw new Error(VITAL_YA_CONVERTIDA);
      }
      return creado;
    });
  } catch (err) {
    if (err instanceof Error && err.message === VITAL_YA_CONVERTIDA) return falla("Esta solicitud de VITAL ya se convirtió en trámite.", 409);
    throw err;
  }
  if (solicitudVital) await resolverAvisoSolicitudVital(solicitudVital.id).catch(() => {});
  await organizarTrasRegistro({ tipo: "tramite", id: expediente.id });
  await sincronizarAvisoVisita(expediente.id);
  await iniciarFlujoAutomaticoEnObjeto("TRAMITE", expediente.id, usuario.id).catch((e) => console.error("iniciarFlujoAutomaticoEnObjeto falló:", e));
  if (publico) {
    // Mismos destinatarios que una solicitud nueva de VITAL: administradores y Subdirector(a) SEYCA.
    await notificar(await destinatariosSolicitudVital(), {
      tipo: "SOLICITUD_AMBIENTAL_NUEVA",
      clave: `solicitud-ambiental:${expediente.id}`,
      titulo: `Nueva solicitud ambiental en línea · ${expediente.numero}`,
      mensaje: `${tramite.nombre} — ${nombreCompleto}. Radicada por el solicitante desde la vista pública.`,
      enlace: `/expedientes/${expediente.id}`,
      expedienteId: expediente.id,
    }).catch((e) => console.error("Aviso de solicitud ambiental en línea falló:", e));
  }
  avisarRadicadoTramite({
    id: expediente.id,
    numero: expediente.numero,
    tramite: tramite.nombre,
    solicitante: nombreCompleto,
    correo: expediente.solicitanteEmail,
    fecha: expediente.createdAt,
    numeroSolicitud: publico?.numeroSolicitud ?? null,
  });

  return { ok: true, id: expediente.id, numero: expediente.numero };
}
