import { redirect } from "next/navigation";
import { verificarSesion as getSession } from "@/lib/permisos";
import { AccesoRestringido } from "@/components/AccesoRestringido";
import { ClasificacionTrdGecon } from "@/components/trd/ClasificacionTrd";

export default async function ClasificacionTrdPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.rol !== "ADMIN") return <AccesoRestringido titulo="Clasificación TRD" volverHref="/contratacion/panel" volverLabel="Volver" />;
  return <ClasificacionTrdGecon />;
}
