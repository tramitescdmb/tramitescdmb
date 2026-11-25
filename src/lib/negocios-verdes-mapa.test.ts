import { describe, expect, it } from "vitest";
import { aPuntoMapa, coordenadaEnJurisdiccion, escribirVistaMapa, filtrarPuntos, leerVistaMapa, puntosCsv, puntosGeoJSON } from "@/lib/negocios-verdes-mapa";
import type { NegocioPublico } from "@/lib/negocios-verdes";

const tax = (slug: string, nombre: string) => ({ id: slug, slug, nombre, icono: null, iconoUrl: null });
const base: NegocioPublico = {
  id: "1", nombre: "Café de Girón", slug: "cafe-giron", municipio: "Girón", vereda: null, direccion: null, latitud: 7.07, longitud: -73.17,
  descripcionCorta: "Café especial", descripcion: "secreto no", producto: null, telefono: null, telefonoSecundario: null, whatsapp: null, email: null, emailSecundario: null, sitioWeb: null,
  facebookUrl: null, instagramUrl: null, fotoPortadaUrl: null, representanteLegal: "Ana", emprendimientoVerde: false, selloMarca: true, avalado: false, destacado: false,
  categoria: tax("bioproductos-x", "Bioproductos"), categorias: [tax("bioproductos-x", "Bioproductos")], subcategorias: [], actividades: [], productos: [], fotos: [],
};

describe("Geovisor público", () => {
  it("solo dibuja coordenadas dentro de la jurisdicción", () => {
    expect(coordenadaEnJurisdiccion(7.07, -73.17)).toBe(true);
    expect(coordenadaEnJurisdiccion(-73.17, 7.07)).toBe(false);
    expect(aPuntoMapa({ ...base, latitud: null })).toBeNull();
  });

  it("el punto no lleva datos que no se usan en el mapa", () => {
    const p = aPuntoMapa(base)!;
    expect(JSON.stringify(p)).not.toContain("Ana");
    expect(p).not.toHaveProperty("descripcion");
  });

  it("filtra por texto sin tildes, municipio, categoría y reconocimiento", () => {
    const p = aPuntoMapa(base)!;
    const f = { q: "cafe giron", municipio: "", categoria: "", reconocimiento: "" as const };
    expect(filtrarPuntos([p], f)).toHaveLength(1);
    expect(filtrarPuntos([p], { ...f, municipio: "Tona" })).toHaveLength(0);
    expect(filtrarPuntos([p], { ...f, categoria: "bioproductos-x" })).toHaveLength(1);
    expect(filtrarPuntos([p], { ...f, reconocimiento: "avalado" })).toHaveLength(0);
    expect(filtrarPuntos([p], { ...f, reconocimiento: "sello" })).toHaveLength(1);
  });

  it("descargas en GeoJSON (lng, lat) y CSV con enlace a la ficha", () => {
    const p = aPuntoMapa(base)!;
    const g = JSON.parse(puntosGeoJSON([p], "https://x"));
    expect(g.features[0].geometry.coordinates).toEqual([-73.17, 7.07]);
    expect(puntosCsv([p], "https://x")).toContain("https://x/negocios-verdes/negocio/cafe-giron");
  });

  it("el enlace guarda y recupera la vista, descartando valores no válidos", () => {
    const q = escribirVistaMapa({ q: "miel", municipio: "Tona", categoria: "", reconocimiento: "sello" }, ["areas"], [7.1, -73.1, 13]);
    const v = leerVistaMapa(new URLSearchParams(q));
    expect(v.filtro).toMatchObject({ q: "miel", municipio: "Tona", reconocimiento: "sello" });
    expect(v.capas).toEqual(["areas"]);
    expect(v.vista).toEqual([7.1, -73.1, 13]);
    expect(leerVistaMapa(new URLSearchParams("v=4.7,-74,12&reconocimiento=x&capas=<b>")).vista).toBeNull();
  });
});
