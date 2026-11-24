import { redirect } from "next/navigation";

/** La antigua página única de clasificación quedó dividida en Categorías, Subcategorías y Actividades productivas. */
export default function ClasificacionNegociosVerdes() {
  redirect("/negocios-verdes/admin/categorias");
}
