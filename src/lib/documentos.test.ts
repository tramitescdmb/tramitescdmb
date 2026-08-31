import { describe, expect, it } from "vitest";
import { documentoEtapaAbierta } from "./documentos";

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
