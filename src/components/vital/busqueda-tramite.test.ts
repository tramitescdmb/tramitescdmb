import { describe, expect, it } from "vitest";
import { coincideBusqueda } from "./tramite-opciones";

describe("coincideBusqueda (selector «Convertir en trámite»)", () => {
  const t = { nombre: "Certificación Minera Ambiental", codigo: "PR30" };

  it("encuentra texto en cualquier parte del nombre, sin mayúsculas ni tildes", () => {
    expect(coincideBusqueda(t, "mine")).toBe(true);
    expect(coincideBusqueda(t, "CERTIFICACION")).toBe(true);
    expect(coincideBusqueda(t, "ambiental cert")).toBe(true);
  });

  it("busca también por código y no coincide con texto ausente", () => {
    expect(coincideBusqueda(t, "pr30")).toBe(true);
    expect(coincideBusqueda(t, "vertimiento")).toBe(false);
  });

  it("busca por número SUIT", () => {
    expect(coincideBusqueda({ ...t, suits: ["19505"] }, "1950")).toBe(true);
  });

  it("sin búsqueda, todo coincide", () => {
    expect(coincideBusqueda(t, "  ")).toBe(true);
  });
});
