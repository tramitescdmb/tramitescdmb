import { redirect } from "next/navigation";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia, puedeGestionarArchivo } from "@/lib/permisos";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { listarSeriesVigentes } from "@/lib/trd";
import { subserieBuscable } from "@/lib/trd-presentacion";
import { listarPlantillas } from "@/lib/plantillas";
import { NuevoExpedienteDocumentalForm } from "@/components/NuevoExpedienteDocumentalForm";
import { FolderPlus } from "lucide-react";
import { CabeceraTablero } from "@/components/tablero";

export default async function NuevoExpedientePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/correspondencia");
  const sp = await searchParams;

  const [todasDependencias, series, plantillas] = await Promise.all([
    listarDependenciasActivas(),
    listarSeriesVigentes(),
    listarPlantillas("EXPEDIENTE"),
  ]);

  const puedeCualquiera = permisos.esAdmin || puedeGestionarArchivo(permisos);
  const dependenciasDisponibles = puedeCualquiera
    ? todasDependencias
    : todasDependencias.filter((d) => d.id === permisos.dependenciaId);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <CabeceraTablero icon={FolderPlus} titulo="Abrir un expediente documental" descripcion="Para documentos de la gestión diaria que no llegan por correspondencia (Art. 4.3.2 del Acuerdo 001/2024 AGN)." />

      {sp.error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      {dependenciasDisponibles.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Su cuenta no tiene una dependencia asignada, así que no puede abrir un expediente todavía.
        </p>
      ) : (
        <NuevoExpedienteDocumentalForm
          dependencias={dependenciasDisponibles.map((d) => ({ id: d.id, nombre: d.nombre }))}
          series={series.map((s) => ({
            id: s.id,
            codigo: s.codigo,
            nombre: s.nombre,
            dependenciaId: s.dependenciaId,
            dependenciaNombre: s.dependencia?.nombre ?? null,
            subseries: s.subseries.map(subserieBuscable),
          }))}
          plantillas={plantillas}
          usuarioNombre={session.nombre}
        />
      )}
    </div>
  );
}
