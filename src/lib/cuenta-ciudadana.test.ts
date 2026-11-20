import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  bitsCeroIniciales,
  codigoCoincide,
  crearReto,
  generarCodigo,
  hashCodigo,
  normalizarCodigo,
  normalizarCorreo,
  origenPermitido,
  retoResuelto,
  rutaSiguienteSegura,
} from "@/lib/cuenta-ciudadana";
import { historialPublico } from "@/lib/solicitud-ambiental";

beforeAll(() => {
  process.env.SESSION_SECRET ||= "secreto-de-prueba";
});

function resolver(reto: string, dificultad: number): string {
  for (let n = 0; ; n++) {
    if (bitsCeroIniciales(createHash("sha256").update(`${reto}:${n}`).digest()) >= dificultad) return String(n);
  }
}

describe("cuenta ciudadana", () => {
  it("normaliza correos y códigos", () => {
    expect(normalizarCorreo("  Ana@Correo.CO ")).toBe("ana@correo.co");
    expect(normalizarCorreo("sin-arroba")).toBeNull();
    expect(normalizarCodigo("12 34 56")).toBe("123456");
    expect(normalizarCodigo("12345")).toBeNull();
    expect(generarCodigo()).toMatch(/^\d{6}$/);
  });

  it("el código queda atado al correo", () => {
    const h = hashCodigo("a@b.co", "123456");
    expect(codigoCoincide("a@b.co", "123456", h)).toBe(true);
    expect(codigoCoincide("otro@b.co", "123456", h)).toBe(false);
    expect(codigoCoincide("a@b.co", "123457", h)).toBe(false);
  });

  it("cuenta los bits en cero", () => {
    expect(bitsCeroIniciales(Buffer.from([0, 0x10, 0xff]))).toBe(11);
    expect(bitsCeroIniciales(Buffer.from([0x80]))).toBe(0);
  });

  it("acepta un reto resuelto y rechaza alterado, vencido o sin resolver", () => {
    const ahora = Date.now();
    const reto = crearReto(ahora);
    const solucion = resolver(reto, 8);
    expect(retoResuelto(reto, solucion, ahora, 8)).toBe(true);
    expect(retoResuelto(reto.replace(/^\d/, "9"), solucion, ahora, 8)).toBe(false);
    expect(retoResuelto(reto, solucion, ahora + 11 * 60_000, 8)).toBe(false);
    expect(retoResuelto(reto, "abc", ahora, 8)).toBe(false);
  });

  it("solo redirige dentro de la vista pública", () => {
    expect(rutaSiguienteSegura("/solicitud-ambiental/mis-solicitudes/abc")).toBe("/solicitud-ambiental/mis-solicitudes/abc");
    expect(rutaSiguienteSegura("https://malo.com")).toBe("/solicitud-ambiental/mis-solicitudes");
    expect(rutaSiguienteSegura("//malo.com")).toBe("/solicitud-ambiental/mis-solicitudes");
    expect(rutaSiguienteSegura("/admin")).toBe("/solicitud-ambiental/mis-solicitudes");
  });

  it("rechaza envíos desde otro origen", () => {
    expect(origenPermitido(new Headers({ host: "sic.cdmb.gov.co", origin: "https://sic.cdmb.gov.co" }))).toBe(true);
    expect(origenPermitido(new Headers({ host: "sic.cdmb.gov.co", origin: "https://malo.com" }))).toBe(false);
    expect(origenPermitido(new Headers({ host: "sic.cdmb.gov.co" }))).toBe(true);
  });
});

describe("historial público", () => {
  const pasos = [
    { numero: 1, titulo: "Revisión documental" },
    { numero: 2, titulo: "Visita técnica" },
  ];
  it("traduce eventos sin mostrar descripciones internas y omite notas", () => {
    const h = historialPublico(
      [
        { tipo: "CREACION", createdAt: new Date("2026-11-01"), pasoNumero: null, estadoAnterior: null, estadoNuevo: "RADICADO" },
        { tipo: "COMENTARIO", createdAt: new Date("2026-11-02"), pasoNumero: 1, estadoAnterior: null, estadoNuevo: null },
        { tipo: "AVANCE_PASO", createdAt: new Date("2026-11-03"), pasoNumero: 1, estadoAnterior: "EN_TRAMITE", estadoNuevo: "EN_TRAMITE" },
        { tipo: "CAMBIO_ESTADO", createdAt: new Date("2026-11-04"), pasoNumero: 2, estadoAnterior: "EN_TRAMITE", estadoNuevo: "APROBADO" },
      ],
      pasos
    );
    expect(h.map((f) => f.texto)).toEqual(["Estado: Resuelta.", "Se completó la etapa «Revisión documental».", "Solicitud radicada."]);
  });
});
