import { describe, expect, it } from "vitest";
import { paginar } from "@/lib/pdf-desde-documento";

describe("paginar el documento", () => {
  it("corta en el último límite de bloque que cabe en la página", () => {
    expect(paginar(250, 100, [40, 90, 130, 180, 240])).toEqual([
      [0, 90],
      [90, 180],
      [180, 250],
    ]);
  });

  it("si un bloque no cabe en una página, lo parte al límite", () => {
    expect(paginar(250, 100, [10, 240])).toEqual([
      [0, 100],
      [100, 200],
      [200, 250],
    ]);
  });
});
