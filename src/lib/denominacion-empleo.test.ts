import { describe, expect, it } from "vitest";
import {
  denominacionParaFirma,
  esClaveDenominacion,
  esSexo,
  CLAVES_DENOMINACION_EMPLEO,
  DENOMINACIONES_EMPLEO,
} from "./denominacion-empleo";

describe("denominacionParaFirma", () => {
  it("usa la forma femenina cuando el sexo es F", () => {
    expect(denominacionParaFirma("COORDINADOR_GRUPO", "F")).toBe("Coordinadora de Grupo");
    expect(denominacionParaFirma("DIRECTOR_GENERAL", "F")).toBe("Directora General");
  });

  it("usa la forma masculina con sexo M o sin sexo", () => {
    expect(denominacionParaFirma("PROFESIONAL_ESPECIALIZADO", "M")).toBe("Profesional Especializado");
    expect(denominacionParaFirma("PROFESIONAL_ESPECIALIZADO", null)).toBe("Profesional Especializado");
  });

  it("añade el complemento tal cual", () => {
    expect(denominacionParaFirma("PROFESIONAL_ESPECIALIZADO", "M", "en Tecnologías de Información")).toBe(
      "Profesional Especializado en Tecnologías de Información",
    );
    expect(denominacionParaFirma("PROFESIONAL_ESPECIALIZADO", "F", "en Tecnologías de Información")).toBe(
      "Profesional Especializada en Tecnologías de Información",
    );
  });

  it("las denominaciones invariables no cambian por sexo", () => {
    expect(denominacionParaFirma("CONTRATISTA", "F")).toBe("Contratista");
    expect(denominacionParaFirma("JUDICANTE", "M")).toBe("Judicante");
  });

  it("devuelve null para una clave desconocida o vacía", () => {
    expect(denominacionParaFirma(null, "F")).toBeNull();
    expect(denominacionParaFirma("INVENTADO", "F")).toBeNull();
  });
});

describe("guardas", () => {
  it("esClaveDenominacion reconoce solo claves del catálogo", () => {
    expect(esClaveDenominacion("CELADOR")).toBe(true);
    expect(esClaveDenominacion("celador")).toBe(false);
    expect(esClaveDenominacion(null)).toBe(false);
  });

  it("esSexo solo acepta M o F", () => {
    expect(esSexo("M")).toBe(true);
    expect(esSexo("F")).toBe(true);
    expect(esSexo("X")).toBe(false);
  });

  it("toda denominación tiene forma m y f no vacías", () => {
    for (const clave of CLAVES_DENOMINACION_EMPLEO) {
      expect(DENOMINACIONES_EMPLEO[clave].m.length).toBeGreaterThan(0);
      expect(DENOMINACIONES_EMPLEO[clave].f.length).toBeGreaterThan(0);
    }
  });
});
