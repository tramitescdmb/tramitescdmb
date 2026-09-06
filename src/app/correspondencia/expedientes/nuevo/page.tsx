import { redirect } from "next/navigation";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeAccederCorrespondencia } from "@/lib/permisos";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { listarSeriesVigentes } from "@/lib/trd";
import { NuevoExpedienteDocumentalForm } from "@/components/NuevoExpedienteDocumentalForm";

export default async function NuevoExpedientePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeAccederCorrespondencia(permisos)) redirect("/correspondencia");
  const sp = await searchParams;

  const [todasDependencias, series] = await Promise.all([listarDependenciasActivas(), listarSeriesVigentes()]);

  // Un funcionario sin rol de administrador de archivo solo puede abrir
  // expedientes para SU PROPIA dependencia (ver puedeGestionarExpedienteDeDependencia).
  const puedeCualquiera = permisos.esAdmin || permisos.correspondencia === "ADMIN_ARCHIVO";
  const dependenciasDisponibles = puedeCualquiera
    ? todasDependencias
    : todasDependencias.filter((d) => d.id === permisos.dependenciaId);

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Abrir un expediente documental</h2>
        <p className="text-sm text-stone-500">
          Para archivar documentos de su gestión diaria que no llegan por correspondencia (contratos, actas internas,
          historias laborales, etc.), conforme al Art. 4.3.2 del Acuerdo 001/2024 AGN.
        </p>
      </div>

      {sp.error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{sp.error}</div>}

      {dependenciasDisponibles.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Su cuenta no tiene una dependencia asignada, así que no puede abrir un expediente todavía. Pídale a un
          administrador que se la asigne desde Usuarios.
        </p>
      ) : (
        <NuevoExpedienteDocumentalForm
          dependencias={dependenciasDisponibles.map((d) => ({ id: d.id, nombre: d.nombre }))}
          series={series.map((s) => ({
            id: s.id,
            codigo: s.codigo,
            nombre: s.nombre,
            dependenciaId: s.dependenciaId,
            subseries: s.subseries.map((ss) => ({ id: ss.id, codigo: ss.codigo, nombre: ss.nombre })),
          }))}
        />
      )}
    </div>
  );
}
