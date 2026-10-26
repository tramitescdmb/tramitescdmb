import type { AsignacionPaso, TipoComunicacion, TipoPasoFlujo } from "@prisma/client";
import { db } from "@/lib/db";
import { registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import { PLANTILLAS_FLUJO, validarEstructuraFlujo } from "@/lib/flujos-plantillas";
import { sumarDiasHabiles, diasHabilesEntre, type CalendarioLaboral } from "@/lib/dias-habiles";
import { solicitudesVigentes } from "@/lib/estado-firmas";
import type { PermisosUsuario } from "@/lib/permisos";
import { esJefeDeReparto, puedeAdministrarArchivo, puedeDistribuir } from "@/lib/permisos";

export const ETIQUETA_TIPO_PASO: Record<TipoPasoFlujo, string> = {
  TAREA: "Tarea",
  REVISION: "Revisión",
  DECISION: "Decisión",
  FIRMA: "Firma electrónica",
  FIN: "Fin",
};

export const ETIQUETA_ASIGNACION: Record<AsignacionPaso, string> = {
  DEPENDENCIA_COMUNICACION: "Dependencia de la comunicación",
  DEPENDENCIA_FIJA: "Una dependencia fija",
  CARGO: "Un cargo",
  RADICADOR: "Quien radicó",
  RESPONSABLE_PASO_ANTERIOR: "Responsable del paso anterior",
  MANUAL: "Se asigna a mano",
};

export const ETIQUETA_APLICA_A: Record<string, string> = {
  "": "Cualquier tipo",
  RECIBIDA: "Solo recibidas",
  ENVIADA: "Solo enviadas",
  INTERNA: "Solo memorandos",
};

export async function listarFlujos() {
  return db.flujoTrabajo.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    include: {
      _count: { select: { pasos: true, instancias: true } },
      creadoPor: { select: { nombre: true } },
    },
  });
}

export async function obtenerFlujo(id: string) {
  const flujo = await db.flujoTrabajo.findUnique({
    where: { id },
    include: {
      pasos: {
        orderBy: { orden: "asc" },
        include: {
          dependencia: { select: { id: true, nombre: true } },
          transiciones: { orderBy: { orden: "asc" } },
        },
      },
      _count: { select: { instancias: true } },
    },
  });
  if (!flujo) return null;
  const problemas = validarEstructuraFlujo(
    flujo.pasos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      orden: p.orden,
      transiciones: p.transiciones.map((t) => ({ haciaPasoId: t.haciaPasoId, etiqueta: t.etiqueta })),
      asignacion: p.asignacion,
      dependenciaId: p.dependenciaId,
      cargoClave: p.cargoClave,
    })),
  );
  return { ...flujo, problemas };
}

export async function crearFlujo(
  datos: { nombre: string; descripcion?: string; aplicaA?: TipoComunicacion | null },
  usuarioId: string,
) {
  const nombre = datos.nombre.trim();
  if (!nombre) throw new Error("El nombre del flujo es obligatorio.");
  const flujo = await db.flujoTrabajo.create({
    data: {
      nombre,
      descripcion: datos.descripcion?.trim() || null,
      aplicaA: datos.aplicaA ?? null,
      activo: false,
      creadoPorId: usuarioId,
      pasos: {
        create: [
          { orden: 1, nombre: "Primer paso", tipo: "TAREA", asignacion: "DEPENDENCIA_COMUNICACION", posX: 160, posY: 40 },
          { orden: 2, nombre: "Cierre", tipo: "FIN", asignacion: "DEPENDENCIA_COMUNICACION", posX: 200, posY: 200 },
        ],
      },
    },
    include: { pasos: { orderBy: { orden: "asc" } } },
  });
  const [primero, cierre] = flujo.pasos;
  await db.transicionPaso.create({
    data: { flujoId: flujo.id, desdePasoId: primero!.id, haciaPasoId: cierre!.id, etiqueta: "Continuar" },
  });
  return flujo;
}

async function verificarUnicoAutomatico(id: string, aplicaA: TipoComunicacion | null) {
  const otro = await db.flujoTrabajo.findFirst({
    where: { id: { not: id }, activo: true, inicioAutomatico: true, aplicaA },
    select: { nombre: true },
  });
  if (otro) {
    throw new Error(
      `Ya hay un flujo automático activo para ${aplicaA ? ETIQUETA_APLICA_A[aplicaA]!.toLowerCase() : "cualquier tipo"}: «${otro.nombre}». Desactive su inicio automático primero.`
    );
  }
}

export async function actualizarFlujo(
  id: string,
  campos: { nombre?: string; descripcion?: string | null; aplicaA?: TipoComunicacion | null; inicioAutomatico?: boolean },
) {
  const data: Record<string, unknown> = {};
  if (campos.nombre !== undefined) {
    const n = campos.nombre.trim();
    if (!n) throw new Error("El nombre del flujo es obligatorio.");
    data.nombre = n;
  }
  if (campos.descripcion !== undefined) data.descripcion = campos.descripcion?.trim() || null;
  if (campos.aplicaA !== undefined) data.aplicaA = campos.aplicaA ?? null;
  if (campos.inicioAutomatico !== undefined) data.inicioAutomatico = campos.inicioAutomatico;
  const actual = await db.flujoTrabajo.findUnique({ where: { id }, select: { activo: true, aplicaA: true, inicioAutomatico: true } });
  const automatico = campos.inicioAutomatico ?? actual?.inicioAutomatico;
  if (actual?.activo && automatico) await verificarUnicoAutomatico(id, campos.aplicaA !== undefined ? campos.aplicaA ?? null : actual.aplicaA);
  return db.flujoTrabajo.update({ where: { id }, data });
}

export async function cambiarEstadoFlujo(id: string, activo: boolean) {
  if (activo) {
    const flujo = await obtenerFlujo(id);
    if (!flujo) throw new Error("El flujo no existe.");
    if (flujo.problemas.length > 0) {
      throw new Error(`No se puede activar: ${flujo.problemas.map((p) => p.mensaje).join(" ")}`);
    }
    if (flujo.inicioAutomatico) await verificarUnicoAutomatico(id, flujo.aplicaA);
  }
  return db.flujoTrabajo.update({ where: { id }, data: { activo } });
}

export async function eliminarFlujo(id: string) {
  const usados = await db.instanciaFlujo.count({ where: { flujoId: id } });
  if (usados > 0) throw new Error("El flujo ya se aplicó a comunicaciones; desactívelo en vez de borrarlo.");
  await db.flujoTrabajo.delete({ where: { id } });
}

export async function duplicarFlujo(id: string, usuarioId: string) {
  const orig = await db.flujoTrabajo.findUnique({
    where: { id },
    include: { pasos: { orderBy: { orden: "asc" }, include: { transiciones: true } } },
  });
  if (!orig) throw new Error("El flujo no existe.");
  const copia = await db.flujoTrabajo.create({
    data: {
      nombre: `${orig.nombre} (copia)`,
      descripcion: orig.descripcion,
      aplicaA: orig.aplicaA,
      activo: false,
      esPlantilla: false,
      dependenciasOperadoras: orig.dependenciasOperadoras,
      creadoPorId: usuarioId,
      pasos: {
        create: orig.pasos.map((p) => ({
          orden: p.orden,
          nombre: p.nombre,
          instrucciones: p.instrucciones,
          tipo: p.tipo,
          asignacion: p.asignacion,
          dependenciaId: p.dependenciaId,
          cargoClave: p.cargoClave,
          slaDiasHabiles: p.slaDiasHabiles,
          posX: p.posX,
          posY: p.posY,
        })),
      },
    },
    include: { pasos: { orderBy: { orden: "asc" } } },
  });
  const idPorOrden = new Map(copia.pasos.map((p) => [p.orden, p.id]));
  const ordenOrig = new Map(orig.pasos.map((p) => [p.id, p.orden]));
  for (const p of orig.pasos) {
    for (const [i, t] of p.transiciones.entries()) {
      const desde = idPorOrden.get(ordenOrig.get(t.desdePasoId)!);
      const hacia = idPorOrden.get(ordenOrig.get(t.haciaPasoId)!);
      if (desde && hacia) {
        await db.transicionPaso.create({ data: { flujoId: copia.id, desdePasoId: desde, haciaPasoId: hacia, etiqueta: t.etiqueta, orden: i } });
      }
    }
  }
  return copia;
}

export async function guardarDependenciasOperadoras(flujoId: string, dependenciaIds: string[]) {
  return db.flujoTrabajo.update({ where: { id: flujoId }, data: { dependenciasOperadoras: [...new Set(dependenciaIds.filter(Boolean))] } });
}

export async function agregarPaso(flujoId: string, datos: { nombre: string; tipo?: TipoPasoFlujo }) {
  const nombre = datos.nombre.trim() || "Paso sin nombre";
  const ultimo = await db.pasoFlujo.findFirst({ where: { flujoId }, orderBy: { orden: "desc" } });
  const pos = { posX: (ultimo?.posX ?? 160) + 60, posY: (ultimo?.posY ?? 0) + 120 };
  if (ultimo?.tipo === "FIN") {
    await db.pasoFlujo.update({ where: { id: ultimo.id }, data: { orden: ultimo.orden + 1 } });
    return db.pasoFlujo.create({
      data: { flujoId, orden: ultimo.orden, nombre, tipo: datos.tipo ?? "TAREA", asignacion: "DEPENDENCIA_COMUNICACION", ...pos },
    });
  }
  return db.pasoFlujo.create({
    data: {
      flujoId,
      orden: (ultimo?.orden ?? 0) + 1,
      nombre,
      tipo: datos.tipo ?? "TAREA",
      asignacion: "DEPENDENCIA_COMUNICACION",
      ...pos,
    },
  });
}

export async function actualizarPaso(
  pasoId: string,
  campos: {
    nombre?: string;
    instrucciones?: string | null;
    tipo?: TipoPasoFlujo;
    asignacion?: AsignacionPaso;
    dependenciaId?: string | null;
    cargoClave?: string | null;
    slaDiasHabiles?: number | null;
  },
) {
  const data: Record<string, unknown> = {};
  if (campos.nombre !== undefined) data.nombre = campos.nombre.trim() || "Paso sin nombre";
  if (campos.instrucciones !== undefined) data.instrucciones = campos.instrucciones?.trim() || null;
  if (campos.tipo !== undefined) data.tipo = campos.tipo;
  if (campos.asignacion !== undefined) data.asignacion = campos.asignacion;
  if (campos.dependenciaId !== undefined) data.dependenciaId = campos.dependenciaId || null;
  if (campos.cargoClave !== undefined) data.cargoClave = campos.cargoClave?.trim() || null;
  if (campos.slaDiasHabiles !== undefined)
    data.slaDiasHabiles = campos.slaDiasHabiles && campos.slaDiasHabiles > 0 ? campos.slaDiasHabiles : null;
  return db.pasoFlujo.update({ where: { id: pasoId }, data });
}

async function verificarPasosSinUso(pasoIds: string[]) {
  if (pasoIds.length === 0) return;
  const usados = await db.pasoFlujo.findMany({
    where: { id: { in: pasoIds }, OR: [{ ejecuciones: { some: {} } }, { instanciasAqui: { some: {} } }] },
    select: { nombre: true },
  });
  if (usados.length > 0) {
    throw new Error(
      `${usados.map((p) => `«${p.nombre}»`).join(", ")} ya se usó en comunicaciones y no se puede eliminar. Para cambiar la ruta, duplique el flujo y desactive el actual.`
    );
  }
}

export async function eliminarPaso(pasoId: string) {
  const paso = await db.pasoFlujo.findUnique({ where: { id: pasoId }, include: { flujo: { include: { pasos: true } } } });
  if (!paso) return;
  if (paso.flujo.pasos.length <= 1) throw new Error("Un flujo debe tener al menos un paso.");
  await verificarPasosSinUso([pasoId]);
  await db.pasoFlujo.delete({ where: { id: pasoId } });
  const restantes = await db.pasoFlujo.findMany({ where: { flujoId: paso.flujoId }, orderBy: { orden: "asc" } });
  await Promise.all(restantes.map((p, i) => db.pasoFlujo.update({ where: { id: p.id }, data: { orden: i + 1 } })));
}

export async function moverPaso(pasoId: string, direccion: "arriba" | "abajo") {
  const paso = await db.pasoFlujo.findUnique({ where: { id: pasoId } });
  if (!paso) return;
  const vecino = await db.pasoFlujo.findFirst({
    where: { flujoId: paso.flujoId, orden: direccion === "arriba" ? { lt: paso.orden } : { gt: paso.orden } },
    orderBy: { orden: direccion === "arriba" ? "desc" : "asc" },
  });
  if (!vecino) return;
  await db.$transaction([
    db.pasoFlujo.update({ where: { id: paso.id }, data: { orden: vecino.orden } }),
    db.pasoFlujo.update({ where: { id: vecino.id }, data: { orden: paso.orden } }),
  ]);
}

export async function agregarTransicion(desdePasoId: string, haciaPasoId: string, etiqueta: string) {
  const desde = await db.pasoFlujo.findUnique({ where: { id: desdePasoId } });
  const hacia = await db.pasoFlujo.findUnique({ where: { id: haciaPasoId } });
  if (!desde || !hacia || desde.flujoId !== hacia.flujoId) throw new Error("Los pasos no pertenecen al mismo flujo.");
  if (desdePasoId === haciaPasoId) throw new Error("Un paso no puede transicionar hacia sí mismo.");
  const n = await db.transicionPaso.count({ where: { desdePasoId } });
  return db.transicionPaso.create({
    data: { flujoId: desde.flujoId, desdePasoId, haciaPasoId, etiqueta: etiqueta.trim() || "Continuar", orden: n },
  });
}

export async function eliminarTransicion(id: string) {
  await db.transicionPaso.delete({ where: { id } });
}

export type LienzoNodo = { id: string; nombre?: string; tipo?: TipoPasoFlujo; x: number; y: number };
export type LienzoTransicion = { id?: string; desdePasoId: string; haciaPasoId: string; etiqueta: string };

export async function guardarLienzoFlujo(
  flujoId: string,
  datos: { nodos: LienzoNodo[]; transiciones: LienzoTransicion[] },
) {
  const flujo = await db.flujoTrabajo.findUnique({
    where: { id: flujoId },
    include: { pasos: { orderBy: { orden: "asc" }, select: { id: true, orden: true } }, transiciones: { select: { id: true } } },
  });
  if (!flujo) throw new Error("El flujo no existe.");
  if (datos.nodos.length === 0) throw new Error("El flujo debe tener al menos un paso.");

  const num = (v: number) => (Number.isFinite(v) ? Math.round(v) : 0);
  const idReal = new Map<string, string>();
  let ordenSiguiente = (flujo.pasos.at(-1)?.orden ?? 0) + 1;

  for (const n of datos.nodos) {
    if (n.id.startsWith("nuevo-")) {
      const creado = await db.pasoFlujo.create({
        data: {
          flujoId,
          orden: ordenSiguiente++,
          nombre: (n.nombre || "").trim() || "Paso sin nombre",
          tipo: n.tipo ?? "TAREA",
          asignacion: "DEPENDENCIA_COMUNICACION",
          posX: num(n.x),
          posY: num(n.y),
        },
      });
      idReal.set(n.id, creado.id);
    } else {
      idReal.set(n.id, n.id);
    }
  }

  const idsExistentesEnLienzo = new Set(datos.nodos.filter((n) => !n.id.startsWith("nuevo-")).map((n) => n.id));
  const aBorrarPasos = flujo.pasos.filter((p) => !idsExistentesEnLienzo.has(p.id));
  if (flujo.pasos.length - aBorrarPasos.length + idReal.size - idsExistentesEnLienzo.size < 1) {
    throw new Error("El flujo debe quedar con al menos un paso.");
  }
  await verificarPasosSinUso(aBorrarPasos.map((p) => p.id));
  for (const p of aBorrarPasos) await db.pasoFlujo.delete({ where: { id: p.id } });

  for (const n of datos.nodos) {
    if (n.id.startsWith("nuevo-")) continue;
    const data: Record<string, unknown> = { posX: num(n.x), posY: num(n.y) };
    if (n.nombre !== undefined) data.nombre = n.nombre.trim() || "Paso sin nombre";
    if (n.tipo !== undefined) data.tipo = n.tipo;
    await db.pasoFlujo.update({ where: { id: n.id }, data });
  }

  const restantes = await db.pasoFlujo.findMany({ where: { flujoId }, orderBy: { orden: "asc" }, select: { id: true } });
  await Promise.all(restantes.map((p, i) => db.pasoFlujo.update({ where: { id: p.id }, data: { orden: i + 1 } })));

  const idsTransEntrantes = new Set(datos.transiciones.filter((t) => t.id && !t.id.startsWith("nueva-")).map((t) => t.id!));
  for (const t of flujo.transiciones) {
    if (!idsTransEntrantes.has(t.id)) await db.transicionPaso.delete({ where: { id: t.id } }).catch(() => {});
  }
  for (const [i, t] of datos.transiciones.entries()) {
    const desde = idReal.get(t.desdePasoId);
    const hacia = idReal.get(t.haciaPasoId);
    if (!desde || !hacia || desde === hacia) continue;
    const etiqueta = (t.etiqueta || "").trim() || "Continuar";
    if (t.id && idsTransEntrantes.has(t.id)) {
      await db.transicionPaso.update({ where: { id: t.id }, data: { etiqueta, orden: i } }).catch(() => {});
    } else {
      await db.transicionPaso.create({ data: { flujoId, desdePasoId: desde, haciaPasoId: hacia, etiqueta, orden: i } });
    }
  }

  return obtenerFlujo(flujoId);
}

export async function cargarPlantillasFlujo(usuarioId: string) {
  const existentes = new Set((await db.flujoTrabajo.findMany({ select: { nombre: true } })).map((f) => f.nombre));
  let creados = 0;
  for (const plantilla of PLANTILLAS_FLUJO) {
    if (existentes.has(plantilla.nombre)) continue;
    const flujo = await db.flujoTrabajo.create({
      data: {
        nombre: plantilla.nombre,
        descripcion: plantilla.descripcion,
        aplicaA: plantilla.aplicaA,
        activo: false,
        esPlantilla: true,
        creadoPorId: usuarioId,
        pasos: {
          create: plantilla.pasos.map((p, i) => ({
            orden: i + 1,
            nombre: p.nombre,
            tipo: p.tipo,
            asignacion: p.asignacion,
            cargoClave: p.cargoClave ?? null,
            slaDiasHabiles: p.slaDiasHabiles ?? null,
            instrucciones: p.instrucciones ?? null,
            posX: 140 + (i % 2) * 40,
            posY: 40 + i * 120,
          })),
        },
      },
      include: { pasos: true },
    });
    const idPorClave = new Map<string, string>();
    plantilla.pasos.forEach((p, i) => {
      const creado = flujo.pasos.find((x) => x.orden === i + 1);
      if (creado) idPorClave.set(p.clave, creado.id);
    });
    for (const p of plantilla.pasos) {
      for (const [orden, t] of (p.transiciones ?? []).entries()) {
        const desdePasoId = idPorClave.get(p.clave);
        const haciaPasoId = idPorClave.get(t.hacia);
        if (desdePasoId && haciaPasoId) {
          await db.transicionPaso.create({
            data: { flujoId: flujo.id, desdePasoId, haciaPasoId, etiqueta: t.etiqueta, orden },
          });
        }
      }
    }
    creados++;
  }
  return creados;
}

export type ContextoOperador = { esAdminArchivo: boolean; dependenciaId: string | null };

export type UsuarioFlujo = { usuarioId: string; dependenciaId: string | null; cargos: Set<string>; esAdminArchivo: boolean };

export type PasoResponsable = { asignacion: AsignacionPaso; dependenciaId: string | null; cargoClave: string | null };

export type ContextoResponsable = {
  asignadoAId: string | null;
  responsableAnteriorId: string | null;
  comunicacion: { dependenciaDestinoId: string | null; dependenciaOrigenId: string | null; radicadoPorId: string | null };
};

export function esResponsablePaso(paso: PasoResponsable, ctx: ContextoResponsable, u: UsuarioFlujo): boolean {
  switch (paso.asignacion) {
    case "DEPENDENCIA_COMUNICACION": {
      const dep = ctx.comunicacion.dependenciaDestinoId ?? ctx.comunicacion.dependenciaOrigenId;
      return Boolean(dep && u.dependenciaId === dep);
    }
    case "DEPENDENCIA_FIJA":
      return Boolean(paso.dependenciaId && u.dependenciaId === paso.dependenciaId);
    case "CARGO":
      return Boolean(paso.cargoClave && u.cargos.has(paso.cargoClave));
    case "RADICADOR":
      return ctx.comunicacion.radicadoPorId === u.usuarioId;
    case "RESPONSABLE_PASO_ANTERIOR":
      return ctx.responsableAnteriorId === u.usuarioId;
    case "MANUAL":
      return ctx.asignadoAId === u.usuarioId;
  }
}

export function puedeCompletarPaso(paso: PasoResponsable, ctx: ContextoResponsable, u: UsuarioFlujo): boolean {
  return u.esAdminArchivo || esResponsablePaso(paso, ctx, u);
}

export function esDevolucion(desde: { orden: number }, hacia: { orden: number; tipo: TipoPasoFlujo }): boolean {
  return hacia.tipo !== "FIN" && hacia.orden < desde.orden;
}

function verificarAccesoFlujo(
  dependenciasOperadoras: string[],
  nombreFlujo: string,
  ctx?: ContextoOperador,
) {
  if (dependenciasOperadoras.length === 0) return;
  if (!ctx) return;
  if (ctx.esAdminArchivo) return;
  if (ctx.dependenciaId && dependenciasOperadoras.includes(ctx.dependenciaId)) return;
  throw new Error(`El flujo «${nombreFlujo}» solo lo operan las dependencias autorizadas.`);
}

export async function flujosAplicables(tipo: TipoComunicacion, ctx?: ContextoOperador) {
  const flujos = await db.flujoTrabajo.findMany({
    where: { activo: true, OR: [{ aplicaA: null }, { aplicaA: tipo }] },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, descripcion: true, dependenciasOperadoras: true },
  });
  if (!ctx || ctx.esAdminArchivo) return flujos;
  return flujos.filter(
    (f) => f.dependenciasOperadoras.length === 0 || (ctx.dependenciaId ? f.dependenciasOperadoras.includes(ctx.dependenciaId) : false),
  );
}

export async function obtenerInstanciasDeComunicacion(comunicacionId: string) {
  const [comunicacion, instancias] = await Promise.all([
    db.comunicacion.findUnique({
      where: { id: comunicacionId },
      select: {
        dependenciaDestinoId: true,
        dependenciaOrigenId: true,
        radicadoPorId: true,
        dependenciaDestino: { select: { nombre: true } },
        dependenciaOrigen: { select: { nombre: true } },
        radicadoPor: { select: { nombre: true } },
      },
    }),
    db.instanciaFlujo.findMany({
      where: { comunicacionId },
      orderBy: { iniciadoEn: "desc" },
      include: {
        flujo: {
          select: {
            nombre: true,
            pasos: {
              orderBy: { orden: "asc" },
              select: {
                id: true,
                orden: true,
                nombre: true,
                tipo: true,
                asignacion: true,
                transiciones: { select: { desdePasoId: true, haciaPasoId: true, etiqueta: true } },
              },
            },
          },
        },
        iniciadoPor: { select: { nombre: true } },
        asignadoA: { select: { nombre: true } },
        pasoActual: {
          include: { transiciones: { orderBy: { orden: "asc" } }, dependencia: { select: { nombre: true } } },
        },
        ejecuciones: {
          orderBy: { completadoEn: "asc" },
          include: { paso: { select: { id: true, nombre: true, tipo: true } }, responsable: { select: { id: true, nombre: true } } },
        },
      },
    }),
  ]);
  return { comunicacion, instancias };
}

export async function iniciarInstancia(
  comunicacionId: string,
  flujoId: string,
  usuarioId: string | null,
  ip?: string | null,
  ctx?: ContextoOperador,
) {
  const [comunicacion, flujo] = await Promise.all([
    db.comunicacion.findUnique({ where: { id: comunicacionId }, select: { id: true, radicado: true, tipo: true, estado: true } }),
    db.flujoTrabajo.findUnique({ where: { id: flujoId }, include: { pasos: { orderBy: { orden: "asc" }, take: 1 } } }),
  ]);
  if (!comunicacion) throw new Error("La comunicación no existe.");
  if (comunicacion.estado === "ANULADA") throw new Error("No se puede iniciar un flujo sobre una comunicación anulada.");
  if (!flujo || !flujo.activo) throw new Error("El flujo no está activo.");
  if (flujo.aplicaA && flujo.aplicaA !== comunicacion.tipo) throw new Error("El flujo no aplica a este tipo de comunicación.");
  verificarAccesoFlujo(flujo.dependenciasOperadoras, flujo.nombre, ctx);
  const yaEnCurso = await db.instanciaFlujo.findFirst({ where: { comunicacionId, estado: "EN_CURSO" } });
  if (yaEnCurso) throw new Error("Esta comunicación ya tiene un flujo en curso.");
  const pasoInicial = flujo.pasos[0];
  if (!pasoInicial) throw new Error("El flujo no tiene pasos.");

  const instancia = await db.instanciaFlujo.create({
    data: {
      flujoId,
      comunicacionId,
      iniciadoPorId: usuarioId,
      asignadoAId: pasoInicial.asignacion === "MANUAL" ? usuarioId : null,
      pasoActualId: pasoInicial.id,
      pasoActualDesde: new Date(),
      estado: pasoInicial.tipo === "FIN" ? "COMPLETADO" : "EN_CURSO",
      finalizadoEn: pasoInicial.tipo === "FIN" ? new Date() : null,
    },
  });
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: comunicacionId,
    accion: "FLUJO",
    usuarioId,
    ip,
    detalle: `Inició el flujo «${flujo.nombre}» sobre ${comunicacion.radicado} — paso inicial: «${pasoInicial.nombre}»`,
  });
  await sincronizarFlujoPorFirmas(comunicacionId, usuarioId);
  return instancia;
}

export async function avanzarInstancia(
  instanciaId: string,
  transicionId: string,
  usuario: UsuarioFlujo,
  comentario: string | null,
  ip?: string | null,
  ctx?: ContextoOperador,
  asignarAId?: string | null,
) {
  const usuarioId = usuario.usuarioId;
  const instancia = await db.instanciaFlujo.findUnique({
    where: { id: instanciaId },
    include: {
      flujo: { select: { nombre: true, dependenciasOperadoras: true } },
      comunicacion: { select: { id: true, radicado: true, dependenciaDestinoId: true, dependenciaOrigenId: true, radicadoPorId: true } },
      pasoActual: { include: { transiciones: true } },
      ejecuciones: { orderBy: { completadoEn: "desc" }, take: 1, select: { responsableId: true } },
    },
  });
  if (!instancia) throw new Error("La instancia de flujo no existe.");
  if (instancia.estado !== "EN_CURSO") throw new Error("El flujo ya no está en curso.");
  verificarAccesoFlujo(instancia.flujo.dependenciasOperadoras, instancia.flujo.nombre, ctx);
  const pasoActual = instancia.pasoActual;
  if (!pasoActual) throw new Error("El flujo no tiene un paso actual.");
  const contexto: ContextoResponsable = {
    asignadoAId: instancia.asignadoAId,
    responsableAnteriorId: instancia.ejecuciones[0]?.responsableId ?? instancia.iniciadoPorId,
    comunicacion: instancia.comunicacion,
  };
  if (pasoActual.tipo === "FIRMA" && !usuario.esAdminArchivo) {
    throw new Error("Este paso avanza solo cuando el documento queda firmado (o se rechaza la firma).");
  }
  if (!puedeCompletarPaso(pasoActual, contexto, usuario)) {
    throw new Error("Este paso le corresponde a otra persona o dependencia; solo su responsable o el administrador del archivo pueden completarlo.");
  }
  const transicion = pasoActual.transiciones.find((t) => t.id === transicionId);
  if (!transicion) throw new Error("Esa opción no corresponde al paso actual.");
  const destino = await db.pasoFlujo.findUnique({ where: { id: transicion.haciaPasoId } });
  if (!destino) throw new Error("El paso destino no existe.");
  const nota = comentario?.trim() || null;
  if (esDevolucion(pasoActual, destino) && !nota) throw new Error(`Para devolver a «${destino.nombre}» indique el motivo en el comentario.`);

  let asignadoAId: string | null = null;
  if (destino.asignacion === "MANUAL" && destino.tipo !== "FIN") {
    if (!asignarAId) throw new Error(`Elija a quién se asigna el paso «${destino.nombre}».`);
    const persona = await db.usuario.findUnique({ where: { id: asignarAId }, select: { activo: true } });
    if (!persona?.activo) throw new Error("La persona elegida no existe o está inactiva.");
    asignadoAId = asignarAId;
  }

  const cierra = destino.tipo === "FIN";
  const movido = await db.instanciaFlujo.updateMany({
    where: { id: instanciaId, estado: "EN_CURSO", pasoActualId: pasoActual.id },
    data: {
      pasoActualId: destino.id,
      pasoActualDesde: new Date(),
      asignadoAId,
      estado: cierra ? "COMPLETADO" : "EN_CURSO",
      finalizadoEn: cierra ? new Date() : null,
    },
  });
  if (movido.count === 0) throw new Error("Otra persona acaba de completar este paso. Recargue la página.");
  await db.pasoEjecutado.create({
    data: { instanciaId, pasoId: pasoActual.id, resultado: transicion.etiqueta, comentario: nota, responsableId: usuarioId },
  });
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: instancia.comunicacion.id,
    accion: "FLUJO",
    usuarioId,
    ip,
    detalle: `Flujo «${instancia.flujo.nombre}» en ${instancia.comunicacion.radicado}: «${pasoActual.nombre}» → «${transicion.etiqueta}» → «${destino.nombre}»${cierra ? " (flujo completado)" : ""}${nota ? ` — ${nota}` : ""}`,
  });
  if (!cierra) await sincronizarFlujoPorFirmas(instancia.comunicacion.id, usuarioId);
}

export async function reasignarPasoManual(instanciaId: string, asignarAId: string, usuarioId: string, ip?: string | null) {
  const instancia = await db.instanciaFlujo.findUnique({
    where: { id: instanciaId },
    include: { flujo: { select: { nombre: true } }, comunicacion: { select: { id: true, radicado: true } }, pasoActual: { select: { nombre: true, asignacion: true } } },
  });
  if (!instancia || instancia.estado !== "EN_CURSO" || !instancia.pasoActual) throw new Error("El flujo no está en curso.");
  if (instancia.pasoActual.asignacion !== "MANUAL") throw new Error("Este paso no se asigna a mano.");
  const persona = await db.usuario.findUnique({ where: { id: asignarAId }, select: { activo: true, nombre: true } });
  if (!persona?.activo) throw new Error("La persona elegida no existe o está inactiva.");
  await db.instanciaFlujo.update({ where: { id: instanciaId }, data: { asignadoAId: asignarAId } });
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: instancia.comunicacion.id,
    accion: "FLUJO",
    usuarioId,
    ip,
    detalle: `Flujo «${instancia.flujo.nombre}» en ${instancia.comunicacion.radicado}: asignó el paso «${instancia.pasoActual.nombre}» a ${persona.nombre}`,
  });
}

export async function cancelarInstancia(instanciaId: string, usuarioId: string, motivo: string, ip?: string | null, ctx?: ContextoOperador) {
  if (!motivo.trim()) throw new Error("Indique el motivo para cancelar el flujo.");
  const instancia = await db.instanciaFlujo.findUnique({
    where: { id: instanciaId },
    include: { flujo: { select: { nombre: true, dependenciasOperadoras: true } }, comunicacion: { select: { id: true, radicado: true } } },
  });
  if (!instancia) throw new Error("La instancia de flujo no existe.");
  if (instancia.estado !== "EN_CURSO") throw new Error("El flujo ya no está en curso.");
  verificarAccesoFlujo(instancia.flujo.dependenciasOperadoras, instancia.flujo.nombre, ctx);
  await db.instanciaFlujo.update({
    where: { id: instanciaId },
    data: { estado: "CANCELADO", finalizadoEn: new Date(), pasoActualId: null, asignadoAId: null },
  });
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: instancia.comunicacion.id,
    accion: "FLUJO",
    usuarioId,
    ip,
    detalle: `Canceló el flujo «${instancia.flujo.nombre}» en ${instancia.comunicacion.radicado}: ${motivo.trim()}`,
  });
}

export function limitePaso(desde: Date | null, slaDiasHabiles: number | null, cal: CalendarioLaboral): Date | null {
  if (!desde || !slaDiasHabiles || slaDiasHabiles <= 0) return null;
  return sumarDiasHabiles(desde, slaDiasHabiles, cal);
}

export function estadoTerminoPaso(
  desde: Date | null,
  slaDiasHabiles: number | null,
  cal: CalendarioLaboral,
  ahora = new Date(),
): { limite: Date; vencido: boolean; diasHabiles: number } | null {
  const limite = limitePaso(desde, slaDiasHabiles, cal);
  if (!limite) return null;
  const vencido = limite.getTime() < ahora.getTime();
  const diasHabiles = diasHabilesEntre(vencido ? limite : ahora, vencido ? ahora : limite, cal);
  return { limite, vencido, diasHabiles };
}

export function describirResponsablePaso(
  paso: { asignacion: AsignacionPaso; dependencia?: { nombre: string } | null; cargoClave?: string | null },
  comunicacion: {
    dependenciaDestino?: { nombre: string } | null;
    dependenciaOrigen?: { nombre: string } | null;
    radicadoPor?: { nombre: string } | null;
    asignadoA?: { nombre: string } | null;
  },
): string {
  switch (paso.asignacion) {
    case "DEPENDENCIA_COMUNICACION":
      return (comunicacion.dependenciaDestino ?? comunicacion.dependenciaOrigen)?.nombre ?? "Dependencia de la comunicación (sin asignar)";
    case "DEPENDENCIA_FIJA":
      return paso.dependencia?.nombre ?? "Dependencia fija (sin definir)";
    case "CARGO":
      return paso.cargoClave ? `Cargo: ${paso.cargoClave}` : "Un cargo (sin definir)";
    case "RADICADOR":
      return comunicacion.radicadoPor?.nombre ?? "Quien radicó";
    case "RESPONSABLE_PASO_ANTERIOR":
      return "Responsable del paso anterior";
    case "MANUAL":
      return comunicacion.asignadoA?.nombre ?? "Se asigna a mano (sin asignar)";
  }
}

export async function contarPasosFlujoVencidos(cal: CalendarioLaboral): Promise<number> {
  const enCurso = await db.instanciaFlujo.findMany({
    where: { estado: "EN_CURSO", pasoActualDesde: { not: null } },
    select: { pasoActualDesde: true, pasoActual: { select: { slaDiasHabiles: true } } },
  });
  const ahora = new Date();
  return enCurso.filter((i) => {
    const e = estadoTerminoPaso(i.pasoActualDesde, i.pasoActual?.slaDiasHabiles ?? null, cal, ahora);
    return e?.vencido ?? false;
  }).length;
}

export function puedeAdministrarFlujos(permisos: PermisosUsuario) {
  return puedeAdministrarArchivo(permisos);
}

export function puedeOperarFlujos(permisos: PermisosUsuario) {
  return (
    puedeAdministrarArchivo(permisos) ||
    puedeDistribuir(permisos) ||
    esJefeDeReparto(permisos)
  );
}

export async function pasosFlujoACargo(u: UsuarioFlujo) {
  const enCurso = await db.instanciaFlujo.findMany({
    where: { estado: "EN_CURSO", pasoActualId: { not: null } },
    orderBy: { pasoActualDesde: "asc" },
    take: 500,
    select: {
      id: true,
      asignadoAId: true,
      iniciadoPorId: true,
      pasoActualDesde: true,
      flujo: { select: { nombre: true } },
      pasoActual: { select: { nombre: true, tipo: true, asignacion: true, dependenciaId: true, cargoClave: true, slaDiasHabiles: true } },
      comunicacion: { select: { id: true, radicado: true, asunto: true, dependenciaDestinoId: true, dependenciaOrigenId: true, radicadoPorId: true } },
      ejecuciones: { orderBy: { completadoEn: "desc" }, take: 1, select: { responsableId: true } },
    },
  });
  const propios = enCurso.filter((i) =>
    esResponsablePaso(
      i.pasoActual!,
      { asignadoAId: i.asignadoAId, responsableAnteriorId: i.ejecuciones[0]?.responsableId ?? i.iniciadoPorId, comunicacion: i.comunicacion },
      u
    )
  );
  const resultado: typeof propios = [];
  for (const i of propios) {
    if (i.pasoActual!.tipo !== "FIRMA" || (await estadoFirmasDeComunicacion(i.comunicacion.id)).estado === "SIN_FIRMANTES") resultado.push(i);
  }
  return resultado;
}

export async function usuarioFlujo(usuarioId: string, permisos: PermisosUsuario): Promise<UsuarioFlujo> {
  const usuario = await db.usuario.findUnique({ where: { id: usuarioId }, select: { dependenciaId: true } });
  return { usuarioId, dependenciaId: usuario?.dependenciaId ?? null, cargos: permisos.cargos, esAdminArchivo: puedeAdministrarArchivo(permisos) };
}

const PATRON_SALIDA_RECHAZO = /rechaz|devolv|no aprueb|corregir/i;

export function esSalidaRechazo(etiqueta: string): boolean {
  return PATRON_SALIDA_RECHAZO.test(etiqueta);
}

export type EstadoFirmasComunicacion =
  | { estado: "SIN_FIRMANTES" }
  | { estado: "PENDIENTE"; completadas: number; total: number }
  | { estado: "FIRMADO" }
  | { estado: "RECHAZADO"; motivo: string | null };

export function evaluarFirmasComunicacion(
  solicitudes: { rol: string; estado: "PENDIENTE" | "COMPLETADA" | "RECHAZADA"; asignadoEn: Date; completadoEn: Date | null; comentario?: string | null }[],
  firmas: number
): EstadoFirmasComunicacion {
  const vigentes = solicitudesVigentes(solicitudes.filter((s) => s.rol !== "LECTURA"));
  const rechazo = vigentes.find((s) => s.estado === "RECHAZADA");
  if (rechazo) return { estado: "RECHAZADO", motivo: rechazo.comentario ?? null };
  if (vigentes.length === 0) return firmas > 0 ? { estado: "FIRMADO" } : { estado: "SIN_FIRMANTES" };
  const completadas = vigentes.filter((s) => s.estado === "COMPLETADA").length;
  if (completadas === vigentes.length) return { estado: "FIRMADO" };
  return { estado: "PENDIENTE", completadas, total: vigentes.length };
}

export async function estadoFirmasDeComunicacion(comunicacionId: string): Promise<EstadoFirmasComunicacion> {
  const [solicitudes, firmas] = await Promise.all([
    db.solicitudFirma.findMany({ where: { comunicacionId }, select: { rol: true, estado: true, asignadoEn: true, completadoEn: true, comentario: true } }),
    db.firma.count({ where: { comunicacionId } }),
  ]);
  return evaluarFirmasComunicacion(solicitudes, firmas);
}

export async function sincronizarFlujoPorFirmas(comunicacionId: string, actorId: string | null): Promise<void> {
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    const instancia = await db.instanciaFlujo.findFirst({
      where: { comunicacionId, estado: "EN_CURSO", pasoActual: { tipo: "FIRMA" } },
      include: {
        flujo: { select: { nombre: true } },
        comunicacion: { select: { radicado: true } },
        pasoActual: { include: { transiciones: { orderBy: { orden: "asc" }, include: { hacia: true } } } },
      },
    });
    const paso = instancia?.pasoActual;
    if (!instancia || !paso) return;
    const firmas = await estadoFirmasDeComunicacion(comunicacionId);
    if (firmas.estado !== "FIRMADO" && firmas.estado !== "RECHAZADO") return;
    const rechazo = firmas.estado === "RECHAZADO";
    const transicion = rechazo
      ? paso.transiciones.find((t) => esSalidaRechazo(t.etiqueta))
      : paso.transiciones.find((t) => !esSalidaRechazo(t.etiqueta)) ?? paso.transiciones[0];
    if (!transicion) return;
    const destino = transicion.hacia;
    const cierra = destino.tipo === "FIN";
    const movido = await db.instanciaFlujo.updateMany({
      where: { id: instancia.id, estado: "EN_CURSO", pasoActualId: paso.id },
      data: {
        pasoActualId: destino.id,
        pasoActualDesde: new Date(),
        asignadoAId: destino.asignacion === "MANUAL" ? instancia.iniciadoPorId : null,
        estado: cierra ? "COMPLETADO" : "EN_CURSO",
        finalizadoEn: cierra ? new Date() : null,
      },
    });
    if (movido.count === 0) return;
    const comentario = rechazo ? `Firma rechazada${firmas.motivo ? `: ${firmas.motivo}` : "."}` : "Avance automático: el documento quedó firmado.";
    await db.pasoEjecutado.create({ data: { instanciaId: instancia.id, pasoId: paso.id, resultado: transicion.etiqueta, comentario, responsableId: actorId } });
    await registrarAuditoriaDoc({
      entidad: "Comunicacion",
      entidadId: comunicacionId,
      accion: "FLUJO",
      usuarioId: actorId,
      detalle: `Flujo «${instancia.flujo.nombre}» en ${instancia.comunicacion.radicado}: «${paso.nombre}» → «${transicion.etiqueta}» → «${destino.nombre}» (${comentario})`,
    });
    if (cierra) return;
  }
}

export async function iniciarFlujoAutomatico(comunicacionId: string, usuarioId: string | null): Promise<void> {
  const comunicacion = await db.comunicacion.findUnique({ where: { id: comunicacionId }, select: { tipo: true } });
  if (!comunicacion) return;
  const candidatos = await db.flujoTrabajo.findMany({
    where: { activo: true, inicioAutomatico: true, OR: [{ aplicaA: comunicacion.tipo }, { aplicaA: null }] },
    select: { id: true, aplicaA: true },
  });
  const flujo = candidatos.find((f) => f.aplicaA === comunicacion.tipo) ?? candidatos[0];
  if (!flujo) return;
  if (await db.instanciaFlujo.count({ where: { comunicacionId, estado: "EN_CURSO" } })) return;
  await iniciarInstancia(comunicacionId, flujo.id, usuarioId);
}
