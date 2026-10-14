import { redirect } from "next/navigation";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRadicar } from "@/lib/permisos";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { listarSeriesVigentes } from "@/lib/trd";
import { subserieBuscable } from "@/lib/trd-presentacion";
import { VentanillaRadicacionForm } from "@/components/VentanillaRadicacionForm";
import { Inbox } from "lucide-react";
import { CabeceraTablero } from "@/components/tablero";

export default async function NuevaRadicacionPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeRadicar(permisos)) redirect("/correspondencia");

  const [dependencias, series] = await Promise.all([listarDependenciasActivas(), listarSeriesVigentes()]);

  return (
    <div className="space-y-4">
      <CabeceraTablero icon={Inbox} titulo="Radicar correspondencia recibida" descripcion="Ventanilla única (Acuerdo 060/2001 AGN). Al radicar se asigna el consecutivo del año y queda registrado en la bitácora." />
      <VentanillaRadicacionForm
        dependencias={dependencias.map((d) => ({ id: d.id, nombre: d.nombre }))}
        series={series.map((s) => ({
          id: s.id,
          codigo: s.codigo,
          nombre: s.nombre,
          dependenciaId: s.dependenciaId,
          dependenciaNombre: s.dependencia?.nombre ?? null,
          subseries: s.subseries.map(subserieBuscable),
        }))}
      />
    </div>
  );
}
