export type CampoVisibilidadModulo =
  | "tramitesVisibleFuncionarios"
  | "sgdeaVisibleFuncionarios"
  | "geconVisibleFuncionarios"
  | "vitalVisibleFuncionarios"
  | "sincaVisibleFuncionarios"
  | "memorandosVisibleFuncionarios"
  | "negociosVerdesVisibleFuncionarios"
  | "negociosVerdesSitioPublico";

export const MODULOS_CONFIGURABLES: { campo: CampoVisibilidadModulo; nombre: string; efecto: string }[] = [
  {
    campo: "tramitesVisibleFuncionarios",
    nombre: "Trámites ambientales 2.0",
    efecto:
      "Desmarcado: el módulo desaparece del menú y se bloquean sus expedientes, solicitantes y firmas para todos menos administradores, incluidos quienes ya tienen trámites asignados.",
  },
  {
    campo: "sgdeaVisibleFuncionarios",
    nombre: "SGDEA — Correspondencia y Archivo",
    efecto:
      "Desmarcado: el módulo desaparece del menú y se bloquea el acceso para todos menos administradores, incluidos quienes ya tienen un rol de correspondencia asignado.",
  },
  {
    campo: "geconVisibleFuncionarios",
    nombre: "GECON — Contratación",
    efecto:
      "Desmarcado: el módulo desaparece del menú y se bloquea el acceso para todos menos administradores, incluidos quienes tienen rol de contratación, contratistas y supervisores.",
  },
  {
    campo: "memorandosVisibleFuncionarios",
    nombre: "Memorandos",
    efecto:
      "Desmarcado: el módulo desaparece del menú y se bloquea el envío y la consulta de memorandos para todos menos administradores. Los memorandos ya firmados se conservan.",
  },
  {
    campo: "vitalVisibleFuncionarios",
    nombre: "VITAL",
    efecto:
      "Desmarcado: el módulo desaparece del menú y se bloquea el acceso para todos menos administradores, aunque tengan asignadas las secciones de VITAL.",
  },
  {
    campo: "sincaVisibleFuncionarios",
    nombre: "SINCA 1.0 — Consulta histórica",
    efecto:
      "Desmarcado: el módulo desaparece del menú y se bloquea el acceso para todos menos administradores, aunque tengan asignadas las secciones de SINCA 1.0.",
  },
  {
    campo: "negociosVerdesVisibleFuncionarios",
    nombre: "Negocios Verdes — Panel administrativo",
    efecto:
      "Desmarcado: el panel interno (/negocios-verdes/admin) desaparece del menú y se bloquea para todos menos administradores, aunque tengan un perfil de Negocios Verdes. No afecta el sitio público.",
  },
  {
    campo: "negociosVerdesSitioPublico",
    nombre: "Negocios Verdes — Sitio público",
    efecto:
      "Marcado: la ciudadanía puede consultar el directorio en /negocios-verdes sin iniciar sesión (solo negocios publicados y solo sus datos públicos). Desmarcado: el sitio muestra «Sitio en preparación»; quienes tienen acceso al panel lo ven en vista previa.",
  },
];
