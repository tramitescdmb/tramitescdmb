import { db } from "@/lib/db";
import type { ModuloManual } from "@prisma/client";
import semillaSgdea from "../../data/sgdea/manual-demostracion.json";
import semillaGecon from "../../data/gecon/manual-demostracion.json";
import semillaTramites from "../../data/tramites-ambientales/manual-demostracion.json";

const SEMILLAS: Record<ModuloManual, DatosApartado[]> = {
  SGDEA: semillaSgdea as DatosApartado[],
  GECON: semillaGecon as DatosApartado[],
  TRAMITES: semillaTramites as DatosApartado[],
};

export function moduloManualValido(v: unknown): ModuloManual {
  return v === "GECON" || v === "TRAMITES" ? v : "SGDEA";
}

export type DatosApartado = {
  orden: number;
  etiqueta: string;
  titulo: string;
  tituloIndice: string;
  ubicacion: string;
  resumen: string;
  pasos: string[];
  ejemplo: string;
  detalle: string;
  fundamento: string;
};

export type SegmentoTexto =
  | { tipo: "texto"; valor: string }
  | { tipo: "codigo"; valor: string }
  | { tipo: "negrita"; valor: string }
  | { tipo: "enlace"; valor: string; destino: string };

const PATRON_MARCAS = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;

export function segmentosTexto(texto: string): SegmentoTexto[] {
  const segmentos: SegmentoTexto[] = [];
  for (const parte of texto.split(PATRON_MARCAS)) {
    if (!parte) continue;
    if (parte.startsWith("`") && parte.endsWith("`") && parte.length > 2) {
      segmentos.push({ tipo: "codigo", valor: parte.slice(1, -1) });
    } else if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) {
      segmentos.push({ tipo: "negrita", valor: parte.slice(2, -2) });
    } else {
      const enlace = parte.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (enlace && esDestinoSeguro(enlace[2]!)) segmentos.push({ tipo: "enlace", valor: enlace[1]!, destino: enlace[2]! });
      else segmentos.push({ tipo: "texto", valor: parte });
    }
  }
  return segmentos;
}

export function esDestinoSeguro(destino: string): boolean {
  return (destino.startsWith("/") && !destino.startsWith("//")) || /^https:\/\/[^\s]+$/i.test(destino);
}

export function parrafos(texto: string): string[] {
  return texto
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function pasosDesdeTexto(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s+/, "").trim())
    .filter(Boolean);
}

function limpio(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function validarDatosApartado(entrada: Record<string, unknown>, ordenPorDefecto: number): DatosApartado {
  const titulo = limpio(entrada.titulo).replace(/\s+/g, " ");
  const etiqueta = limpio(entrada.etiqueta).replace(/\s+/g, " ");
  const resumen = limpio(entrada.resumen);
  if (!titulo) throw new Error("El título del apartado es obligatorio.");
  if (!etiqueta) throw new Error("La etiqueta del apartado es obligatoria.");
  if (!resumen) throw new Error("El resumen del apartado es obligatorio.");
  const orden = Number(entrada.orden);
  const pasos = Array.isArray(entrada.pasos) ? entrada.pasos.map(limpio).filter(Boolean) : pasosDesdeTexto(limpio(entrada.pasos));
  return {
    orden: Number.isInteger(orden) && orden > 0 ? orden : ordenPorDefecto,
    etiqueta: etiqueta.slice(0, 40),
    titulo: titulo.slice(0, 200),
    tituloIndice: (limpio(entrada.tituloIndice).replace(/\s+/g, " ") || titulo).slice(0, 120),
    ubicacion: limpio(entrada.ubicacion),
    resumen,
    pasos,
    ejemplo: limpio(entrada.ejemplo),
    detalle: limpio(entrada.detalle),
    fundamento: limpio(entrada.fundamento),
  };
}

export function filasSemillaManual(modulo: ModuloManual = "SGDEA"): DatosApartado[] {
  return SEMILLAS[modulo].map((a) => validarDatosApartado(a, a.orden));
}

const CAMPOS_APARTADO = ["etiqueta", "titulo", "tituloIndice", "ubicacion", "resumen", "pasos", "ejemplo", "detalle", "fundamento"] as const;

export async function asegurarManualDemostracion(modulo: ModuloManual = "SGDEA"): Promise<void> {
  const semilla = filasSemillaManual(modulo);
  const actuales = await db.apartadoManualDemostracion.findMany({ where: { modulo } });
  if (actuales.length === 0) {
    await db.apartadoManualDemostracion.createMany({ data: semilla.map((a) => ({ ...a, modulo })) });
    return;
  }
  const maxOrden = Math.max(...actuales.map((a) => a.orden));
  const nuevos = semilla.filter((a) => a.orden > maxOrden && !actuales.some((x) => x.titulo === a.titulo));
  const desactualizados = actuales.flatMap((fila) => {
    if (fila.actualizadoPorId) return [];
    const base = semilla.find((a) => a.orden === fila.orden);
    if (!base || CAMPOS_APARTADO.every((k) => JSON.stringify(base[k]) === JSON.stringify(fila[k]))) return [];
    return [{ id: fila.id, base }];
  });
  if (nuevos.length === 0 && desactualizados.length === 0) return;
  await db.$transaction([
    ...desactualizados.map(({ id, base }) => db.apartadoManualDemostracion.update({ where: { id }, data: base })),
    ...(nuevos.length ? [db.apartadoManualDemostracion.createMany({ data: nuevos.map((a) => ({ ...a, modulo })) })] : []),
  ]);
}

const ETIQUETA_CAMPO: Record<keyof DatosApartado, string> = {
  orden: "orden",
  etiqueta: "etiqueta",
  titulo: "título",
  tituloIndice: "título en el índice",
  ubicacion: "ubicación",
  resumen: "resumen",
  pasos: "procedimiento",
  ejemplo: "ejemplo",
  detalle: "detalle",
  fundamento: "fundamento normativo",
};

export async function crearApartadoManual(entrada: Record<string, unknown>, usuarioId: string) {
  const modulo = moduloManualValido(entrada.modulo);
  const ultimo = await db.apartadoManualDemostracion.aggregate({ where: { modulo }, _max: { orden: true } });
  const datos = validarDatosApartado(entrada, (ultimo._max.orden ?? 0) + 1);
  return db.apartadoManualDemostracion.create({
    data: { ...datos, modulo, actualizadoEn: new Date(), actualizadoPorId: usuarioId },
    select: { id: true, orden: true, titulo: true },
  });
}

export async function actualizarApartadoManual(id: string, entrada: Record<string, unknown>, usuarioId: string) {
  const actual = await db.apartadoManualDemostracion.findUnique({ where: { id } });
  if (!actual) throw new Error("El apartado no existe.");
  const datos = validarDatosApartado(entrada, actual.orden);
  const cambios = (Object.keys(datos) as (keyof DatosApartado)[])
    .filter((k) => JSON.stringify(datos[k]) !== JSON.stringify(actual[k]))
    .map((k) => ETIQUETA_CAMPO[k]);
  if (cambios.length > 0) {
    await db.apartadoManualDemostracion.update({ where: { id }, data: { ...datos, actualizadoEn: new Date(), actualizadoPorId: usuarioId } });
  }
  return { titulo: datos.titulo, cambios };
}

export async function eliminarApartadoManual(id: string) {
  const actual = await db.apartadoManualDemostracion.findUnique({ where: { id }, select: { titulo: true, orden: true } });
  if (!actual) throw new Error("El apartado no existe.");
  await db.apartadoManualDemostracion.delete({ where: { id } });
  return actual;
}
