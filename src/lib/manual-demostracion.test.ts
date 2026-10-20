import { describe, expect, it } from "vitest";
import { filasSemillaManual, parrafos, pasosDesdeTexto, segmentosTexto, validarDatosApartado } from "./manual-demostracion";

describe("manual de demostración del SGDEA", () => {
  it("trae los 18 apartados completos y en orden", () => {
    const apartados = filasSemillaManual();
    expect(apartados).toHaveLength(18);
    expect(apartados.map((a) => a.orden)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(apartados.every((a) => a.titulo && a.etiqueta && a.resumen && a.pasos.length >= 3 && a.fundamento)).toBe(true);
  });

  it("interpreta código, negrita y enlaces sin aceptar destinos peligrosos", () => {
    expect(segmentosTexto("Abrir `/pqrsd` con **cuidado** en [la matriz](/correspondencia/matriz-moreq).")).toEqual([
      { tipo: "texto", valor: "Abrir " },
      { tipo: "codigo", valor: "/pqrsd" },
      { tipo: "texto", valor: " con " },
      { tipo: "negrita", valor: "cuidado" },
      { tipo: "texto", valor: " en " },
      { tipo: "enlace", valor: "la matriz", destino: "/correspondencia/matriz-moreq" },
      { tipo: "texto", valor: "." },
    ]);
    expect(segmentosTexto("[x](javascript:alert(1))").every((s) => s.tipo === "texto")).toBe(true);
    expect(segmentosTexto("[x](//sitio.externo)").every((s) => s.tipo === "texto")).toBe(true);
    expect(segmentosTexto("[x](https://www.cdmb.gov.co)")).toEqual([{ tipo: "enlace", valor: "x", destino: "https://www.cdmb.gov.co" }]);
  });

  it("separa pasos por línea y párrafos por línea en blanco", () => {
    expect(pasosDesdeTexto("1. Primero\n\n- Segundo\n3) Tercero  ")).toEqual(["Primero", "Segundo", "Tercero"]);
    expect(parrafos("Uno\nsigue\n\nDos")).toEqual(["Uno sigue", "Dos"]);
  });

  it("exige título, etiqueta y resumen, y toma el título como índice si falta", () => {
    expect(() => validarDatosApartado({ titulo: "", etiqueta: "X", resumen: "Y" }, 1)).toThrow("título");
    const datos = validarDatosApartado({ titulo: "Nuevo", etiqueta: "Archivo", resumen: "Resumen", pasos: "a\nb", orden: "0" }, 18);
    expect(datos.orden).toBe(18);
    expect(datos.tituloIndice).toBe("Nuevo");
    expect(datos.pasos).toEqual(["a", "b"]);
  });
});

describe("semilla del manual de GECON", () => {
  it("trae apartados válidos y ordenados", () => {
    const apartados = filasSemillaManual("GECON");
    expect(apartados.length).toBeGreaterThan(5);
    expect(apartados.map((a) => a.orden)).toEqual([...apartados.map((a) => a.orden)].sort((x, y) => x - y));
    for (const a of apartados) expect(a.pasos.length).toBeGreaterThan(0);
  });
});
