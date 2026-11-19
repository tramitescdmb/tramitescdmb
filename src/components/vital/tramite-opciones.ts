/** Una entrada del catálogo: un trámite, o uno de sus procedimientos cuando el catálogo los muestra por separado. */
export type TramiteOpcion = {
  clave: string;
  href: string;
  nombre: string;
  codigo: string;
  suits: string[];
  enSuit: boolean;
  radicable: boolean;
};

/** Minúsculas y sin tildes, para que «mine» encuentre «Certificación Minera». */
export const normalizarBusqueda = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/** Coincide si cada palabra buscada aparece en cualquier parte del nombre, el código o el número SUIT. */
export function coincideBusqueda(t: Pick<TramiteOpcion, "nombre" | "codigo"> & { suits?: string[] }, busqueda: string): boolean {
  const q = normalizarBusqueda(busqueda);
  if (!q) return true;
  const texto = normalizarBusqueda(`${t.nombre} ${t.codigo} ${(t.suits ?? []).join(" ")}`);
  return q.split(/\s+/).every((palabra) => texto.includes(palabra));
}

/**
 * Los mismos grupos y conteos del catálogo (sus mismas entradas): primero los inscritos en el SUIT
 * y luego los demás, en orden alfabético. Los instrumentos económicos (IE-) no se muestran. Los
 * trámites sin procedimiento en SIC aparecen, pero no se pueden elegir.
 */
export function gruposTramites(tramites: TramiteOpcion[], busqueda = "") {
  const lista = tramites.filter((t) => !t.codigo.startsWith("IE-") && coincideBusqueda(t, busqueda));
  return [
    { titulo: "Trámites inscritos en el SUIT", lista: lista.filter((t) => t.enSuit) },
    { titulo: "Sin registro en el SUIT", lista: lista.filter((t) => !t.enSuit) },
  ];
}
