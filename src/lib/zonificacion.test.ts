import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ARCHIVOS_CAPAS, zonificarPunto, type CapasZonificacion } from "@/lib/zonificacion";
import { aplicarZonificacion } from "@/lib/formato-visita";
import { FORMATO_AGUAS, FORMATO_GENERICO } from "@/lib/formatos-visita-base";
import { claveConcepto, etiquetaConcepto } from "@/lib/concepto-tecnico";

const capas = Object.fromEntries(
  Object.entries(ARCHIVOS_CAPAS).map(([k, ruta]) => [k, JSON.parse(readFileSync(join(process.cwd(), "public", ruta), "utf8"))])
) as CapasZonificacion;

describe("zonificarPunto con las capas de la jurisdicción", () => {
  it("ubica un punto de Bucaramanga con municipio, vereda y subzona", () => {
    const z = zonificarPunto(7.1193, -73.1227, capas);
    expect(z.municipio).toBe("Bucaramanga");
    expect(z.subzona_hidrografica).toMatch(/código \d+/);
    expect(z.resumen_ambiental).toContain("municipio de Bucaramanga");
  });

  it("marca un punto fuera de la jurisdicción", () => {
    const z = zonificarPunto(4.6, -74.08, capas);
    expect(z.municipio).toBe("");
    expect(z.resumen_ambiental).toContain("no se encuentra dentro de las capas");
  });

  it("detecta las áreas protegidas cuando el punto cae en una", () => {
    const area = capas.areas_protegidas!.features[0]!;
    const geom = area.geometry as { type: string; coordinates: number[][][] | number[][][][] };
    const anillo = (geom.type === "Polygon" ? geom.coordinates[0] : (geom.coordinates as number[][][][])[0]![0]) as number[][];
    const [lon, lat] = [anillo.reduce((s, c) => s + c[0]!, 0) / anillo.length, anillo.reduce((s, c) => s + c[1]!, 0) / anillo.length];
    const z = zonificarPunto(lat, lon, capas);
    if (z.areas_protegidas !== "Ninguna") expect(z.resumen_ambiental).toContain("dentro del área protegida");
  });
});

function puntoRural(): [number, number] {
  for (const f of capas.veredas!.features) {
    const g = f.geometry as { type: string; coordinates: unknown };
    const anillo = (g.type === "Polygon" ? (g.coordinates as number[][][])[0] : (g.coordinates as number[][][][])[0]![0]) as number[][];
    const lon = anillo.reduce((s, c) => s + c[0]!, 0) / anillo.length;
    const lat = anillo.reduce((s, c) => s + c[1]!, 0) / anillo.length;
    if (zonificarPunto(lat, lon, capas).vereda) return [lat, lon];
  }
  throw new Error("sin punto rural");
}

describe("aplicarZonificacion", () => {
  const [lat, lon] = puntoRural();
  const zona = zonificarPunto(lat, lon, capas);

  it("el punto rural trae vereda", () => {
    expect(zona.vereda).not.toBe("");
    expect(zona.resumen_ambiental).toContain(`vereda ${zona.vereda}`);
  });

  it("llena los campos vinculados a las coordenadas sin pisar lo escrito a mano", () => {
    const r = aplicarZonificacion(FORMATO_GENERICO.estructura, {}, "coordenadas", zona, null);
    expect(r.vereda).toBe(zona.vereda);
    expect(r.determinantes_ambientales).toBe(zona.resumen_ambiental);
    const manual = aplicarZonificacion(FORMATO_GENERICO.estructura, { vereda: "La que dijo el usuario" }, "coordenadas", zona, null);
    expect(manual.vereda).toBe("La que dijo el usuario");
  });

  it("solo afecta los campos de esas coordenadas", () => {
    const r = aplicarZonificacion(FORMATO_AGUAS.estructura, {}, "otra", zona, null);
    expect(r.cuenca).toBeUndefined();
    const ok = aplicarZonificacion(FORMATO_AGUAS.estructura, {}, "coord_captacion", zona, null);
    expect(ok.cuenca).toBe(zona.subzona_hidrografica);
  });
});

describe("número de concepto técnico", () => {
  it("formatea EV con cuatro dígitos y la fecha larga", () => {
    const clave = claveConcepto(207, 2026);
    expect(clave).toBe("EV-0207-2026");
    expect(etiquetaConcepto(clave, new Date("2026-10-24T15:00:00Z"))).toBe("EV-0207 DE 24 DE OCTUBRE DE 2026");
  });
});
