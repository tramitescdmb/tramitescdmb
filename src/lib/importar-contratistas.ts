export type ColumnaImportacion = {
  clave: string;
  titulo: string;
  requerido: string;
  descripcion: string;
  ejemplo: [string, string];
};

export const COLUMNAS_IMPORTACION: ColumnaImportacion[] = [
  { clave: "tipo_persona", titulo: "Tipo de persona", requerido: "Sí", descripcion: "NATURAL o JURIDICA", ejemplo: ["NATURAL", "JURIDICA"] },
  { clave: "numero_documento", titulo: "Número de documento", requerido: "Sí", descripcion: "Cédula o NIT, sin puntos ni dígito de verificación", ejemplo: ["1098765432", "900123456"] },
  { clave: "nombres", titulo: "Nombres", requerido: "Persona natural", descripcion: "", ejemplo: ["María Fernanda", ""] },
  { clave: "apellidos", titulo: "Apellidos", requerido: "Persona natural", descripcion: "", ejemplo: ["Gómez Rueda", ""] },
  { clave: "razon_social", titulo: "Razón social", requerido: "Persona jurídica", descripcion: "", ejemplo: ["", "Ingeniería Ambiental S.A.S."] },
  { clave: "correo", titulo: "Correo", requerido: "No", descripcion: "Correo de contacto", ejemplo: ["maria.gomez@correo.com", "contacto@ingambiental.co"] },
  { clave: "celular", titulo: "Celular", requerido: "Persona natural", descripcion: "", ejemplo: ["3001234567", ""] },
  { clave: "telefono", titulo: "Teléfono", requerido: "Persona natural", descripcion: "Fijo; puede repetir el celular", ejemplo: ["6076970000", "6076345678"] },
  { clave: "departamento", titulo: "Departamento", requerido: "No", descripcion: "Nombre oficial (DIVIPOLA)", ejemplo: ["Santander", "Santander"] },
  { clave: "ciudad", titulo: "Ciudad o municipio", requerido: "No", descripcion: "Nombre oficial (DIVIPOLA)", ejemplo: ["Floridablanca", "Bucaramanga"] },
  { clave: "direccion", titulo: "Dirección", requerido: "No", descripcion: "", ejemplo: ["Calle 10 # 20-30", "Carrera 27 # 36-14 Of. 501"] },
  { clave: "rep_documento", titulo: "Representante legal: cédula", requerido: "Persona jurídica", descripcion: "", ejemplo: ["", "91234567"] },
  { clave: "rep_nombres", titulo: "Representante legal: nombres", requerido: "Persona jurídica", descripcion: "", ejemplo: ["", "Carlos Andrés"] },
  { clave: "rep_apellidos", titulo: "Representante legal: apellidos", requerido: "Persona jurídica", descripcion: "", ejemplo: ["", "Pérez Díaz"] },
  { clave: "rep_direccion", titulo: "Representante legal: dirección", requerido: "Persona jurídica", descripcion: "", ejemplo: ["", "Carrera 27 # 36-14 Of. 501"] },
  { clave: "rep_celular", titulo: "Representante legal: celular", requerido: "Persona jurídica (celular o teléfono)", descripcion: "", ejemplo: ["", "3159876543"] },
  { clave: "rep_telefono", titulo: "Representante legal: teléfono", requerido: "No", descripcion: "", ejemplo: ["", ""] },
];

export const MAX_FILAS_IMPORTACION = 500;

function celdaCsv(v: string): string {
  return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function plantillaCsv(): string {
  const filas = [COLUMNAS_IMPORTACION.map((c) => c.clave), ...[0, 1].map((i) => COLUMNAS_IMPORTACION.map((c) => c.ejemplo[i as 0 | 1]))];
  return "﻿" + filas.map((f) => f.map(celdaCsv).join(";")).join("\r\n") + "\r\n";
}

export function normalizarEncabezado(h: string): string {
  return h
    .replace(/^﻿/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s.-]+/g, "_");
}

export type FilaImportacion = Record<string, string>;

export function filaACuerpos(fila: FilaImportacion) {
  const v = (k: string) => (fila[k] ?? "").trim();
  const tipoPersona = normalizarEncabezado(v("tipo_persona")).startsWith("jur") ? "JURIDICA" : "NATURAL";
  return {
    persona: {
      tipoPersona,
      tipoIdentificacion: tipoPersona === "JURIDICA" ? "NIT" : "CC",
      identificacion: v("numero_documento").replace(/[.\s]/g, ""),
      nombres: v("nombres"),
      apellidos: v("apellidos"),
      razonSocial: v("razon_social"),
      email: v("correo"),
      celular: v("celular"),
      telefono: v("telefono"),
      departamento: v("departamento"),
      ciudad: v("ciudad"),
      direccion: v("direccion"),
    },
    representanteLegal:
      tipoPersona === "JURIDICA"
        ? {
            identificacion: v("rep_documento").replace(/[.\s]/g, ""),
            nombres: v("rep_nombres"),
            apellidos: v("rep_apellidos"),
            direccion: v("rep_direccion"),
            celular: v("rep_celular"),
            telefono: v("rep_telefono"),
          }
        : null,
  };
}

export type ResultadoFila = { fila: number; documento: string; nombre: string; estado: "listo" | "creado" | "existente" | "error"; detalle?: string; contratistaId?: string };
