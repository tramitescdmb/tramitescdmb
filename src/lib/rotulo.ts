// Subpath explícito: bundle puro (sin canvas ni fuentes) que genera SVG — sirve
// en el render de servidor sin dependencias nativas. El export "." de bwip-js
// solo expone condiciones por entorno, que moduleResolution "bundler" no resuelve.
import bwipjs from "bwip-js/browser";

/**
 * Rótulo de radicación (Acuerdo 060/2001 AGN, art. 2): el código de barras se
 * genera SIEMPRE de forma automática a partir del número de radicado — no hay un
 * paso manual. Para un documento físico se imprime el rótulo y se adhiere; para
 * uno electrónico, el mismo código se estampa sobre el PDF (fase posterior).
 *
 * bwip-js produce SVG puro (sin canvas), apto para render en servidor y para
 * impresión sin pérdida de nitidez.
 */

/** Code 128 del número de radicado. SVG con `viewBox`, escalable. */
export function codigoBarrasRadicado(radicado: string): string {
  return bwipjs.toSVG({
    bcid: "code128",
    text: radicado,
    scale: 3,
    height: 12,
    includetext: false,
  });
}

/** URL pública de verificación de un radicado (destino del QR del rótulo). */
export function urlVerificacion(base: string, radicado: string): string {
  return `${base.replace(/\/+$/, "")}/verificar/${encodeURIComponent(radicado)}`;
}

/** QR que abre la verificación pública del radicado. */
export function qrVerificacion(base: string, radicado: string): string {
  return bwipjs.toSVG({
    bcid: "qrcode",
    text: urlVerificacion(base, radicado),
    scale: 3,
  });
}
