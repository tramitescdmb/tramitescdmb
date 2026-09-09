import { describe, it, expect } from "vitest";
import { aplicarMarcadores, marcadoresPendientes } from "@/lib/plantillas-marcadores";

describe("aplicarMarcadores (MoReq 3.30)", () => {
  it("reemplaza los marcadores que trae el contexto", () => {
    const r = aplicarMarcadores("Señor [DESTINATARIO], en [CIUDAD] a [FECHA].", {
      DESTINATARIO: "Juan Pérez",
      CIUDAD: "Bucaramanga",
      FECHA: "9 de septiembre de 2026",
    });
    expect(r).toBe("Señor Juan Pérez, en Bucaramanga a 9 de septiembre de 2026.");
  });

  it("deja intacto el marcador cuyo valor no se conoce o está vacío", () => {
    expect(aplicarMarcadores("Radicado [RADICADO] / [ASUNTO]", { RADICADO: "", ASUNTO: undefined })).toBe(
      "Radicado [RADICADO] / [ASUNTO]"
    );
  });

  it("no toca texto sin marcadores", () => {
    expect(aplicarMarcadores("Cordial saludo.", {})).toBe("Cordial saludo.");
  });

  it("reemplaza todas las apariciones del mismo marcador", () => {
    expect(aplicarMarcadores("[X] y otra vez [X]", { X: "ok" })).toBe("ok y otra vez ok");
  });
});

describe("marcadoresPendientes", () => {
  it("lista los marcadores sin resolver, sin duplicados", () => {
    expect(marcadoresPendientes("[RADICADO] [ASUNTO] [RADICADO]").sort()).toEqual(["ASUNTO", "RADICADO"]);
  });

  it("devuelve vacío cuando no queda ninguno", () => {
    expect(marcadoresPendientes("todo resuelto")).toEqual([]);
  });
});
