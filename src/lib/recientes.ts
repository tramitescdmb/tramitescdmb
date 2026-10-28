export type Reciente = { href: string; titulo: string; detalle?: string; modulo: string; en: number };

const CLAVE = "recientes-v1";
const MAXIMO = 8;
export const EVENTO_RECIENTES = "recientes-actualizados";

export function leerRecientes(): Reciente[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE) ?? "[]");
    return Array.isArray(lista) ? lista.filter((r) => r && typeof r.href === "string" && typeof r.titulo === "string") : [];
  } catch {
    return [];
  }
}

export function registrarReciente(r: Omit<Reciente, "en">) {
  try {
    const lista = [{ ...r, en: Date.now() }, ...leerRecientes().filter((x) => x.href !== r.href)].slice(0, MAXIMO);
    localStorage.setItem(CLAVE, JSON.stringify(lista));
    window.dispatchEvent(new Event(EVENTO_RECIENTES));
  } catch {}
}
