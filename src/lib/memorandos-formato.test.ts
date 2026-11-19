import { describe, expect, it } from "vitest";
import { bloquesCuerpo, fechaLargaMemorando, formatearNumeroMemorando, leerDatosMemorando, siglaDependencia } from "@/lib/memorandos-formato";

describe("número del memorando", () => {
  it("toma la sigla del nombre de la dependencia", () => {
    expect(siglaDependencia("Oficina Asesora de Direccionamiento Estratégico Institucional - ADEI", "110")).toBe("ADEI");
    expect(siglaDependencia("Subdirección de Evaluación y Control Ambiental - SEYCA - Grupo Evaluación para la Sostenibilidad", "710")).toBe("SEYCA");
    expect(siglaDependencia("Dirección General", "100")).toBe("DG");
    expect(siglaDependencia("Oficina sin sigla", "130")).toBe("130");
  });

  it("sigue el formato del modelo ADEI – 054 /2026", () => {
    expect(formatearNumeroMemorando("ADEI", 54, 2026)).toBe("ADEI – 054 /2026");
    expect(formatearNumeroMemorando("SEYCA", 1234, 2026)).toBe("SEYCA – 1234 /2026");
  });
});

describe("fecha del memorando", () => {
  it("escribe la fecha en letras y en hora de Colombia", () => {
    expect(fechaLargaMemorando(new Date("2026-02-05T15:00:00Z"))).toBe("5 de febrero de 2026");
    expect(fechaLargaMemorando(new Date("2026-02-06T03:00:00Z"))).toBe("5 de febrero de 2026");
  });
});

describe("datos guardados", () => {
  it("lee los datos del formato y descarta lo incompleto", () => {
    const d = leerDatosMemorando({
      version: 1,
      consecutivo: 54,
      numero: "ADEI – 054 /2026",
      para: { nombre: "Kelly Restrepo", cargo: "Jefe Oficina de Control Interno" },
      de: { nombre: "Oscar Rodríguez", cargo: "Jefe Oficina ADEI" },
      proyecto: { nombre: "", cargo: "x" },
      oficina: "Oficina ADEI",
    });
    expect(d?.numero).toBe("ADEI – 054 /2026");
    expect(d?.ciudad).toBe("Bucaramanga");
    expect(d?.proyecto).toBeNull();
    expect(leerDatosMemorando(null)).toBeNull();
    expect(leerDatosMemorando({ numero: "x" })).toBeNull();
  });
});

describe("cuerpo del memorando", () => {
  it("separa párrafos, negrillas y tablas", () => {
    const b = bloquesCuerpo("**1. Trámites reportados**\nAdjunto la lista:\n\n| Código | Nombre |\n|---|---|\n| 19201 | Concesión de aguas |\n\nCordialmente,");
    expect(b).toHaveLength(3);
    expect(b[0]).toEqual({
      tipo: "parrafo",
      lineas: [[{ texto: "1. Trámites reportados", negrilla: true }], [{ texto: "Adjunto la lista:", negrilla: false }]],
    });
    expect(b[1]!.tipo).toBe("tabla");
    if (b[1]!.tipo === "tabla") {
      expect(b[1]!.filas).toHaveLength(2);
      expect(b[1]!.filas[1]![0]).toEqual([{ texto: "19201", negrilla: false }]);
    }
    expect(b[2]!.tipo).toBe("parrafo");
  });

  it("un texto plano queda igual", () => {
    expect(bloquesCuerpo("Hola")).toEqual([{ tipo: "parrafo", lineas: [[{ texto: "Hola", negrilla: false }]] }]);
    expect(bloquesCuerpo("  \n ")).toEqual([]);
  });
});
