import { nulo, regimenONulo, type DatosPersona } from "@/lib/datos-persona";

export function errorSolicitante(p: DatosPersona): string | null {
  if (p.tipoPersona === "JURIDICA" ? !p.razonSocial : !p.nombres || !p.apellidos) {
    return p.tipoPersona === "JURIDICA" ? "La razón social es obligatoria." : "Los nombres y apellidos son obligatorios.";
  }
  if (!p.departamento || !p.ciudad) return "El departamento y la ciudad son obligatorios.";
  return null;
}

export function datosSolicitante(p: DatosPersona) {
  const juridica = p.tipoPersona === "JURIDICA";
  return {
    nombres: juridica ? null : nulo(p.nombres),
    apellidos: juridica ? null : nulo(p.apellidos),
    razonSocial: juridica ? nulo(p.razonSocial) : null,
    regimenTributario: regimenONulo(p.regimenTributario),
    granContribuyente: p.granContribuyente,
    email: nulo(p.email),
    celular: nulo(p.celular),
    telefono: nulo(p.telefono),
    direccion: nulo(p.direccion),
    municipio: p.ciudad,
    departamento: nulo(p.departamento),
  };
}

export function nombreCompletoSolicitante(s: {
  tipo: string;
  nombres?: string | null;
  apellidos?: string | null;
  razonSocial?: string | null;
}): string {
  const nombres = s.nombres?.trim();
  const apellidos = s.apellidos?.trim();
  const razonSocial = s.razonSocial?.trim();
  if (s.tipo === "JURIDICA") {
    return razonSocial || [nombres, apellidos].filter(Boolean).join(" ") || "—";
  }
  return [nombres, apellidos].filter(Boolean).join(" ") || razonSocial || "—";
}
