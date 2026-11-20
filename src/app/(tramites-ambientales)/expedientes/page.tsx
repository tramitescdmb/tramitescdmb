import { ListadoExpedientes, type ParametrosListado } from "./listado";

export default async function ExpedientesPage({ searchParams }: { searchParams: Promise<ParametrosListado> }) {
  return <ListadoExpedientes sp={await searchParams} />;
}
