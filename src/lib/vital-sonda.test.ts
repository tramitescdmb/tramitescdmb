import { describe, it, expect } from "vitest";
import { encontrarArchivosEnFormulario, resumirRespuestaVital } from "@/lib/vital-resumen";

describe("resumirRespuestaVital", () => {
  it("muestra fechas, estados y archivos pero no datos personales", () => {
    const r = resumirRespuestaVital({
      estado: "Radicada",
      fechaCreacion: "2026-11-17 00:00:00",
      solicitante: { primerNombre: "Elias", correo: "a@b.co", numeroIdentificacion: "5638359" },
      documentos: [{ nombre_archivo: "455236.rtf", url_archivo: "https://v/x/455236.rtf?token=1" }],
    });
    expect(r.valores.fechaCreacion).toBe("2026-11-17 00:00:00");
    expect(r.valores.estado).toBe("Radicada");
    expect(r.valores["documentos.length"]).toBe(1);
    expect(r.valores["documentos[].url_archivo"]).toBe("https://v/x/455236.rtf");
    expect(JSON.stringify(r.valores)).not.toMatch(/Elias|a@b.co|5638359|token/);
  });
});

describe("encontrarArchivosEnFormulario", () => {
  it("devuelve solo direcciones y archivos, sin otros datos del formulario", () => {
    const r = encontrarArchivosEnFormulario({
      Nombre: "Elias",
      "Adjuntar Documento": "292770031_69_Nacional.zip",
      anexos: [{ ruta: "https://vital.minambiente.gov.co/VitalFiletraffic/x/plano.pdf?t=1" }],
    });
    expect(r).toEqual({
      "Adjuntar Documento": "292770031_69_Nacional.zip",
      "anexos[0].ruta": "https://vital.minambiente.gov.co/VitalFiletraffic/x/plano.pdf",
    });
  });
});
