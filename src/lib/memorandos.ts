import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ESTADOS_ACTIVOS } from "@/lib/correspondencia-panel";
import { puedeAccederCorrespondencia, puedeRadicar, type PermisosUsuario } from "@/lib/permisos";
import type { DenominacionEmpleoClave } from "@/lib/denominacion-empleo";

export const PLAZOS_RESPUESTA_MEMORANDO = [3, 5, 10, 15] as const;

export type VistaMemorandos = "por-responder" | "sin-leer" | "recibidos" | "esperando" | "enviados";

export const VISTAS_MEMORANDOS: { id: VistaMemorandos; label: string }[] = [
  { id: "por-responder", label: "Por responder" },
  { id: "sin-leer", label: "Sin leer" },
  { id: "recibidos", label: "Recibidos" },
  { id: "esperando", label: "Esperando respuesta" },
  { id: "enviados", label: "Enviados" },
];

export const DENOMINACIONES_QUE_ENVIAN_MEMORANDOS: ReadonlySet<string> = new Set<DenominacionEmpleoClave>([
  "DIRECTOR_GENERAL",
  "SECRETARIO_GENERAL",
  "SUBDIRECTOR",
  "JEFE_OFICINA",
  "ASESOR_DIRECCION",
  "REVISOR_FISCAL",
]);

export function puedeEnviarMemorando(permisos: PermisosUsuario, denominacionEmpleo: string | null | undefined): boolean {
  if (!puedeAccederCorrespondencia(permisos)) return false;
  return puedeRadicar(permisos) || DENOMINACIONES_QUE_ENVIAN_MEMORANDOS.has(denominacionEmpleo ?? "");
}

export function eligeOrigenLibre(permisos: PermisosUsuario): boolean {
  return puedeRadicar(permisos);
}

export type ContextoMemorandos = { id: string; dependenciaId: string | null; firmante: boolean; acceso: boolean };

export async function contextoMemorandos(usuarioId: string, permisos: PermisosUsuario): Promise<ContextoMemorandos> {
  const u = await db.usuario.findUnique({ where: { id: usuarioId }, select: { denominacionEmpleo: true, dependenciaId: true } });
  return {
    id: usuarioId,
    dependenciaId: u?.dependenciaId ?? null,
    firmante: puedeEnviarMemorando(permisos, u?.denominacionEmpleo),
    acceso: puedeAccederCorrespondencia(permisos),
  };
}

function directivoDeDestino(ctx: ContextoMemorandos): Prisma.ComunicacionWhereInput[] {
  return ctx.firmante && ctx.dependenciaId ? [{ dependenciaDestinoId: ctx.dependenciaId }] : [];
}

function recibidosPor(ctx: ContextoMemorandos): Prisma.ComunicacionWhereInput {
  return {
    tipo: "INTERNA",
    estado: { not: "ANULADA" },
    OR: [{ distribuciones: { some: { usuarioId: ctx.id, activa: true } } }, ...directivoDeDestino(ctx)],
  };
}

const NADA: Prisma.ComunicacionWhereInput = { id: "" };

export function whereMemorandos(ctx: ContextoMemorandos, vista: VistaMemorandos): Prisma.ComunicacionWhereInput {
  if (!ctx.acceso) return NADA;
  const pendiente: Prisma.ComunicacionWhereInput = { fechaVencimiento: { not: null }, estado: { in: ESTADOS_ACTIVOS } };
  switch (vista) {
    case "por-responder":
      return {
        AND: [
          recibidosPor(ctx),
          pendiente,
          ctx.firmante ? {} : { respuestaTexto: null },
        ],
      };
    case "sin-leer":
      return { tipo: "INTERNA", estado: { not: "ANULADA" }, distribuciones: { some: { usuarioId: ctx.id, activa: true, fechaAcuse: null } } };
    case "recibidos":
      return recibidosPor(ctx);
    case "esperando":
      return { tipo: "INTERNA", radicadoPorId: ctx.id, ...pendiente };
    case "enviados":
      return { tipo: "INTERNA", radicadoPorId: ctx.id };
  }
}

export async function contarMemorandos(ctx: ContextoMemorandos) {
  if (!ctx.acceso) return { porResponder: 0, vencidos: 0, sinLeer: 0, esperando: 0 };
  const ahora = new Date();
  const [porResponder, vencidos, sinLeer, esperando] = await Promise.all([
    db.comunicacion.count({ where: whereMemorandos(ctx, "por-responder") }),
    db.comunicacion.count({ where: { AND: [whereMemorandos(ctx, "por-responder"), { fechaVencimiento: { lt: ahora } }] } }),
    db.comunicacion.count({ where: whereMemorandos(ctx, "sin-leer") }),
    db.comunicacion.count({ where: whereMemorandos(ctx, "esperando") }),
  ]);
  return { porResponder, vencidos, sinLeer, esperando };
}

export async function listarMemorandos(ctx: ContextoMemorandos, vista: VistaMemorandos) {
  return db.comunicacion.findMany({
    where: whereMemorandos(ctx, vista),
    orderBy: vista === "por-responder" || vista === "esperando" ? [{ fechaVencimiento: "asc" }] : [{ fechaRadicacion: "desc" }],
    take: 200,
    select: {
      id: true,
      radicado: true,
      asunto: true,
      estado: true,
      fechaRadicacion: true,
      fechaVencimiento: true,
      respuestaTexto: true,
      respuestaPor: { select: { nombre: true } },
      dependenciaOrigen: { select: { nombre: true } },
      dependenciaDestino: { select: { nombre: true } },
      radicadoPor: { select: { nombre: true } },
      respondeA: { select: { id: true, radicado: true } },
      respuestas: { select: { id: true, radicado: true }, orderBy: { fechaRadicacion: "desc" }, take: 1 },
      distribuciones: { where: { activa: true }, select: { usuarioId: true, fechaAcuse: true, usuario: { select: { nombre: true } } } },
    },
  });
}

export async function marcarMemorandoLeido(comunicacionId: string, usuarioId: string) {
  await db.distribucion.updateMany({ where: { comunicacionId, usuarioId, activa: true, fechaAcuse: null }, data: { fechaAcuse: new Date() } });
}

export async function memorandoPendienteDe(comunicacionId: string, ctx: ContextoMemorandos) {
  return db.comunicacion.findFirst({
    where: { id: comunicacionId, AND: [whereMemorandos(ctx, "por-responder")] },
    select: {
      id: true,
      radicado: true,
      asunto: true,
      dependenciaOrigenId: true,
      dependenciaDestinoId: true,
      radicadoPorId: true,
      respuestaTexto: true,
      respuestaPor: { select: { nombre: true } },
    },
  });
}
