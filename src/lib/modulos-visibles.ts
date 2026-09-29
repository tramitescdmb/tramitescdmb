export type CampoVisibilidadModulo =
  | "tramitesVisibleFuncionarios"
  | "sgdeaVisibleFuncionarios"
  | "geconVisibleFuncionarios"
  | "vitalVisibleFuncionarios"
  | "sincaVisibleFuncionarios";

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
];
