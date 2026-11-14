/**
 * Mueve los archivos de un expediente, contrato, trámite, radicado o solicitud VITAL a su carpeta por
 * módulo/año/tipo (carpetas-almacen.ts) y actualiza la ruta en la base. Se llama al registrar
 * documentos: lo recién subido sale de `_subidas/` y, si el contrato o trámite cambió de carpeta
 * (p. ej. se le asignó el número de contrato), sus demás archivos pasan a la carpeta nueva.
 *
 * Reglas:
 * - El contenido del archivo no cambia: la huella SHA-256 y las firmas siguen valiendo.
 * - Nunca se pisa un archivo: si el nombre existe se usa "nombre_2.pdf".
 * - Un mismo archivo puede estar registrado en varias filas (p. ej. los adjuntos de la respuesta de
 *   un radicado se reutilizan en el oficio de salida): se actualizan todas. Si ya está en la carpeta de
 *   otro módulo/expediente y lo comparte, no se mueve.
 * - Si la fila cambió mientras se movía, el archivo vuelve a su lugar. (Caso raro: si en ese instante se
 *   reemplazó el archivo del documento, la versión vieja puede quedar sin fila en el NAS; no afecta nada.)
 * - Nunca lanza: un fallo deja el archivo donde estaba (su ruta vieja sigue sirviendo) y se registra.
 */
import { db } from "@/lib/db";
import { limpiarCarpetasVacias, mover } from "@/lib/almacen";
import {
  CARPETA_ETAPA_CONTRATO,
  CARPETA_SUBIDAS,
  carpetaComunicacion,
  carpetaContrato,
  carpetaDocumental,
  carpetaTramite,
  carpetaVital,
  estaEnCarpeta,
  rutaDestino,
  subcarpetaTramite,
  variante,
} from "@/lib/carpetas-almacen";
import { anioColombia, fechaArchivoColombia } from "@/lib/fecha";

const BUCKET = "documentos";

export type AmbitoArchivos =
  | { tipo: "tramite"; id: string }
  | { tipo: "contrato"; id: string }
  | { tipo: "comunicacion"; id: string }
  | { tipo: "documental"; id: string }
  | { tipo: "vital"; id: string };

export type MovimientoArchivo = { origen: string; destino: string; estado: "movido" | "simulado" | "omitido" | "error"; detalle?: string };

type Pendiente = { ruta: string; carpeta: string };

/** Carpeta deseada de cada archivo del ámbito (ruta actual → carpeta). */
async function planear(ambito: AmbitoArchivos): Promise<Pendiente[]> {
  switch (ambito.tipo) {
    case "tramite": {
      const e = await db.expediente.findUnique({
        where: { id: ambito.id },
        select: {
          numero: true,
          fechaRadicacion: true,
          tramiteTipo: { select: { slug: true } },
          documentos: { select: { storagePath: true, pasoNumero: true, visitaConcepto: { select: { id: true } } } },
          visitasTecnicas: { select: { capturadoEn: true, inicioReal: true, fotos: { select: { storagePath: true } } } },
        },
      });
      if (!e) return [];
      const base = carpetaTramite({ anio: anioColombia(e.fechaRadicacion), tipo: e.tramiteTipo.slug, numero: e.numero });
      return [
        ...e.documentos.map((d) => ({
          ruta: d.storagePath,
          carpeta: `${base}/${subcarpetaTramite({ pasoNumero: d.pasoNumero, esConcepto: !!d.visitaConcepto })}`,
        })),
        ...e.visitasTecnicas.flatMap((v) =>
          v.fotos.map((f) => ({
            ruta: f.storagePath,
            carpeta: `${base}/${subcarpetaTramite({ fechaVisita: fechaArchivoColombia(v.inicioReal ?? v.capturadoEn) })}`,
          }))
        ),
      ];
    }
    case "contrato": {
      const c = await db.expedienteContractual.findUnique({
        where: { id: ambito.id },
        select: {
          numero: true,
          numeroContrato: true,
          tipoContrato: true,
          fechaInicio: true,
          createdAt: true,
          documentos: { select: { storagePath: true, etapa: true } },
        },
      });
      if (!c) return [];
      const base = carpetaContrato({
        vigencia: anioColombia(c.fechaInicio ?? c.createdAt),
        tipoContrato: c.tipoContrato,
        numeroContrato: c.numeroContrato,
        numero: c.numero,
      });
      return c.documentos.map((d) => ({ ruta: d.storagePath, carpeta: `${base}/${CARPETA_ETAPA_CONTRATO[d.etapa]}` }));
    }
    case "comunicacion": {
      const c = await db.comunicacion.findUnique({
        where: { id: ambito.id },
        select: { anio: true, tipo: true, radicado: true, documentos: { select: { storagePath: true, esRespuesta: true } } },
      });
      if (!c) return [];
      const base = carpetaComunicacion(c);
      return c.documentos.map((d) => ({ ruta: d.storagePath, carpeta: d.esRespuesta ? `${base}/respuesta` : base }));
    }
    case "documental": {
      const e = await db.expedienteDocumental.findUnique({
        where: { id: ambito.id },
        select: { numero: true, fechaApertura: true, dependencia: { select: { codigo: true, nombre: true } }, documentos: { select: { storagePath: true } } },
      });
      if (!e) return [];
      const base = carpetaDocumental({ anio: anioColombia(e.fechaApertura), dependencia: e.dependencia, numero: e.numero });
      return e.documentos.map((d) => ({ ruta: d.storagePath, carpeta: base }));
    }
    case "vital": {
      const s = await db.solicitudVital.findUnique({
        where: { id: ambito.id },
        select: { idVital: true, fechaRadicacion: true, createdAt: true, documentos: { select: { storagePath: true } } },
      });
      if (!s) return [];
      const base = carpetaVital({ anio: anioColombia(s.fechaRadicacion ?? s.createdAt), idVital: s.idVital });
      return s.documentos.map((d) => ({ ruta: d.storagePath, carpeta: base }));
    }
  }
}

/** Cuántas filas de cada tabla usan esa ruta. */
async function usos(ruta: string) {
  const w = { where: { storagePath: ruta } };
  const [a, b, c, d, e, f] = await Promise.all([
    db.expedienteDocumento.count(w),
    db.visitaTecnicaFoto.count(w),
    db.documentoContrato.count(w),
    db.comunicacionDocumento.count(w),
    db.documentoArchivo.count(w),
    db.solicitudVitalDocumento.count(w),
  ]);
  return a + b + c + d + e + f;
}

async function cambiarRuta(origen: string, destino: string): Promise<number> {
  const w = { where: { storagePath: origen }, data: { storagePath: destino } };
  const r = await db.$transaction([
    db.expedienteDocumento.updateMany(w),
    db.visitaTecnicaFoto.updateMany(w),
    db.documentoContrato.updateMany(w),
    db.comunicacionDocumento.updateMany(w),
    db.documentoArchivo.updateMany(w),
    db.solicitudVitalDocumento.updateMany(w),
  ]);
  return r.reduce((t, x) => t + x.count, 0);
}

function esDeLlegada(ruta: string): boolean {
  return ruta.startsWith(`${CARPETA_SUBIDAS}/`);
}

export async function organizarArchivos(ambito: AmbitoArchivos, opciones: { simular?: boolean } = {}): Promise<MovimientoArchivo[]> {
  const resultado: MovimientoArchivo[] = [];
  let plan: Pendiente[];
  try {
    plan = await planear(ambito);
  } catch (e) {
    console.error(`organizarArchivos(${ambito.tipo} ${ambito.id}): no se pudo leer el expediente:`, e);
    return resultado;
  }
  const vistos = new Set<string>();
  for (const { ruta, carpeta } of plan) {
    if (vistos.has(ruta) || estaEnCarpeta(ruta, carpeta)) continue;
    vistos.add(ruta);
    const destino = rutaDestino(carpeta, ruta);
    try {
      // Un archivo ya ordenado que comparte otra fila (de otro expediente o módulo) se queda donde está.
      const enUso = await usos(ruta);
      const delAmbito = plan.filter((p) => p.ruta === ruta).length;
      if (!esDeLlegada(ruta) && enUso > delAmbito) {
        resultado.push({ origen: ruta, destino, estado: "omitido", detalle: "lo comparte otro expediente" });
        continue;
      }
      if (opciones.simular) {
        resultado.push({ origen: ruta, destino, estado: "simulado" });
        continue;
      }
      const final = await mover(BUCKET, ruta, destino, variante);
      if ((await cambiarRuta(ruta, final)) === 0) {
        // La fila cambió o se borró mientras se movía: devolver el archivo.
        await mover(BUCKET, final, ruta, variante).catch(() => {});
        resultado.push({ origen: ruta, destino: final, estado: "omitido", detalle: "el documento cambió mientras se movía" });
        continue;
      }
      await limpiarCarpetasVacias(BUCKET, ruta.slice(0, ruta.lastIndexOf("/")));
      resultado.push({ origen: ruta, destino: final, estado: "movido" });
    } catch (e) {
      const detalle = (e as NodeJS.ErrnoException).code === "ENOENT" ? "el archivo no está en el almacén" : e instanceof Error ? e.message : String(e);
      if (!opciones.simular) console.error(`organizarArchivos: no se movió ${ruta}: ${detalle}`);
      resultado.push({ origen: ruta, destino, estado: "error", detalle });
    }
  }
  return resultado;
}

/** Para llamar tras registrar documentos: ordena sin interrumpir la respuesta si algo falla. */
export async function organizarTrasRegistro(ambito: AmbitoArchivos): Promise<void> {
  try {
    await organizarArchivos(ambito);
  } catch (e) {
    console.error(`organizarTrasRegistro(${ambito.tipo} ${ambito.id}):`, e);
  }
}
