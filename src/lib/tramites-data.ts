import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

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

export function tiempoEstimadoDias(pasos: { tiempoDias: number | null }[]) {
  const conocidos = pasos.filter((p) => p.tiempoDias !== null);
  const total = conocidos.reduce((acc, p) => acc + (p.tiempoDias ?? 0), 0);
  return { total, completo: conocidos.length === pasos.length, pasosConTiempo: conocidos.length, pasosTotal: pasos.length };
}

export function resumenSinPrefijo(texto: string) {
  const sinPrefijo = texto.replace(/^este trámite\s+/i, "");
  if (sinPrefijo === texto) return texto;
  return sinPrefijo.charAt(0).toUpperCase() + sinPrefijo.slice(1);
}
