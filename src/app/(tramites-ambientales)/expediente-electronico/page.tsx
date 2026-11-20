import { ListadoExpedientes, type ParametrosListado } from "../expedientes/listado";

/** Menú «Expediente electrónico»: expedientes de trámites ambientales finalizados, cerrados y archivados. */
export default async function ExpedienteElectronicoPage({ searchParams }: { searchParams: Promise<ParametrosListado> }) {
  return <ListadoExpedientes sp={await searchParams} soloArchivados />;
}
