import { db } from "@/lib/db";

/**
 * Vocabulario controlado (MoReq 1.17/5.5): términos normalizados que un
 * administrador de archivo mantiene. Las palabras clave que se guardan en una
 * comunicación o un expediente deben pertenecer a esta lista.
 */
export async function listarTerminos(soloActivos = true) {
  return db.terminoControlado.findMany({
    where: soloActivos ? { activo: true } : {},
    orderBy: [{ categoria: "asc" }, { termino: "asc" }],
  });
}

export async function crearTermino(termino: string, categoria?: string | null) {
  const t = termino.trim();
  if (!t) throw new Error("El término es obligatorio.");
  const existe = await db.terminoControlado.findUnique({ where: { termino: t } });
  if (existe) throw new Error(`El término "${t}" ya existe en el vocabulario.`);
  return db.terminoControlado.create({ data: { termino: t, categoria: categoria?.trim() || null } });
}

export async function editarTermino(id: string, datos: { termino?: string; categoria?: string | null; activo?: boolean }) {
  const data: Record<string, unknown> = {};
  if (datos.termino !== undefined) {
    const t = datos.termino.trim();
    if (!t) throw new Error("El término es obligatorio.");
    const otro = await db.terminoControlado.findUnique({ where: { termino: t } });
    if (otro && otro.id !== id) throw new Error(`Ya existe otro término "${t}".`);
    data.termino = t;
  }
  if (datos.categoria !== undefined) data.categoria = datos.categoria?.trim() || null;
  if (datos.activo !== undefined) data.activo = datos.activo;
  return db.terminoControlado.update({ where: { id }, data });
}

/**
 * Filtra una lista de palabras clave propuestas dejando solo las que existen como
 * término activo del vocabulario. Devuelve las válidas (normalizadas, sin
 * duplicados) y las rechazadas.
 */
export async function validarPalabrasClave(propuestas: string[]): Promise<{ validas: string[]; rechazadas: string[] }> {
  const limpias = Array.from(new Set(propuestas.map((p) => p.trim()).filter(Boolean)));
  if (limpias.length === 0) return { validas: [], rechazadas: [] };
  const existentes = await db.terminoControlado.findMany({
    where: { termino: { in: limpias }, activo: true },
    select: { termino: true },
  });
  const set = new Set(existentes.map((e) => e.termino));
  return {
    validas: limpias.filter((p) => set.has(p)),
    rechazadas: limpias.filter((p) => !set.has(p)),
  };
}
