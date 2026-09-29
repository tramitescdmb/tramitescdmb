import { describe, expect, it } from "vitest";
import { cargoDelFirmante, esContratista, nivelFirma, puedeSerFirmantePrincipal, puedeSolicitarFirmas } from "./jerarquia-firma";

const director = { denominacionEmpleo: "DIRECTOR_GENERAL", sexo: "M" };
const secretaria = { denominacionEmpleo: "SECRETARIO_GENERAL", sexo: "F" };
const subdirector = { denominacionEmpleo: "SUBDIRECTOR", sexo: "M" };
const jefa = { denominacionEmpleo: "JEFE_OFICINA", sexo: "F" };
const profesional = { denominacionEmpleo: "PROFESIONAL_UNIVERSITARIO", sexo: "M" };
const sinDenominacion = { denominacionEmpleo: null };
const contratistaPorEmpleo = { denominacionEmpleo: "CONTRATISTA" };
const contratistaPorRol = { denominacionEmpleo: null, rolContratacion: "CONTRATISTA" };
const supervisor = { denominacionEmpleo: "PROFESIONAL_ESPECIALIZADO", sexo: "F", rolContratacion: "SUPERVISOR_INTERVENTOR" };

describe("nivelFirma", () => {
  it("ordena Director, Secretaría General, jefaturas, funcionarios y contratistas", () => {
    expect(nivelFirma(director)).toBe(1);
    expect(nivelFirma(secretaria)).toBe(2);
    expect(nivelFirma(subdirector)).toBe(3);
    expect(nivelFirma(jefa)).toBe(3);
    expect(nivelFirma(profesional)).toBe(4);
    expect(nivelFirma(supervisor)).toBe(4);
    expect(nivelFirma(contratistaPorEmpleo)).toBe(5);
  });

  it("sin denominación cuenta como funcionario, salvo que su rol en contratación sea contratista", () => {
    expect(nivelFirma(sinDenominacion)).toBe(4);
    expect(nivelFirma(contratistaPorRol)).toBe(5);
    expect(esContratista(contratistaPorRol)).toBe(true);
  });
});

describe("firma principal", () => {
  it("el contratista no puede ser firmante principal fuera de GECON", () => {
    expect(puedeSerFirmantePrincipal(contratistaPorEmpleo, "SGDEA")).toBe(false);
    expect(puedeSerFirmantePrincipal(contratistaPorRol, "TRAMITES")).toBe(false);
    expect(puedeSerFirmantePrincipal(contratistaPorEmpleo, "GECON")).toBe(true);
  });

  it("funcionarios y cargos directivos sí pueden ser firmantes principales", () => {
    for (const p of [director, secretaria, subdirector, jefa, profesional, sinDenominacion]) {
      expect(puedeSerFirmantePrincipal(p, "SGDEA")).toBe(true);
    }
  });
});

describe("solicitar firmas", () => {
  it("un contratista no puede solicitar firmas a otra persona", () => {
    expect(puedeSolicitarFirmas(contratistaPorEmpleo)).toBe(false);
    expect(puedeSolicitarFirmas(contratistaPorRol)).toBe(false);
    expect(puedeSolicitarFirmas(profesional)).toBe(true);
  });
});

describe("cargoDelFirmante", () => {
  it("usa la denominación con género y marca al supervisor en GECON", () => {
    expect(cargoDelFirmante(secretaria)).toBe("Secretaria General");
    expect(cargoDelFirmante(supervisor, "GECON")).toBe("Profesional Especializada · Supervisor");
    expect(cargoDelFirmante(supervisor, "SGDEA")).toBe("Profesional Especializada");
    expect(cargoDelFirmante(contratistaPorRol)).toBe("Contratista");
  });
});
