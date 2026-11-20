import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarLimiteEnvio } from "@/lib/anti-abuso";
import { datosPeticion, registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import { origenPermitido } from "@/lib/cuenta-ciudadana";
import { cuentaEnSesion } from "@/lib/cuenta-ciudadana-db";
import { estadoTrasRespuesta } from "@/lib/correccion-solicitud";
import { notificar } from "@/lib/notificaciones";
import { organizarTrasRegistro } from "@/lib/organizar-archivos";
import { MIME_POR_EXTENSION, contenidoCorrespondeAExtension } from "@/lib/solicitud-ambiental";
import { usuarioVentanillaVirtual } from "@/lib/solicitud-ambiental-db";
import { MENSAJE_RUTA_AJENA, inspeccionarDocumento, problemaArchivoSubido, rutaDeExpediente } from "@/lib/storage";
import { TAMANO_MAXIMO_BYTES, TAMANO_MAXIMO_PLANO_BYTES, esRequisitoPlano, extensionDe, extensionPermitida } from "@/lib/uploads-config";

type Archivo = { itemId?: unknown; path?: unknown; nombre?: unknown; hashSha256?: unknown };

/**
 * El ciudadano envía los documentos corregidos. Debe responder todos los ítems de la devolución.
 * Los documentos originales se conservan; los nuevos quedan enlazados al ítem y la solicitud vuelve
 * a revisión en el mismo expediente.
 */
export async function POST(req: NextRequest) {
  if (!origenPermitido(req.headers)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 403 });
  const cuenta = await cuentaEnSesion();
  if (!cuenta?.completa) return NextResponse.json({ error: "Su sesión terminó. Ingrese de nuevo." }, { status: 401 });
  const { ip, userAgent } = datosPeticion(req.headers);
  const limite = await verificarLimiteEnvio(ip, "solicitud-ambiental:correccion-responder", { porHora: 10, porDia: 30 });
  if (!limite.permitido) return NextResponse.json({ error: limite.motivo }, { status: 429 });

  const body = await req.json().catch(() => null);
  const expedienteId = typeof body?.expedienteId === "string" ? body.expedienteId : "";
  const archivos: Archivo[] = Array.isArray(body?.archivos) ? body.archivos.slice(0, 50) : [];

  const r = await db.requerimientoCorreccion.findFirst({
    where: { expedienteId, estado: "PENDIENTE", expediente: { cuentaCiudadanaId: cuenta.id } },
    select: {
      id: true,
      estadoAnterior: true,
      creadoPorId: true,
      expediente: { select: { numero: true, codigoSolicitudPublica: true, responsableActualId: true } },
      items: {
        select: {
          id: true,
          titulo: true,
          requisitoId: true,
          reemplazoId: true,
          requisito: { select: { nombre: true, tipoDocumentalId: true } },
          documento: { select: { tipoDocumentalId: true } },
        },
      },
    },
  });
  if (!r) return NextResponse.json({ error: "No hay una corrección pendiente en esta solicitud. Recargue la página." }, { status: 404 });

  const porItem = new Map<string, Archivo>();
  for (const a of archivos) if (typeof a?.itemId === "string") porItem.set(a.itemId, a);
  const pendientes = r.items.filter((i) => !i.reemplazoId);
  const faltan = pendientes.filter((i) => !porItem.has(i.id));
  if (faltan.length > 0) return NextResponse.json({ error: `Falta cargar: ${faltan.map((i) => i.titulo).join("; ")}.` }, { status: 400 });

  const nuevos: { itemId: string; path: string; nombre: string; tamano: number; mime: string; hash: string | null; requisitoId: string | null; tipoDocumentalId: string | null }[] = [];
  for (const i of pendientes) {
    const a = porItem.get(i.id)!;
    const path = typeof a.path === "string" ? a.path : "";
    const nombre = typeof a.nombre === "string" ? a.nombre.trim().slice(0, 200) : "";
    if (!path || !nombre || !rutaDeExpediente(path, expedienteId)) return NextResponse.json({ error: MENSAJE_RUTA_AJENA }, { status: 400 });
    if (!extensionPermitida(nombre) || extensionDe(nombre) !== extensionDe(path)) return NextResponse.json({ error: `«${nombre}» no es un tipo de archivo permitido.` }, { status: 400 });
    const problema = await problemaArchivoSubido(path, await db.expedienteDocumento.count({ where: { storagePath: path } }));
    if (problema) return NextResponse.json({ error: `«${nombre}»: ${problema}` }, { status: 409 });
    const info = await inspeccionarDocumento(path);
    if (!info) return NextResponse.json({ error: `«${nombre}»: el archivo no terminó de subirse. Vuelva a subirlo.` }, { status: 409 });
    const tope = esRequisitoPlano(i.requisito?.nombre ?? i.titulo) ? TAMANO_MAXIMO_PLANO_BYTES : TAMANO_MAXIMO_BYTES;
    if (info.tamano === 0 || info.tamano > tope) return NextResponse.json({ error: `«${nombre}» está vacío o supera el tamaño permitido.` }, { status: 400 });
    if (!contenidoCorrespondeAExtension(nombre, info.cabecera)) {
      return NextResponse.json({ error: `«${nombre}» no parece un archivo ${extensionDe(nombre).toUpperCase()} válido.` }, { status: 400 });
    }
    nuevos.push({
      itemId: i.id,
      path,
      nombre,
      tamano: info.tamano,
      mime: MIME_POR_EXTENSION[extensionDe(nombre)] ?? "application/octet-stream",
      hash: typeof a.hashSha256 === "string" && /^[0-9a-f]{64}$/.test(a.hashSha256) ? a.hashSha256 : null,
      requisitoId: i.requisitoId,
      tipoDocumentalId: i.documento?.tipoDocumentalId ?? i.requisito?.tipoDocumentalId ?? null,
    });
  }
  if (new Set(nuevos.map((n) => n.path)).size !== nuevos.length) return NextResponse.json({ error: "El mismo archivo aparece dos veces." }, { status: 400 });

  const ventanilla = await usuarioVentanillaVirtual();
  const ahora = new Date();
  const estadoNuevo = estadoTrasRespuesta(r.estadoAnterior);
  const ok = await db.$transaction(async (tx) => {
    const marcado = await tx.requerimientoCorreccion.updateMany({ where: { id: r.id, estado: "PENDIENTE" }, data: { estado: "RESPONDIDO", respondidoEn: ahora } });
    if (marcado.count !== 1) return false;
    for (const n of nuevos) {
      const doc = await tx.expedienteDocumento.create({
        data: {
          expedienteId,
          requisitoId: n.requisitoId,
          tipoDocumentalId: n.tipoDocumentalId,
          nombre: n.nombre,
          descripcion: "Documento corregido aportado por el solicitante.",
          storagePath: n.path,
          mimeType: n.mime,
          tamanoBytes: n.tamano,
          hashSha256: n.hash,
          subidoPorId: ventanilla.id,
        },
        select: { id: true },
      });
      await tx.itemCorreccion.update({ where: { id: n.itemId }, data: { reemplazoId: doc.id } });
    }
    await tx.expediente.updateMany({ where: { id: expedienteId, estado: "INFORMACION_ADICIONAL_REQUERIDA" }, data: { estado: estadoNuevo, fechaUltimoMovimiento: ahora } });
    await tx.expedienteEvento.create({
      data: {
        expedienteId,
        tipo: "CORRECCION_RECIBIDA",
        descripcion: `El solicitante envió en línea ${nuevos.length} documento${nuevos.length === 1 ? "" : "s"} corregido${nuevos.length === 1 ? "" : "s"}: ${nuevos.map((n) => n.nombre).join("; ")}.`,
        estadoAnterior: "INFORMACION_ADICIONAL_REQUERIDA",
        estadoNuevo,
        usuarioId: ventanilla.id,
      },
    });
    return true;
  });
  if (!ok) return NextResponse.json({ error: "La corrección ya se había enviado. Recargue la página." }, { status: 409 });

  await registrarAuditoriaDoc({
    entidad: "Expediente",
    entidadId: expedienteId,
    accion: "MODIFICA",
    usuarioId: null,
    ip,
    userAgent,
    detalle: `El solicitante respondió en línea la devolución de la solicitud ${r.expediente.codigoSolicitudPublica} (${r.expediente.numero})`,
  });
  await organizarTrasRegistro({ tipo: "tramite", id: expedienteId });
  const destinatarios = [r.creadoPorId, r.expediente.responsableActualId].filter((x): x is string => Boolean(x));
  await notificar(destinatarios, {
    tipo: "CORRECCION_RECIBIDA",
    clave: `correccion-recibida:${r.id}`,
    titulo: `Corrección recibida · ${r.expediente.numero}`,
    mensaje: `El solicitante envió los documentos corregidos de la solicitud ${r.expediente.codigoSolicitudPublica}.`,
    enlace: `/expedientes/${expedienteId}`,
    expedienteId,
  }).catch((e) => console.error("Aviso de corrección recibida falló:", e));
  return NextResponse.json({ ok: true });
}
