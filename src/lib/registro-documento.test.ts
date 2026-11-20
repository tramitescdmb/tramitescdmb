import { describe, expect, it } from "vitest";
import { registroDocumentoTramite } from "./registro-documento";

const expediente = {
  numero: "CA-0001-2026",
  tramiteTipo: { nombre: "Concesión de Aguas de Uso Público Superficial y Subterránea" },
  flujo: { nombre: "Solicitud nueva", pasos: [{ numero: 3, titulo: "Concepto técnico" }] },
};

describe("registro al que pertenece un documento firmado", () => {
  it("indica expediente, trámite, procedimiento, etapa y tipo de documento", () => {
    const r = registroDocumentoTramite({ pasoNumero: 3, requisito: null, tipoDocumental: { nombre: "Concepto técnico" }, expediente });
    expect(r).toEqual([
      { etiqueta: "Expediente", valor: "CA-0001-2026" },
      { etiqueta: "Trámite", valor: "Concesión de Aguas de Uso Público Superficial y Subterránea" },
      { etiqueta: "Procedimiento", valor: "Solicitud nueva" },
      { etiqueta: "Etapa del trámite", valor: "Paso 3 · Concepto técnico" },
      { etiqueta: "Tipo de documento", valor: "Concepto técnico" },
    ]);
  });

  it("marca los documentos de radicación y no inventa etapa si no la hay", () => {
    const radicacion = registroDocumentoTramite({ pasoNumero: null, requisito: { nombre: "Formulario único" }, expediente });
    expect(radicacion.find((d) => d.etiqueta === "Etapa del trámite")?.valor).toBe("Radicación (documento requerido)");
    expect(radicacion.find((d) => d.etiqueta === "Tipo de documento")?.valor).toBe("Formulario único");
    const libre = registroDocumentoTramite({ pasoNumero: null, expediente });
    expect(libre.map((d) => d.etiqueta)).toEqual(["Expediente", "Trámite", "Procedimiento"]);
  });

  it("si el paso ya no existe en el flujo, conserva el número", () => {
    const r = registroDocumentoTramite({ pasoNumero: 9, expediente });
    expect(r.find((d) => d.etiqueta === "Etapa del trámite")?.valor).toBe("Paso 9");
  });
});
