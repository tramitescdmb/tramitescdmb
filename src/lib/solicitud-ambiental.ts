import { randomInt } from "node:crypto";
import { extensionDe } from "@/lib/uploads-config";

/**
 * Vista pública «Solicitud ambiental»: radicación de trámites ambientales en línea, sin cuenta,
 * y consulta del estado con la cédula o el NIT más el número de solicitud.
 */

/** Sin 0/O, 1/I/L: se dicta y se copia sin confusiones. 31^8 ≈ 8,5 × 10^11 combinaciones. */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const FORMATO_NUMERO_SOLICITUD = /^SA-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;

export function generarNumeroSolicitud(): string {
  let c = "";
  for (let i = 0; i < 8; i++) c += ALFABETO[randomInt(ALFABETO.length)];
  return `SA-${c.slice(0, 4)}-${c.slice(4)}`;
}

/** Acepta el número escrito con espacios, minúsculas o sin guiones («sa 7kq4 m9xd» → «SA-7KQ4-M9XD»). */
export function normalizarNumeroSolicitud(texto: string): string | null {
  const limpio = texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cuerpo = limpio.startsWith("SA") ? limpio.slice(2) : limpio;
  if (cuerpo.length !== 8) return null;
  const numero = `SA-${cuerpo.slice(0, 4)}-${cuerpo.slice(4)}`;
  return FORMATO_NUMERO_SOLICITUD.test(numero) ? numero : null;
}

/** Cédula o NIT comparables: solo dígitos, sin el dígito de verificación separado por guion. */
export function normalizarIdentificacion(texto: string): string {
  const sinDv = texto.trim().replace(/-\s*\d\s*$/, "");
  return sinDv.replace(/\D/g, "");
}

/** Firma de los primeros bytes de cada tipo permitido: la extensión sola no garantiza el contenido. */
const FIRMAS: Record<string, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  png: [[0x89, 0x50, 0x4e, 0x47]],
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  docx: [[0x50, 0x4b, 0x03, 0x04]], // ZIP (Office Open XML)
  xlsx: [[0x50, 0x4b, 0x03, 0x04]],
  doc: [[0xd0, 0xcf, 0x11, 0xe0]], // OLE (Office 97-2003)
  xls: [[0xd0, 0xcf, 0x11, 0xe0]],
};

export const MIME_POR_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
};

/** true si los primeros bytes corresponden a la extensión del nombre (solo tipos conocidos). */
export function contenidoCorrespondeAExtension(nombre: string, cabecera: Uint8Array): boolean {
  const firmas = FIRMAS[extensionDe(nombre)];
  if (!firmas) return false;
  return firmas.some((f) => f.length <= cabecera.length && f.every((b, i) => cabecera[i] === b));
}

/**
 * Estado visible para el ciudadano, en palabras sencillas. La decisión (aprobado o negado) no se
 * anticipa aquí: se comunica con la notificación del acto administrativo.
 */
const RESUELTA = { etiqueta: "Resuelta", explicacion: "La CDMB tomó una decisión sobre su solicitud. Se le notificará por los medios previstos en la ley." };
export const ESTADO_PUBLICO: Record<string, { etiqueta: string; explicacion: string }> = {
  RADICADO: { etiqueta: "Radicada", explicacion: "La CDMB recibió su solicitud y está pendiente de revisión." },
  EN_TRAMITE: { etiqueta: "En trámite", explicacion: "La CDMB está gestionando su solicitud según las etapas del procedimiento." },
  INFORMACION_ADICIONAL_REQUERIDA: {
    etiqueta: "Se requiere información adicional",
    explicacion: "La CDMB necesita información o documentos adicionales. Revise el correo o el teléfono que indicó.",
  },
  SUSPENDIDO: { etiqueta: "Suspendida", explicacion: "El trámite está suspendido temporalmente." },
  APROBADO: RESUELTA,
  NEGADO: RESUELTA,
  RECHAZADO: RESUELTA,
  DESISTIDO: { etiqueta: "Terminada por desistimiento", explicacion: "El trámite terminó por desistimiento." },
  ARCHIVADO: { etiqueta: "Archivada", explicacion: "El trámite terminó y el expediente se archivó." },
};
