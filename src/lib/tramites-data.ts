import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

/**
 * Los datos de un TramiteTipo (objeto/alcance/pasos/documentos) son la
 * definición del procedimiento oficial — casi no cambian (solo cuando la
 * CDMB actualiza un PDF y se vuelve a sembrar). Cachearlos evita ir a
 * Supabase en cada clic y es lo que más se sentía "lento" al entrar a un
 * trámite. Los expedientes (que sí cambian todo el tiempo) NO se cachean.
 */

export const getTramitePorSlug = unstable_cache(
  async (slug: string) => {
    return db.tramiteTipo.findUnique({
      where: { slug },
      include: {
        documentosRequeridos: { orderBy: { orden: "asc" } },
        flujos: { orderBy: { orden: "asc" }, include: { pasos: { orderBy: { numero: "asc" } } } },
      },
    });
  },
  ["tramite-por-slug"],
  { revalidate: 300, tags: ["tramites"] }
);

export const getCatalogoTramites = unstable_cache(
  async () => {
    return db.tramiteTipo.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      include: { _count: { select: { flujos: true } }, flujos: { include: { pasos: true } } },
    });
  },
  ["catalogo-tramites"],
  { revalidate: 300, tags: ["tramites"] }
);

/** Suma los días de los pasos que sí tienen tiempo definido en el PDF original. */
export function tiempoEstimadoDias(pasos: { tiempoDias: number | null }[]) {
  const conocidos = pasos.filter((p) => p.tiempoDias !== null);
  const total = conocidos.reduce((acc, p) => acc + (p.tiempoDias ?? 0), 0);
  return { total, completo: conocidos.length === pasos.length, pasosConTiempo: conocidos.length, pasosTotal: pasos.length };
}

/**
 * Todos los `resumen` empiezan con "Este trámite..." (a propósito, para que
 * se lean bien solos en la página de detalle). En el catálogo, con 30+
 * tarjetas seguidas, repetir "Este trámite" al inicio de cada una es puro
 * ruido — esto lo quita y deja la oración en su forma directa ("Autoriza...",
 * "Certifica..."). Si algún texto no trae ese prefijo, lo deja intacto.
 */
export function resumenSinPrefijo(texto: string) {
  const sinPrefijo = texto.replace(/^este trámite\s+/i, "");
  if (sinPrefijo === texto) return texto;
  return sinPrefijo.charAt(0).toUpperCase() + sinPrefijo.slice(1);
}
