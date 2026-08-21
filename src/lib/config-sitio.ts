import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

const VACIA = {
  id: "singleton",
  logoUrl: null,
  logoPath: null,
  logoGovcoUrl: null,
  logoGovcoPath: null,
  logoColombiaUrl: null,
  logoColombiaPath: null,
  logoPotenciaUrl: null,
  logoPotenciaPath: null,
} as const;

/**
 * Fila única de configuración (logos), sembrada una vez desde prisma/seed.ts.
 * Esto es solo LECTURA — nunca crea la fila aquí: dos componentes del mismo
 * layout (NavBar + FranjaGovCo) la piden en paralelo, y un "upsert al leer"
 * generaba una condición de carrera (P2002, ambos intentando el create a la
 * vez). Si por lo que sea la fila no existe todavía, se devuelve un objeto
 * vacío en memoria (todas las franjas simplemente no aparecen).
 */
export const getConfiguracionSitio = unstable_cache(
  async () => {
    const config = await db.configuracionSitio.findUnique({ where: { id: "singleton" } });
    return config ?? VACIA;
  },
  ["configuracion-sitio"],
  { revalidate: 60, tags: ["configuracion-sitio"] }
);
