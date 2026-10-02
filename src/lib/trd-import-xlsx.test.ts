import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { filasDesdeMatriz, mapearEncabezados } from "@/lib/trd-import-xlsx";
import { marcasADisposiciones, type FilaTrdCsv } from "@/lib/trd-import";
import { esSerieSinSubseries, resumenRetencion } from "@/lib/trd-presentacion";

const ENCABEZADO = [
  "CODIGO",
  "OFICINA PRODUCTORA",
  "CODIGO",
  "SERIE",
  "CODIGO",
  "SUBSERIE",
  "TIEMPO\nRETENCION\nAG",
  "TIEMPO\nRETENCION\nAC",
  "DISPOSICION\nFINAL",
  "PROCEDIMIENTO DE REPROGRAFÍA",
];

describe("mapearEncabezados", () => {
  it("asigna cada CODIGO a la columna de nombre que lo sigue", () => {
    expect(mapearEncabezados(ENCABEZADO)).toEqual([
      "dependencia_codigo",
      "dependencia_nombre",
      "serie_codigo",
      "serie_nombre",
      "subserie_codigo",
      "subserie_nombre",
      "retencion_gestion",
      "retencion_central",
      "disposicion_final",
      "reprografia",
    ]);
  });
});

describe("filasDesdeMatriz", () => {
  const matriz = [
    ["NOMBRE DE LA ENTIDAD: CDMB", "", "", "", "", "", "", "", "", ""],
    ENCABEZADO,
    ["100", "DIRECCIÓN GENERAL", "20", "ACTAS", "8", "Actas de Comité Directivo", "2", "8", "CT", "D"],
    ["100", "DIRECCIÓN GENERAL", "250", "DERECHOS DE PETICIÓN", " ", "", "1", "9", "S", "D"],
    ["", "", "", "", "", "", "", "", "", "", "Nota aclaratoria sin datos"],
  ];

  it("detecta el encabezado debajo del título y omite filas sin códigos", () => {
    const { filas, errores } = filasDesdeMatriz(matriz);
    expect(errores).toEqual([]);
    expect(filas).toHaveLength(2);
    expect(filas[0]!.numeroFila).toBe(3);
  });

  it("compone el código de subserie como serie.subserie", () => {
    const { filas } = filasDesdeMatriz(matriz);
    expect(filas[0]!.subserie_codigo).toBe("20.8");
    expect(filas[0]!.dependencia_nombre).toBe("DIRECCIÓN GENERAL");
  });

  it("deja vacía la subserie cuando la serie no se subdivide", () => {
    const { filas } = filasDesdeMatriz(matriz);
    expect(filas[1]!.subserie_codigo).toBe("");
  });

  it("no vuelve a componer un código que ya trae punto", () => {
    const { filas } = filasDesdeMatriz([ENCABEZADO, ["100", "DG", "20", "ACTAS", "20.8", "Actas", "2", "8", "CT", ""]]);
    expect(filas[0]!.subserie_codigo).toBe("20.8");
  });

  it("informa cuando no encuentra encabezados", () => {
    const { filas, errores } = filasDesdeMatriz([["a", "b"], ["1", "2"]]);
    expect(filas).toEqual([]);
    expect(errores).toHaveLength(1);
  });
});

describe("marcasADisposiciones", () => {
  const fila = (disposicion_final: string, reprografia = "") =>
    ({ disposicion_final, reprografia }) as unknown as FilaTrdCsv;

  it("convierte las siglas del cuadro resumen", () => {
    expect(marcasADisposiciones(fila("CT", "D"))).toEqual(["CONSERVACION_TOTAL", "MICROFILMACION_DIGITALIZACION"]);
    expect(marcasADisposiciones(fila("E"))).toEqual(["ELIMINACION"]);
    expect(marcasADisposiciones(fila("S", "M/D"))).toEqual(["SELECCION", "MICROFILMACION_DIGITALIZACION"]);
  });

  it("sigue aceptando las columnas marcadas con X del CSV", () => {
    expect(marcasADisposiciones({ disposicion_ct: "X", disposicion_md: "x" } as unknown as FilaTrdCsv)).toEqual([
      "CONSERVACION_TOTAL",
      "MICROFILMACION_DIGITALIZACION",
    ]);
  });
});

describe("presentación de la TRD", () => {
  it("reconoce una serie sin subseries", () => {
    expect(esSerieSinSubseries({ codigo: "250", subseries: [{ codigo: "250" }] })).toBe(true);
    expect(esSerieSinSubseries({ codigo: "20", subseries: [{ codigo: "20.8" }] })).toBe(false);
  });

  it("resume retención y disposición", () => {
    expect(
      resumenRetencion({
        id: "x",
        codigo: "250",
        nombre: "Derechos de Petición",
        retencionGestionAnios: 1,
        retencionCentralAnios: 9,
        disposicionesFinal: ["SELECCION"],
      })
    ).toBe("Archivo de gestión: 1 año · Archivo central: 9 años · Disposición final: Selección");
  });
});
