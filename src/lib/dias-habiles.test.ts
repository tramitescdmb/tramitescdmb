import { describe, expect, it } from "vitest";
import {
  festivosColombia,
  esFestivo,
  esDiaHabil,
  esFinDeSemana,
  sumarDiasHabiles,
  diasHabilesEntre,
} from "./dias-habiles";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("festivosColombia", () => {
  it("incluye los festivos fijos de 2025", () => {
    const f = festivosColombia(2025);
    expect(f.has("2025-01-01")).toBe(true); // Año Nuevo
    expect(f.has("2025-05-01")).toBe(true); // Trabajo
    expect(f.has("2025-07-20")).toBe(true); // Independencia
    expect(f.has("2025-08-07")).toBe(true); // Boyacá
    expect(f.has("2025-12-08")).toBe(true); // Inmaculada
    expect(f.has("2025-12-25")).toBe(true); // Navidad
  });

  it("traslada Reyes al lunes siguiente cuando no cae lunes (2026-01-06 martes → 2026-01-12)", () => {
    const f = festivosColombia(2026);
    expect(f.has("2026-01-06")).toBe(false);
    expect(f.has("2026-01-12")).toBe(true);
  });

  it("incluye Viernes Santo (Semana Santa 2025 = 18 de abril)", () => {
    expect(esFestivo(d("2025-04-18"))).toBe(true);
  });
});

describe("esFinDeSemana / esDiaHabil", () => {
  it("sábado y domingo no son hábiles", () => {
    expect(esFinDeSemana(d("2025-01-04"))).toBe(true); // sábado
    expect(esFinDeSemana(d("2025-01-05"))).toBe(true); // domingo
    expect(esDiaHabil(d("2025-01-04"))).toBe(false);
  });

  it("un jueves normal es hábil", () => {
    expect(esDiaHabil(d("2025-01-02"))).toBe(true);
  });

  it("un festivo entre semana no es hábil", () => {
    expect(esDiaHabil(d("2025-01-01"))).toBe(false);
  });
});

describe("sumarDiasHabiles", () => {
  it("el día de partida no cuenta", () => {
    // jueves 2025-01-02 + 1 hábil = viernes 2025-01-03
    expect(sumarDiasHabiles(d("2025-01-02"), 1).toISOString().slice(0, 10)).toBe("2025-01-03");
  });

  it("salta fin de semana y el festivo de Reyes (viernes 03 + 1 hábil = martes 07, porque lun 06 es Reyes)", () => {
    expect(sumarDiasHabiles(d("2025-01-03"), 1).toISOString().slice(0, 10)).toBe("2025-01-07");
  });

  it("cuenta 10 días hábiles saltando fines de semana", () => {
    // desde jueves 2025-01-09 (sin festivos hasta el 20), 10 hábiles = jueves 2025-01-23
    expect(sumarDiasHabiles(d("2025-01-09"), 10).toISOString().slice(0, 10)).toBe("2025-01-23");
  });
});

describe("diasHabilesEntre", () => {
  it("cero si la fecha final no es posterior", () => {
    expect(diasHabilesEntre(d("2025-01-10"), d("2025-01-10"))).toBe(0);
  });

  it("es inverso de sumarDiasHabiles", () => {
    const fin = sumarDiasHabiles(d("2025-02-03"), 15);
    expect(diasHabilesEntre(d("2025-02-03"), fin)).toBe(15);
  });
});

describe("CalendarioLaboral (jornada + días no laborados de la entidad)", () => {
  it("un día compensado de la entidad no cuenta como hábil", () => {
    const cal = { diasNoLaborables: new Set(["2025-01-15"]) };
    expect(esDiaHabil(d("2025-01-15"))).toBe(true); // miércoles normal
    expect(esDiaHabil(d("2025-01-15"), cal)).toBe(false);
  });

  it("sumarDiasHabiles salta el día compensado", () => {
    const cal = { diasNoLaborables: new Set(["2025-01-15"]) };
    // martes 14 + 1 hábil = jueves 16 (miércoles 15 está compensado)
    expect(sumarDiasHabiles(d("2025-01-14"), 1, cal).toISOString().slice(0, 10)).toBe("2025-01-16");
  });

  it("si la entidad labora sábados, el sábado cuenta como hábil", () => {
    const cal = { diasSemana: [1, 2, 3, 4, 5, 6] };
    expect(esDiaHabil(d("2025-01-04"))).toBe(false); // sábado, jornada por defecto
    expect(esDiaHabil(d("2025-01-04"), cal)).toBe(true);
  });

  it("si la entidad no labora viernes, el viernes no es hábil", () => {
    const cal = { diasSemana: [1, 2, 3, 4] };
    expect(esDiaHabil(d("2025-01-03"), cal)).toBe(false); // viernes
  });
});
