import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { getBrandingRuta } from "@/lib/branding-storage";

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
  tramitesVisibleFuncionarios: true,
  geconVisibleFuncionarios: true,
  vitalVisibleFuncionarios: true,
  sincaVisibleFuncionarios: true,
  memorandosVisibleFuncionarios: true,
  selloTiempoTsaUrl: null,
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
  modulosPorPerfil: [] as string[],
} as const;

export const getConfiguracionSitio = unstable_cache(
  async () => {
    const config = await db.configuracionSitio.findUnique({ where: { id: "singleton" } });
    if (!config) return VACIA;
    // Las URL guardadas antes eran absolutas (https://192.168.7.61/...) y dejaban de cargar al
    // entrar por el dominio. Se calcula siempre la ruta relativa a partir del archivo guardado.
    const ruta = (path: string | null, url: string | null) => (path ? getBrandingRuta(path) : url);
    return {
      ...config,
      logoUrl: ruta(config.logoPath, config.logoUrl),
      logoGovcoUrl: ruta(config.logoGovcoPath, config.logoGovcoUrl),
      logoColombiaUrl: ruta(config.logoColombiaPath, config.logoColombiaUrl),
      logoPotenciaUrl: ruta(config.logoPotenciaPath, config.logoPotenciaUrl),
    };
  },
  ["configuracion-sitio"],
  { revalidate: 60, tags: ["configuracion-sitio"] }
);
