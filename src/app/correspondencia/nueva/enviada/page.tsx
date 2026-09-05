import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRadicar } from "@/lib/permisos";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { listarSeriesVigentes } from "@/lib/trd";
import { MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION } from "@/lib/municipios";
import { RadicarEnviadaForm } from "@/components/RadicarEnviadaForm";

export default async function NuevaEnviadaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeRadicar(permisos)) redirect("/correspondencia");

  const [dependencias, series, recibidasPendientes] = await Promise.all([
    listarDependenciasActivas(),
    listarSeriesVigentes(),
    db.comunicacion.findMany({
      where: { tipo: "RECIBIDA", estado: { notIn: ["RESPONDIDA", "ARCHIVADA", "ANULADA"] } },
      orderBy: { fechaRadicacion: "desc" },
      take: 100,
      select: { id: true, radicado: true, asunto: true, terceroNombre: true },
    }),
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
          subseries: s.subseries.map((ss) => ({ id: ss.id, codigo: ss.codigo, nombre: ss.nombre })),
        }))}
        municipios={municipios}
        recibidasPendientes={recibidasPendientes}
      />
    </div>
  );
}
