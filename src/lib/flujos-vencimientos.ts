import { db } from "@/lib/db";
import { registrarAuditoriaDoc } from "@/lib/auditoria-doc";
import { getCalendarioLaboral } from "@/lib/calendario-laboral";
import { cancelarFlujosDeObjetosCerrados, estadoTerminoPaso, objetivoDeInstancia, sincronizarFlujoPorFirmas, SELECT_OBJETIVO_FLUJO } from "@/lib/flujos";

export type ResultadoVencimientos = { revisadas: number; vencidas: number; avisadas: number; avanzadas: number; cerradas: number };

export function salidaDeVencimiento<T extends { etiqueta: string }>(transiciones: T[], salida: string | null): T | null {
  if (!salida) return null;
  const buscada = salida.trim().toLowerCase();
  return transiciones.find((t) => t.etiqueta.trim().toLowerCase() === buscada) ?? null;
}

export async function procesarVencimientosFlujos(actorId: string | null = null): Promise<ResultadoVencimientos> {
  const cerradas = await cancelarFlujosDeObjetosCerrados(actorId);
  const calendario = await getCalendarioLaboral();
  const instancias = await db.instanciaFlujo.findMany({
    where: {
      estado: "EN_CURSO",
      pasoActualDesde: { not: null },
      pasoActual: { slaDiasHabiles: { not: null }, alVencer: { not: "NINGUNA" }, tipo: { not: "FIN" } },
    },
    take: 1000,
    select: {
      id: true,
      iniciadoPorId: true,
      pasoActualDesde: true,
      vencimientoAvisadoEn: true,
      flujo: { select: { nombre: true } },
      pasoActual: {
        select: {
          id: true,
          nombre: true,
          tipo: true,
          slaDiasHabiles: true,
          alVencer: true,
          salidaVencimiento: true,
          transiciones: { orderBy: { orden: "asc" }, select: { etiqueta: true, hacia: { select: { id: true, nombre: true, tipo: true, asignacion: true } } } },
        },
      },
      ...SELECT_OBJETIVO_FLUJO,
    },
  });

  const r: ResultadoVencimientos = { revisadas: instancias.length, vencidas: 0, avisadas: 0, avanzadas: 0, cerradas };
  const ahora = new Date();
  for (const i of instancias) {
    try {
      const paso = i.pasoActual;
      if (!paso) continue;
      const termino = estadoTerminoPaso(i.pasoActualDesde, paso.slaDiasHabiles, calendario, ahora);
      if (!termino?.vencido) continue;
      const objetivo = objetivoDeInstancia(i);
      if (!objetivo.abierto) continue;
      r.vencidas++;
      const firmaEnCurso = paso.tipo === "FIRMA" && objetivo.esComunicacion;
      const salida = paso.alVencer === "AVANZAR" && !firmaEnCurso ? salidaDeVencimiento(paso.transiciones, paso.salidaVencimiento) : null;

      if (salida) {
        const destino = salida.hacia;
        const cierra = destino.tipo === "FIN";
        const movido = await db.instanciaFlujo.updateMany({
          where: { id: i.id, estado: "EN_CURSO", pasoActualId: paso.id },
          data: {
            pasoActualId: destino.id,
            pasoActualDesde: ahora,
            asignadoAId: destino.asignacion === "MANUAL" && !cierra ? i.iniciadoPorId : null,
            estado: cierra ? "COMPLETADO" : "EN_CURSO",
            finalizadoEn: cierra ? ahora : null,
            vencimientoAvisadoEn: null,
          },
        });
        if (movido.count === 0) continue;
        const comentario = `Avance automático: venció el término de ${paso.slaDiasHabiles} día(s) hábil(es) el ${termino.limite.toISOString().slice(0, 10)}.`;
        await db.pasoEjecutado.create({ data: { instanciaId: i.id, pasoId: paso.id, resultado: salida.etiqueta, comentario, responsableId: actorId } });
        await registrarAuditoriaDoc({
          entidad: objetivo.entidad,
          entidadId: objetivo.id,
          accion: "FLUJO",
          usuarioId: actorId,
          detalle: `Flujo «${i.flujo.nombre}» en ${objetivo.etiqueta}: «${paso.nombre}» → «${salida.etiqueta}» → «${destino.nombre}» (${comentario})`,
        });
        if (!cierra && objetivo.esComunicacion) await sincronizarFlujoPorFirmas(objetivo.id, actorId);
        r.avanzadas++;
        continue;
      }

      const yaAvisado = i.vencimientoAvisadoEn && i.pasoActualDesde && i.vencimientoAvisadoEn >= i.pasoActualDesde;
      if (yaAvisado) continue;
      await db.instanciaFlujo.update({ where: { id: i.id }, data: { vencimientoAvisadoEn: ahora } });
      await registrarAuditoriaDoc({
        entidad: objetivo.entidad,
        entidadId: objetivo.id,
        accion: "FLUJO",
        usuarioId: actorId,
        detalle: `Flujo «${i.flujo.nombre}» en ${objetivo.etiqueta}: el paso «${paso.nombre}» venció el ${termino.limite.toISOString().slice(0, 10)} (${paso.slaDiasHabiles} día(s) hábil(es)); queda marcado como vencido para su responsable.`,
      });
      r.avisadas++;
    } catch (err) {
      console.error(`Vencimientos de flujos: falló la instancia ${i.id}:`, err);
    }
  }
  return r;
}
