import type { CampoVisibilidadModulo } from "@/lib/modulos-visibles";

export type ModuloUsuario = "TRAMITES" | "SGDEA" | "GECON" | "VITAL" | "SINCA";

export type PestanaFichaUsuario = "datos" | "firma" | "cuenta" | "tramites" | "modulos" | "consulta";

export const MODULOS_USUARIO: { id: ModuloUsuario; nombre: string; corto: string; pestana: PestanaFichaUsuario; campoGlobal: CampoVisibilidadModulo }[] = [
  { id: "TRAMITES", nombre: "Trámites ambientales 2.0", corto: "Trámites 2.0", pestana: "tramites", campoGlobal: "tramitesVisibleFuncionarios" },
  { id: "SGDEA", nombre: "SGDEA CDMB", corto: "SGDEA", pestana: "modulos", campoGlobal: "sgdeaVisibleFuncionarios" },
  { id: "GECON", nombre: "GECON — Contratación", corto: "GECON", pestana: "modulos", campoGlobal: "geconVisibleFuncionarios" },
  { id: "VITAL", nombre: "VITAL", corto: "VITAL", pestana: "consulta", campoGlobal: "vitalVisibleFuncionarios" },
  { id: "SINCA", nombre: "SINCA 1.0", corto: "SINCA 1.0", pestana: "consulta", campoGlobal: "sincaVisibleFuncionarios" },
];

export const IDS_MODULOS_USUARIO = MODULOS_USUARIO.map((m) => m.id);

export type ConfiguracionAccesoUsuario = {
  tramites: number;
  rolCorrespondencia: string | null;
  rolesContratacion: string[];
  secciones: string[];
};

export function faltanteModulo(id: ModuloUsuario, c: ConfiguracionAccesoUsuario): string | null {
  switch (id) {
    case "TRAMITES":
      return c.tramites > 0 ? null : "Sin trámites asignados";
    case "SGDEA":
      return c.rolCorrespondencia ? null : "Sin rol en el SGDEA";
    case "GECON":
      return c.rolesContratacion.length > 0 ? null : "Sin rol en GECON";
    case "VITAL":
      return c.secciones.some((s) => s.startsWith("VITAL_")) ? null : "Sin secciones de VITAL";
    case "SINCA":
      return c.secciones.some((s) => s.startsWith("SINCA_")) ? null : "Sin secciones de SINCA 1.0";
  }
}
