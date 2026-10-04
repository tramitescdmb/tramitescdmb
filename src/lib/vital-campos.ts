import { MUNICIPIO_POR_CODIGO_DANE } from "@/lib/municipios";

function campos(valor: unknown): [string, string][] {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return [];
  return Object.entries(valor as Record<string, unknown>).map(([k, v]) => [k.trim().toLowerCase(), typeof v === "string" ? v.trim() : v == null ? "" : String(v)]);
}

export function municipioDeCamposVital(valor: unknown): string | null {
  const codigo = campos(valor).find(([k]) => /^municipio\W*$/.test(k))?.[1] ?? "";
  const dane = codigo.replace(/\D/g, "").padStart(5, "0");
  return MUNICIPIO_POR_CODIGO_DANE[dane] ?? null;
}

export function estadoDeCamposVital(valor: unknown): string {
  const controlada = campos(valor).find(([k]) => /contingencia fue controlada/.test(k))?.[1].toLowerCase();
  if (controlada === "si" || controlada === "sí") return "Contingencia controlada";
  if (controlada === "no") return "Contingencia no controlada";
  return "Radicada en VITAL";
}
