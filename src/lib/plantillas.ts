import type { AmbitoPlantilla } from "@prisma/client";
import { db } from "@/lib/db";

export { MARCADORES, contextoBase, aplicarMarcadores, marcadoresPendientes } from "@/lib/plantillas-marcadores";
export type { ContextoMarcadores } from "@/lib/plantillas-marcadores";

export const ETIQUETA_AMBITO: Record<AmbitoPlantilla, string> = {
  ENVIADA: "Oficio de salida",
  INTERNA: "Memorando interno",
  RESPUESTA: "Respuesta a una recibida",
  EXPEDIENTE: "Descripción de expediente",
  AMBAS: "Cualquier oficio / memorando / respuesta",
};

export const AMBITOS: AmbitoPlantilla[] = ["ENVIADA", "INTERNA", "RESPUESTA", "EXPEDIENTE", "AMBAS"];

/** Ámbitos donde una plantilla marcada AMBAS también aparece. */
const AMBITOS_COMUNICACION: AmbitoPlantilla[] = ["ENVIADA", "INTERNA", "RESPUESTA"];

export function esAmbitoValido(v: string | undefined | null): v is AmbitoPlantilla {
  return !!v && (AMBITOS as string[]).includes(v);
}

type PlantillaOpcion = {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  asunto: string | null;
  cuerpo: string;
  ambito: AmbitoPlantilla;
};

/**
 * Plantillas activas aplicables a un ámbito concreto (una de ámbito AMBAS
 * aparece en los tres de comunicación, no en EXPEDIENTE). MoReq 3.30.
 */
export async function listarPlantillas(ambito: AmbitoPlantilla): Promise<PlantillaOpcion[]> {
  const ambitos = AMBITOS_COMUNICACION.includes(ambito) ? [ambito, "AMBAS" as const] : [ambito];
  return db.plantillaDocumento.findMany({
    where: { activo: true, ambito: { in: ambitos } },
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true, descripcion: true, categoria: true, asunto: true, cuerpo: true, ambito: true },
  });
}

/** Todas, incluidas las inactivas — para la pantalla de Plantillas. */
export async function listarPlantillasAdmin() {
  return db.plantillaDocumento.findMany({ orderBy: [{ activo: "desc" }, { categoria: "asc" }, { nombre: "asc" }] });
}

/** Categorías ya usadas, para sugerir en el formulario. */
export async function listarCategoriasPlantilla(): Promise<string[]> {
  const filas = await db.plantillaDocumento.findMany({
    where: { categoria: { not: null } },
    distinct: ["categoria"],
    select: { categoria: true },
    orderBy: { categoria: "asc" },
  });
  return filas.map((f) => f.categoria!).filter(Boolean);
}

type DatosPlantilla = {
  nombre: string;
  descripcion?: string | null;
  categoria?: string | null;
  asunto?: string | null;
  cuerpo: string;
  ambito: AmbitoPlantilla;
};

function limpiar(datos: Partial<DatosPlantilla>) {
  const out: Record<string, unknown> = {};
  if (datos.nombre !== undefined) {
    const n = datos.nombre.trim();
    if (!n) throw new Error("El nombre de la plantilla es obligatorio.");
    out.nombre = n;
  }
  if (datos.cuerpo !== undefined) {
    const c = datos.cuerpo.trim();
    if (!c) throw new Error("El cuerpo de la plantilla es obligatorio.");
    out.cuerpo = c;
  }
  if (datos.descripcion !== undefined) out.descripcion = datos.descripcion?.trim() || null;
  if (datos.categoria !== undefined) out.categoria = datos.categoria?.trim() || null;
  if (datos.asunto !== undefined) out.asunto = datos.asunto?.trim() || null;
  if (datos.ambito !== undefined) out.ambito = datos.ambito;
  return out;
}

export async function crearPlantilla(datos: DatosPlantilla) {
  const data = limpiar(datos);
  if (data.nombre === undefined) throw new Error("El nombre de la plantilla es obligatorio.");
  if (data.cuerpo === undefined) throw new Error("El cuerpo de la plantilla es obligatorio.");
  return db.plantillaDocumento.create({ data: data as never });
}

export async function editarPlantilla(id: string, datos: Partial<DatosPlantilla> & { activo?: boolean }) {
  const data = limpiar(datos);
  if (datos.activo !== undefined) data.activo = datos.activo;
  return db.plantillaDocumento.update({ where: { id }, data });
}

export async function duplicarPlantilla(id: string) {
  const orig = await db.plantillaDocumento.findUnique({ where: { id } });
  if (!orig) throw new Error("La plantilla no existe.");
  return db.plantillaDocumento.create({
    data: {
      nombre: `${orig.nombre} (copia)`,
      descripcion: orig.descripcion,
      categoria: orig.categoria,
      asunto: orig.asunto,
      cuerpo: orig.cuerpo,
      ambito: orig.ambito,
      activo: false,
    },
  });
}

/** Suma 1 al contador de uso (best-effort — se llama al cargar la plantilla en un formulario). */
export async function incrementarUso(id: string) {
  await db.plantillaDocumento.update({ where: { id }, data: { vecesUsada: { increment: 1 } } }).catch(() => {});
}
