import { describe, expect, it } from "vitest";
import { calcularCumplimiento, CATEGORIAS_MOREQ, csvMatrizMoreq, filasSemillaMoreq } from "./matriz-moreq";

describe("matriz de cumplimiento MoReq", () => {
  it("calcula el porcentaje con los completos más la mitad de los parciales", () => {
    expect(calcularCumplimiento(["COMPLETO", "PARCIAL", "PENDIENTE", "COMPLETO"])).toEqual({
      total: 4,
      completos: 2,
      parciales: 1,
      pendientes: 1,
      porcentaje: 63,
    });
    expect(calcularCumplimiento([]).porcentaje).toBe(0);
  });

  it("trae los 209 requisitos del MOREQ v5, sin números repetidos y en las 8 categorías", () => {
    const filas = filasSemillaMoreq();
    expect(filas).toHaveLength(209);
    expect(new Set(filas.map((f) => f.numero)).size).toBe(209);
    expect(new Set(filas.map((f) => f.categoria))).toEqual(new Set(CATEGORIAS_MOREQ.map((c) => c.n)));
    expect(filas.every((f) => f.titulo.trim() && f.nota.trim())).toBe(true);
  });

  it("exporta el CSV con separador punto y coma y comillas escapadas", () => {
    const csv = csvMatrizMoreq([
      { numero: "1.1", categoria: 1, titulo: 'Crear la "TRD"', estado: "PARCIAL", nota: "Nota; con separador", actualizadoEn: null, actualizadoPor: null },
    ]);
    const [encabezado, fila] = csv.replace("﻿", "").split("\r\n");
    expect(encabezado).toBe("numero;categoria;requisito;estado;nota;ultima_edicion;editado_por");
    expect(fila).toBe('"1.1";"1. Clasificación y Organización Documental";"Crear la ""TRD""";"Parcial";"Nota; con separador";"";""');
  });
});
