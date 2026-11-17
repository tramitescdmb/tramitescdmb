import { describe, expect, it } from "vitest";
import { buildStoragePath, rutaDeExpediente } from "./storage";

const ID = "3f1c2b9a-5d4e-4c7b-9a1f-2e8d7c6b5a40";
const OTRO = "9a8b7c6d-1e2f-4a3b-8c9d-0e1f2a3b4c5d";

describe("rutaDeExpediente", () => {
  it("acepta lo que arma buildStoragePath para ese expediente", () => {
    expect(rutaDeExpediente(buildStoragePath(ID, "Acta de visita (firmada).pdf"), ID)).toBe(true);
  });
  it("rechaza archivos de otro expediente o de otras carpetas", () => {
    expect(rutaDeExpediente(buildStoragePath(OTRO, "a.pdf"), ID)).toBe(false);
    expect(rutaDeExpediente(`gecon/${ID}/a.pdf`, ID)).toBe(false);
    expect(rutaDeExpediente(`vital/123/a.pdf`, ID)).toBe(false);
    expect(rutaDeExpediente(`expedientes/${ID}/sub/a.pdf`, ID)).toBe(false);
    expect(rutaDeExpediente(`expedientes/${ID}/../${OTRO}/a.pdf`, ID)).toBe(false);
    expect(rutaDeExpediente(`expedientes/${ID}/..`, ID)).toBe(false);
    expect(rutaDeExpediente(`/expedientes/${ID}/a.pdf`, ID)).toBe(false);
    expect(rutaDeExpediente(null, ID)).toBe(false);
    expect(rutaDeExpediente(`expedientes/${ID}/a.pdf`, "")).toBe(false);
  });
});

describe("buildStoragePath", () => {
  it("recorta nombres muy largos conservando la extensión", () => {
    const ruta = buildStoragePath(ID, `${"á".repeat(300)}.pdf`);
    const archivo = ruta.slice(ruta.lastIndexOf("/") + 1);
    expect(archivo.length).toBeLessThan(150);
    expect(archivo.endsWith(".pdf")).toBe(true);
    expect(rutaDeExpediente(ruta, ID)).toBe(true);
  });
});
