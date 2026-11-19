import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ESTADOS_ACTIVOS } from "@/lib/correspondencia-panel";
import { getConfiguracionSitio } from "@/lib/config-sitio";
import { puedeGestionarArchivo, type PermisosUsuario } from "@/lib/permisos";
import type { DenominacionEmpleoClave } from "@/lib/denominacion-empleo";
import { formatearNumeroMemorando, leerDatosMemorando, siglaDependencia } from "@/lib/memorandos-formato";

export const PLAZOS_RESPUESTA_MEMORANDO = [3, 5, 10, 15] as const;

export type VistaMemorandos = "por-responder" | "sin-leer" | "recibidos" | "esperando" | "enviados";

export const VISTAS_MEMORANDOS: { id: VistaMemorandos; label: string }[] = [
  { id: "por-responder", label: "Por responder" },
  { id: "sin-leer", label: "Sin leer" },
  { id: "recibidos", label: "Recibidos" },
  { id: "esperando", label: "Esperando respuesta" },
  { id: "enviados", label: "Enviados" },
];

/**
 * Únicos cargos que envían (firman) memorandos: Director(a) General, Secretario(a) General, Subdirector(a)
 * y Jefe(a) de Oficina.
 * Se toma de la denominación del empleo registrada en la ficha del usuario (la misma que sale en la firma).
 */
export const DENOMINACIONES_QUE_ENVIAN_MEMORANDOS: ReadonlySet<string> = new Set<DenominacionEmpleoClave>([
  "DIRECTOR_GENERAL",
  "SECRETARIO_GENERAL",
  "SUBDIRECTOR",
  "JEFE_OFICINA",
]);

export const TEXTO_QUIEN_ENVIA = "Los memorandos solo los envían la Dirección General, la Secretaría General, las subdirecciones y las jefaturas de oficina, según el cargo registrado en la ficha del usuario.";

/** Entra al módulo: administradores siempre; los demás, si el módulo está visible y tienen dependencia asignada. */
export function accedeMemorandos(permisos: PermisosUsuario, moduloVisible: boolean): boolean {
  if (permisos.esAdmin) return true;
  return moduloVisible && Boolean(permisos.dependenciaId);
}

export function puedeEnviarMemorando(permisos: PermisosUsuario, denominacionEmpleo: string | null | undefined, moduloVisible: boolean): boolean {
  return accedeMemorandos(permisos, moduloVisible) && Boolean(permisos.dependenciaId) && DENOMINACIONES_QUE_ENVIAN_MEMORANDOS.has(denominacionEmpleo ?? "");
}

export type ContextoMemorandos = { id: string; dependenciaId: string | null; firmante: boolean; acceso: boolean; archivo: boolean };

export async function contextoMemorandos(usuarioId: string, permisos: PermisosUsuario): Promise<ContextoMemorandos> {
  const [u, config] = await Promise.all([
    db.usuario.findUnique({ where: { id: usuarioId }, select: { denominacionEmpleo: true, dependenciaId: true } }),
    getConfiguracionSitio(),
  ]);
  const visible = config.memorandosVisibleFuncionarios !== false;
  return {
    id: usuarioId,
    dependenciaId: u?.dependenciaId ?? null,
    firmante: puedeEnviarMemorando(permisos, u?.denominacionEmpleo, visible),
    acceso: accedeMemorandos(permisos, visible),
    archivo: permisos.esAdmin || puedeGestionarArchivo(permisos),
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

/**
 * Quién ve un memorando: quien lo firmó, a quien se le asignó (aunque ya no esté vigente), quien
 * proyectó su respuesta, quien dirige la oficina de origen o de destino, y gestión documental o el
 * administrador.
 */
export function whereVerMemorando(ctx: ContextoMemorandos): Prisma.ComunicacionWhereInput {
  if (!ctx.acceso) return NADA;
  if (ctx.archivo) return { tipo: "INTERNA" };
  const directivo: Prisma.ComunicacionWhereInput[] =
    ctx.firmante && ctx.dependenciaId ? [{ dependenciaDestinoId: ctx.dependenciaId }, { dependenciaOrigenId: ctx.dependenciaId }] : [];
  return {
    tipo: "INTERNA",
    OR: [{ radicadoPorId: ctx.id }, { respuestaPorId: ctx.id }, { distribuciones: { some: { usuarioId: ctx.id } } }, ...directivo],
  };
}

export async function puedeVerMemorando(ctx: ContextoMemorandos, comunicacionId: string): Promise<boolean> {
  return (await db.comunicacion.count({ where: { id: comunicacionId, AND: [whereVerMemorando(ctx)] } })) > 0;
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
      datosMemorando: true,
      anio: true,
      dependenciaOrigenId: true,
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
      respuestaPorId: true,
      respuestaPor: { select: { nombre: true } },
    },
  });
}

/**
 * Número del memorando («ADEI – 054 /2026»). Los firmados en el módulo nuevo lo traen guardado. A los
 * firmados antes en el SGDEA se les calcula por orden de radicación dentro de su oficina y año, sin
 * modificar el registro: así su firma (hash de radicado, asunto y contenido) queda intacta.
 */
export async function numeroDeMemorando(c: {
  id: string;
  anio: number;
  fechaRadicacion: Date;
  dependenciaOrigenId: string | null;
  datosMemorando: unknown;
}): Promise<string | null> {
  const guardado = leerDatosMemorando(c.datosMemorando);
  if (guardado) return guardado.numero;
  if (!c.dependenciaOrigenId) return null;
  const [dep, previos] = await Promise.all([
    db.dependencia.findUnique({ where: { id: c.dependenciaOrigenId }, select: { nombre: true, codigo: true } }),
    db.comunicacion.count({
      where: {
        tipo: "INTERNA",
        anio: c.anio,
        dependenciaOrigenId: c.dependenciaOrigenId,
        OR: [{ fechaRadicacion: { lt: c.fechaRadicacion } }, { fechaRadicacion: c.fechaRadicacion, id: { lte: c.id } }],
      },
    }),
  ]);
  return formatearNumeroMemorando(siglaDependencia(dep?.nombre, dep?.codigo), previos, c.anio);
}

type FilaNumero = { id: string; anio: number; fechaRadicacion: Date; dependenciaOrigenId: string | null; datosMemorando: unknown };

/** Igual que numeroDeMemorando, para una lista: una consulta por oficina y año en vez de una por fila. */
export async function numerosDeMemorandos(filas: FilaNumero[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const grupos = new Map<string, { dependenciaId: string; anio: number }>();
  for (const f of filas) {
    const guardado = leerDatosMemorando(f.datosMemorando);
    if (guardado) out.set(f.id, guardado.numero);
    else if (f.dependenciaOrigenId) grupos.set(`${f.dependenciaOrigenId}|${f.anio}`, { dependenciaId: f.dependenciaOrigenId, anio: f.anio });
  }
  await Promise.all(
    [...grupos.values()].map(async ({ dependenciaId, anio }) => {
      const [dep, todos] = await Promise.all([
        db.dependencia.findUnique({ where: { id: dependenciaId }, select: { nombre: true, codigo: true } }),
        db.comunicacion.findMany({
          where: { tipo: "INTERNA", anio, dependenciaOrigenId: dependenciaId },
          orderBy: [{ fechaRadicacion: "asc" }, { id: "asc" }],
          select: { id: true },
        }),
      ]);
      const sigla = siglaDependencia(dep?.nombre, dep?.codigo);
      todos.forEach((t, i) => {
        if (!out.has(t.id)) out.set(t.id, formatearNumeroMemorando(sigla, i + 1, anio));
      });
    })
  );
  return out;
}
