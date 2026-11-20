import { describe, expect, it } from "vitest";
import { camposCambiados, validarPerfilCiudadano } from "@/lib/cuenta-ciudadana";

const base = {
  tipoPersona: "NATURAL",
  tipoIdentificacion: "CC",
  identificacion: "91.234.567",
  nombres: " Ana  María ",
  apellidos: "Pérez Gómez",
  email: "",
  celular: "300 123 4567",
  telefono: "",
  direccion: "Calle 45 # 12-30",
  departamento: "Santander",
  ciudad: "Bucaramanga",
  regimenTributario: "NO_RESPONSABLE_IVA",
  granContribuyente: false,
  tipoUsuario: "CIUDADANO",
  autorizaNotificacionElectronica: true,
};
const opc = { correoCuenta: "ana@ejemplo.co", identidadFija: null };

describe("validarPerfilCiudadano", () => {
  it("acepta un perfil completo y normaliza documento y nombre", () => {
    const r = validarPerfilCiudadano(base, opc);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.perfil.identificacion).toBe("91234567");
    expect(r.perfil.nombre).toBe("Ana María Pérez Gómez");
    expect(r.perfil.autorizaNotificacionElectronica).toBe(true);
  });

  it("quita el dígito de verificación del NIT y exige representante legal", () => {
    const juridica = { ...base, tipoPersona: "JURIDICA", tipoIdentificacion: "NIT", identificacion: "900.123.456-1", razonSocial: "Agua Limpia SAS" };
    expect(validarPerfilCiudadano(juridica, opc)).toMatchObject({ ok: false });
    const r = validarPerfilCiudadano({ ...juridica, representanteLegal: "Luis Rojas", representanteIdentificacion: "1098" }, opc);
    expect(r.ok && r.perfil.identificacion).toBe("900123456");
    expect(r.ok && r.perfil.nombres).toBeNull();
  });

  it("ignora la identidad que manda el navegador cuando ya está fijada", () => {
    const r = validarPerfilCiudadano(
      { ...base, tipoPersona: "JURIDICA", identificacion: "111111" },
      { correoCuenta: "ana@ejemplo.co", identidadFija: { tipo: "NATURAL", tipoIdentificacion: "CC", identificacion: "91234567" } }
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.perfil.tipo).toBe("NATURAL");
    expect(r.perfil.identificacion).toBe("91234567");
  });

  it("pide contacto, dirección, régimen y tipo de usuario", () => {
    expect(validarPerfilCiudadano({ ...base, celular: "", telefono: "" }, opc).ok).toBe(false);
    expect(validarPerfilCiudadano({ ...base, direccion: "x" }, opc).ok).toBe(false);
    expect(validarPerfilCiudadano({ ...base, regimenTributario: "" }, opc).ok).toBe(false);
    expect(validarPerfilCiudadano({ ...base, tipoUsuario: "HACKER" }, opc).ok).toBe(false);
    expect(validarPerfilCiudadano({ ...base, celular: "abc" }, opc).ok).toBe(false);
  });

  it("descarta el correo alterno si es el mismo de la cuenta y valida su formato", () => {
    const r = validarPerfilCiudadano({ ...base, email: "ANA@ejemplo.co" }, opc);
    expect(r.ok && r.perfil.correoAlterno).toBeNull();
    expect(validarPerfilCiudadano({ ...base, email: "no-es-correo" }, opc).ok).toBe(false);
  });
});

describe("camposCambiados", () => {
  it("lista solo las etiquetas de lo que cambió, sin valores", () => {
    const r = validarPerfilCiudadano(base, opc);
    if (!r.ok) throw new Error("perfil inválido");
    const antes = { ...r.perfil, direccion: "Otra dirección", celular: null };
    expect(camposCambiados(antes, r.perfil)).toEqual(["celular", "dirección de notificación"]);
    expect(camposCambiados(r.perfil, r.perfil)).toEqual([]);
  });
});
