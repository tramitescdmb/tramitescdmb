// Reporte de "próximos a transferencia o disposición final" para Trámites 2.0 y GECON — ítem TRD
// del prompt SEYCA. Reusa calcularFaseArchivistica() de disposicion-final.ts (ya construido para el
// SGDEA), solo con la fecha de CIERRE del expediente como referencia en vez de la de radicación: acá
// el expediente sigue activo (creciendo) hasta que se cierra, así que la retención no debería contarse
// antes de eso.
import { db } from "@/lib/db";
import { calcularFaseArchivistica, type FaseArchivistica } from "@/lib/disposicion-final";

export type ExpedienteEnDisposicion = {
  id: string;
  numero: string;
  fechaCierre: Date;
  fase: FaseArchivistica;
  fechaFinGestion: Date;
  fechaFinCentral: Date;
  subserie: string;
};

export async function tramitesEnDisposicion(): Promise<{ clasificados: ExpedienteEnDisposicion[]; sinClasificar: number }> {
  const expedientes = await db.expediente.findMany({
    where: { fechaCierre: { not: null } },
    select: {
      id: true,
      numero: true,
      fechaCierre: true,
      tramiteTipo: { select: { nombre: true, subserie: { select: { nombre: true, retencionGestionAnios: true, retencionCentralAnios: true } } } },
    },
  });
  const ahora = new Date();
  const clasificados: ExpedienteEnDisposicion[] = [];
  let sinClasificar = 0;
  for (const e of expedientes) {
    const subserie = e.tramiteTipo.subserie;
    if (!subserie || !e.fechaCierre) {
      sinClasificar++;
      continue;
    }
    const { fase, fechaFinGestion, fechaFinCentral } = calcularFaseArchivistica(
      e.fechaCierre,
      subserie.retencionGestionAnios,
      subserie.retencionCentralAnios,
      ahora
    );
    clasificados.push({ id: e.id, numero: e.numero, fechaCierre: e.fechaCierre, fase, fechaFinGestion, fechaFinCentral, subserie: subserie.nombre });
  }
  return { clasificados, sinClasificar };
}

export async function contratosEnDisposicion(): Promise<{ clasificados: ExpedienteEnDisposicion[]; sinClasificar: number }> {
  const config = await db.configuracionSitio.findUnique({
    where: { id: "singleton" },
    select: { subserieContratacion: { select: { nombre: true, retencionGestionAnios: true, retencionCentralAnios: true } } },
  });
  const subserie = config?.subserieContratacion;

  const contratos = await db.expedienteContractual.findMany({
    where: { fechaCierre: { not: null }, eliminado: false },
    select: {
      id: true,
      numero: true,
      fechaCierre: true,
      subserie: { select: { nombre: true, retencionGestionAnios: true, retencionCentralAnios: true } },
    },
  });
  const ahora = new Date();
  const clasificados: ExpedienteEnDisposicion[] = [];
  let sinClasificar = 0;
  for (const c of contratos) {
    const s = c.subserie ?? subserie;
    if (!s || !c.fechaCierre) {
      sinClasificar++;
      continue;
    }
    const { fase, fechaFinGestion, fechaFinCentral } = calcularFaseArchivistica(c.fechaCierre, s.retencionGestionAnios, s.retencionCentralAnios, ahora);
    clasificados.push({ id: c.id, numero: c.numero, fechaCierre: c.fechaCierre, fase, fechaFinGestion, fechaFinCentral, subserie: s.nombre });
  }
  return { clasificados, sinClasificar };
}
