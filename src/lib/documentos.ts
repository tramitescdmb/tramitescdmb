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

/**
 * ¿Puede este usuario intentar eliminar el documento? Es la regla de acceso,
 * NO la regla completa: en etapa cerrada, además de ser administrador hay que
 * indicar el oficio de solicitud del Subdirector (verificado aparte, en la
 * ruta de eliminación) — sin eso, ni siquiera un administrador puede
 * completar el borrado. Dentro de la etapa abierta: quien subió el documento
 * puede corregir su propio error, o un administrador. Una vez la etapa se
 * cierra, NINGÚN usuario puede eliminar el documento por su cuenta — ni
 * siquiera quien lo subió — solo un administrador, y solo con esa
 * autorización de por medio.
 */
export function puedeIntentarEliminarDocumento({
  esAdmin,
  esQuienLoSubio,
  etapaAbierta,
}: {
  esAdmin: boolean;
  esQuienLoSubio: boolean;
  etapaAbierta: boolean;
}): boolean {
  if (esAdmin) return true;
  return etapaAbierta && esQuienLoSubio;
}
