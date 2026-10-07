import { describe, expect, it } from "vitest";
import { DEPARTAMENTOS_COLOMBIA, MUNICIPIOS_COLOMBIA } from "./divipola-datos";
import { buscarDepartamentos, buscarMunicipios, departamentoPorNombre, municipioExacto } from "./divipola";
import { MUNICIPIOS_JURISDICCION_CDMB, MUNICIPIO_POR_CODIGO_DANE } from "./municipios";

const datos = { departamentos: DEPARTAMENTOS_COLOMBIA, municipios: MUNICIPIOS_COLOMBIA };

describe("DIVIPOLA", () => {
  it("trae los 33 departamentos y los 1.122 municipios", () => {
    expect(DEPARTAMENTOS_COLOMBIA).toHaveLength(33);
    expect(MUNICIPIOS_COLOMBIA).toHaveLength(1122);
  });

  it("los municipios de la jurisdicción CDMB existen con el mismo nombre y código", () => {
    for (const nombre of MUNICIPIOS_JURISDICCION_CDMB) {
      expect(municipioExacto(datos, nombre, "Santander")?.nombre).toBe(nombre);
    }
    for (const [codigo, nombre] of Object.entries(MUNICIPIO_POR_CODIGO_DANE)) {
      expect(MUNICIPIOS_COLOMBIA.find(([c]) => c === codigo)?.[1]).toBe(nombre);
    }
  });

  it("busca departamentos sin tildes y priorizando el inicio del nombre", () => {
    expect(buscarDepartamentos(datos, "boy")).toEqual(["Boyacá"]);
    expect(buscarDepartamentos(datos, "santan")).toEqual(["Santander", "Norte de Santander"]);
    expect(departamentoPorNombre(datos, "bogota")?.codigo).toBe("11");
  });

  it("filtra los municipios por el departamento elegido", () => {
    expect(buscarMunicipios(datos, "giron", "Santander").map((m) => m.nombre)).toEqual(["Girón"]);
    expect(buscarMunicipios(datos, "rionegro", "").map((m) => m.departamento).sort()).toEqual(["Antioquia", "Santander"]);
    expect(buscarMunicipios(datos, "rionegro", "Santander")).toHaveLength(1);
  });

  it("sin departamento reconocido busca en todo el país", () => {
    expect(buscarMunicipios(datos, "medellin", "otro").map((m) => m.nombre)).toEqual(["Medellín"]);
  });
});
