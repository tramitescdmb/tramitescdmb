import type { AmbitoPlantilla } from "@prisma/client";
import { db } from "@/lib/db";

export const ETIQUETA_AMBITO: Record<AmbitoPlantilla, string> = {
  ENVIADA: "Oficio de salida",
  INTERNA: "Memorando interno",
  RESPUESTA: "Respuesta a una recibida",
  AMBAS: "Cualquier tipo",
};

export const AMBITOS: AmbitoPlantilla[] = ["ENVIADA", "INTERNA", "RESPUESTA", "AMBAS"];

export function esAmbitoValido(v: string | undefined | null): v is AmbitoPlantilla {
  return !!v && (AMBITOS as string[]).includes(v);
}

/**
 * Plantillas activas aplicables a un ámbito concreto (una de ámbito AMBAS
 * aparece en los tres). MoReq 3.30: crear documentos desde plantillas.
 */
export async function listarPlantillas(ambito?: AmbitoPlantilla) {
  return db.plantillaDocumento.findMany({
    where: {
      activo: true,
      ...(ambito ? { ambito: { in: [ambito, "AMBAS"] } } : {}),
    },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, descripcion: true, cuerpo: true, ambito: true },
  });
}

/** Todas, incluidas las inactivas — para la pantalla de administración. */
export async function listarPlantillasAdmin() {
  return db.plantillaDocumento.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }] });
}

export async function crearPlantilla(datos: { nombre: string; descripcion?: string | null; cuerpo: string; ambito: AmbitoPlantilla }) {
  const nombre = datos.nombre.trim();
  const cuerpo = datos.cuerpo.trim();
  if (!nombre) throw new Error("El nombre de la plantilla es obligatorio.");
  if (!cuerpo) throw new Error("El cuerpo de la plantilla es obligatorio.");
  return db.plantillaDocumento.create({
    data: { nombre, descripcion: datos.descripcion?.trim() || null, cuerpo, ambito: datos.ambito },
  });
}

export async function editarPlantilla(
  id: string,
  datos: { nombre?: string; descripcion?: string | null; cuerpo?: string; ambito?: AmbitoPlantilla; activo?: boolean }
) {
  const data: Record<string, unknown> = {};
  if (datos.nombre !== undefined) {
    const n = datos.nombre.trim();
    if (!n) throw new Error("El nombre de la plantilla es obligatorio.");
    data.nombre = n;
  }
  if (datos.cuerpo !== undefined) {
    const c = datos.cuerpo.trim();
    if (!c) throw new Error("El cuerpo de la plantilla es obligatorio.");
    data.cuerpo = c;
  }
  if (datos.descripcion !== undefined) data.descripcion = datos.descripcion?.trim() || null;
  if (datos.ambito !== undefined) data.ambito = datos.ambito;
  if (datos.activo !== undefined) data.activo = datos.activo;
  return db.plantillaDocumento.update({ where: { id }, data });
}
