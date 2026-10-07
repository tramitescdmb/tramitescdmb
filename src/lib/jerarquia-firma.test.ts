import { describe, expect, it } from "vitest";
import { cargoDelFirmante, esContratista, nivelFirma, puedeSerFirmantePrincipal, puedeSolicitarFirmas } from "./jerarquia-firma";
import { puedeActuarSolicitud } from "./solicitudes-firma";

const director = { denominacionEmpleo: "DIRECTOR_GENERAL", sexo: "M" };
const secretaria = { denominacionEmpleo: "SECRETARIO_GENERAL", sexo: "F" };
const subdirector = { denominacionEmpleo: "SUBDIRECTOR", sexo: "M" };
const jefa = { denominacionEmpleo: "JEFE_OFICINA", sexo: "F" };
const profesional = { denominacionEmpleo: "PROFESIONAL_UNIVERSITARIO", sexo: "M" };
const sinDenominacion = { denominacionEmpleo: null };
const contratistaPorEmpleo = { denominacionEmpleo: "CONTRATISTA" };
const contratistaPorRol = { denominacionEmpleo: null, rolesContratacion: ["CONTRATISTA"] };
const supervisor = { denominacionEmpleo: "PROFESIONAL_ESPECIALIZADO", sexo: "F", rolesContratacion: ["SUPERVISOR_INTERVENTOR"] };
const supervisorYPersonal = { denominacionEmpleo: "PROFESIONAL_ESPECIALIZADO", sexo: "F", rolesContratacion: ["SUPERVISOR_INTERVENTOR", "FUNCIONARIO_CONTRATACION"] };

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

  it("con varios roles, en GECON solo dice Supervisor en los contratos que esa persona supervisa", () => {
    expect(cargoDelFirmante({ ...supervisorYPersonal, supervisaElExpediente: true }, "GECON")).toBe("Profesional Especializada · Supervisor");
    expect(cargoDelFirmante({ ...supervisorYPersonal, supervisaElExpediente: false }, "GECON")).toBe("Profesional Especializada");
  });
});

describe("orden de firma (ítem 8): nadie firma fuera de turno", () => {
  // Reproduce exactamente lo que asignarFirmantes() hace en producción: orden = nivelFirma(persona),
  // nunca lo elige quien asigna (src/lib/solicitudes-firma.ts, createMany). Cada caso arma el mismo
  // arreglo de solicitudes "todas" que vería puedeActuarSolicitud() en el detalle del expediente.
  const solicitud = (persona: typeof director | typeof supervisor | typeof contratistaPorRol, estado: "PENDIENTE" | "COMPLETADA") => ({
    rol: "FIRMA" as const,
    orden: nivelFirma(persona),
    estado,
  });

  it("el contratista no puede firmar mientras el supervisor tenga la firma pendiente", () => {
    const todas = [solicitud(supervisor, "PENDIENTE"), solicitud(contratistaPorRol, "PENDIENTE")];
    const laDelContratista = todas[1]!;
    expect(puedeActuarSolicitud(todas, laDelContratista)).toBe(false);
  });

  it("el contratista sí puede firmar una vez el supervisor ya firmó", () => {
    const todas = [solicitud(supervisor, "COMPLETADA"), solicitud(contratistaPorRol, "PENDIENTE")];
    const laDelContratista = todas[1]!;
    expect(puedeActuarSolicitud(todas, laDelContratista)).toBe(true);
  });

  it("el subdirector firma antes que el supervisor: el supervisor espera al subdirector, no al revés", () => {
    const todas = [solicitud(subdirector, "PENDIENTE"), solicitud(supervisor, "PENDIENTE")];
    const [laDelSubdirector, laDelSupervisor] = todas as [ReturnType<typeof solicitud>, ReturnType<typeof solicitud>];
    expect(puedeActuarSolicitud(todas, laDelSubdirector)).toBe(true);
    expect(puedeActuarSolicitud(todas, laDelSupervisor)).toBe(false);
  });

  it("director, secretaría general y subdirección firman antes que cualquier funcionario o supervisor", () => {
    const todas = [
      solicitud(director, "PENDIENTE"),
      solicitud(secretaria, "PENDIENTE"),
      solicitud(subdirector, "PENDIENTE"),
      solicitud(supervisor, "PENDIENTE"),
    ];
    const laDelSupervisor = todas[3]!;
    expect(puedeActuarSolicitud(todas, laDelSupervisor)).toBe(false);
  });
});
