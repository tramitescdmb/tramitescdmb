/**
 * Un paso cuya lista de `documentos` (PasoDefinicion.documentos, tal como viene
 * del PDF oficial) menciona un recibo/comprobante/constancia de pago o factura
 * necesita un campo de carga aparte para ese soporte — si no, se pierde entre
 * "otros documentos del paso". Esto detecta ese caso a partir del texto que ya
 * trae cada trámite (ej. PR21 paso 1 lista "Recibo de Pago"), sin depender de
 * un campo nuevo en el modelo de datos.
 */
export function documentoDePagoEnPaso(documentos: string[]): string | null {
  return documentos.find((d) => /\bpago\b|\bfactura\b/i.test(d)) ?? null;
}
