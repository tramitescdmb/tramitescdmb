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

/**
 * ¿La etapa en la que se subió este documento sigue abierta (es la etapa
 * actual del expediente)? Un documento de radicación (pasoNumero null) se
 * trata como si perteneciera al paso 1 — es la misma etapa real, solo que
 * se subió desde el formulario de radicación en vez de "subir documento
 * del paso". Sirve para decidir quién puede eliminar un documento: dentro
 * de la etapa abierta, quien lo subió puede corregir su propio error; una
 * vez cerrada la etapa, solo un administrador (con oficio de por medio).
 */
export function documentoEtapaAbierta(pasoNumeroDocumento: number | null, pasoActualNumero: number): boolean {
  return (pasoNumeroDocumento ?? 1) === pasoActualNumero;
}
