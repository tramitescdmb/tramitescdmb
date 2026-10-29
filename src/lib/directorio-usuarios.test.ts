import { describe, expect, it } from "vitest";
import { cruzarUsuarioConDirectorio, indexarDirectorio } from "./directorio-usuarios";
import { extraerPerfil } from "./directorio-activo";

const respuestaEme = {
  samAccountName: "jperez01",
  givenName: "Juan Carlos",
  sn: "Pérez Gómez",
  telephoneNumber: "6076344000",
  mail: "juan.perez@cdmb.gov.co",
  displayName: "Juan Carlos Pérez Gómez",
  mobile: null,
  employeeID: "91000111",
  streetAddress: "Carrera 23 # 37-63",
  department: "SEYCA",
  title: "Profesional Universitario",
};

const indice = indexarDirectorio([extraerPerfil(respuestaEme)]);
const base = { directorioActivo: false, cedulaONit: null, correoNotificacion: null, contratista: null };

describe("cruce de usuarios con el directorio activo", () => {
  it("lee los campos del API de EME", () => {
    const p = extraerPerfil({ message: "ok", data: respuestaEme });
    expect(p).toMatchObject({ usuarioRed: "jperez01", nombres: "Juan Carlos", apellidos: "Pérez Gómez", documento: "91000111", email: "juan.perez@cdmb.gov.co" });
  });

  it("encuentra por cédula, también la de un contratista sin cédula en su usuario", () => {
    expect(cruzarUsuarioConDirectorio({ ...base, email: "x@y.co", cedulaONit: "91.000.111" }, indice)?.por).toBe("cedula");
    expect(cruzarUsuarioConDirectorio({ ...base, email: "x@y.co", contratista: { identificacion: "91000111", tipoPersona: "NATURAL" } }, indice)?.por).toBe("cedula");
  });

  it("encuentra por usuario de red solo si la cuenta es del dominio", () => {
    expect(cruzarUsuarioConDirectorio({ ...base, email: "JPEREZ01", directorioActivo: true }, indice)?.por).toBe("usuarioRed");
    expect(cruzarUsuarioConDirectorio({ ...base, email: "jperez01" }, indice)).toBeNull();
  });

  it("encuentra por correo institucional", () => {
    expect(cruzarUsuarioConDirectorio({ ...base, email: "otro@gmail.com", correoNotificacion: "Juan.Perez@cdmb.gov.co" }, indice)?.por).toBe("correo");
    expect(cruzarUsuarioConDirectorio({ ...base, email: "juan.perez@cdmb.gov.co" }, indice)?.por).toBe("correo");
  });
});
