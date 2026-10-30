import { describe, it, expect } from "vitest";
import { PLANTILLAS_FLUJO, posicionesPlantilla, validarEstructuraFlujo, type PlantillaFlujo } from "./flujos-plantillas";
import { CARGOS_CDMB } from "./cargos";
import { moduloDeAmbito, TIPOS_PASO_DE_MODULO } from "./flujos-modulos";

function comoEstructura(p: PlantillaFlujo) {
  const idPorClave = new Map(p.pasos.map((paso, i) => [paso.clave, `id-${i}`]));
  return p.pasos.map((paso, i) => ({
    id: `id-${i}`,
    nombre: paso.nombre,
    tipo: paso.tipo,
    orden: i + 1,
    transiciones: (paso.transiciones ?? []).map((t) => ({ haciaPasoId: idPorClave.get(t.hacia)!, etiqueta: t.etiqueta })),
    asignacion: paso.asignacion,
    cargoClave: paso.cargoClave ?? null,
    dependenciaId: paso.dependencia ?? null,
  }));
}

describe("plantillas por módulo", () => {
  const cargos = new Set(CARGOS_CDMB.map((c) => c.nombre));

  it("usan solo cargos del catálogo y tipos de paso permitidos en su módulo", () => {
    for (const p of PLANTILLAS_FLUJO) {
      const modulo = moduloDeAmbito(p.ambito ?? "COMUNICACION");
      for (const paso of p.pasos) {
        if (paso.cargoClave) expect(cargos.has(paso.cargoClave), `${p.nombre} › ${paso.nombre}: ${paso.cargoClave}`).toBe(true);
        expect(TIPOS_PASO_DE_MODULO[modulo], `${p.nombre} › ${paso.nombre}`).toContain(paso.tipo);
        if (paso.asignacion === "DEPENDENCIA_FIJA") expect(paso.dependencia, `${p.nombre} › ${paso.nombre}`).toBeTruthy();
      }
    }
  });

  it("GECON y Trámites tienen flujos de ejemplo con instrucciones", () => {
    for (const ambito of ["CONTRATO", "TRAMITE"] as const) {
      const propias = PLANTILLAS_FLUJO.filter((p) => p.ambito === ambito);
      expect(propias.length).toBeGreaterThanOrEqual(7);
      expect(new Set(propias.map((p) => p.nombre)).size).toBe(propias.length);
      expect(propias.every((p) => p.pasos.some((x) => x.instrucciones))).toBe(true);
    }
  });

  it("acomoda las ramas en el mismo nivel y lado a lado", () => {
    const minima = PLANTILLAS_FLUJO.find((p) => p.nombre === "Proceso de mínima cuantía")!;
    const pos = posicionesPlantilla(minima.pasos);
    expect(pos.get("aceptacion")!.y).toBe(pos.get("desierto")!.y);
    expect(pos.get("aceptacion")!.x).not.toBe(pos.get("desierto")!.x);
    expect(pos.get("estudios")!.y).toBeLessThan(pos.get("invitacion")!.y);
    expect(pos.size).toBe(minima.pasos.length);
  });
});

describe("validarEstructuraFlujo", () => {
  it("las plantillas precargadas no tienen problemas estructurales", () => {
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
