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
