import { describe, expect, it } from "vitest";
import { construirFilasFirmantes, type SolicitudPanel, type FirmaPanel } from "./panel-firmas";

const director = { id: "d", nombre: "Dora Directora", denominacionEmpleo: "DIRECTOR_GENERAL", sexo: "F" };
const subdirector = { id: "s", nombre: "Saúl Subdirector", denominacionEmpleo: "SUBDIRECTOR", sexo: "M" };
const profesional = { id: "p", nombre: "Pía Profesional", denominacionEmpleo: "PROFESIONAL_UNIVERSITARIO", sexo: "F" };
const contratista = { id: "c", nombre: "Carlos Contratista", denominacionEmpleo: "CONTRATISTA" };

function solicitud(id: string, u: SolicitudPanel["usuarioAsignado"], orden: number, extra: Partial<SolicitudPanel> = {}): SolicitudPanel {
  return { id, rol: "FIRMA", calidad: "PRINCIPAL", orden, estado: "PENDIENTE", completadoEn: null, usuarioAsignado: u, ...extra };
}

describe("construirFilasFirmantes", () => {
  it("el de mayor jerarquía tiene el turno y los demás esperan", () => {
    const filas = construirFilasFirmantes(
      [solicitud("1", contratista, 5, { calidad: "PROYECTO" }), solicitud("2", director, 1), solicitud("3", subdirector, 3)],
      [],
      "SGDEA",
    );
    expect(filas.map((f) => f.nombre)).toEqual(["Dora Directora", "Saúl Subdirector", "Carlos Contratista"]);
    expect(filas.map((f) => f.estado)).toEqual(["TURNO", "EN_ESPERA", "EN_ESPERA"]);
    expect(filas[0]!.cargo).toBe("Directora General");
    expect(filas[2]!.calidad).toBe("Proyectó");
  });

  it("cuando firma el superior, pasa el turno al siguiente nivel", () => {
    const firma: FirmaPanel = { id: "f1", calidad: "PRINCIPAL", fechaHora: new Date("2026-09-29T15:00:00Z"), usuario: director };
    const filas = construirFilasFirmantes(
      [solicitud("2", director, 1, { estado: "COMPLETADA", completadoEn: firma.fechaHora }), solicitud("3", subdirector, 3)],
      [firma],
      "SGDEA",
    );
    expect(filas.map((f) => f.estado)).toEqual(["FIRMADO", "TURNO"]);
    expect(filas[0]!.fecha?.toISOString()).toBe("2026-09-29T15:00:00.000Z");
  });

  it("incluye las firmas directas que no vienen de una solicitud", () => {
    const firma: FirmaPanel = { id: "f2", calidad: "PRINCIPAL", fechaHora: new Date(), usuario: profesional };
    const filas = construirFilasFirmantes([], [firma], "SGDEA");
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ nombre: "Pía Profesional", estado: "FIRMADO", calidad: "Firmante principal" });
  });

  it("muestra el motivo de un rechazo", () => {
    const filas = construirFilasFirmantes(
      [solicitud("4", subdirector, 3, { estado: "RECHAZADA", completadoEn: new Date(), comentario: "Falta el anexo" })],
      [],
      "SGDEA",
    );
    expect(filas[0]).toMatchObject({ estado: "RECHAZADO", comentario: "Falta el anexo" });
  });
});
