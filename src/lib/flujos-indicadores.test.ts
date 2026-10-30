import { describe, expect, it } from "vitest";
import { promedioDiasHabiles, sumarUso, tiemposPorPaso } from "@/lib/flujos-indicadores";

const cal = { diasNoLaborables: new Set<string>(), diasSemana: [1, 2, 3, 4, 5] };
const d = (iso: string) => new Date(`${iso}T15:00:00Z`);

describe("indicadores de flujos", () => {
  it("mide cada paso desde que el flujo llegó hasta que se completó, en días hábiles", () => {
    const tiempos = tiemposPorPaso(
      [
        {
          iniciadoEn: d("2026-10-05"),
          ejecuciones: [
            { pasoId: "revisar", completadoEn: d("2026-10-09") },
            { pasoId: "proyectar", completadoEn: d("2026-10-07") },
          ],
        },
        { iniciadoEn: d("2026-10-05"), ejecuciones: [{ pasoId: "proyectar", completadoEn: d("2026-10-06") }] },
      ],
      new Map([
        ["proyectar", 1],
        ["revisar", 10],
      ]),
      cal,
    );
    expect(tiempos.get("proyectar")).toEqual({ veces: 2, promedioDias: 1.5, maximoDias: 2, fueraDeTermino: 1 });
    expect(tiempos.get("revisar")).toEqual({ veces: 1, promedioDias: 2, maximoDias: 2, fueraDeTermino: 0 });
  });

  it("promedia la duración y suma el uso de todas las versiones", () => {
    expect(promedioDiasHabiles([], cal)).toBeNull();
    expect(promedioDiasHabiles([{ inicio: d("2026-10-05"), fin: d("2026-10-09") }], cal)).toBe(4);
    expect(
      sumarUso([
        { enCurso: 1, vencidos: 1, completados: 2, cancelados: 0 },
        undefined,
        { enCurso: 2, vencidos: 0, completados: 1, cancelados: 3 },
      ]),
    ).toEqual({ enCurso: 3, vencidos: 1, completados: 3, cancelados: 3 });
  });
});
