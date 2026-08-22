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
