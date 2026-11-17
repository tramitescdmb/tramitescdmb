/**
 * Estructura de carpetas del almacén de documentos (NAS): una carpeta por módulo, año y tipo, y dentro
 * una por expediente, contrato, trámite o radicado, para que el administrador encuentre y copie a mano
 * lo que necesite. Ejemplos:
 *
 *   Gecon/2026/prestacion-de-servicios/contrato-1520-2026/contractual/Informe_octubre.pdf
 *   Tramites/2026/concesion-de-aguas-superficiales/M-DA-PR39-2026-0012/radicacion/Plano.pdf
 *   Correspondencia/2026/recibidas/CDMB-R-2026-000123/Peticion.pdf
 *   SGDEA/2026/110-Oficina-Juridica/CDMB-X-2026-000004/Acta.pdf
 *   Vital/2026/3500000000123/Solicitud.pdf
 *
 * Los archivos se suben primero a `_subidas/<identificador>/` (la carpeta que valida el servidor al
 * registrarlos) y, ya registrado el documento, se mueven a su carpeta definitiva. Aquí solo se arman
 * los nombres; mover y actualizar la base es de organizar-archivos.ts.
 */
import type { EtapaContratacion, TipoComunicacion, TipoContratoEstatal } from "@prisma/client";

/** Carpeta de llegada de lo que sube el navegador, antes de registrar el documento. */
export const CARPETA_SUBIDAS = "_subidas";

function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Nombre de carpeta legible y seguro: letras, números y guiones; nunca vacío, "." ni "..". */
export function segmento(texto: string | number | null | undefined, max = 80): string {
  const limpio = sinTildes(String(texto ?? ""))
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return limpio || "sin-nombre";
}

/** Nombre de archivo seguro conservando la extensión: "Acta de visita (firmada).PDF" → "Acta_de_visita_firmada.pdf". */
export function nombreArchivo(nombre: string): string {
  const base0 = sinTildes(nombre.split(/[\\/]/).pop() ?? "");
  const punto = base0.lastIndexOf(".");
  const ext = punto > 0 ? base0.slice(punto + 1).replace(/[^A-Za-z0-9]/g, "").slice(0, 10).toLowerCase() : "";
  const base =
    (punto > 0 ? base0.slice(0, punto) : base0)
      .replace(/[^A-Za-z0-9_-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^[_-]+|[_-]+$/g, "")
      .slice(0, 100)
      .replace(/[_-]+$/g, "") || "archivo";
  return ext ? `${base}.${ext}` : base;
}

/** Quita el sello de tiempo que se antepone al nombre en la carpeta de llegada ("1731600000000-Acta.pdf"). */
export function nombreSinSello(archivo: string): string {
  return archivo.replace(/^\d{10,14}-/, "") || archivo;
}

export const CARPETA_TIPO_CONTRATO: Record<TipoContratoEstatal, string> = {
  PRESTACION_SERVICIOS: "prestacion-de-servicios",
  OBRA: "obra",
  SUMINISTRO: "suministro",
  COMPRAVENTA: "compraventa",
  CONSULTORIA: "consultoria",
  INTERVENTORIA: "interventoria",
  ARRENDAMIENTO: "arrendamiento",
  OTRO: "otros",
};

export const CARPETA_ETAPA_CONTRATO: Record<EtapaContratacion, string> = {
  PRECONTRACTUAL: "precontractual",
  CONTRACTUAL: "contractual",
  POSTCONTRACTUAL: "poscontractual",
};

export const CARPETA_TIPO_COMUNICACION: Record<TipoComunicacion, string> = {
  RECIBIDA: "recibidas",
  ENVIADA: "enviadas",
  INTERNA: "internas",
};

/**
 * Gecon/<vigencia>/<tipo de contrato>/<contrato>. Con número de contrato: "contrato-050-2026" (si el
 * número no trae el año se le agrega la vigencia); mientras no lo tenga, el número interno del
 * expediente ("expediente-CDMB-CTO-2026-000006"). Al asignarse el número, la reorganización mueve
 * los archivos a la carpeta nueva.
 */
export function carpetaContrato(c: {
  vigencia: number;
  tipoContrato: TipoContratoEstatal;
  numeroContrato: string | null;
  numero: string;
}): string {
  const tipo = CARPETA_TIPO_CONTRATO[c.tipoContrato] ?? "otros";
  const n = c.numeroContrato?.trim();
  const nombre = n
    ? `contrato-${segmento(n, 60)}${/(^|\D)(19|20)\d{2}(\D|$)/.test(n) ? "" : `-${c.vigencia}`}`
    : `expediente-${segmento(c.numero, 60)}`;
  return `Gecon/${c.vigencia}/${tipo}/${nombre}`;
}

/** Tramites/<año de radicación>/<tipo de trámite>/<número del expediente>. */
export function carpetaTramite(t: { anio: number; tipo: string; numero: string }): string {
  return `Tramites/${t.anio}/${segmento(t.tipo)}/${segmento(t.numero)}`;
}

/** Dentro del trámite: radicacion/, paso-03/, conceptos/ o visitas/<fecha>/. */
export function subcarpetaTramite(d: { pasoNumero?: number | null; esConcepto?: boolean; fechaVisita?: string | null }): string {
  if (d.fechaVisita) return `visitas/${segmento(d.fechaVisita)}`;
  if (d.esConcepto) return "conceptos";
  if (d.pasoNumero == null) return "radicacion";
  return `paso-${String(d.pasoNumero).padStart(2, "0")}`;
}

/** Correspondencia/<año>/<recibidas|enviadas|internas>/<radicado>. */
export function carpetaComunicacion(c: { anio: number; tipo: TipoComunicacion; radicado: string }): string {
  return `Correspondencia/${c.anio}/${CARPETA_TIPO_COMUNICACION[c.tipo] ?? "otras"}/${segmento(c.radicado)}`;
}

/** SGDEA/<año de apertura>/<código-nombre de la dependencia>/<número del expediente>. */
export function carpetaDocumental(e: { anio: number; dependencia: { codigo: string; nombre: string } | null; numero: string }): string {
  const dep = e.dependencia ? segmento(`${e.dependencia.codigo}-${e.dependencia.nombre}`, 60) : "sin-dependencia";
  return `SGDEA/${e.anio}/${dep}/${segmento(e.numero)}`;
}

/** Vital/<año de radicación>/<id VITAL>. */
export function carpetaVital(v: { anio: number; idVital: string }): string {
  return `Vital/${v.anio}/${segmento(v.idVital)}`;
}

/** Ruta definitiva de un archivo: la carpeta + el nombre del archivo actual sin el sello de tiempo. */
export function rutaDestino(carpeta: string, rutaActual: string): string {
  const archivo = rutaActual.slice(rutaActual.lastIndexOf("/") + 1);
  return `${carpeta}/${nombreArchivo(nombreSinSello(archivo))}`;
}

/** true si el archivo ya está directamente en esa carpeta. */
export function estaEnCarpeta(ruta: string, carpeta: string): boolean {
  return ruta.startsWith(`${carpeta}/`) && !ruta.slice(carpeta.length + 1).includes("/");
}

/** "Acta.pdf" → "Acta_2.pdf" para no pisar un archivo con el mismo nombre. */
export function variante(ruta: string, n: number): string {
  if (n <= 1) return ruta;
  const barra = ruta.lastIndexOf("/");
  const punto = ruta.lastIndexOf(".");
  if (punto > barra + 1) return `${ruta.slice(0, punto)}_${n}${ruta.slice(punto)}`;
  return `${ruta}_${n}`;
}
