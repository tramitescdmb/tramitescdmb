import { describe, it, expect } from "vitest";
import { resumirRespuestaVital } from "@/lib/vital";

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
