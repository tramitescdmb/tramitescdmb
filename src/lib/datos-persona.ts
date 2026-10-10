import { esRegimenTributario } from "@/lib/regimen-tributario";
import { CIUDAD_POR_DEFECTO, DEPARTAMENTO_POR_DEFECTO } from "@/lib/divipola";

export type TipoPersonaValor = "NATURAL" | "JURIDICA";
export type RegimenValor = "RESPONSABLE_IVA" | "NO_RESPONSABLE_IVA" | "SIMPLE_TRIBUTACION" | "REGIMEN_ESPECIAL" | "OTRO";

export type DatosPersona = {
  tipoPersona: TipoPersonaValor;
  tipoIdentificacion: string;
  identificacion: string;
  nombres: string;
  apellidos: string;
  razonSocial: string;
  email: string;
  celular: string;
  telefono: string;
  direccion: string;
  departamento: string;
  ciudad: string;
  regimenTributario: string;
  granContribuyente: boolean;
};

export type OpcionIdentificacion = { valor: string; etiqueta: string };

export const TIPOS_IDENTIFICACION_PERSONA: OpcionIdentificacion[] = [
  { valor: "CC", etiqueta: "Cédula de ciudadanía" },
  { valor: "CE", etiqueta: "Cédula de extranjería" },
  { valor: "NIT", etiqueta: "NIT" },
  { valor: "PA", etiqueta: "Pasaporte" },
  { valor: "PPT", etiqueta: "Permiso por protección temporal" },
  { valor: "TI", etiqueta: "Tarjeta de identidad" },
  { valor: "OTRO", etiqueta: "Otro" },
];

export const TIPOS_IDENTIFICACION_REMITENTE: OpcionIdentificacion[] = [...TIPOS_IDENTIFICACION_PERSONA, { valor: "ANONIMO", etiqueta: "Anónimo" }];

export const TIPOS_IDENTIFICACION_USUARIO: OpcionIdentificacion[] = [
  { valor: "CC", etiqueta: "Cédula de ciudadanía" },
  { valor: "NIT", etiqueta: "NIT" },
];

export function personaVacia(parcial: Partial<DatosPersona> = {}): DatosPersona {
  return {
    tipoPersona: "NATURAL",
    tipoIdentificacion: "CC",
    identificacion: "",
    nombres: "",
    apellidos: "",
    razonSocial: "",
    email: "",
    celular: "",
    telefono: "",
    direccion: "",
    departamento: DEPARTAMENTO_POR_DEFECTO,
    ciudad: CIUDAD_POR_DEFECTO,
    regimenTributario: "",
    granContribuyente: false,
    ...parcial,
  };
}

export function nombreCompletoPersona(p: { tipoPersona: string; nombres?: string | null; apellidos?: string | null; razonSocial?: string | null }): string {
  if (p.tipoPersona === "JURIDICA") return (p.razonSocial ?? "").trim();
  return [p.nombres, p.apellidos]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export function separarNombreCompleto(nombre: string): { nombres: string; apellidos: string } {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return { nombres: partes[0] ?? "", apellidos: "" };
  if (partes.length === 2) return { nombres: partes[0]!, apellidos: partes[1]! };
  return { nombres: partes.slice(0, partes.length - 2).join(" "), apellidos: partes.slice(-2).join(" ") };
}

export type CampoPersona = "identificacion" | "nombre" | "email" | "direccion" | "ubicacion" | "regimenTributario" | "telefono" | "celular";

const ETIQUETA_CAMPO: Record<CampoPersona, (tipo: string) => string> = {
  identificacion: (tipo) => (tipo === "JURIDICA" ? "NIT" : "documento de identificación"),
  nombre: (tipo) => (tipo === "JURIDICA" ? "razón social" : "nombres y apellidos"),
  email: () => "correo electrónico",
  direccion: () => "dirección",
  ubicacion: () => "departamento y ciudad",
  regimenTributario: () => "régimen tributario",
  telefono: () => "teléfono",
  celular: () => "celular",
};

export function camposFaltantes(p: Partial<DatosPersona>, requeridos: readonly CampoPersona[]): string[] {
  const tipo = p.tipoPersona ?? "NATURAL";
  const vacio = (s?: string | null) => !(s ?? "").trim();
  const falta: Record<CampoPersona, boolean> = {
    identificacion: vacio(p.identificacion),
    nombre: tipo === "JURIDICA" ? vacio(p.razonSocial) : vacio(p.nombres) || vacio(p.apellidos),
    email: vacio(p.email),
    direccion: vacio(p.direccion),
    ubicacion: vacio(p.departamento) || vacio(p.ciudad),
    regimenTributario: vacio(p.regimenTributario),
    telefono: vacio(p.telefono),
    celular: vacio(p.celular),
  };
  return requeridos.filter((c) => falta[c]).map((c) => ETIQUETA_CAMPO[c](tipo));
}

export const REQUERIDOS_CONTRATISTA: readonly CampoPersona[] = ["identificacion", "nombre", "email", "direccion", "ubicacion", "regimenTributario"];

// Perfil mínimo para registrar un contratista desde GECON en la etapa precontractual, cuando la
// persona todavía no existe como Usuario del sistema (ver crearContratistaMinimo en contratacion.ts).
// Persona jurídica no exige télefono/celular propios aquí porque esos datos de contacto los trae
// el representante legal (ver faltantesRepresentanteLegal).
export const REQUERIDOS_CONTRATISTA_MINIMO_NATURAL: readonly CampoPersona[] = ["identificacion", "nombre", "telefono", "celular"];
export const REQUERIDOS_CONTRATISTA_MINIMO_JURIDICA: readonly CampoPersona[] = ["identificacion", "nombre"];

function texto(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function leerDatosPersona(body: unknown, tiposValidos: readonly OpcionIdentificacion[] = TIPOS_IDENTIFICACION_PERSONA): DatosPersona {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const tipoPersona: TipoPersonaValor = b.tipoPersona === "JURIDICA" ? "JURIDICA" : "NATURAL";
  const tipoId = texto(b.tipoIdentificacion, 10).toUpperCase();
  const tipoIdentificacion = tiposValidos.some((t) => t.valor === tipoId) ? tipoId : tipoPersona === "JURIDICA" ? "NIT" : "CC";
  const regimen = texto(b.regimenTributario, 40);
  return {
    tipoPersona,
    tipoIdentificacion,
    identificacion: texto(b.identificacion, 30),
    nombres: tipoPersona === "JURIDICA" ? "" : texto(b.nombres, 120),
    apellidos: tipoPersona === "JURIDICA" ? "" : texto(b.apellidos, 120),
    razonSocial: tipoPersona === "JURIDICA" ? texto(b.razonSocial, 200) : "",
    email: texto(b.email, 160).toLowerCase(),
    celular: texto(b.celular, 30),
    telefono: texto(b.telefono, 30),
    direccion: texto(b.direccion, 200),
    departamento: texto(b.departamento, 80),
    ciudad: texto(b.ciudad, 80),
    regimenTributario: esRegimenTributario(regimen) ? regimen : "",
    granContribuyente: b.granContribuyente === true,
  };
}

export function nulo(s: string): string | null {
  return s.trim() ? s.trim() : null;
}

export function regimenONulo(s: string): RegimenValor | null {
  return esRegimenTributario(s) ? (s as RegimenValor) : null;
}

export function correoValido(s: string): boolean {
  return !s.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}
