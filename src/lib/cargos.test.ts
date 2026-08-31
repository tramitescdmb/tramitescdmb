import { describe, expect, it } from "vitest";
import { puedeGestionarPaso } from "./cargos";

// "Coordinador de Evaluación para la Sostenibilidad" tal como aparece literal en el catálogo
// (CARGOS_CDMB) — usarlo tal cual, no una paráfrasis, es justo lo que hace que la comparación
// coincida por palabra clave.
const RESPONSABLES_RECONOCIDOS = ["Coordinador de Evaluación para la Sostenibilidad", "Subdirector SEYCA"];
const RESPONSABLES_NO_RECONOCIDOS = ["El usuario radica su solicitud de forma presencial o virtual"]; // sin cargo identificable

describe("puedeGestionarPaso", () => {
  it("el ADMIN siempre puede, sin importar su cargo", () => {
    expect(puedeGestionarPaso({ rol: "ADMIN", cargo: null }, RESPONSABLES_RECONOCIDOS)).toBe(true);
    expect(puedeGestionarPaso({ rol: "ADMIN", cargo: "Otro / sin cargo específico" }, RESPONSABLES_RECONOCIDOS)).toBe(true);
  });

  it("un FUNCIONARIO con el cargo que coincide puede avanzar el paso", () => {
    const session = { rol: "FUNCIONARIO" as const, cargo: "Coordinador(a) de Evaluación para la Sostenibilidad" };
    expect(puedeGestionarPaso(session, RESPONSABLES_RECONOCIDOS)).toBe(true);
  });

  it("un FUNCIONARIO con un cargo distinto queda bloqueado", () => {
    const session = { rol: "FUNCIONARIO" as const, cargo: "Servidor(a) de Correspondencia" };
    expect(puedeGestionarPaso(session, RESPONSABLES_RECONOCIDOS)).toBe(false);
  });

  it("un FUNCIONARIO sin cargo asignado queda bloqueado cuando el paso sí exige uno", () => {
    const session = { rol: "FUNCIONARIO" as const, cargo: null };
    expect(puedeGestionarPaso(session, RESPONSABLES_RECONOCIDOS)).toBe(false);
  });

  it("si el texto de responsables no menciona ningún cargo reconocible, no se bloquea a nadie", () => {
    const session = { rol: "FUNCIONARIO" as const, cargo: "Servidor(a) de Correspondencia" };
    expect(puedeGestionarPaso(session, RESPONSABLES_NO_RECONOCIDOS)).toBe(true);
  });

  it("sin sesión, nunca se permite", () => {
    expect(puedeGestionarPaso(null, RESPONSABLES_RECONOCIDOS)).toBe(false);
  });
});
