import { describe, expect, it } from "vitest";
import { documentoEtapaAbierta, puedeIntentarEliminarDocumento } from "./documentos";

describe("documentoEtapaAbierta", () => {
  it("un documento de radicación (pasoNumero null) se trata como paso 1", () => {
    expect(documentoEtapaAbierta(null, 1)).toBe(true);
    expect(documentoEtapaAbierta(null, 2)).toBe(false);
  });

  it("está abierta cuando el documento pertenece al paso actual del expediente", () => {
    expect(documentoEtapaAbierta(3, 3)).toBe(true);
  });

  it("está cerrada cuando el expediente ya avanzó a un paso posterior", () => {
    expect(documentoEtapaAbierta(2, 3)).toBe(false);
  });
});

describe("puedeIntentarEliminarDocumento", () => {
  it("en etapa abierta, quien subió el documento puede intentarlo", () => {
    expect(puedeIntentarEliminarDocumento({ esAdmin: false, esQuienLoSubio: true, etapaAbierta: true })).toBe(true);
  });

  it("en etapa abierta, otro funcionario (no quien lo subió) NO puede", () => {
    expect(puedeIntentarEliminarDocumento({ esAdmin: false, esQuienLoSubio: false, etapaAbierta: true })).toBe(false);
  });

  it("en etapa cerrada, NINGÚN funcionario puede — ni siquiera quien lo subió", () => {
    expect(puedeIntentarEliminarDocumento({ esAdmin: false, esQuienLoSubio: true, etapaAbierta: false })).toBe(false);
    expect(puedeIntentarEliminarDocumento({ esAdmin: false, esQuienLoSubio: false, etapaAbierta: false })).toBe(false);
  });

  it("un administrador puede intentarlo en cualquier etapa (la etapa cerrada además exige el oficio, verificado aparte)", () => {
    expect(puedeIntentarEliminarDocumento({ esAdmin: true, esQuienLoSubio: false, etapaAbierta: true })).toBe(true);
    expect(puedeIntentarEliminarDocumento({ esAdmin: true, esQuienLoSubio: false, etapaAbierta: false })).toBe(true);
  });
});
