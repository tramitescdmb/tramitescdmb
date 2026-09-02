import { describe, expect, it } from "vitest";
import { puedeGestionarPaso, cargosEnTexto } from "./cargos";

// "Coordinador de Evaluación para la Sostenibilidad" tal como aparece literal en el catálogo
// (CARGOS_CDMB) — usarlo tal cual, no una paráfrasis, es justo lo que hace que la comparación
// coincida por palabra clave.
const RESPONSABLES_RECONOCIDOS = ["Coordinador de Evaluación para la Sostenibilidad", "Subdirector SEYCA"];
const RESPONSABLES_NO_RECONOCIDOS = ["El usuario radica su solicitud de forma presencial o virtual"]; // sin cargo identificable

describe("puedeGestionarPaso", () => {
  it("el ADMIN siempre puede, sin importar su cargo", () => {
    expect(puedeGestionarPaso({ rol: "ADMIN", cargos: [] }, RESPONSABLES_RECONOCIDOS)).toBe(true);
    expect(puedeGestionarPaso({ rol: "ADMIN", cargos: ["Otro / sin cargo específico"] }, RESPONSABLES_RECONOCIDOS)).toBe(true);
  });

  it("un FUNCIONARIO con el cargo que coincide puede avanzar el paso", () => {
    const session = { rol: "FUNCIONARIO" as const, cargos: ["Coordinador(a) de Evaluación para la Sostenibilidad"] };
    expect(puedeGestionarPaso(session, RESPONSABLES_RECONOCIDOS)).toBe(true);
  });

  it("un FUNCIONARIO con un cargo distinto queda bloqueado", () => {
    const session = { rol: "FUNCIONARIO" as const, cargos: ["Servidor(a) de Correspondencia"] };
    expect(puedeGestionarPaso(session, RESPONSABLES_RECONOCIDOS)).toBe(false);
  });

  it("un FUNCIONARIO sin cargo asignado queda bloqueado cuando el paso sí exige uno", () => {
    const session = { rol: "FUNCIONARIO" as const, cargos: [] };
    expect(puedeGestionarPaso(session, RESPONSABLES_RECONOCIDOS)).toBe(false);
  });

  it("si el texto de responsables no menciona ningún cargo reconocible, no se bloquea a nadie", () => {
    const session = { rol: "FUNCIONARIO" as const, cargos: ["Servidor(a) de Correspondencia"] };
    expect(puedeGestionarPaso(session, RESPONSABLES_NO_RECONOCIDOS)).toBe(true);
  });

  it("sin sesión, nunca se permite", () => {
    expect(puedeGestionarPaso(null, RESPONSABLES_RECONOCIDOS)).toBe(false);
  });

  it("con varios cargos, basta con que UNO coincida con el paso", () => {
    const session = { rol: "FUNCIONARIO" as const, cargos: ["Servidor(a) de Correspondencia", "Subdirector(a) de Evaluación y Control Ambiental (SEYCA)"] };
    expect(puedeGestionarPaso(session, RESPONSABLES_RECONOCIDOS)).toBe(true);
  });

  // Regresión: la palabra clave genérica "coordinador" (sin calificar) daba acceso real
  // cruzado entre los dos coordinadores. Un paso que solo menciona al Coordinador de
  // Seguimiento no puede quedar habilitado para el Coordinador de Evaluación.
  it("un coordinador no puede avanzar el paso del OTRO coordinador", () => {
    const pasoDeSeguimiento = ["Servidor responsable de la Coordinación de Seguimiento para la Sostenibilidad"];
    const evaluacion = { rol: "FUNCIONARIO" as const, cargos: ["Coordinador(a) de Evaluación para la Sostenibilidad"] };
    const seguimiento = { rol: "FUNCIONARIO" as const, cargos: ["Coordinador(a) de Seguimiento para la Sostenibilidad"] };
    expect(puedeGestionarPaso(evaluacion, pasoDeSeguimiento)).toBe(false);
    expect(puedeGestionarPaso(seguimiento, pasoDeSeguimiento)).toBe(true);
  });

  // Regresión: con la palabra clave "notificaci" se perdían los pasos redactados con el
  // verbo ("Servidor responsable de notificar"); ahora la clave es "notific".
  it("reconoce al Servidor de Notificaciones cuando el paso usa el verbo 'notificar'", () => {
    const paso = ["Servidor responsable de notificar"];
    const notificaciones = { rol: "FUNCIONARIO" as const, cargos: ["Servidor(a) de Notificaciones"] };
    const correspondencia = { rol: "FUNCIONARIO" as const, cargos: ["Servidor(a) de Correspondencia"] };
    expect(puedeGestionarPaso(notificaciones, paso)).toBe(true);
    expect(puedeGestionarPaso(correspondencia, paso)).toBe(false);
  });
});

describe("cargosEnTexto — precisión del reconocimiento por palabra clave", () => {
  it("'Asesor de la Dirección General' reconoce al Asesor (antes solo caía en Director General)", () => {
    expect(cargosEnTexto("Asesor de la Dirección General")).toContain("Asesor(a) de Dirección General");
  });

  it("el nombre del ÁREA (SEYCA) sin la palabra 'subdirector' NO se marca como Subdirector", () => {
    expect(cargosEnTexto("Secretaria de SEYCA")).not.toContain("Subdirector(a) de Evaluación y Control Ambiental (SEYCA)");
    expect(cargosEnTexto("Profesional idóneo adscrito a SEYCA")).not.toContain(
      "Subdirector(a) de Evaluación y Control Ambiental (SEYCA)"
    );
    // pero "Subdirector ... de SEYCA" sí
    expect(cargosEnTexto("Subdirector de SEYCA")).toContain("Subdirector(a) de Evaluación y Control Ambiental (SEYCA)");
  });

  it("reconoce al Coordinador de Seguimiento aunque el texto invierta 'seguimiento y control ambiental'", () => {
    expect(cargosEnTexto("Coordinación de Seguimiento y Control Ambiental")).toContain(
      "Coordinador(a) de Seguimiento para la Sostenibilidad"
    );
    expect(cargosEnTexto("Coordinador de seguimiento / servidor delegado")).toContain(
      "Coordinador(a) de Seguimiento para la Sostenibilidad"
    );
  });

  it("mapea al staff del área de evaluación como Profesional o Técnico de Evaluación", () => {
    expect(cargosEnTexto("Servidor área de Evaluación y Control Ambiental")).toContain("Profesional o Técnico de Evaluación");
    expect(cargosEnTexto("Profesional de la Subdirección de Evaluación y Control Ambiental")).toContain(
      "Profesional o Técnico de Evaluación"
    );
  });
});
