import { describe, expect, it } from "vitest";
import { desplazarMes, desplazarVista, diasDeVista, fechaValida, ubicarBloques, vistaValida, expedienteEnEjecucion, fechaHoraColombia, partesColombia, filtrarExpedientes } from "./planeador";

describe("fechaHoraColombia / partesColombia", () => {
  it("interpreta fecha y hora en hora de Colombia y la devuelve igual", () => {
    const d = fechaHoraColombia("2026-10-06", "08:30")!;
    expect(d.toISOString()).toBe("2026-10-06T13:30:00.000Z");
    expect(partesColombia(d)).toEqual({ fecha: "2026-10-06", hora: "08:30" });
  });

  it("conserva la fecha local en la noche", () => {
    const d = fechaHoraColombia("2026-10-06", "22:15")!;
    expect(partesColombia(d)).toEqual({ fecha: "2026-10-06", hora: "22:15" });
  });

  it("rechaza formatos inválidos", () => {
    expect(fechaHoraColombia("06/10/2026", "08:30")).toBeNull();
    expect(fechaHoraColombia("2026-10-06", "8:30")).toBeNull();
  });
});

describe("meses", () => {
  it("desplaza entre años", () => {
    expect(desplazarMes(2026, 12, 1)).toEqual({ anio: 2027, mes: 1 });
    expect(desplazarMes(2026, 1, -1)).toEqual({ anio: 2025, mes: 12 });
  });

});

describe("vistas del calendario", () => {
  it("arma la semana laboral y la semana completa desde el lunes", () => {
    expect(diasDeVista("laboral", "2026-10-08")).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]);
    expect(diasDeVista("semana", "2026-10-11").at(-1)).toBe("2026-10-11");
  });

  it("cubre el mes con semanas completas", () => {
    const dias = diasDeVista("mes", "2026-10-20");
    expect(dias[0]).toBe("2026-09-28");
    expect(dias.at(-1)).toBe("2026-11-01");
    expect(dias.length % 7).toBe(0);
  });

  it("desplaza por la unidad de la vista y ajusta fin de mes", () => {
    expect(desplazarVista("dia", "2026-12-31", 1)).toBe("2027-01-01");
    expect(desplazarVista("semana", "2026-10-06", -1)).toBe("2026-09-29");
    expect(desplazarVista("mes", "2026-01-31", 1)).toBe("2026-02-28");
  });

  it("valida vista y fecha", () => {
    expect(vistaValida("xyz")).toBe("semana");
    expect(fechaValida("2026-02-30x", "2026-10-06")).toBe("2026-10-06");
  });

  it("reparte en columnas los bloques que se cruzan", () => {
    const r = ubicarBloques([{ minutos: 480 }, { minutos: 510 }, { minutos: 600 }], 60);
    expect(r.map((b) => [b.item.minutos, b.columna, b.columnas])).toEqual([
      [480, 0, 2],
      [510, 1, 2],
      [600, 0, 1],
    ]);
  });
});

describe("filtrarExpedientes", () => {
  const lista = [
    { numero: "M-DA-PR39-2026-0002", tramite: "Permiso de Ocupación de Cauces", solicitante: "Acueducto S.A.", identificacion: "890.200.162-3", municipio: "Bucaramanga", otrosIdentificadores: ["68001010203"] },
    { numero: "M-DA-PR05-2026-0010", tramite: "Concesión de Aguas Superficiales", solicitante: "José Pérez", identificacion: "91234567", municipio: "Girón", otrosIdentificadores: [] },
  ];
  const nums = (q: string) => filtrarExpedientes(lista, q).map((e) => e.numero);

  it("busca por código, tipo de trámite y varios términos sin tildes", () => {
    expect(nums("pr05")).toEqual(["M-DA-PR05-2026-0010"]);
    expect(nums("ocupacion cauces")).toEqual(["M-DA-PR39-2026-0002"]);
    expect(nums("concesion giron")).toEqual(["M-DA-PR05-2026-0010"]);
  });

  it("busca por NIT o cédula con o sin puntos y por catastral", () => {
    expect(nums("890200162")).toEqual(["M-DA-PR39-2026-0002"]);
    expect(nums("91234567")).toEqual(["M-DA-PR05-2026-0010"]);
    expect(nums("68001010203")).toEqual(["M-DA-PR39-2026-0002"]);
  });

  it("sin consulta devuelve todo", () => {
    expect(nums("  ")).toHaveLength(2);
  });
});

describe("expedienteEnEjecucion", () => {
  it("excluye estados finales y archivados", () => {
    expect(expedienteEnEjecucion({ estado: "EN_TRAMITE", archivado: false })).toBe(true);
    expect(expedienteEnEjecucion({ estado: "APROBADO", archivado: false })).toBe(false);
    expect(expedienteEnEjecucion({ estado: "EN_TRAMITE", archivado: true })).toBe(false);
  });
});
