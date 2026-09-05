import { describe, expect, it } from "vitest";
import { hashContenidoFirma } from "./firma";

describe("hashContenidoFirma", () => {
  const base = { radicado: "CDMB-E-2026-000001", asunto: "Respuesta a solicitud", contenido: "Cuerpo del oficio.", fechaIso: "2026-01-01T00:00:00.000Z" };

  it("es determinista: el mismo contenido produce el mismo hash", () => {
    expect(hashContenidoFirma(base)).toBe(hashContenidoFirma({ ...base }));
  });

  it("cambiar el contenido cambia el hash (detecta alteración posterior a la firma)", () => {
    const h1 = hashContenidoFirma(base);
    const h2 = hashContenidoFirma({ ...base, contenido: "Cuerpo del oficio modificado." });
    expect(h1).not.toBe(h2);
  });

  it("cambiar el asunto también cambia el hash", () => {
    const h1 = hashContenidoFirma(base);
    const h2 = hashContenidoFirma({ ...base, asunto: "Otro asunto" });
    expect(h1).not.toBe(h2);
  });

  it("produce un hash SHA-256 válido (64 caracteres hexadecimales)", () => {
    expect(hashContenidoFirma(base)).toMatch(/^[0-9a-f]{64}$/);
  });
});
