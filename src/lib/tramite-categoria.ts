/**
 * Ícono por tipo de trámite, para que el catálogo y el detalle se reconozcan
 * de un vistazo (agua, bosque, vehículos...) en vez de ser 30 tarjetas
 * idénticas. Se infiere por palabras clave del nombre — no hace falta tocar
 * los JSON de datos para esto, es solo presentación.
 */
const REGLAS: { emoji: string; etiqueta: string; palabras: string[] }[] = [
  { emoji: "💧", etiqueta: "Agua / vertimientos", palabras: ["vertimiento", "agua", "hídric", "cauce", "acuífer"] },
  { emoji: "🌳", etiqueta: "Bosques / árboles", palabras: ["forestal", "árbol", "arbol", "poda", "tala", "bosque", "plantacion", "plantación"] },
  { emoji: "🦉", etiqueta: "Fauna silvestre", palabras: ["fauna", "caza", "espec", "biodiversidad", "silvestre", "salvoconducto"] },
  { emoji: "⛏️", etiqueta: "Minería", palabras: ["minera", "minería", "mineria"] },
  { emoji: "🌬️", etiqueta: "Aire / emisiones", palabras: ["emisiones atmosf", "gases", "diagnóstico automotor", "diagnostico automotor"] },
  { emoji: "🚚", etiqueta: "Transporte / vehículos", palabras: ["vehicular", "automotor", "transporte", "hidrocarburos"] },
  { emoji: "♻️", etiqueta: "Residuos", palabras: ["residuo", "aceite", "rcd", "peligroso", "pcb"] },
  { emoji: "⚖️", etiqueta: "Licencias / permisos generales", palabras: ["licencia", "anla"] },
  { emoji: "🏢", etiqueta: "Gestión ambiental empresarial", palabras: ["gestión ambiental", "gestion ambiental", "inversiones"] },
];

export function categoriaTramite(nombre: string): { emoji: string; etiqueta: string } {
  const texto = nombre.toLowerCase();
  for (const regla of REGLAS) {
    if (regla.palabras.some((p) => texto.includes(p))) {
      return { emoji: regla.emoji, etiqueta: regla.etiqueta };
    }
  }
  return { emoji: "📋", etiqueta: "Trámite ambiental" };
}
