import { redirect } from "next/navigation";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRadicar } from "@/lib/permisos";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { listarSeriesVigentes } from "@/lib/trd";
import { db } from "@/lib/db";
import { MemorandoForm } from "@/components/MemorandoForm";

export default async function NuevaInternaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeRadicar(permisos)) redirect("/correspondencia");

  const [dependencias, series, usuario] = await Promise.all([
    listarDependenciasActivas(),
    listarSeriesVigentes(),
    db.usuario.findUnique({ where: { id: session.userId }, select: { dependenciaId: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Nuevo memorando interno</h2>
        <p className="text-sm text-stone-500">
          Comunicación entre dependencias, con trazabilidad completa. Se radica y se firma electrónicamente (hash
          SHA-256) en el mismo paso.
        </p>
      </div>
      <MemorandoForm
        dependencias={dependencias.map((d) => ({ id: d.id, nombre: d.nombre }))}
        series={series.map((s) => ({
          id: s.id,
          codigo: s.codigo,
          nombre: s.nombre,
          subseries: s.subseries.map((ss) => ({ id: ss.id, codigo: ss.codigo, nombre: ss.nombre })),
        }))}
        dependenciaOrigenSugerida={usuario?.dependenciaId ?? null}
      />
    </div>
  );
}
