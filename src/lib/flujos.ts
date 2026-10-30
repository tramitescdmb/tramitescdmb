import type { AccionVencimientoPaso, AmbitoFlujo, AsignacionPaso, Prisma, TipoComunicacion, TipoPasoFlujo } from "@prisma/client";
import { db } from "@/lib/db";
import { registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import { PLANTILLAS_FLUJO, validarEstructuraFlujo } from "@/lib/flujos-plantillas";
import { sumarDiasHabiles, diasHabilesEntre, type CalendarioLaboral } from "@/lib/dias-habiles";
import { solicitudesVigentes } from "@/lib/estado-firmas";
import { ESTADOS_TERMINALES_EXPEDIENTE } from "@/lib/estados-expediente";
import type { PermisosUsuario } from "@/lib/permisos";
import {
  AMBITOS_DE_MODULO,
  etiquetaAsignacion,
  OPCIONES_APLICA_A,
  puedeAdministrarFlujosModulo,
  puedeOperarFlujosSgdea,
  type ModuloFlujo,
} from "@/lib/flujos-modulos";

export { ETIQUETA_ASIGNACION, aplicaAFormulario } from "@/lib/flujos-modulos";

export const ETIQUETA_TIPO_PASO: Record<TipoPasoFlujo, string> = {
  TAREA: "Tarea",
  REVISION: "Revisión",
  DECISION: "Decisión",
  FIRMA: "Firma electrónica",
  FIN: "Fin",
};

export async function listarFlujos(modulo: ModuloFlujo = "SGDEA") {
  return db.flujoTrabajo.findMany({
    where: { ambito: { in: AMBITOS_DE_MODULO[modulo] } },
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
  datos: { nombre: string; descripcion?: string; aplicaA?: TipoComunicacion | null; ambito?: AmbitoFlujo },
  usuarioId: string,
) {
  const nombre = datos.nombre.trim();
  if (!nombre) throw new Error("El nombre del flujo es obligatorio.");
  const flujo = await db.flujoTrabajo.create({
    data: {
      nombre,
      descripcion: datos.descripcion?.trim() || null,
      ambito: datos.ambito ?? "COMUNICACION",
      aplicaA: datos.ambito === "EXPEDIENTE" ? null : (datos.aplicaA ?? null),
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

const DESTINO_AUTOMATICO: Record<Exclude<AmbitoFlujo, "COMUNICACION">, string> = {
  EXPEDIENTE: "los expedientes documentales",
  CONTRATO: "los expedientes contractuales",
  TRAMITE: "los expedientes de trámites ambientales",
};

async function verificarUnicoAutomatico(id: string, ambito: AmbitoFlujo, aplicaA: TipoComunicacion | null, familia: string = id) {
  const otro = await db.flujoTrabajo.findFirst({
    where: {
      id: { not: id },
      activo: true,
      inicioAutomatico: true,
      ambito,
      ...(ambito === "COMUNICACION" ? { aplicaA } : {}),
      NOT: { OR: [{ id: familia }, { familiaId: familia }] },
    },
    select: { nombre: true },
  });
  if (otro) {
    const destino =
      ambito === "COMUNICACION"
        ? aplicaA
          ? (OPCIONES_APLICA_A.SGDEA[aplicaA] ?? aplicaA).toLowerCase()
          : "cualquier tipo"
        : DESTINO_AUTOMATICO[ambito];
    throw new Error(`Ya hay un flujo automático activo para ${destino}: «${otro.nombre}». Desactive su inicio automático primero.`);
  }
}

export async function actualizarFlujo(
  id: string,
  campos: { nombre?: string; descripcion?: string | null; aplicaA?: TipoComunicacion | null; inicioAutomatico?: boolean; ambito?: AmbitoFlujo },
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
  const actual = await db.flujoTrabajo.findUnique({
    where: { id },
    select: { id: true, familiaId: true, activo: true, aplicaA: true, inicioAutomatico: true, ambito: true, _count: { select: { instancias: true } } },
  });
  if (campos.ambito !== undefined && actual && campos.ambito !== actual.ambito) {
    if (actual._count.instancias > 0) throw new Error("No se puede cambiar entre comunicaciones y expedientes: el flujo ya tiene instancias.");
    data.ambito = campos.ambito;
  }
  const ambito = campos.ambito ?? actual?.ambito ?? "COMUNICACION";
  if (ambito !== "COMUNICACION") {
    data.aplicaA = null;
    campos.aplicaA = null;
  }
  const automatico = campos.inicioAutomatico ?? actual?.inicioAutomatico;
  if (actual?.activo && automatico) {
    await verificarUnicoAutomatico(id, ambito, campos.aplicaA !== undefined ? campos.aplicaA ?? null : actual.aplicaA, actual.familiaId ?? actual.id);
  }
  return db.flujoTrabajo.update({ where: { id }, data });
}

export async function cambiarEstadoFlujo(id: string, activo: boolean) {
  if (activo) {
    const flujo = await obtenerFlujo(id);
    if (!flujo) throw new Error("El flujo no existe.");
    if (flujo.problemas.length > 0) {
      throw new Error(`No se puede activar: ${flujo.problemas.map((p) => p.mensaje).join(" ")}`);
    }
    const familia = flujo.familiaId ?? flujo.id;
    if (flujo.inicioAutomatico) await verificarUnicoAutomatico(id, flujo.ambito, flujo.aplicaA, familia);
    const [, actualizado] = await db.$transaction([
      db.flujoTrabajo.updateMany({ where: { id: { not: id }, activo: true, OR: [{ id: familia }, { familiaId: familia }] }, data: { activo: false } }),
      db.flujoTrabajo.update({ where: { id }, data: { activo: true } }),
    ]);
    return actualizado;
  }
  return db.flujoTrabajo.update({ where: { id }, data: { activo } });
}

export async function versionesDeFlujo(flujo: { id: string; familiaId: string | null }) {
  const familia = flujo.familiaId ?? flujo.id;
  return db.flujoTrabajo.findMany({
    where: { OR: [{ id: familia }, { familiaId: familia }] },
    orderBy: { version: "desc" },
    select: { id: true, version: true, activo: true, createdAt: true, _count: { select: { instancias: true } } },
  });
}

export async function eliminarFlujo(id: string) {
  const usados = await db.instanciaFlujo.count({ where: { flujoId: id } });
  if (usados > 0) throw new Error("El flujo ya se aplicó; desactívelo en vez de borrarlo.");
  await db.flujoTrabajo.delete({ where: { id } });
}

export async function duplicarFlujo(id: string, usuarioId: string, comoVersion = false) {
  const orig = await db.flujoTrabajo.findUnique({
    where: { id },
    include: { pasos: { orderBy: { orden: "asc" }, include: { transiciones: true } } },
  });
  if (!orig) throw new Error("El flujo no existe.");
  const familia = orig.familiaId ?? orig.id;
  const ultimaVersion = comoVersion
    ? ((await db.flujoTrabajo.aggregate({ where: { OR: [{ id: familia }, { familiaId: familia }] }, _max: { version: true } }))._max.version ?? orig.version)
    : 0;
  const copia = await db.flujoTrabajo.create({
    data: {
      nombre: comoVersion ? orig.nombre : `${orig.nombre} (copia)`,
      descripcion: orig.descripcion,
      aplicaA: orig.aplicaA,
      ambito: orig.ambito,
      familiaId: comoVersion ? familia : null,
      version: comoVersion ? ultimaVersion + 1 : 1,
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
          alVencer: p.alVencer,
          salidaVencimiento: p.salidaVencimiento,
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
    alVencer?: AccionVencimientoPaso;
    salidaVencimiento?: string | null;
  },
) {
  const data: Record<string, unknown> = {};
  if (campos.alVencer !== undefined) data.alVencer = campos.alVencer;
  if (campos.salidaVencimiento !== undefined) data.salidaVencimiento = campos.salidaVencimiento?.trim() || null;
  if (campos.alVencer === "AVANZAR") {
    const paso = await db.pasoFlujo.findUnique({ where: { id: pasoId }, select: { transiciones: { select: { etiqueta: true } } } });
    if (!paso?.transiciones.some((t) => t.etiqueta === campos.salidaVencimiento)) {
      throw new Error("Para avanzar automáticamente al vencer, elija una de las salidas del paso.");
    }
  }
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
      `${usados.map((p) => `«${p.nombre}»`).join(", ")} ya se usó en flujos iniciados y no se puede eliminar. Para cambiar la ruta, duplique el flujo y desactive el actual.`
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

export function plantillasDeModulo(modulo: ModuloFlujo) {
  return PLANTILLAS_FLUJO.filter((p) => AMBITOS_DE_MODULO[modulo].includes(p.ambito ?? "COMUNICACION"));
}

export async function cargarPlantillasFlujo(usuarioId: string, modulo: ModuloFlujo = "SGDEA") {
  const existentes = new Set(
    (await db.flujoTrabajo.findMany({ where: { ambito: { in: AMBITOS_DE_MODULO[modulo] } }, select: { nombre: true } })).map((f) => f.nombre),
  );
  let creados = 0;
  for (const plantilla of plantillasDeModulo(modulo)) {
    if (existentes.has(plantilla.nombre)) continue;
    const flujo = await db.flujoTrabajo.create({
      data: {
        nombre: plantilla.nombre,
        descripcion: plantilla.descripcion,
        aplicaA: plantilla.aplicaA,
        ambito: plantilla.ambito ?? "COMUNICACION",
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

export type ContextoOperador = { esAdministrador: boolean; dependenciaId: string | null };

export type UsuarioFlujo = { usuarioId: string; dependenciaId: string | null; cargos: Set<string>; esAdministrador: boolean };

export type PasoResponsable = { asignacion: AsignacionPaso; dependenciaId: string | null; cargoClave: string | null };

export type ContextoResponsable = {
  asignadoAId: string | null;
  responsableAnteriorId: string | null;
  comunicacion: {
    dependenciaDestinoId: string | null;
    dependenciaOrigenId: string | null;
    radicadoPorId: string | null;
    asignadosIds?: string[];
    supervisoresIds?: string[];
  };
};

export const SELECT_OBJETIVO_FLUJO = {
  comunicacion: { select: { id: true, radicado: true, asunto: true, estado: true, dependenciaDestinoId: true, dependenciaOrigenId: true, radicadoPorId: true } },
  expedienteDocumental: { select: { id: true, numero: true, asunto: true, estado: true, dependenciaId: true, creadoPorId: true } },
  expedienteContractual: {
    select: {
      id: true,
      numero: true,
      numeroContrato: true,
      objeto: true,
      cerrado: true,
      eliminado: true,
      dependenciaSolicitanteId: true,
      creadoPorId: true,
      asignados: { select: { usuarioId: true } },
      supervisores: { select: { usuarioId: true } },
    },
  },
  expedienteTramite: {
    select: {
      id: true,
      numero: true,
      estado: true,
      archivado: true,
      createdById: true,
      tramiteTipo: { select: { nombre: true } },
      usuariosAsignados: { select: { id: true } },
    },
  },
} as const;

type InstanciaConObjetivo = {
  comunicacion: {
    id: string;
    radicado: string;
    asunto: string;
    estado?: string;
    dependenciaDestinoId: string | null;
    dependenciaOrigenId: string | null;
    radicadoPorId: string | null;
  } | null;
  expedienteDocumental: { id: string; numero: string; asunto: string; estado?: string; dependenciaId: string; creadoPorId: string } | null;
  expedienteContractual?: {
    id: string;
    numero: string;
    numeroContrato: string | null;
    objeto: string;
    cerrado?: boolean;
    eliminado?: boolean;
    dependenciaSolicitanteId: string;
    creadoPorId: string;
    asignados: { usuarioId: string }[];
    supervisores: { usuarioId: string }[];
  } | null;
  expedienteTramite?: {
    id: string;
    numero: string;
    estado?: string;
    archivado?: boolean;
    createdById: string;
    tramiteTipo: { nombre: string };
    usuariosAsignados: { id: string }[];
  } | null;
};

export type EntidadFlujo = "Comunicacion" | "ExpedienteDocumental" | "ExpedienteContractual" | "Expediente";

export type ObjetivoFlujo = {
  entidad: EntidadFlujo;
  id: string;
  etiqueta: string;
  asunto: string;
  href: string;
  esComunicacion: boolean;
  abierto: boolean;
  modulo: ModuloFlujo;
  ctx: ContextoResponsable["comunicacion"];
};

export function objetivoDeInstancia(i: InstanciaConObjetivo): ObjetivoFlujo {
  if (i.expedienteContractual) {
    const e = i.expedienteContractual;
    return {
      entidad: "ExpedienteContractual",
      id: e.id,
      etiqueta: e.numeroContrato ? `${e.numero} · Contrato ${e.numeroContrato}` : e.numero,
      asunto: e.objeto,
      href: `/contratacion/expedientes/${e.id}#flujo-trabajo`,
      esComunicacion: false,
      abierto: !e.cerrado && !e.eliminado,
      modulo: "GECON",
      ctx: {
        dependenciaDestinoId: e.dependenciaSolicitanteId,
        dependenciaOrigenId: null,
        radicadoPorId: e.creadoPorId,
        asignadosIds: e.asignados.map((a) => a.usuarioId),
        supervisoresIds: e.supervisores.map((s) => s.usuarioId),
      },
    };
  }
  if (i.expedienteTramite) {
    const e = i.expedienteTramite;
    return {
      entidad: "Expediente",
      id: e.id,
      etiqueta: e.numero,
      asunto: e.tramiteTipo.nombre,
      href: `/expedientes/${e.id}#flujo-trabajo`,
      esComunicacion: false,
      abierto: !e.archivado && !(e.estado && (ESTADOS_TERMINALES_EXPEDIENTE as readonly string[]).includes(e.estado)),
      modulo: "TRAMITES",
      ctx: { dependenciaDestinoId: null, dependenciaOrigenId: null, radicadoPorId: e.createdById, asignadosIds: e.usuariosAsignados.map((u) => u.id) },
    };
  }
  if (i.comunicacion) {
    const c = i.comunicacion;
    return {
      entidad: "Comunicacion",
      id: c.id,
      etiqueta: c.radicado,
      asunto: c.asunto,
      href: `/correspondencia/${c.id}#flujo`,
      esComunicacion: true,
      abierto: c.estado !== "ANULADA",
      modulo: "SGDEA",
      ctx: { dependenciaDestinoId: c.dependenciaDestinoId, dependenciaOrigenId: c.dependenciaOrigenId, radicadoPorId: c.radicadoPorId },
    };
  }
  const e = i.expedienteDocumental;
  if (!e) throw new Error("La instancia de flujo no está asociada a una comunicación ni a un expediente.");
  return {
    entidad: "ExpedienteDocumental",
    id: e.id,
    etiqueta: e.numero,
    asunto: e.asunto,
    href: `/correspondencia/expedientes/${e.id}#flujo`,
    esComunicacion: false,
    abierto: e.estado === undefined || e.estado === "ABIERTO",
    modulo: "SGDEA",
    ctx: { dependenciaDestinoId: e.dependenciaId, dependenciaOrigenId: null, radicadoPorId: e.creadoPorId },
  };
}

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
    case "PERSONAL_ASIGNADO":
      return Boolean(ctx.comunicacion.asignadosIds?.includes(u.usuarioId));
    case "SUPERVISOR":
      return Boolean(ctx.comunicacion.supervisoresIds?.includes(u.usuarioId));
  }
}

export function puedeCompletarPaso(paso: PasoResponsable, ctx: ContextoResponsable, u: UsuarioFlujo): boolean {
  return u.esAdministrador || esResponsablePaso(paso, ctx, u);
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
  if (ctx.esAdministrador) return;
  if (ctx.dependenciaId && dependenciasOperadoras.includes(ctx.dependenciaId)) return;
  throw new Error(`El flujo «${nombreFlujo}» solo lo operan las dependencias autorizadas.`);
}

export async function flujosAplicables(tipo: TipoComunicacion | Exclude<AmbitoFlujo, "COMUNICACION">, ctx?: ContextoOperador) {
  const porAmbito = tipo === "EXPEDIENTE" || tipo === "CONTRATO" || tipo === "TRAMITE";
  const flujos = await db.flujoTrabajo.findMany({
    where: porAmbito ? { activo: true, ambito: tipo } : { activo: true, ambito: "COMUNICACION", OR: [{ aplicaA: null }, { aplicaA: tipo }] },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, descripcion: true, dependenciasOperadoras: true },
  });
  if (!ctx || ctx.esAdministrador) return flujos;
  return flujos.filter(
    (f) => f.dependenciasOperadoras.length === 0 || (ctx.dependenciaId ? f.dependenciasOperadoras.includes(ctx.dependenciaId) : false),
  );
}

const INCLUDE_INSTANCIA_DETALLE = {
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
} satisfies Prisma.InstanciaFlujoInclude;

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
    db.instanciaFlujo.findMany({ where: { comunicacionId }, orderBy: { iniciadoEn: "desc" }, include: INCLUDE_INSTANCIA_DETALLE }),
  ]);
  return { comunicacion, instancias };
}

export type AmbitoExpedienteFlujo = Exclude<AmbitoFlujo, "COMUNICACION">;

const CAMPO_INSTANCIA = {
  EXPEDIENTE: "expedienteDocumentalId",
  CONTRATO: "expedienteContractualId",
  TRAMITE: "expedienteTramiteId",
} as const satisfies Record<AmbitoExpedienteFlujo, keyof Prisma.InstanciaFlujoUncheckedCreateInput>;

const ENTIDAD_AMBITO: Record<AmbitoExpedienteFlujo, EntidadFlujo> = { EXPEDIENTE: "ExpedienteDocumental", CONTRATO: "ExpedienteContractual", TRAMITE: "Expediente" };

export type ContextoObjetoFlujo = {
  numero: string;
  abierto: boolean;
  dependenciaDestinoId: string | null;
  dependenciaOrigenId: null;
  radicadoPorId: string | null;
  asignadosIds: string[];
  supervisoresIds: string[];
  dependenciaDestino: { nombre: string } | null;
  dependenciaOrigen: null;
  radicadoPor: { nombre: string } | null;
  asignados: { nombre: string }[];
  supervisores: { nombre: string }[];
};

async function contextoObjeto(ambito: AmbitoExpedienteFlujo, id: string): Promise<ContextoObjetoFlujo | null> {
  if (ambito === "CONTRATO") {
    const e = await db.expedienteContractual.findUnique({
      where: { id },
      select: {
        numero: true,
        cerrado: true,
        eliminado: true,
        dependenciaSolicitanteId: true,
        creadoPorId: true,
        dependenciaSolicitante: { select: { nombre: true } },
        creadoPor: { select: { nombre: true } },
        asignados: { select: { usuario: { select: { id: true, nombre: true } } } },
        supervisores: { select: { usuario: { select: { id: true, nombre: true } } } },
      },
    });
    if (!e) return null;
    return {
      numero: e.numero,
      abierto: !e.cerrado && !e.eliminado,
      dependenciaDestinoId: e.dependenciaSolicitanteId,
      dependenciaOrigenId: null,
      radicadoPorId: e.creadoPorId,
      asignadosIds: e.asignados.map((a) => a.usuario.id),
      supervisoresIds: e.supervisores.map((s) => s.usuario.id),
      dependenciaDestino: e.dependenciaSolicitante,
      dependenciaOrigen: null,
      radicadoPor: e.creadoPor,
      asignados: e.asignados.map((a) => a.usuario),
      supervisores: e.supervisores.map((s) => s.usuario),
    };
  }
  if (ambito === "TRAMITE") {
    const e = await db.expediente.findUnique({
      where: { id },
      select: { numero: true, estado: true, archivado: true, createdById: true, creadoPor: { select: { nombre: true } }, usuariosAsignados: { select: { id: true, nombre: true } } },
    });
    if (!e) return null;
    return {
      numero: e.numero,
      abierto: !e.archivado && !(ESTADOS_TERMINALES_EXPEDIENTE as readonly string[]).includes(e.estado),
      dependenciaDestinoId: null,
      dependenciaOrigenId: null,
      radicadoPorId: e.createdById,
      asignadosIds: e.usuariosAsignados.map((u) => u.id),
      supervisoresIds: [],
      dependenciaDestino: null,
      dependenciaOrigen: null,
      radicadoPor: e.creadoPor,
      asignados: e.usuariosAsignados,
      supervisores: [],
    };
  }
  const e = await db.expedienteDocumental.findUnique({
    where: { id },
    select: { numero: true, estado: true, dependenciaId: true, creadoPorId: true, dependencia: { select: { nombre: true } }, creadoPor: { select: { nombre: true } } },
  });
  if (!e) return null;
  return {
    numero: e.numero,
    abierto: e.estado === "ABIERTO",
    dependenciaDestinoId: e.dependenciaId,
    dependenciaOrigenId: null,
    radicadoPorId: e.creadoPorId,
    asignadosIds: [],
    supervisoresIds: [],
    dependenciaDestino: e.dependencia,
    dependenciaOrigen: null,
    radicadoPor: e.creadoPor,
    asignados: [],
    supervisores: [],
  };
}

export async function obtenerInstanciasDeObjeto(ambito: AmbitoExpedienteFlujo, id: string) {
  const [comunicacion, instancias] = await Promise.all([
    contextoObjeto(ambito, id),
    db.instanciaFlujo.findMany({ where: { [CAMPO_INSTANCIA[ambito]]: id }, orderBy: { iniciadoEn: "desc" }, include: INCLUDE_INSTANCIA_DETALLE }),
  ]);
  return { comunicacion, instancias };
}

export async function iniciarInstanciaEnObjeto(
  ambito: AmbitoExpedienteFlujo,
  objetoId: string,
  flujoId: string,
  usuarioId: string | null,
  ip?: string | null,
  ctx?: ContextoOperador,
) {
  const [objeto, flujo] = await Promise.all([
    contextoObjeto(ambito, objetoId),
    db.flujoTrabajo.findUnique({ where: { id: flujoId }, include: { pasos: { orderBy: { orden: "asc" }, take: 1 } } }),
  ]);
  if (!objeto) throw new Error("El expediente no existe.");
  if (!objeto.abierto) throw new Error("Solo se inician flujos en expedientes abiertos.");
  if (!flujo || !flujo.activo) throw new Error("El flujo no está activo.");
  if (flujo.ambito !== ambito) throw new Error("Ese flujo no corresponde a este tipo de expediente.");
  verificarAccesoFlujo(flujo.dependenciasOperadoras, flujo.nombre, ctx);
  const campo = CAMPO_INSTANCIA[ambito];
  if (await db.instanciaFlujo.findFirst({ where: { [campo]: objetoId, estado: "EN_CURSO" } })) throw new Error("Este expediente ya tiene un flujo en curso.");
  const pasoInicial = flujo.pasos[0];
  if (!pasoInicial) throw new Error("El flujo no tiene pasos.");

  const instancia = await db.instanciaFlujo.create({
    data: {
      flujoId,
      [campo]: objetoId,
      iniciadoPorId: usuarioId,
      asignadoAId: pasoInicial.asignacion === "MANUAL" ? usuarioId : null,
      pasoActualId: pasoInicial.id,
      pasoActualDesde: new Date(),
      estado: pasoInicial.tipo === "FIN" ? "COMPLETADO" : "EN_CURSO",
      finalizadoEn: pasoInicial.tipo === "FIN" ? new Date() : null,
    },
  });
  await registrarAuditoriaDoc({
    entidad: ENTIDAD_AMBITO[ambito],
    entidadId: objetoId,
    accion: "FLUJO",
    usuarioId,
    ip,
    detalle: `Inició el flujo «${flujo.nombre}» sobre el expediente ${objeto.numero} — paso inicial: «${pasoInicial.nombre}»`,
  });
  return instancia;
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
  if (flujo.ambito !== "COMUNICACION") throw new Error("Ese flujo es para expedientes documentales, no para comunicaciones.");
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
      ...SELECT_OBJETIVO_FLUJO,
      pasoActual: { include: { transiciones: true } },
      ejecuciones: { orderBy: { completadoEn: "desc" }, take: 1, select: { responsableId: true } },
    },
  });
  if (!instancia) throw new Error("La instancia de flujo no existe.");
  if (instancia.estado !== "EN_CURSO") throw new Error("El flujo ya no está en curso.");
  verificarAccesoFlujo(instancia.flujo.dependenciasOperadoras, instancia.flujo.nombre, ctx);
  const pasoActual = instancia.pasoActual;
  if (!pasoActual) throw new Error("El flujo no tiene un paso actual.");
  const objetivo = objetivoDeInstancia(instancia);
  const contexto: ContextoResponsable = {
    asignadoAId: instancia.asignadoAId,
    responsableAnteriorId: instancia.ejecuciones[0]?.responsableId ?? instancia.iniciadoPorId,
    comunicacion: objetivo.ctx,
  };
  if (!objetivo.abierto && !usuario.esAdministrador) {
    throw new Error(`${objetivo.etiqueta} ya está cerrado o anulado; solo el administrador del módulo puede mover su flujo.`);
  }
  if (pasoActual.tipo === "FIRMA" && objetivo.esComunicacion && !usuario.esAdministrador) {
    throw new Error("Este paso avanza solo cuando el documento queda firmado (o se rechaza la firma).");
  }
  if (!puedeCompletarPaso(pasoActual, contexto, usuario)) {
    throw new Error("Este paso le corresponde a otra persona o dependencia; solo su responsable o el administrador del módulo pueden completarlo.");
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
    entidad: objetivo.entidad,
    entidadId: objetivo.id,
    accion: "FLUJO",
    usuarioId,
    ip,
    detalle: `Flujo «${instancia.flujo.nombre}» en ${objetivo.etiqueta}: «${pasoActual.nombre}» → «${transicion.etiqueta}» → «${destino.nombre}»${cierra ? " (flujo completado)" : ""}${nota ? ` — ${nota}` : ""}`,
  });
  if (!cierra && objetivo.esComunicacion) await sincronizarFlujoPorFirmas(objetivo.id, usuarioId);
}

export async function reasignarPasoManual(instanciaId: string, asignarAId: string, usuarioId: string, ip?: string | null) {
  const instancia = await db.instanciaFlujo.findUnique({
    where: { id: instanciaId },
    include: { flujo: { select: { nombre: true } }, ...SELECT_OBJETIVO_FLUJO, pasoActual: { select: { nombre: true, asignacion: true } } },
  });
  if (!instancia || instancia.estado !== "EN_CURSO" || !instancia.pasoActual) throw new Error("El flujo no está en curso.");
  if (instancia.pasoActual.asignacion !== "MANUAL") throw new Error("Este paso no se asigna a mano.");
  const persona = await db.usuario.findUnique({ where: { id: asignarAId }, select: { activo: true, nombre: true } });
  if (!persona?.activo) throw new Error("La persona elegida no existe o está inactiva.");
  await db.instanciaFlujo.update({ where: { id: instanciaId }, data: { asignadoAId: asignarAId } });
  const objetivo = objetivoDeInstancia(instancia);
  await registrarAuditoriaDoc({
    entidad: objetivo.entidad,
    entidadId: objetivo.id,
    accion: "FLUJO",
    usuarioId,
    ip,
    detalle: `Flujo «${instancia.flujo.nombre}» en ${objetivo.etiqueta}: asignó el paso «${instancia.pasoActual.nombre}» a ${persona.nombre}`,
  });
}

export async function cancelarInstancia(instanciaId: string, usuarioId: string, motivo: string, ip?: string | null, ctx?: ContextoOperador) {
  if (!motivo.trim()) throw new Error("Indique el motivo para cancelar el flujo.");
  const instancia = await db.instanciaFlujo.findUnique({
    where: { id: instanciaId },
    include: { flujo: { select: { nombre: true, dependenciasOperadoras: true } }, ...SELECT_OBJETIVO_FLUJO },
  });
  if (!instancia) throw new Error("La instancia de flujo no existe.");
  if (instancia.estado !== "EN_CURSO") throw new Error("El flujo ya no está en curso.");
  verificarAccesoFlujo(instancia.flujo.dependenciasOperadoras, instancia.flujo.nombre, ctx);
  await db.instanciaFlujo.update({
    where: { id: instanciaId },
    data: { estado: "CANCELADO", finalizadoEn: new Date(), pasoActualId: null, asignadoAId: null },
  });
  const objetivo = objetivoDeInstancia(instancia);
  await registrarAuditoriaDoc({
    entidad: objetivo.entidad,
    entidadId: objetivo.id,
    accion: "FLUJO",
    usuarioId,
    ip,
    detalle: `Canceló el flujo «${instancia.flujo.nombre}» en ${objetivo.etiqueta}: ${motivo.trim()}`,
  });
}

const CAMPO_OBJETO: Record<AmbitoFlujo, "comunicacionId" | (typeof CAMPO_INSTANCIA)[AmbitoExpedienteFlujo]> = {
  COMUNICACION: "comunicacionId",
  ...CAMPO_INSTANCIA,
};

async function cancelarPorCierre(
  instancias: { id: string; flujo: { nombre: string }; pasoActual: { nombre: string } | null; objetivo: ObjetivoFlujo }[],
  usuarioId: string | null,
  motivo: string,
): Promise<number> {
  let canceladas = 0;
  for (const i of instancias) {
    const movido = await db.instanciaFlujo.updateMany({
      where: { id: i.id, estado: "EN_CURSO" },
      data: { estado: "CANCELADO", finalizadoEn: new Date(), pasoActualId: null, asignadoAId: null },
    });
    if (movido.count === 0) continue;
    canceladas++;
    await registrarAuditoriaDoc({
      entidad: i.objetivo.entidad,
      entidadId: i.objetivo.id,
      accion: "FLUJO",
      usuarioId,
      detalle: `Flujo «${i.flujo.nombre}» en ${i.objetivo.etiqueta}: terminó sin completarse en el paso «${i.pasoActual?.nombre ?? "—"}» — ${motivo}`,
    });
  }
  return canceladas;
}

const SELECT_CIERRE = { id: true, flujo: { select: { nombre: true } }, pasoActual: { select: { nombre: true } }, ...SELECT_OBJETIVO_FLUJO } as const;

export async function cancelarFlujosDeObjeto(ambito: AmbitoFlujo, objetoId: string, usuarioId: string | null, motivo: string): Promise<number> {
  const instancias = await db.instanciaFlujo.findMany({ where: { [CAMPO_OBJETO[ambito]]: objetoId, estado: "EN_CURSO" }, select: SELECT_CIERRE });
  return cancelarPorCierre(instancias.map((i) => ({ ...i, objetivo: objetivoDeInstancia(i) })), usuarioId, motivo);
}

export async function cancelarFlujosDeObjetosCerrados(usuarioId: string | null = null): Promise<number> {
  const instancias = await db.instanciaFlujo.findMany({ where: { estado: "EN_CURSO" }, take: 2000, select: SELECT_CIERRE });
  const cerradas = instancias.map((i) => ({ ...i, objetivo: objetivoDeInstancia(i) })).filter((i) => !i.objetivo.abierto);
  return cancelarPorCierre(cerradas, usuarioId, "el expediente o la comunicación ya estaba cerrado, finalizado o anulado.");
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
    asignados?: { nombre: string }[];
    supervisores?: { nombre: string }[];
  },
  modulo: ModuloFlujo = "SGDEA",
): string {
  const lista = (personas: { nombre: string }[] | undefined) => (personas?.length ? personas.map((p) => p.nombre).join(", ") : null);
  switch (paso.asignacion) {
    case "DEPENDENCIA_COMUNICACION":
      return (comunicacion.dependenciaDestino ?? comunicacion.dependenciaOrigen)?.nombre ?? `${etiquetaAsignacion("DEPENDENCIA_COMUNICACION", modulo)} (sin asignar)`;
    case "DEPENDENCIA_FIJA":
      return paso.dependencia?.nombre ?? "Dependencia fija (sin definir)";
    case "CARGO":
      return paso.cargoClave ? `Cargo: ${paso.cargoClave}` : "Un cargo (sin definir)";
    case "RADICADOR":
      return comunicacion.radicadoPor?.nombre ?? etiquetaAsignacion("RADICADOR", modulo);
    case "RESPONSABLE_PASO_ANTERIOR":
      return "Responsable del paso anterior";
    case "MANUAL":
      return comunicacion.asignadoA?.nombre ?? "Se asigna a mano (sin asignar)";
    case "PERSONAL_ASIGNADO":
      return lista(comunicacion.asignados) ?? `${etiquetaAsignacion("PERSONAL_ASIGNADO", modulo)} (sin asignar)`;
    case "SUPERVISOR":
      return lista(comunicacion.supervisores) ?? "Supervisor del contrato (sin designar)";
  }
}

export async function contarPasosFlujoVencidos(cal: CalendarioLaboral, modulo: ModuloFlujo = "SGDEA"): Promise<number> {
  const enCurso = await db.instanciaFlujo.findMany({
    where: { estado: "EN_CURSO", pasoActualDesde: { not: null }, pasoActual: { slaDiasHabiles: { not: null } }, flujo: { ambito: { in: AMBITOS_DE_MODULO[modulo] } } },
    select: { pasoActualDesde: true, pasoActual: { select: { slaDiasHabiles: true } }, ...SELECT_OBJETIVO_FLUJO },
  });
  const ahora = new Date();
  return enCurso.filter((i) => {
    if (!objetivoDeInstancia(i).abierto) return false;
    const e = estadoTerminoPaso(i.pasoActualDesde, i.pasoActual?.slaDiasHabiles ?? null, cal, ahora);
    return e?.vencido ?? false;
  }).length;
}

export function puedeAdministrarFlujos(permisos: PermisosUsuario, modulo: ModuloFlujo = "SGDEA") {
  return puedeAdministrarFlujosModulo(permisos, modulo);
}

export function puedeOperarFlujos(permisos: PermisosUsuario) {
  return puedeOperarFlujosSgdea(permisos);
}

export async function pasosFlujoACargo(u: UsuarioFlujo, modulo: ModuloFlujo = "SGDEA") {
  const enCurso = await db.instanciaFlujo.findMany({
    where: { estado: "EN_CURSO", pasoActualId: { not: null }, flujo: { ambito: { in: AMBITOS_DE_MODULO[modulo] } } },
    orderBy: { pasoActualDesde: "asc" },
    take: 500,
    select: {
      id: true,
      asignadoAId: true,
      iniciadoPorId: true,
      pasoActualDesde: true,
      flujo: { select: { nombre: true } },
      pasoActual: { select: { nombre: true, tipo: true, asignacion: true, dependenciaId: true, cargoClave: true, slaDiasHabiles: true } },
      ...SELECT_OBJETIVO_FLUJO,
      ejecuciones: { orderBy: { completadoEn: "desc" }, take: 1, select: { responsableId: true } },
    },
  });
  const propios = enCurso
    .map((i) => ({ ...i, objetivo: objetivoDeInstancia(i) }))
    .filter((i) =>
      i.objetivo.abierto &&
      esResponsablePaso(
        i.pasoActual!,
        { asignadoAId: i.asignadoAId, responsableAnteriorId: i.ejecuciones[0]?.responsableId ?? i.iniciadoPorId, comunicacion: i.objetivo.ctx },
        u
      )
    );
  const resultado: typeof propios = [];
  for (const i of propios) {
    if (i.pasoActual!.tipo !== "FIRMA" || !i.objetivo.esComunicacion || (await estadoFirmasDeComunicacion(i.objetivo.id)).estado === "SIN_FIRMANTES") resultado.push(i);
  }
  return resultado;
}

export async function resumenPasosACargo(u: UsuarioFlujo, modulo: ModuloFlujo, cal: CalendarioLaboral): Promise<{ total: number; vencidos: number }> {
  const pasos = await pasosFlujoACargo(u, modulo);
  const ahora = new Date();
  return {
    total: pasos.length,
    vencidos: pasos.filter((p) => estadoTerminoPaso(p.pasoActualDesde, p.pasoActual?.slaDiasHabiles ?? null, cal, ahora)?.vencido).length,
  };
}

export async function usuarioFlujo(usuarioId: string, permisos: PermisosUsuario, modulo: ModuloFlujo = "SGDEA"): Promise<UsuarioFlujo> {
  const usuario = await db.usuario.findUnique({ where: { id: usuarioId }, select: { dependenciaId: true } });
  return { usuarioId, dependenciaId: usuario?.dependenciaId ?? null, cargos: permisos.cargos, esAdministrador: puedeAdministrarFlujosModulo(permisos, modulo) };
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
      detalle: `Flujo «${instancia.flujo.nombre}» en ${instancia.comunicacion?.radicado ?? ""}: «${paso.nombre}» → «${transicion.etiqueta}» → «${destino.nombre}» (${comentario})`,
    });
    if (cierra) return;
  }
}

export async function iniciarFlujoAutomatico(comunicacionId: string, usuarioId: string | null): Promise<void> {
  const comunicacion = await db.comunicacion.findUnique({ where: { id: comunicacionId }, select: { tipo: true } });
  if (!comunicacion) return;
  const candidatos = await db.flujoTrabajo.findMany({
    where: { activo: true, inicioAutomatico: true, ambito: "COMUNICACION", OR: [{ aplicaA: comunicacion.tipo }, { aplicaA: null }] },
    select: { id: true, aplicaA: true },
  });
  const flujo = candidatos.find((f) => f.aplicaA === comunicacion.tipo) ?? candidatos[0];
  if (!flujo) return;
  if (await db.instanciaFlujo.count({ where: { comunicacionId, estado: "EN_CURSO" } })) return;
  await iniciarInstancia(comunicacionId, flujo.id, usuarioId);
}

export async function iniciarFlujoAutomaticoEnObjeto(ambito: AmbitoExpedienteFlujo, objetoId: string, usuarioId: string | null): Promise<void> {
  const flujo = await db.flujoTrabajo.findFirst({ where: { activo: true, inicioAutomatico: true, ambito }, orderBy: { updatedAt: "desc" }, select: { id: true } });
  if (!flujo) return;
  if (await db.instanciaFlujo.count({ where: { [CAMPO_INSTANCIA[ambito]]: objetoId, estado: "EN_CURSO" } })) return;
  await iniciarInstanciaEnObjeto(ambito, objetoId, flujo.id, usuarioId);
}
