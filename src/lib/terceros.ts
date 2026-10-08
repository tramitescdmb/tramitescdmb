import type { Prisma, Tercero } from "@prisma/client";
import { db } from "@/lib/db";
import { nombreCompletoPersona, nulo, personaVacia, type DatosPersona } from "@/lib/datos-persona";

export function nombreTercero(t: Pick<Tercero, "tipo" | "nombres" | "apellidos" | "razonSocial">): string {
  return nombreCompletoPersona({ tipoPersona: t.tipo, nombres: t.nombres, apellidos: t.apellidos, razonSocial: t.razonSocial });
}

export function personaDesdeTercero(t: Tercero): DatosPersona {
  return personaVacia({
    tipoPersona: t.tipo,
    tipoIdentificacion: t.tipoIdentificacion ?? (t.tipo === "JURIDICA" ? "NIT" : "CC"),
    identificacion: t.identificacion,
    nombres: t.nombres ?? "",
    apellidos: t.apellidos ?? "",
    razonSocial: t.razonSocial ?? "",
    email: t.email ?? "",
    celular: t.celular ?? "",
    telefono: t.telefono ?? "",
    direccion: t.direccion ?? "",
    departamento: t.departamento ?? "",
    ciudad: t.ciudad ?? "",
  });
}

export function datosTercero(p: DatosPersona) {
  const juridica = p.tipoPersona === "JURIDICA";
  return {
    tipo: p.tipoPersona,
    tipoIdentificacion: p.tipoIdentificacion,
    nombres: juridica ? null : nulo(p.nombres),
    apellidos: juridica ? null : nulo(p.apellidos),
    razonSocial: juridica ? nulo(p.razonSocial) : null,
    email: nulo(p.email),
    celular: nulo(p.celular),
    telefono: nulo(p.telefono),
    direccion: nulo(p.direccion),
    departamento: nulo(p.departamento),
    ciudad: nulo(p.ciudad),
  };
}

export function filtroTerceros(busqueda: string): Prisma.TerceroWhereInput {
  const palabras = busqueda.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  if (palabras.length === 0) return {};
  return {
    AND: palabras.map((p) => ({
      OR: [
        { identificacion: { contains: p, mode: "insensitive" as const } },
        { nombres: { contains: p, mode: "insensitive" as const } },
        { apellidos: { contains: p, mode: "insensitive" as const } },
        { razonSocial: { contains: p, mode: "insensitive" as const } },
        { email: { contains: p, mode: "insensitive" as const } },
      ],
    })),
  };
}

export async function buscarTerceros(consulta: string, limite = 8) {
  if (consulta.trim().length < 2) return [];
  const filas = await db.tercero.findMany({ where: filtroTerceros(consulta), orderBy: { updatedAt: "desc" }, take: limite });
  return filas.map((t) => ({ id: t.id, nombre: nombreTercero(t), identificacion: t.identificacion, ciudad: t.ciudad ?? "", persona: personaDesdeTercero(t) }));
}

export type TerceroEncontrado = Awaited<ReturnType<typeof buscarTerceros>>[number];
