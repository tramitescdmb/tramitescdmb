import { redirect } from "next/navigation";
import { datosRespuestaRecibida } from "@/lib/correspondencia-respuesta";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRadicar } from "@/lib/permisos";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { listarSeriesVigentes } from "@/lib/trd";
import { subserieBuscable } from "@/lib/trd-presentacion";
import { listarPlantillas } from "@/lib/plantillas";
import { MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION } from "@/lib/municipios";
import { RadicarEnviadaForm } from "@/components/RadicarEnviadaForm";

export default async function NuevaEnviadaPage({ searchParams }: { searchParams: Promise<{ respondeAId?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeRadicar(permisos)) redirect("/correspondencia");

  const { respondeAId } = await searchParams;
  const [dependencias, series, inicial, plantillas] = await Promise.all([
    listarDependenciasActivas(),
    listarSeriesVigentes(),
    respondeAId ? datosRespuestaRecibida(respondeAId) : null,
    listarPlantillas("ENVIADA"),
  ]);
  const municipios = [...MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Radicar correspondencia enviada</h2>
        <p className="text-sm text-stone-500">
          Oficio de salida. Se radica y se firma electrónicamente (hash SHA-256) en el mismo paso — el contenido queda
          protegido: cualquier cambio posterior invalidaría la firma.
        </p>
      </div>
      <RadicarEnviadaForm
        dependencias={dependencias.map((d) => ({ id: d.id, nombre: d.nombre }))}
        series={series.map((s) => ({
          id: s.id,
          codigo: s.codigo,
          nombre: s.nombre,
          dependenciaId: s.dependenciaId,
          dependenciaNombre: s.dependencia?.nombre ?? null,
          subseries: s.subseries.map(subserieBuscable),
        }))}
        municipios={municipios}
        inicial={inicial ?? undefined}
        plantillas={plantillas}
        usuarioNombre={session.nombre}
      />
    </div>
  );
}
