import { describe, expect, it } from "vitest";
import { puntoDesdeNorteEste, puntoDesdeTexto, puntoDesdeCampos, dentroDeZonaCdmb } from "./coordenadas-texto";

describe("puntoDesdeNorteEste", () => {
  it("convierte planas MAGNA origen Bogotá de la zona de Bucaramanga", () => {
    const p = puntoDesdeNorteEste("1273646", "1101208");
    expect(p?.origen).toBe("planas_magna_bogota");
    expect(p!.lat).toBeGreaterThan(7);
    expect(p!.lat).toBeLessThan(7.3);
    expect(p!.lon).toBeGreaterThan(-73.2);
    expect(p!.lon).toBeLessThan(-73);
  });

  it("acepta geográficas y repara un decimal perdido en la longitud", () => {
    const p = puntoDesdeNorteEste("7.124723", "-73054511");
    expect(p).toEqual({ lat: 7.124723, lon: -73.054511, origen: "geograficas" });
  });

  it("descarta valores fuera de la zona de la CDMB", () => {
    expect(puntoDesdeNorteEste("3223555", "456345")).toBeNull();
    expect(puntoDesdeNorteEste("", "1101208")).toBeNull();
  });
});

describe("puntoDesdeCampos (VITAL)", () => {
  it("lee las claves Norte:/Este: de los campos del trámite", () => {
    expect(puntoDesdeCampos({ "Norte:": "7.124723", "Este:": "-73054511", Agua: "0" })).toEqual({ lat: 7.124723, lon: -73.054511, origen: "geograficas" });
    expect(puntoDesdeCampos({ "Norte:": "1273646", "Este:": "1101208" })?.origen).toBe("planas_magna_bogota");
  });

  it("ignora campos de coordenadas vacíos o sin sentido", () => {
    expect(puntoDesdeCampos({ Coordenadas: "" })).toBeNull();
    expect(puntoDesdeCampos({ Coordenadas: "3223555.00-456345.66;" })).toBeNull();
    expect(puntoDesdeCampos(null)).toBeNull();
  });
});

describe("puntoDesdeTexto", () => {
  it("extrae N y E escritos dentro de una descripción", () => {
    const p = puntoDesdeTexto("CONSTRUCCION DE VIVIENDA, COORDENADAS: N:1323147, E:1098164 Y COTA: 780MSNM MUNICIPIO DE BUCARAMANGA");
    expect(p).not.toBeNull();
    expect(dentroDeZonaCdmb(p!.lat, p!.lon)).toBe(true);
  });

  it("extrae latitud y longitud con nombre", () => {
    expect(puntoDesdeTexto("ubicado en latitud 7,1194 longitud -73,1227")).toEqual({ lat: 7.1194, lon: -73.1227, origen: "geograficas" });
  });

  it("no confunde palabras que empiezan por N o E sin números", () => {
    expect(puntoDesdeTexto("COORDINACION JURIDICA NORTE DEL MUNICIPIO ESTE PROYECTO")).toBeNull();
  });
});
