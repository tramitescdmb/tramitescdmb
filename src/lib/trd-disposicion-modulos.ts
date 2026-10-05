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

const SELECT_RETENCION = { nombre: true, retencionGestionAnios: true, retencionCentralAnios: true } as const;

export async function tramitesEnDisposicion(): Promise<{ clasificados: ExpedienteEnDisposicion[]; sinClasificar: number }> {
  const expedientes = await db.expediente.findMany({
    where: { OR: [{ archivadoEn: { not: null } }, { fechaCierre: { not: null } }] },
    select: {
      id: true,
      numero: true,
      fechaCierre: true,
      archivadoEn: true,
      subserie: { select: SELECT_RETENCION },
      tramiteTipo: { select: { subserie: { select: SELECT_RETENCION } } },
    },
  });
  const ahora = new Date();
  const clasificados: ExpedienteEnDisposicion[] = [];
  let sinClasificar = 0;
  for (const e of expedientes) {
    const subserie = e.subserie ?? e.tramiteTipo.subserie;
    const fechaBase = e.archivadoEn ?? e.fechaCierre;
    if (!subserie || !fechaBase) {
      sinClasificar++;
      continue;
    }
    const { fase, fechaFinGestion, fechaFinCentral } = calcularFaseArchivistica(
      fechaBase,
      subserie.retencionGestionAnios,
      subserie.retencionCentralAnios,
      ahora
    );
    clasificados.push({ id: e.id, numero: e.numero, fechaCierre: fechaBase, fase, fechaFinGestion, fechaFinCentral, subserie: subserie.nombre });
  }
  return { clasificados, sinClasificar };
}

export async function contratosEnDisposicion(): Promise<{ clasificados: ExpedienteEnDisposicion[]; sinClasificar: number }> {
  const config = await db.configuracionSitio.findUnique({
    where: { id: "singleton" },
    select: { subserieContratacion: { select: SELECT_RETENCION } },
  });
  const subserie = config?.subserieContratacion;

  const contratos = await db.expedienteContractual.findMany({
    where: { fechaCierre: { not: null }, eliminado: false },
    select: {
      id: true,
      numero: true,
      fechaCierre: true,
      subserie: { select: SELECT_RETENCION },
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
