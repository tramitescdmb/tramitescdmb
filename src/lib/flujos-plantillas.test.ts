import { describe, it, expect } from "vitest";
import { PLANTILLAS_FLUJO, validarEstructuraFlujo, type PlantillaFlujo } from "./flujos-plantillas";

/** Convierte una plantilla (claves locales) a la forma que espera validarEstructuraFlujo (ids). */
function comoEstructura(p: PlantillaFlujo) {
  const idPorClave = new Map(p.pasos.map((paso, i) => [paso.clave, `id-${i}`]));
  return p.pasos.map((paso, i) => ({
    id: `id-${i}`,
    nombre: paso.nombre,
    tipo: paso.tipo,
    orden: i + 1,
    transiciones: (paso.transiciones ?? []).map((t) => ({ haciaPasoId: idPorClave.get(t.hacia)! })),
  }));
}

describe("validarEstructuraFlujo", () => {
  it("las 4 plantillas precargadas no tienen problemas estructurales", () => {
    for (const plantilla of PLANTILLAS_FLUJO) {
      const problemas = validarEstructuraFlujo(comoEstructura(plantilla));
      expect(problemas, `${plantilla.nombre}: ${problemas.map((x) => x.mensaje).join(" ")}`).toEqual([]);
    }
  });

  it("detecta un flujo sin paso Fin", () => {
    const problemas = validarEstructuraFlujo([
      { id: "a", nombre: "A", tipo: "TAREA", orden: 1, transiciones: [{ haciaPasoId: "b" }] },
      { id: "b", nombre: "B", tipo: "TAREA", orden: 2, transiciones: [{ haciaPasoId: "a" }] },
    ]);
    expect(problemas.some((p) => p.mensaje.includes("«Fin»"))).toBe(true);
  });

  it("detecta un paso que no es Fin y no tiene salidas", () => {
    const problemas = validarEstructuraFlujo([
      { id: "a", nombre: "A", tipo: "TAREA", orden: 1, transiciones: [] },
      { id: "z", nombre: "Cierre", tipo: "FIN", orden: 2, transiciones: [] },
    ]);
    expect(problemas.some((p) => p.paso === "A" && p.mensaje.includes("salida"))).toBe(true);
  });

  it("detecta un paso inalcanzable y un Fin que no se alcanza", () => {
    const problemas = validarEstructuraFlujo([
      { id: "a", nombre: "A", tipo: "TAREA", orden: 1, transiciones: [{ haciaPasoId: "a" }] },
      { id: "huerfano", nombre: "Huérfano", tipo: "TAREA", orden: 2, transiciones: [{ haciaPasoId: "z" }] },
      { id: "z", nombre: "Cierre", tipo: "FIN", orden: 3, transiciones: [] },
    ]);
    expect(problemas.some((p) => p.mensaje.includes("no se llega"))).toBe(true);
    expect(problemas.some((p) => p.paso === "Huérfano" && p.mensaje.includes("no es alcanzable"))).toBe(true);
  });

  it("un flujo vacío se reporta", () => {
    expect(validarEstructuraFlujo([])).toEqual([{ mensaje: "El flujo no tiene pasos." }]);
  });
});
