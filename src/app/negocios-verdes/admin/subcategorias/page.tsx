import { TaxonomiaNV } from "@/components/negocios-verdes/admin/TaxonomiaNV";
import { taxonomiaAdminNV } from "@/lib/negocios-verdes-taxonomia-admin";

export const dynamic = "force-dynamic";

export default async function SubcategoriasNegociosVerdes() {
  const { nodos, padres } = await taxonomiaAdminNV("subcategoria");
  return <TaxonomiaNV nivel="subcategoria" nodos={nodos} padres={padres} />;
}
