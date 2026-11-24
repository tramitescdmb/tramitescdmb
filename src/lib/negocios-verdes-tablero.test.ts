import { describe, expect, it } from "vitest";
import { calcularTablero, combinacionesReconocimientos, puntajesDelAnio, type FilaTableroNV } from "./negocios-verdes-tablero";

const fila = (o: Partial<FilaTableroNV>): FilaTableroNV => ({
  id: Math.random().toString(36),
  nombre: "N",
  municipio: "Girón",
  activo: true,
  estado: "ACTIVO",
  conFoto: true,
  categoria: "Bioproductos",
  pendiente: false,
  emprendimientoVerde: false,
  selloMarca: false,
  avalado: false,
  puntajes: {},
  ...o,
});

describe("tablero de Negocios Verdes", () => {
  const filas = [
    fila({ activo: false, estado: "ACTIVO", conFoto: false, puntajes: { 2024: 60, 2025: 80 } }),
    fila({ municipio: "Bucaramanga", estado: "RETIRADO", pendiente: true, emprendimientoVerde: true, puntajes: { 2025: 0 } }),
    fila({ municipio: "Bucaramanga", selloMarca: true, avalado: true, puntajes: { 2025: 70 } }),
  ];

  it("cifras globales", () => {
    const t = calcularTablero(filas, { tipo: "global" });
    expect(t.publicados).toBe(2);
    expect(t.faltanPublicar).toBe(1);
    expect(t.sinFoto).toBe(1);
    expect(t.sinClasificar).toBe(1);
    expect(t.porMunicipio[0]).toEqual(["Bucaramanga", 2]);
    expect(t.segundaTorta.titulo).toBe("Por estado CDMB");
  });

  it("el promedio por año solo cuenta los calificados (puntaje mayor que 0)", () => {
    const t = calcularTablero(filas, { tipo: "global" });
    expect(t.porAnio).toEqual([
      { anio: 2024, promedio: 60, negocios: 1 },
      { anio: 2025, promedio: 75, negocios: 2 },
    ]);
  });

  it("vista por un estado concreto: la segunda torta es publicado / sin publicar", () => {
    const t = calcularTablero(filas, { tipo: "estado", estado: "ACTIVO" });
    expect(t.filas).toHaveLength(2);
    expect(t.segundaTorta.titulo).toBe("Publicación en el sitio");
  });

  it("ranking y promedio por municipio de un año", () => {
    const p = puntajesDelAnio(filas, 2025);
    expect(p.delAnio.map((x) => x.puntaje)).toEqual([80, 70]);
    expect(p.porMunicipio[0]).toEqual({ municipio: "Girón", promedio: 80, negocios: 1 });
  });

  it("combinaciones de reconocimientos", () => {
    const c = Object.fromEntries(combinacionesReconocimientos(filas));
    expect(c["Sello Marca + Avalado"]).toBe(1);
    expect(c["Solo Emprendimiento Verde"]).toBe(1);
    expect(c["Sin ningún reconocimiento"]).toBe(1);
  });
});
