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

/** Modalidad (código de flujo) sugerida dentro del trámite, según VITAL. */
export function codigoFlujoSugerido(idTramiteVital: number, clase: "NUEVA" | "RENOVACION" | ""): string | null {
  if ([30, 112].includes(idTramiteVital)) return "subterranea";
  if ([31, 109].includes(idTramiteVital)) return "superficial";
  if (clase === "RENOVACION") return "renovacion";
  return null;
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
  representanteIdentificacion: string;
  email: string;
  telefono: string;
  direccion: string;
  municipioSolicitante: string;
  municipio: string;
  predioDireccion: string;
  predioNombre: string;
  predioCatastral: string;
  predioMatricula: string;
  claseSolicitud: "NUEVA" | "RENOVACION" | "";
  ubicacion: { lat: number; lon: number } | null;
};

/** Valores que VITAL usa como «sin dato». */
const SIN_DATO = /^(-?2147483648|-1|0+|n\/?a|null|undefined|-+|ninguno|no aplica|seleccione.*)$/i;

function valorCampo(v: unknown): string {
  const t = texto(v);
  return t && !SIN_DATO.test(t) ? t : "";
}

/**
 * Campos del formulario de VITAL con la etiqueta normalizada: sin tildes, en
 * minúsculas, sin numeración («3. nombre o razón social:» → «nombre o razon social»)
 * y sin los valores vacíos de VITAL. Las etiquetas cambian de un trámite a otro.
 */
export function camposNormalizados(campos: unknown): [string, string][] {
  if (!campos || typeof campos !== "object" || Array.isArray(campos)) return [];
  return Object.entries(campos as Record<string, unknown>)
    .map(([k, v]) => [
      sinTildes(k)
        .replace(/^[\d.\s]+(?=[a-z¿])/, "")
        .replace(/[:¿?]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
      valorCampo(v),
    ] as [string, string])
    .filter(([, v]) => v);
}

function buscar(campos: [string, string][], ...patrones: RegExp[]): string {
  for (const p of patrones) {
    const hallado = campos.find(([k]) => p.test(k));
    if (hallado) return hallado[1];
  }
  return "";
}

const esCorreo = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const telefonoValido = (v: string) => (v.replace(/\D/g, "").replace(/^0+$/, "").length >= 7 ? v : "");

/** «Carlos Arturo Ávila Muñoz» → nombres «Carlos Arturo», apellidos «Ávila Muñoz». */
export function partirNombreCompleto(completo: string): { nombres: string; apellidos: string } {
  const partes = completo.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return { nombres: partes[0] ?? "", apellidos: "" };
  if (partes.length === 2) return { nombres: partes[0], apellidos: partes[1] };
  if (partes.length === 3) return { nombres: partes[0], apellidos: partes.slice(1).join(" ") };
  return { nombres: partes.slice(0, -2).join(" "), apellidos: partes.slice(-2).join(" ") };
}

/** Datos para llenar el formulario de radicación a partir de una solicitud de VITAL. */
export function prellenadoDesdeVital(s: {
  solicitanteNombre: string | null;
  solicitanteIdentificacion: string | null;
  solicitanteCorreo: string | null;
  solicitanteRaw: unknown;
  camposTramite: unknown;
}): PrellenadoVital {
  const lista = Array.isArray(s.solicitanteRaw) ? s.solicitanteRaw : s.solicitanteRaw && typeof s.solicitanteRaw === "object" ? [s.solicitanteRaw] : [];
  const interesados = lista.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object");
  // Si VITAL trae varios interesados, el representante puede venir aparte.
  const esRepresentante = (x: Record<string, unknown>) =>
    /represent|apoderad/.test(sinTildes(texto(x.tipoInteresado ?? x.rol ?? x.calidad ?? x.tipoRelacion ?? x.tipo)));
  const i = interesados.find((x) => !esRepresentante(x)) ?? interesados[0] ?? {};
  const rep = interesados.find(esRepresentante) ?? null;
  const f = camposNormalizados(s.camposTramite);
  const v = (x: unknown) => valorCampo(x);

  // Tipo de persona: el del solicitante en VITAL; si no, el del formulario.
  const tipoTexto = sinTildes(v(i.tipoPersona ?? i.tipo_persona) || buscar(f, /^tipo de persona$/, /tipo de persona/));
  const razonInteresado = v(i.razonSocial ?? i.razon_social ?? i.nombreRazonSocial);
  const tipo: "NATURAL" | "JURIDICA" = tipoTexto.includes("jur") || Boolean(razonInteresado) ? "JURIDICA" : "NATURAL";

  const nombreFormulario = buscar(
    f,
    /^nombre o razon social$/,
    /^nombres? y apellidos$/,
    /^razon social$/,
    /^nombre del (solicitante|titular|usuario)$/,
    /^nombre o razon social/,
  );

  // Persona natural
  let nombres = [i.primerNombre ?? i.primer_nombre, i.segundoNombre ?? i.segundo_nombre].map(v).filter(Boolean).join(" ");
  let apellidos = [i.primerApellido ?? i.primer_apellido, i.segundoApellido ?? i.segundo_apellido].map(v).filter(Boolean).join(" ");
  if (tipo === "NATURAL" && !nombres && !apellidos) {
    const partido = partirNombreCompleto(v(i.nombreCompleto) || nombreFormulario || texto(s.solicitanteNombre));
    nombres = partido.nombres;
    apellidos = partido.apellidos;
  }

  // Persona jurídica
  const nit = v(i.numeroIdentificacion ?? i.numero_identificacion ?? i.identificacion) || buscar(f, /^nit$/, /^nit\b/) || texto(s.solicitanteIdentificacion);
  const razonSocial = razonInteresado || nombreFormulario || texto(s.solicitanteNombre);
  const repNombre =
    (rep ? v(rep.nombreCompleto) || [rep.primerNombre, rep.segundoNombre, rep.primerApellido, rep.segundoApellido].map(v).filter(Boolean).join(" ") : "") ||
    v(i.representanteLegal ?? i.representante_legal ?? i.nombreRepresentante) ||
    buscar(f, /^nombre (del )?representante/, /^nombre.*apoderado/, /^representante legal( o apoderado)?$/, /^apoderado$/);
  const repId =
    (rep ? v(rep.numeroIdentificacion ?? rep.identificacion) : "") ||
    v(i.identificacionRepresentante ?? i.documentoRepresentante) ||
    buscar(f, /(documento|identificacion|cedula).*(represent|apoderad)/, /(represent|apoderad).*(documento|identificacion|cedula)/) ||
    // En los formularios de persona jurídica, «número de documento» es el del representante.
    (() => {
      const doc = buscar(f, /^numero de (documento|identificacion)$/, /^no\.? (de )?documento$/);
      return doc && doc.replace(/\D/g, "") !== nit.replace(/\D/g, "") ? doc : "";
    })();

  const correoInteresado = v(i.correoElectronico ?? i.correo_electronico ?? i.correo ?? i.email);
  const correoFormulario = f.filter(([k, val]) => /correo|e-?mail/.test(k) && esCorreo(val)).map(([, val]) => val)[0] ?? "";
  const telefono =
    telefonoValido(v(i.telefonoContacto ?? i.telefono ?? i.celular)) ||
    telefonoValido(buscar(f, /^telefono/, /celular/, /^telefono\(s\)/));
  const direccion =
    v(i.direccionResidencia ?? i.direccion) ||
    buscar(f, /^direccion de (correspondencia|notificacion)/, /^direccion$/, /^direccion del solicitante/);

  const vereda = buscar(f, /poblado|vereda|corregimiento/);
  const predioDireccion =
    buscar(f, /^direccion del predio/, /^direccion o descripcion del sitio/, /^direccion del (punto|proyecto|sitio)/, /^ubicacion del (proyecto|sitio)/) ||
    [buscar(f, /^nombre del predio/), vereda].filter(Boolean).join(", ") ||
    vereda;
  const tipoTramite = sinTildes(buscar(f, /^tipo de (tramite|solicitud)$/, /tipo de (tramite|solicitud)/));
  const punto = puntoDesdeCampos(s.camposTramite);

  return {
    tipo,
    identificacion: tipo === "JURIDICA" ? nit : v(i.numeroIdentificacion ?? i.numero_identificacion ?? i.identificacion) || buscar(f, /^numero de (documento|identificacion)$/) || texto(s.solicitanteIdentificacion),
    nombres: tipo === "NATURAL" ? nombres : "",
    apellidos: tipo === "NATURAL" ? apellidos : "",
    razonSocial: tipo === "JURIDICA" ? razonSocial : "",
    representanteLegal: tipo === "JURIDICA" ? repNombre : "",
    representanteIdentificacion: tipo === "JURIDICA" ? repId : "",
    email: (esCorreo(correoInteresado) ? correoInteresado : "") || texto(s.solicitanteCorreo) || correoFormulario,
    telefono,
    direccion,
    municipioSolicitante: municipioCdmbDe(i.municipioResidencia ?? i.municipio),
    municipio: municipioDeCamposVital(s.camposTramite) ?? "",
    predioDireccion,
    predioNombre: buscar(f, /^nombre del predio/),
    predioCatastral: buscar(f, /catastral/, /numero predial/),
    predioMatricula: buscar(f, /matricula/),
    claseSolicitud: /renov/.test(tipoTramite) ? "RENOVACION" : /nuev/.test(tipoTramite) ? "NUEVA" : "",
    ubicacion: punto ? { lat: punto.lat, lon: punto.lon } : null,
  };
}
