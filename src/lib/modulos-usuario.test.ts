import { describe, expect, it } from "vitest";
import { faltanteModulo } from "@/lib/modulos-usuario";

const vacio = { tramites: 0, rolCorrespondencia: null, rolesContratacion: [], secciones: [] };

describe("faltanteModulo", () => {
  it("señala lo que falta configurar en cada módulo", () => {
    expect(faltanteModulo("TRAMITES", vacio)).toBe("Sin trámites asignados");
    expect(faltanteModulo("SGDEA", vacio)).toBe("Sin rol en el SGDEA");
    expect(faltanteModulo("GECON", vacio)).toBe("Sin rol en GECON");
    expect(faltanteModulo("VITAL", { ...vacio, secciones: ["SINCA_BASE"] })).toBe("Sin secciones de VITAL");
  });

  it("no señala nada cuando el módulo tiene su configuración", () => {
    const completo = { tramites: 3, rolCorrespondencia: "FUNCIONARIO_DEPENDENCIA", rolesContratacion: ["CONTRATISTA"], secciones: ["VITAL_BASE", "SINCA_BASE"] };
    for (const m of ["TRAMITES", "SGDEA", "GECON", "VITAL", "SINCA"] as const) expect(faltanteModulo(m, completo)).toBeNull();
  });
});
