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
  loginMaxIntentos: 5,
  loginVentanaMinutos: 15,
  sgdeaVisibleFuncionarios: true,
  passwordLongitudMinima: 8,
  passwordLongitudMaxima: 72,
  passwordRequiereMayuscula: false,
  passwordRequiereNumero: false,
  passwordRequiereEspecial: false,
  passwordHistorialCantidad: 0,
  passwordVigenciaDias: null,
  passwordVigenciaMinimaDias: 0,
  extensionesPermitidas: ["pdf", "jpg", "jpeg", "png", "doc", "docx", "xls", "xlsx"],
  jornadaDiasSemana: [1, 2, 3, 4, 5],
  jornadaHoraInicio: "08:00",
  jornadaHoraFin: "17:00",
  jornadaHoraInicioTarde: null,
  jornadaHoraFinTarde: null,
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
