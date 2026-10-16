export const TIPOS_ACTO_ADMINISTRATIVO = ["Resolución", "Decreto", "Acuerdo", "Acta de posesión", "Circular", "Ley"] as const;

export type TipoActoAdministrativo = (typeof TIPOS_ACTO_ADMINISTRATIVO)[number];

export type PartesActoAdministrativo = { tipo: string; numero: string; anio: string };

export const PARTES_ACTO_VACIAS: PartesActoAdministrativo = { tipo: "", numero: "", anio: "" };

const PATRON_NUMERO = /^[0-9][0-9A-Za-z-]{0,14}$/;

function anioMaximo(): number {
  return new Date().getFullYear() + 1;
}

export function errorPartesActo(p: PartesActoAdministrativo): string | null {
  const tipo = p.tipo.trim();
  const numero = p.numero.trim();
  const anio = p.anio.trim();
  if (!tipo && !numero && !anio) return null;
  if (!(TIPOS_ACTO_ADMINISTRATIVO as readonly string[]).includes(tipo)) return "Seleccione el tipo de acto administrativo.";
  if (!PATRON_NUMERO.test(numero)) return "Indique el número del acto administrativo (solo el número, sin «N.°»).";
  const a = Number(anio);
  if (!/^\d{4}$/.test(anio) || a < 1950 || a > anioMaximo()) return `Indique el año del acto administrativo (1950–${anioMaximo()}).`;
  return null;
}

export function componerActo(p: PartesActoAdministrativo): string | null {
  if (errorPartesActo(p) || !p.tipo.trim()) return null;
  return `${p.tipo.trim()} ${p.numero.trim()} de ${p.anio.trim()}`;
}

export function descomponerActo(texto: string | null | undefined): PartesActoAdministrativo {
  const t = texto?.trim() ?? "";
  if (!t) return { ...PARTES_ACTO_VACIAS };
  const tipo = [...TIPOS_ACTO_ADMINISTRATIVO].sort((a, b) => b.length - a.length).find((x) => t.toLowerCase().startsWith(x.toLowerCase()));
  const m = t.match(/(?:N\.?\s*[°ºo]?\.?\s*)?([0-9][0-9A-Za-z-]*)\s+de\s+(\d{4})\s*$/i);
  return { tipo: tipo ?? "", numero: m?.[1] ?? "", anio: m?.[2] ?? "" };
}

export function normalizarActoAdministrativo(valor: unknown): { valor: string | null; error: string | null } {
  if (valor === null || valor === undefined || (typeof valor === "string" && !valor.trim())) return { valor: null, error: null };
  if (typeof valor !== "string") return { valor: null, error: "El acto administrativo no es válido." };
  const partes = descomponerActo(valor);
  const error = errorPartesActo(partes) ?? (partes.tipo ? null : "Seleccione el tipo de acto administrativo.");
  return error ? { valor: null, error } : { valor: componerActo(partes), error: null };
}
