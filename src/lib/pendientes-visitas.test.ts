import { describe, expect, it } from "vitest";
import { clasificarVisitas, etiquetaDia, type ExpedienteAlerta, type VisitaAlerta } from "./pendientes-visitas";

const h = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);
const ahora = h("2026-10-06", "15:00");

function visita(over: Partial<VisitaAlerta>): VisitaAlerta {
  return {
    id: "v",
    expedienteId: "e",
    numero: "M-DA-PR39-2026-0002",
    tramite: "Ocupación de cauces",
    profesionalId: "yo",
    profesional: "Yo",
    inicio: h("2026-10-07", "08:00"),
    fin: h("2026-10-07", "10:00"),
    estado: "PROGRAMADA",
    lugar: "Bucaramanga",
    ...over,
  };
}

function exp(over: Partial<ExpedienteAlerta>): ExpedienteAlerta {
  return { id: "e", numero: "N", tramite: "T", pasoActualNumero: 4, pasoTitulo: "NOTIFICAR EL AUTO Y PROGRAMAR LA VISITA", visitas: [], pasosConHoja: [], ...over };
}

describe("etiquetaDia", () => {
  it("nombra hoy y mañana", () => {
    expect(etiquetaDia("2026-10-06", "2026-10-06")).toBe("Hoy");
    expect(etiquetaDia("2026-10-07", "2026-10-06")).toBe("Mañana");
    expect(etiquetaDia("2026-10-09", "2026-10-06")).toMatch(/^Viernes/);
  });
});

describe("clasificarVisitas", () => {
  it("separa mis visitas próximas de las que ya pasaron sin registrar", () => {
    const r = clasificarVisitas({
      userId: "yo",
      planificador: false,
      ahora,
      expedientes: [],
      visitas: [
        visita({ id: "manana" }),
        visita({ id: "ayer", inicio: h("2026-10-05", "08:00"), fin: h("2026-10-05", "09:00") }),
        visita({ id: "lejos", inicio: h("2026-10-20", "08:00"), fin: h("2026-10-20", "09:00") }),
        visita({ id: "otro", profesionalId: "otro", inicio: h("2026-10-05", "08:00"), fin: h("2026-10-05", "09:00") }),
      ],
    });
    expect(r.proximas.map((a) => [a.visitaId, a.destacada])).toEqual([["manana", true]]);
    expect(r.proximas[0]!.texto).toMatch(/^Mañana, /);
    expect(r.porRegistrar.map((a) => a.visitaId)).toEqual(["ayer"]);
    expect(r.equipoVencidas).toEqual([]);
  });

  it("al planificador le muestra las vencidas del equipo, las no realizadas y los pasos de visita sin programar", () => {
    const r = clasificarVisitas({
      userId: "yo",
      planificador: true,
      ahora,
      visitas: [visita({ id: "otro", profesionalId: "otro", profesional: "Ana", inicio: h("2026-10-05", "08:00"), fin: h("2026-10-05", "09:00") })],
      expedientes: [
        exp({ id: "sin" }),
        exp({ id: "con", visitas: [{ estado: "PROGRAMADA", inicio: h("2026-10-08", "08:00") }] }),
        exp({ id: "fallida", visitas: [{ estado: "NO_REALIZADA", inicio: h("2026-10-02", "08:00") }] }),
        exp({ id: "otropaso", pasoTitulo: "ELABORAR AUTO DE INICIO" }),
        exp({ id: "hecha", pasoTitulo: "REALIZAR VISITA TÉCNICA", visitas: [{ estado: "REALIZADA", inicio: h("2026-10-01", "08:00") }] }),
      ],
    });
    expect(r.equipoVencidas.map((a) => a.texto)).toEqual([expect.stringContaining("Ana")]);
    expect(r.porReprogramar.map((a) => a.expedienteId)).toEqual(["fallida"]);
    expect(r.sinProgramar.map((a) => a.expedienteId)).toEqual(["sin"]);
    expect(r.hayAlgo).toBe(true);
  });
});
