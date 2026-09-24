import bwipjs from "bwip-js/browser";

export function codigoBarrasRadicado(radicado: string): string {
  return bwipjs.toSVG({
    bcid: "code128",
    text: radicado,
    scale: 3,
    height: 12,
    includetext: false,
  });
}

export function urlVerificacion(base: string, radicado: string): string {
  return `${base.replace(/\/+$/, "")}/verificar/${encodeURIComponent(radicado)}`;
}

export function qrVerificacion(base: string, radicado: string): string {
  return bwipjs.toSVG({
    bcid: "qrcode",
    text: urlVerificacion(base, radicado),
    scale: 3,
  });
}
