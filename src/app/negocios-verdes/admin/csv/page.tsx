import { verificarSesion, obtenerPermisosUsuario } from "@/lib/permisos";
import { puedeGestionarNV } from "@/lib/negocios-verdes-permisos";
import { ImportarCsvNV } from "@/components/negocios-verdes/ImportarCsvNV";

export const dynamic = "force-dynamic";

export default async function CsvNegociosVerdes() {
  const session = await verificarSesion();
  const permisos = session ? await obtenerPermisosUsuario(session.userId) : null;
  return <ImportarCsvNV puedeImportar={Boolean(permisos && puedeGestionarNV(permisos, "CREAR") && puedeGestionarNV(permisos, "ACTUALIZAR"))} />;
}
