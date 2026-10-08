import {
  correoValido,
  nombreCompletoPersona,
  nulo,
  personaVacia,
  regimenONulo,
  separarNombreCompleto,
  type DatosPersona,
} from "@/lib/datos-persona";

export type UsuarioConPersona = {
  nombre: string;
  tipoPersona: "NATURAL" | "JURIDICA";
  tipoIdentificacionFirma: "CC" | "NIT" | null;
  cedulaONit: string | null;
  nombres: string | null;
  apellidos: string | null;
  razonSocial: string | null;
  correoNotificacion: string | null;
  celular: string | null;
  telefono: string | null;
  direccion: string | null;
  departamento: string | null;
  ciudad: string | null;
  regimenTributario: string | null;
  granContribuyente: boolean;
};

export const SELECT_PERSONA_USUARIO = {
  nombre: true,
  tipoPersona: true,
  tipoIdentificacionFirma: true,
  cedulaONit: true,
  nombres: true,
  apellidos: true,
  razonSocial: true,
  correoNotificacion: true,
  celular: true,
  telefono: true,
  direccion: true,
  departamento: true,
  ciudad: true,
  regimenTributario: true,
  granContribuyente: true,
} as const;

export function personaDesdeUsuario(u: UsuarioConPersona, conValoresPorDefecto = true): DatosPersona {
  const sinNombres = !u.nombres?.trim() && !u.apellidos?.trim() && !u.razonSocial?.trim();
  const separado = sinNombres ? separarNombreCompleto(u.nombre) : null;
  const base = conValoresPorDefecto ? personaVacia() : personaVacia({ departamento: "", ciudad: "" });
  return {
    ...base,
    tipoPersona: u.tipoPersona,
    tipoIdentificacion: u.tipoIdentificacionFirma ?? (u.tipoPersona === "JURIDICA" ? "NIT" : "CC"),
    identificacion: u.cedulaONit ?? "",
    nombres: u.tipoPersona === "JURIDICA" ? "" : (u.nombres ?? separado?.nombres ?? ""),
    apellidos: u.tipoPersona === "JURIDICA" ? "" : (u.apellidos ?? separado?.apellidos ?? ""),
    razonSocial: u.tipoPersona === "JURIDICA" ? (u.razonSocial ?? (sinNombres ? u.nombre : "")) : "",
    email: u.correoNotificacion ?? "",
    celular: u.celular ?? "",
    telefono: u.telefono ?? "",
    direccion: u.direccion ?? "",
    departamento: u.departamento ?? base.departamento,
    ciudad: u.ciudad ?? base.ciudad,
    regimenTributario: u.regimenTributario ?? "",
    granContribuyente: u.granContribuyente,
  };
}

export function errorPersonaUsuario(p: DatosPersona): string | null {
  if (!nombreCompletoPersona(p)) {
    return p.tipoPersona === "JURIDICA" ? "Indique la razón social." : "Indique los nombres y los apellidos.";
  }
  if (p.tipoPersona === "NATURAL" && (!p.nombres.trim() || !p.apellidos.trim())) return "Indique los nombres y los apellidos por separado.";
  if (!correoValido(p.email)) return "El correo electrónico no es válido.";
  return null;
}

export function dataUsuarioDesdePersona(p: DatosPersona) {
  const esJuridica = p.tipoPersona === "JURIDICA";
  return {
    nombre: nombreCompletoPersona(p),
    tipoPersona: p.tipoPersona,
    tipoIdentificacionFirma: (p.tipoIdentificacion === "NIT" ? "NIT" : "CC") as "CC" | "NIT",
    cedulaONit: nulo(p.identificacion),
    nombres: esJuridica ? null : nulo(p.nombres),
    apellidos: esJuridica ? null : nulo(p.apellidos),
    razonSocial: esJuridica ? nulo(p.razonSocial) : null,
    correoNotificacion: nulo(p.email),
    celular: nulo(p.celular),
    telefono: nulo(p.telefono),
    direccion: nulo(p.direccion),
    departamento: nulo(p.departamento),
    ciudad: nulo(p.ciudad),
    regimenTributario: regimenONulo(p.regimenTributario),
    granContribuyente: p.granContribuyente,
  };
}
