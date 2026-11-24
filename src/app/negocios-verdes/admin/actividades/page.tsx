import { TaxonomiaNV } from "@/components/negocios-verdes/admin/TaxonomiaNV";
import { taxonomiaAdminNV } from "@/lib/negocios-verdes-taxonomia-admin";

export const dynamic = "force-dynamic";

export default async function ActividadesNegociosVerdes() {
  const { nodos, padres } = await taxonomiaAdminNV("actividad");
  return <TaxonomiaNV nivel="actividad" nodos={nodos} padres={padres} />;
}
