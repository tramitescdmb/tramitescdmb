export const MARCADORES: { clave: string; descripcion: string }[] = [
  { clave: "FECHA", descripcion: "Fecha de hoy en letras (ej. 9 de septiembre de 2026)" },
  { clave: "FECHA_CORTA", descripcion: "Fecha de hoy en números (dd/mm/aaaa)" },
  { clave: "CIUDAD", descripcion: "Bucaramanga" },
  { clave: "RADICADO", descripcion: "Número de radicado (si ya existe)" },
  { clave: "ASUNTO", descripcion: "Asunto del documento" },
  { clave: "DESTINATARIO", descripcion: "Nombre del destinatario" },
  { clave: "REMITENTE", descripcion: "Nombre del remitente" },
  { clave: "DEPENDENCIA", descripcion: "Dependencia (origen o destino, según el formulario)" },
  { clave: "FUNCIONARIO", descripcion: "Nombre del funcionario que redacta" },
];

export type ContextoMarcadores = Partial<Record<string, string>>;

export function contextoBase(): ContextoMarcadores {
  const hoy = new Date();
  return {
    FECHA: hoy.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }),
    FECHA_CORTA: hoy.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" }),
    CIUDAD: "Bucaramanga",
  };
}

export function aplicarMarcadores(texto: string, contexto: ContextoMarcadores): string {
  return texto.replace(/\[([A-Z_]+)\]/g, (original, clave: string) => {
    const valor = contexto[clave];
    return valor != null && valor !== "" ? valor : original;
  });
}

export function marcadoresPendientes(texto: string): string[] {
  const encontrados = new Set<string>();
  for (const m of texto.matchAll(/\[([A-Z_]+)\]/g)) encontrados.add(m[1]!);
  return [...encontrados];
}
