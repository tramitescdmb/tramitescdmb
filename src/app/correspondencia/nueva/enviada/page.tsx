import { redirect } from "next/navigation";
import { datosRespuestaRecibida } from "@/lib/correspondencia-respuesta";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRadicar } from "@/lib/permisos";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { listarSeriesVigentes } from "@/lib/trd";
import { subserieBuscable } from "@/lib/trd-presentacion";
import { listarPlantillas } from "@/lib/plantillas";
import { RadicarEnviadaForm } from "@/components/RadicarEnviadaForm";
import { Send } from "lucide-react";
import { CabeceraTablero } from "@/components/tablero";

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

  return (
    <div className="space-y-4">
      <CabeceraTablero icon={Send} titulo="Radicar correspondencia enviada" descripcion="Oficio de salida. Se radica y se firma electrónicamente (SHA-256) en el mismo paso; cualquier cambio posterior invalida la firma." />
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
        inicial={inicial ?? undefined}
        plantillas={plantillas}
        usuarioNombre={session.nombre}
      />
    </div>
  );
}
