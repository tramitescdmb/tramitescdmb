import type { AmbitoCampoMetadato, TipoCampoMetadato } from "@prisma/client";
import { db } from "@/lib/db";

export const ETIQUETA_TIPO_CAMPO: Record<TipoCampoMetadato, string> = {
  TEXTO: "Texto",
  NUMERO: "Número",
  FECHA: "Fecha",
  LISTA: "Lista de opciones",
  BOOLEANO: "Sí / No",
};

export const ETIQUETA_AMBITO_CAMPO: Record<AmbitoCampoMetadato, string> = {
  COMUNICACION: "Comunicaciones",
  EXPEDIENTE: "Expedientes",
  AMBOS: "Ambos",
};

/* ------------------------------------------------------------- Validación (pura) */

export type CampoDef = {
  clave: string;
  nombre: string;
  ayuda: string | null;
  tipo: TipoCampoMetadato;
  opciones: string[];
  obligatorio: boolean;
  valorPorDefecto: string | null;
};

/** Convierte "" / null / undefined a null, y coacciona por tipo. Devuelve `{ valores, errores }`. */
export function validarMetadatos(
  campos: CampoDef[],
  entrada: Record<string, unknown>,
): { valores: Record<string, string | number | boolean>; errores: string[] } {
  const valores: Record<string, string | number | boolean> = {};
  const errores: string[] = [];

  for (const c of campos) {
    const bruto = entrada[c.clave];
    const texto = bruto === undefined || bruto === null ? "" : String(bruto).trim();

    if (texto === "") {
      if (c.obligatorio) errores.push(`«${c.nombre}» es obligatorio.`);
      continue;
    }

    switch (c.tipo) {
      case "NUMERO": {
        const n = Number(texto.replace(",", "."));
        if (!Number.isFinite(n)) {
          errores.push(`«${c.nombre}» debe ser un número.`);
          continue;
        }
        valores[c.clave] = n;
        break;
      }
      case "FECHA": {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || Number.isNaN(Date.parse(texto))) {
          errores.push(`«${c.nombre}» debe ser una fecha válida (AAAA-MM-DD).`);
          continue;
        }
        valores[c.clave] = texto;
        break;
      }
      case "BOOLEANO": {
        valores[c.clave] = texto === "true" || texto === "on" || texto === "1" || texto === "sí" || texto === "si";
        break;
      }
      case "LISTA": {
        if (!c.opciones.includes(texto)) {
          errores.push(`«${c.nombre}»: "${texto}" no es una de las opciones válidas.`);
          continue;
        }
        valores[c.clave] = texto;
        break;
      }
      default:
        valores[c.clave] = texto;
    }
  }

  return { valores, errores };
}

/** Valores iniciales de un formulario: el valor guardado, o el `valorPorDefecto` del campo. */
export function metadatosIniciales(campos: CampoDef[], guardados: Record<string, unknown> | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of campos) {
    const g = guardados?.[c.clave];
    out[c.clave] = g !== undefined && g !== null ? String(g) : c.valorPorDefecto ?? "";
  }
  return out;
}

/* ------------------------------------------------------------- Consultas / CRUD */

/** Campos activos aplicables a un ámbito, opcionalmente restringidos a una serie. */
export async function camposMetadatoPara(
  ambito: "COMUNICACION" | "EXPEDIENTE",
  serieId: string | null,
): Promise<CampoDef[]> {
  const filas = await db.campoMetadato.findMany({
    where: {
      activo: true,
      ambito: { in: [ambito, "AMBOS"] },
      OR: [{ serieId: null }, ...(serieId ? [{ serieId }] : [])],
    },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
  });
  return filas.map((c) => ({
    clave: c.clave,
    nombre: c.nombre,
    ayuda: c.ayuda,
    tipo: c.tipo,
    opciones: c.opciones,
    obligatorio: c.obligatorio,
    valorPorDefecto: c.valorPorDefecto,
  }));
}

export async function listarCamposMetadato() {
  return db.campoMetadato.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    include: { serie: { select: { codigo: true, nombre: true, dependencia: { select: { nombre: true } } } } },
  });
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function crearCampoMetadato(datos: {
  nombre: string;
  ayuda?: string;
  tipo: TipoCampoMetadato;
  opciones?: string[];
  obligatorio?: boolean;
  ambito: AmbitoCampoMetadato;
  serieId?: string | null;
  valorPorDefecto?: string | null;
}) {
  const nombre = datos.nombre.trim();
  if (!nombre) throw new Error("El nombre del campo es obligatorio.");
  let clave = slug(nombre) || "campo";
  const opciones = (datos.opciones ?? []).map((o) => o.trim()).filter(Boolean);
  if (datos.tipo === "LISTA" && opciones.length < 2) throw new Error("Un campo de lista necesita al menos dos opciones.");

  // clave única: agrega un sufijo si choca
  const existentes = new Set((await db.campoMetadato.findMany({ select: { clave: true } })).map((c) => c.clave));
  if (existentes.has(clave)) {
    let i = 2;
    while (existentes.has(`${clave}_${i}`)) i++;
    clave = `${clave}_${i}`;
  }
  const ultimo = await db.campoMetadato.findFirst({ orderBy: { orden: "desc" } });

  return db.campoMetadato.create({
    data: {
      clave,
      nombre,
      ayuda: datos.ayuda?.trim() || null,
      tipo: datos.tipo,
      opciones,
      obligatorio: datos.obligatorio ?? false,
      ambito: datos.ambito,
      serieId: datos.serieId || null,
      valorPorDefecto: datos.valorPorDefecto?.trim() || null,
      orden: (ultimo?.orden ?? 0) + 1,
    },
  });
}

export async function actualizarCampoMetadato(
  id: string,
  campos: {
    nombre?: string;
    ayuda?: string | null;
    opciones?: string[];
    obligatorio?: boolean;
    ambito?: AmbitoCampoMetadato;
    serieId?: string | null;
    valorPorDefecto?: string | null;
  },
) {
  const actual = await db.campoMetadato.findUnique({ where: { id } });
  if (!actual) throw new Error("El campo no existe.");
  const data: Record<string, unknown> = {};
  if (campos.nombre !== undefined) {
    const n = campos.nombre.trim();
    if (!n) throw new Error("El nombre del campo es obligatorio.");
    data.nombre = n;
  }
  if (campos.ayuda !== undefined) data.ayuda = campos.ayuda?.trim() || null;
  if (campos.opciones !== undefined) {
    const ops = campos.opciones.map((o) => o.trim()).filter(Boolean);
    if (actual.tipo === "LISTA" && ops.length < 2) throw new Error("Un campo de lista necesita al menos dos opciones.");
    data.opciones = ops;
  }
  if (campos.obligatorio !== undefined) data.obligatorio = campos.obligatorio;
  if (campos.ambito !== undefined) data.ambito = campos.ambito;
  if (campos.serieId !== undefined) data.serieId = campos.serieId || null;
  if (campos.valorPorDefecto !== undefined) data.valorPorDefecto = campos.valorPorDefecto?.trim() || null;
  return db.campoMetadato.update({ where: { id }, data });
}

export async function cambiarEstadoCampoMetadato(id: string, activo: boolean) {
  return db.campoMetadato.update({ where: { id }, data: { activo } });
}

export async function eliminarCampoMetadato(id: string) {
  // No borra los valores ya guardados en las comunicaciones/expedientes — solo deja
  // de pedir el campo. Es un cambio de esquema reversible reactivándolo.
  await db.campoMetadato.delete({ where: { id } });
}

/** Guarda los metadatos de una comunicación o expediente, validados contra los campos aplicables. */
export async function guardarMetadatosComunicacion(comunicacionId: string, entrada: Record<string, unknown>) {
  const c = await db.comunicacion.findUnique({ where: { id: comunicacionId }, select: { serieId: true, metadatos: true } });
  if (!c) throw new Error("La comunicación no existe.");
  const campos = await camposMetadatoPara("COMUNICACION", c.serieId);
  const { valores, errores } = validarMetadatos(campos, entrada);
  if (errores.length) throw new Error(errores.join(" "));
  await db.comunicacion.update({ where: { id: comunicacionId }, data: { metadatos: valores } });
}

export async function guardarMetadatosExpediente(expedienteId: string, entrada: Record<string, unknown>) {
  const e = await db.expedienteDocumental.findUnique({ where: { id: expedienteId }, select: { serieId: true } });
  if (!e) throw new Error("El expediente no existe.");
  const campos = await camposMetadatoPara("EXPEDIENTE", e.serieId);
  const { valores, errores } = validarMetadatos(campos, entrada);
  if (errores.length) throw new Error(errores.join(" "));
  await db.expedienteDocumental.update({ where: { id: expedienteId }, data: { metadatos: valores } });
}

/** Presenta los metadatos guardados para mostrarlos (etiqueta + valor legible). */
export function presentarMetadatos(
  campos: { clave: string; nombre: string; tipo: TipoCampoMetadato }[],
  guardados: Record<string, unknown> | null,
): { nombre: string; valor: string }[] {
  if (!guardados) return [];
  return campos
    .filter((c) => guardados[c.clave] !== undefined && guardados[c.clave] !== null && guardados[c.clave] !== "")
    .map((c) => {
      const v = guardados[c.clave];
      return { nombre: c.nombre, valor: c.tipo === "BOOLEANO" ? (v ? "Sí" : "No") : String(v) };
    });
}
