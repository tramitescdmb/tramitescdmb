import { describe, expect, it } from "vitest";
import { nombreFlujo } from "@/lib/flujo-nombre";

describe("nombreFlujo", () => {
  it("quita «Instrucciones» y usa nombres claros", () => {
    expect(nombreFlujo("INSTRUCCIONES INICIO TRÁMITE")).toBe("Solicitud nueva");
    expect(nombreFlujo("INSTRUCCIONES")).toBe("Solicitud nueva");
    expect(nombreFlujo("INSTRUCCIONES RENOVACIÓN DE PERMISO DE VERTIMIENTO")).toBe("Renovación de permiso de vertimiento");
    expect(nombreFlujo("INSTRUCCIONES INSCRIPCIÓN DE GESTORES DE ACU")).toBe("Inscripción de gestores de ACU");
    expect(nombreFlujo("INSTRUCCIONES PARA LA OBTENCIÓN DEL PERMISO DE CAZA DE FAUNA SILVESTRE")).toBe("Obtención del permiso de caza de fauna silvestre");
    expect(nombreFlujo("GENERADORES DE RCD")).toBe("Generadores de RCD");
    expect(nombreFlujo("Concesión de Aguas Superficiales")).toBe("Concesión de Aguas Superficiales");
  });
});
