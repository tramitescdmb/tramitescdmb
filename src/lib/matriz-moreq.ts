import type { EstadoRequisitoMoreq } from "@prisma/client";
import { db } from "@/lib/db";
import semilla from "../../data/sgdea/matriz-moreq.json";

export const CATEGORIAS_MOREQ = [
  { n: 1, titulo: "Clasificación y Organización Documental", descripcion: "El cuadro de clasificación, la TRD, los expedientes electrónicos y su ciclo de vida." },
  { n: 2, titulo: "Retención y Disposición", descripcion: "Quién controla los tiempos de retención y qué pasa al cumplirse." },
  { n: 3, titulo: "Captura e Ingreso de Documentos", descripcion: "Cómo entra un documento al sistema, en qué formatos y con qué controles." },
  { n: 4, titulo: "Búsqueda y Presentación", descripcion: "Cómo se encuentra y se muestra lo que ya está en el sistema." },
  { n: 5, titulo: "Metadatos", descripcion: "Los datos que describen a cada documento, más allá de su contenido." },
  { n: 6, titulo: "Control y Seguridad", descripcion: "Usuarios, roles, contraseñas, auditoría y protección de la información." },
  { n: 7, titulo: "Flujos de Trabajo Electrónicos", descripcion: "Un motor de procesos configurable por un administrador funcional, no programado en código." },
  { n: 8, titulo: "Requisitos No Funcionales", descripcion: "Disponibilidad, desempeño, usabilidad y accesibilidad de la plataforma." },
] as const;

export const ESTADOS_MOREQ: EstadoRequisitoMoreq[] = ["COMPLETO", "PARCIAL", "PENDIENTE"];

export const ETIQUETA_ESTADO_MOREQ: Record<EstadoRequisitoMoreq, string> = {
  COMPLETO: "Completo",
  PARCIAL: "Parcial",
  PENDIENTE: "Pendiente",
};

export function esEstadoMoreq(v: unknown): v is EstadoRequisitoMoreq {
  return typeof v === "string" && (ESTADOS_MOREQ as string[]).includes(v);
}

export type CumplimientoMoreq = { total: number; completos: number; parciales: number; pendientes: number; porcentaje: number };

export function calcularCumplimiento(estados: EstadoRequisitoMoreq[]): CumplimientoMoreq {
  const completos = estados.filter((e) => e === "COMPLETO").length;
  const parciales = estados.filter((e) => e === "PARCIAL").length;
  const pendientes = estados.filter((e) => e === "PENDIENTE").length;
  const total = estados.length;
  return { total, completos, parciales, pendientes, porcentaje: total ? Math.round(((completos + parciales * 0.5) / total) * 100) : 0 };
}

type FilaSemilla = { numero: string; categoria: number; orden: number; titulo: string; estado: string; nota: string };

export function filasSemillaMoreq() {
  return (semilla as FilaSemilla[]).map((f) => {
    if (!esEstadoMoreq(f.estado)) throw new Error(`Estado no válido en la matriz MoReq (${f.numero}): ${f.estado}`);
    return { numero: f.numero, categoria: f.categoria, orden: f.orden, titulo: f.titulo, estado: f.estado, nota: f.nota };
  });
}

export async function asegurarMatrizMoreq(): Promise<void> {
  if ((await db.requisitoMoreq.count()) > 0) return;
  await db.requisitoMoreq.createMany({ data: filasSemillaMoreq(), skipDuplicates: true });
}

export async function actualizarRequisitoMoreq(
  id: string,
  datos: { titulo: string; estado: EstadoRequisitoMoreq; nota: string },
  usuarioId: string
): Promise<{ numero: string; cambios: string[] }> {
  const titulo = datos.titulo.replace(/\s+/g, " ").trim();
  const nota = datos.nota.trim();
  if (!titulo) throw new Error("El requisito no puede quedar vacío.");
  if (!nota) throw new Error("La nota con la evidencia es obligatoria.");
  const actual = await db.requisitoMoreq.findUnique({ where: { id }, select: { numero: true, titulo: true, estado: true, nota: true } });
  if (!actual) throw new Error("El requisito no existe.");

  const cambios: string[] = [];
  if (actual.estado !== datos.estado) cambios.push(`estado ${ETIQUETA_ESTADO_MOREQ[actual.estado]} → ${ETIQUETA_ESTADO_MOREQ[datos.estado]}`);
  if (actual.titulo !== titulo) cambios.push("requisito ajustado");
  if (actual.nota !== nota) cambios.push("nota actualizada");
  if (cambios.length === 0) return { numero: actual.numero, cambios };

  await db.requisitoMoreq.update({
    where: { id },
    data: { titulo, estado: datos.estado, nota, actualizadoEn: new Date(), actualizadoPorId: usuarioId },
  });
  return { numero: actual.numero, cambios };
}

function campoCsv(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export function csvMatrizMoreq(
  filas: { numero: string; categoria: number; titulo: string; estado: EstadoRequisitoMoreq; nota: string; actualizadoEn: Date | null; actualizadoPor: string | null }[]
): string {
  const tituloCategoria = new Map<number, string>(CATEGORIAS_MOREQ.map((c) => [c.n, c.titulo]));
  const lineas = [
    ["numero", "categoria", "requisito", "estado", "nota", "ultima_edicion", "editado_por"].join(";"),
    ...filas.map((f) =>
      [
        campoCsv(f.numero),
        campoCsv(`${f.categoria}. ${tituloCategoria.get(f.categoria) ?? ""}`),
        campoCsv(f.titulo),
        campoCsv(ETIQUETA_ESTADO_MOREQ[f.estado]),
        campoCsv(f.nota),
        campoCsv(f.actualizadoEn ? f.actualizadoEn.toISOString().slice(0, 10) : ""),
        campoCsv(f.actualizadoPor ?? ""),
      ].join(";")
    ),
  ];
  return "﻿" + lineas.join("\r\n");
}
