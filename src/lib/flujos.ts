import type { AsignacionPaso, TipoComunicacion, TipoPasoFlujo } from "@prisma/client";
import { db } from "@/lib/db";
import { registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import { PLANTILLAS_FLUJO, validarEstructuraFlujo } from "@/lib/flujos-plantillas";
import { sumarDiasHabiles, diasHabilesEntre, type CalendarioLaboral } from "@/lib/dias-habiles";
import type { PermisosUsuario } from "@/lib/permisos";
import { puedeAdministrarArchivo, puedeDistribuir } from "@/lib/permisos";

export const ETIQUETA_TIPO_PASO: Record<TipoPasoFlujo, string> = {
  TAREA: "Tarea",
  REVISION: "Revisión",
  DECISION: "Decisión",
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

/* ============================================================ Definición (admin) */

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
      transiciones: p.transiciones.map((t) => ({ haciaPasoId: t.haciaPasoId })),
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
  // Nace con un primer paso y un cierre, para que sea válido de entrada.
  const flujo = await db.flujoTrabajo.create({
    data: {
      nombre,
      descripcion: datos.descripcion?.trim() || null,
      aplicaA: datos.aplicaA ?? null,
      activo: false,
      creadoPorId: usuarioId,
      pasos: {
        create: [
          { orden: 1, nombre: "Primer paso", tipo: "TAREA", asignacion: "DEPENDENCIA_COMUNICACION" },
          { orden: 2, nombre: "Cierre", tipo: "FIN", asignacion: "DEPENDENCIA_COMUNICACION" },
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

export async function actualizarFlujo(
  id: string,
  campos: { nombre?: string; descripcion?: string | null; aplicaA?: TipoComunicacion | null },
) {
  const data: Record<string, unknown> = {};
  if (campos.nombre !== undefined) {
    const n = campos.nombre.trim();
    if (!n) throw new Error("El nombre del flujo es obligatorio.");
    data.nombre = n;
  }
  if (campos.descripcion !== undefined) data.descripcion = campos.descripcion?.trim() || null;
  if (campos.aplicaA !== undefined) data.aplicaA = campos.aplicaA ?? null;
  return db.flujoTrabajo.update({ where: { id }, data });
}

export async function cambiarEstadoFlujo(id: string, activo: boolean) {
  if (activo) {
    const flujo = await obtenerFlujo(id);
    if (!flujo) throw new Error("El flujo no existe.");
    if (flujo.problemas.length > 0) {
      throw new Error(`No se puede activar: ${flujo.problemas.map((p) => p.mensaje).join(" ")}`);
    }
  }
  return db.flujoTrabajo.update({ where: { id }, data: { activo } });
}

export async function eliminarFlujo(id: string) {
  const usados = await db.instanciaFlujo.count({ where: { flujoId: id } });
  if (usados > 0) throw new Error("El flujo ya se aplicó a comunicaciones; desactívelo en vez de borrarlo.");
  await db.flujoTrabajo.delete({ where: { id } });
}

/* ---------------------------------------------------------------- Pasos */

export async function agregarPaso(flujoId: string, datos: { nombre: string; tipo?: TipoPasoFlujo }) {
  const nombre = datos.nombre.trim() || "Paso sin nombre";
  const ultimo = await db.pasoFlujo.findFirst({ where: { flujoId }, orderBy: { orden: "desc" } });
  // El nuevo paso entra ANTES del cierre si el último es FIN.
  if (ultimo?.tipo === "FIN") {
    await db.pasoFlujo.update({ where: { id: ultimo.id }, data: { orden: ultimo.orden + 1 } });
    return db.pasoFlujo.create({
      data: { flujoId, orden: ultimo.orden, nombre, tipo: datos.tipo ?? "TAREA", asignacion: "DEPENDENCIA_COMUNICACION" },
    });
  }
  return db.pasoFlujo.create({
    data: {
      flujoId,
      orden: (ultimo?.orden ?? 0) + 1,
      nombre,
      tipo: datos.tipo ?? "TAREA",
      asignacion: "DEPENDENCIA_COMUNICACION",
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

export async function eliminarPaso(pasoId: string) {
  const paso = await db.pasoFlujo.findUnique({ where: { id: pasoId }, include: { flujo: { include: { pasos: true } } } });
  if (!paso) return;
  if (paso.flujo.pasos.length <= 1) throw new Error("Un flujo debe tener al menos un paso.");
  // Las transiciones desde/hacia el paso caen por onDelete: Cascade.
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

/* ---------------------------------------------------------------- Transiciones */

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

/* ---------------------------------------------------------------- Plantillas precargadas */

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
            slaDiasHabiles: p.slaDiasHabiles ?? null,
            instrucciones: p.instrucciones ?? null,
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

/* ============================================================ Ejecución (instancias) */

/** Flujos activos que se le pueden aplicar a una comunicación de este tipo. */
export async function flujosAplicables(tipo: TipoComunicacion) {
  return db.flujoTrabajo.findMany({
    where: { activo: true, OR: [{ aplicaA: null }, { aplicaA: tipo }] },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, descripcion: true },
  });
}

export async function obtenerInstanciasDeComunicacion(comunicacionId: string) {
  const [comunicacion, instancias] = await Promise.all([
    db.comunicacion.findUnique({
      where: { id: comunicacionId },
      select: {
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
                transiciones: { select: { desdePasoId: true, haciaPasoId: true, etiqueta: true } },
              },
            },
          },
        },
        iniciadoPor: { select: { nombre: true } },
        pasoActual: {
          include: { transiciones: { orderBy: { orden: "asc" } }, dependencia: { select: { nombre: true } } },
        },
        ejecuciones: {
          orderBy: { completadoEn: "asc" },
          include: { paso: { select: { id: true, nombre: true, tipo: true } }, responsable: { select: { nombre: true } } },
        },
      },
    }),
  ]);
  return { comunicacion, instancias };
}

export async function iniciarInstancia(comunicacionId: string, flujoId: string, usuarioId: string, ip?: string | null) {
  const [comunicacion, flujo] = await Promise.all([
    db.comunicacion.findUnique({ where: { id: comunicacionId }, select: { id: true, radicado: true, tipo: true, estado: true } }),
    db.flujoTrabajo.findUnique({ where: { id: flujoId }, include: { pasos: { orderBy: { orden: "asc" }, take: 1 } } }),
  ]);
  if (!comunicacion) throw new Error("La comunicación no existe.");
  if (comunicacion.estado === "ANULADA") throw new Error("No se puede iniciar un flujo sobre una comunicación anulada.");
  if (!flujo || !flujo.activo) throw new Error("El flujo no está activo.");
  if (flujo.aplicaA && flujo.aplicaA !== comunicacion.tipo) throw new Error("El flujo no aplica a este tipo de comunicación.");
  const yaEnCurso = await db.instanciaFlujo.findFirst({ where: { comunicacionId, estado: "EN_CURSO" } });
  if (yaEnCurso) throw new Error("Esta comunicación ya tiene un flujo en curso.");
  const pasoInicial = flujo.pasos[0];
  if (!pasoInicial) throw new Error("El flujo no tiene pasos.");

  const instancia = await db.instanciaFlujo.create({
    data: {
      flujoId,
      comunicacionId,
      iniciadoPorId: usuarioId,
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
  return instancia;
}

export async function avanzarInstancia(
  instanciaId: string,
  transicionId: string,
  usuarioId: string,
  comentario: string | null,
  ip?: string | null,
) {
  const instancia = await db.instanciaFlujo.findUnique({
    where: { id: instanciaId },
    include: {
      flujo: { select: { nombre: true } },
      comunicacion: { select: { id: true, radicado: true } },
      pasoActual: { include: { transiciones: true } },
    },
  });
  if (!instancia) throw new Error("La instancia de flujo no existe.");
  if (instancia.estado !== "EN_CURSO") throw new Error("El flujo ya no está en curso.");
  const pasoActual = instancia.pasoActual;
  if (!pasoActual) throw new Error("El flujo no tiene un paso actual.");
  const transicion = pasoActual.transiciones.find((t) => t.id === transicionId);
  if (!transicion) throw new Error("Esa opción no corresponde al paso actual.");
  const destino = await db.pasoFlujo.findUnique({ where: { id: transicion.haciaPasoId } });
  if (!destino) throw new Error("El paso destino no existe.");

  const cierra = destino.tipo === "FIN";
  await db.$transaction([
    db.pasoEjecutado.create({
      data: {
        instanciaId,
        pasoId: pasoActual.id,
        resultado: transicion.etiqueta,
        comentario: comentario?.trim() || null,
        responsableId: usuarioId,
      },
    }),
    db.instanciaFlujo.update({
      where: { id: instanciaId },
      data: {
        pasoActualId: destino.id,
        pasoActualDesde: new Date(),
        estado: cierra ? "COMPLETADO" : "EN_CURSO",
        finalizadoEn: cierra ? new Date() : null,
      },
    }),
  ]);
  await registrarAuditoriaDoc({
    entidad: "Comunicacion",
    entidadId: instancia.comunicacion.id,
    accion: "FLUJO",
    usuarioId,
    ip,
    detalle: `Flujo «${instancia.flujo.nombre}» en ${instancia.comunicacion.radicado}: «${pasoActual.nombre}» → «${transicion.etiqueta}» → «${destino.nombre}»${cierra ? " (flujo completado)" : ""}`,
  });
}

export async function cancelarInstancia(instanciaId: string, usuarioId: string, motivo: string, ip?: string | null) {
  if (!motivo.trim()) throw new Error("Indique el motivo para cancelar el flujo.");
  const instancia = await db.instanciaFlujo.findUnique({
    where: { id: instanciaId },
    include: { flujo: { select: { nombre: true } }, comunicacion: { select: { id: true, radicado: true } } },
  });
  if (!instancia) throw new Error("La instancia de flujo no existe.");
  if (instancia.estado !== "EN_CURSO") throw new Error("El flujo ya no está en curso.");
  await db.instanciaFlujo.update({
    where: { id: instanciaId },
    data: { estado: "CANCELADO", finalizadoEn: new Date(), pasoActualId: null },
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

/* ---------------------------------------------------------------- Término del paso */

/** Fecha límite sugerida para el paso actual (según su `slaDiasHabiles` y el calendario). */
export function limitePaso(desde: Date | null, slaDiasHabiles: number | null, cal: CalendarioLaboral): Date | null {
  if (!desde || !slaDiasHabiles || slaDiasHabiles <= 0) return null;
  return sumarDiasHabiles(desde, slaDiasHabiles, cal);
}

/** Estado del término del paso actual — null si el paso no tiene `slaDiasHabiles`. */
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

/** Texto legible de a quién le corresponde un paso (para el detalle de la instancia). */
export function describirResponsablePaso(
  paso: { asignacion: AsignacionPaso; dependencia?: { nombre: string } | null; cargoClave?: string | null },
  comunicacion: {
    dependenciaDestino?: { nombre: string } | null;
    dependenciaOrigen?: { nombre: string } | null;
    radicadoPor?: { nombre: string } | null;
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
      return "Se asigna a mano";
  }
}

/** Cuántos flujos en curso tienen el término de su paso actual vencido. */
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

/* ---------------------------------------------------------------- Permisos */

/** Quién puede administrar definiciones de flujo: el mismo nivel que la TRD (MoReq 7.16). */
export function puedeAdministrarFlujos(permisos: PermisosUsuario) {
  return puedeAdministrarArchivo(permisos);
}

/** Quién puede iniciar/avanzar un flujo sobre una comunicación. */
export function puedeOperarFlujos(permisos: PermisosUsuario) {
  return puedeAdministrarArchivo(permisos) || puedeDistribuir(permisos);
}
