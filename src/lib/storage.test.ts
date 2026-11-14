import { describe, expect, it } from "vitest";
import { buildStoragePath, rutaDeExpediente } from "./storage";

const ID = "3f1c2b9a-5d4e-4c7b-9a1f-2e8d7c6b5a40";
const OTRO = "9a8b7c6d-1e2f-4a3b-8c9d-0e1f2a3b4c5d";

describe("rutaDeExpediente", () => {
  it("acepta lo que arma buildStoragePath para ese expediente", () => {
    const ruta = buildStoragePath(ID, "Acta de visita (firmada).pdf");
    expect(ruta).toMatch(new RegExp(`^_subidas/${ID}/\\d+-Acta_de_visita_firmada\\.pdf$`));
    expect(rutaDeExpediente(ruta, ID)).toBe(true);
  });
  it("nunca acepta desde el navegador una carpeta definitiva de módulo", () => {
    expect(rutaDeExpediente(`Gecon/2026/obra/contrato-1-2026/contractual/a.pdf`, ID)).toBe(false);
    expect(rutaDeExpediente(`Tramites/2026/x/${ID}/a.pdf`, ID)).toBe(false);
    expect(rutaDeExpediente(`_subidas/${ID}/../../Gecon/a.pdf`, ID)).toBe(false);
    expect(rutaDeExpediente(`_subidas/${OTRO}/a.pdf`, ID)).toBe(false);
  });
  it("rechaza archivos de otro expediente o de otras carpetas", () => {
    expect(rutaDeExpediente(buildStoragePath(OTRO, "a.pdf"), ID)).toBe(false);
    expect(rutaDeExpediente(`gecon/${ID}/a.pdf`, ID)).toBe(false);
    expect(rutaDeExpediente(`vital/123/a.pdf`, ID)).toBe(false);
    expect(rutaDeExpediente(`expedientes/${ID}/a.pdf`, ID)).toBe(false);
    expect(rutaDeExpediente(`_subidas/${ID}/sub/a.pdf`, ID)).toBe(false);
    expect(rutaDeExpediente(`_subidas/${ID}/../${OTRO}/a.pdf`, ID)).toBe(false);
    expect(rutaDeExpediente(`_subidas/${ID}/..`, ID)).toBe(false);
    expect(rutaDeExpediente(`/_subidas/${ID}/a.pdf`, ID)).toBe(false);
    expect(rutaDeExpediente(null, ID)).toBe(false);
    expect(rutaDeExpediente(`_subidas/${ID}/a.pdf`, "")).toBe(false);
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
