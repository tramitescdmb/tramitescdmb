import { redirect } from "next/navigation";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRadicar } from "@/lib/permisos";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { listarSeriesVigentes } from "@/lib/trd";
import { MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION } from "@/lib/municipios";
import { VentanillaRadicacionForm } from "@/components/VentanillaRadicacionForm";

export default async function NuevaRadicacionPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeRadicar(permisos)) redirect("/correspondencia");

  const [dependencias, series] = await Promise.all([listarDependenciasActivas(), listarSeriesVigentes()]);
  const municipios = [...MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Radicar correspondencia recibida</h2>
        <p className="text-sm text-stone-500">
          Ventanilla única (Acuerdo 060/2001 AGN). Capture los datos del remitente y de la comunicación; al radicar se
          asigna el consecutivo del año y se registra en la bitácora inalterable.
        </p>
      </div>
      <VentanillaRadicacionForm
        dependencias={dependencias.map((d) => ({ id: d.id, nombre: d.nombre }))}
        series={series.map((s) => ({
          id: s.id,
          codigo: s.codigo,
          nombre: s.nombre,
          subseries: s.subseries.map((ss) => ({ id: ss.id, codigo: ss.codigo, nombre: ss.nombre })),
        }))}
        municipios={municipios}
      />
    </div>
  );
}
