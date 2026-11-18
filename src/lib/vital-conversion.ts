import { FUERA_DE_JURISDICCION, MUNICIPIOS_JURISDICCION_CDMB, MUNICIPIO_POR_CODIGO_DANE, type MunicipioCdmb } from "@/lib/municipios";
import { municipioDeCamposVital } from "@/lib/vital-campos";
import { puntoDesdeCampos } from "@/lib/coordenadas-texto";

/**
 * Trámite de SIC que corresponde a cada tipo de trámite de VITAL (por `codigo`
 * de TramiteTipo). Solo una sugerencia: en la ficha se puede elegir otro.
 * Los que no están (reportes de contingencia, liquidaciones, etc.) no traen
 * sugerencia y el funcionario elige el trámite.
 */
export const CODIGO_TRAMITE_POR_VITAL: Record<number, string> = {
  2: "M-DA-PR22", // Licencia Ambiental
  9: "M-DA-PR16", // Salvoconducto Único Nacional
  17: "M-DA-PR59", // Salvoconducto - Renovación
  18: "M-DA-PR58", // Salvoconducto - Removilización
  23: "M-DA-PR41", // Aprovechamiento Forestal
  118: "M-DA-PR41", // 382 Aprovechamiento forestal
  30: "M-DA-PR21", // Concesión Aguas Subterráneas
  31: "M-DA-PR21", // Concesión Aguas Superficiales
  109: "M-DA-PR21", // 351 Concesión aguas superficiales
  112: "M-DA-PR21", // 363 Concesión aguas subterráneas
  32: "M-DA-PR07", // Emisiones Atmosféricas FF
  33: "M-DA-PR33", // Prospección y Exploración
  111: "M-DA-PR33", // 361 Prospección y exploración
  34: "M-DA-PR05", // Vertimientos
  106: "M-DA-PR05", // Vertimiento a cuerpo de agua
  107: "M-DA-PR05", // 348 Vertimiento a cuerpo de agua
  110: "M-DA-PR05", // Vertimiento al suelo
  49: "M-DA-PR39", // Permiso de Ocupación de Cauce
  113: "M-DA-PR39", // 365 Ocupación de playas y cauces
  114: "M-DA-PR39", // 365 Ocupación de playas, cauces y lechos
  125: "M-DA-PR65", // 416 Licencia ambiental temporal
  127: "M-DA-PR09", // Certificación habilitación CDA
};

export function codigoTramiteSugerido(idTramiteVital: number): string | null {
  return CODIGO_TRAMITE_POR_VITAL[idTramiteVital] ?? null;
}

/** Una solicitud que llega por sincronización cuenta como «nueva» solo si es reciente. */
export const DIAS_SOLICITUD_VITAL_NUEVA = 60;

export function esSolicitudVitalReciente(fechaRadicacion: Date | null, ahora = new Date()): boolean {
  if (!fechaRadicacion || Number.isNaN(fechaRadicacion.getTime())) return true;
  return ahora.getTime() - fechaRadicacion.getTime() <= DIAS_SOLICITUD_VITAL_NUEVA * 86_400_000;
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function texto(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return texto(o.label ?? o.nombre ?? o.descripcion ?? o.value ?? null);
  }
  const s = String(v).trim();
  return ["null", "undefined", "n/a", "-", "--"].includes(s.toLowerCase()) ? "" : s;
}

/** Municipio de la jurisdicción a partir de un nombre o código DANE; "" si no hay dato. */
export function municipioCdmbDe(valor: unknown): MunicipioCdmb | typeof FUERA_DE_JURISDICCION | "" {
  const v = texto(valor);
  if (!v) return "";
  const digitos = v.replace(/\D/g, "");
  if (digitos.length >= 4 && digitos.length === v.replace(/\s/g, "").length) {
    return MUNICIPIO_POR_CODIGO_DANE[digitos.padStart(5, "0")] ?? FUERA_DE_JURISDICCION;
  }
  const buscado = sinTildes(v.split(/[,(-]/)[0] ?? v);
  return MUNICIPIOS_JURISDICCION_CDMB.find((m) => sinTildes(m) === buscado) ?? FUERA_DE_JURISDICCION;
}

export type PrellenadoVital = {
  tipo: "NATURAL" | "JURIDICA";
  identificacion: string;
  nombres: string;
  apellidos: string;
  razonSocial: string;
  representanteLegal: string;
  email: string;
  telefono: string;
  direccion: string;
  municipioSolicitante: string;
  municipio: string;
  predioDireccion: string;
  ubicacion: { lat: number; lon: number } | null;
};

/** Datos para llenar el formulario de radicación a partir de una solicitud de VITAL. */
export function prellenadoDesdeVital(s: {
  solicitanteNombre: string | null;
  solicitanteIdentificacion: string | null;
  solicitanteCorreo: string | null;
  solicitanteRaw: unknown;
  camposTramite: unknown;
}): PrellenadoVital {
  const lista = Array.isArray(s.solicitanteRaw) ? s.solicitanteRaw : s.solicitanteRaw && typeof s.solicitanteRaw === "object" ? [s.solicitanteRaw] : [];
  const i = (lista[0] ?? {}) as Record<string, unknown>;
  const razonSocial = texto(i.razonSocial ?? i.razon_social);
  const tipoPersona = sinTildes(texto(i.tipoPersona ?? i.tipo_persona));
  const tipo: "NATURAL" | "JURIDICA" = tipoPersona.includes("jur") || Boolean(razonSocial) ? "JURIDICA" : "NATURAL";
  const nombres = [i.primerNombre ?? i.primer_nombre, i.segundoNombre ?? i.segundo_nombre].map(texto).filter(Boolean).join(" ");
  const apellidos = [i.primerApellido ?? i.primer_apellido, i.segundoApellido ?? i.segundo_apellido].map(texto).filter(Boolean).join(" ");
  const campos = s.camposTramite && typeof s.camposTramite === "object" && !Array.isArray(s.camposTramite) ? (s.camposTramite as Record<string, unknown>) : {};
  const direccionPredio =
    Object.entries(campos).find(([k, v]) => /direcci/i.test(k) && texto(v))?.[1] ?? null;
  const punto = puntoDesdeCampos(s.camposTramite);

  return {
    tipo,
    identificacion: texto(i.numeroIdentificacion ?? i.numero_identificacion ?? i.identificacion) || texto(s.solicitanteIdentificacion),
    nombres: tipo === "NATURAL" ? nombres || texto(s.solicitanteNombre) : "",
    apellidos: tipo === "NATURAL" ? apellidos : "",
    razonSocial: tipo === "JURIDICA" ? razonSocial || texto(s.solicitanteNombre) : "",
    representanteLegal: tipo === "JURIDICA" ? texto(i.representanteLegal ?? i.representante_legal) : "",
    email: texto(i.correoElectronico ?? i.correo_electronico ?? i.correo ?? i.email) || texto(s.solicitanteCorreo),
    telefono: texto(i.telefonoContacto ?? i.telefono ?? i.celular),
    direccion: texto(i.direccionResidencia ?? i.direccion),
    municipioSolicitante: municipioCdmbDe(i.municipioResidencia ?? i.municipio),
    municipio: municipioDeCamposVital(s.camposTramite) ?? "",
    predioDireccion: texto(direccionPredio),
    ubicacion: punto ? { lat: punto.lat, lon: punto.lon } : null,
  };
}
