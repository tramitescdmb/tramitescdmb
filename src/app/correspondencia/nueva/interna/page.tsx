import { redirect } from "next/navigation";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRadicar } from "@/lib/permisos";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { listarSeriesVigentes } from "@/lib/trd";
import { subserieBuscable } from "@/lib/trd-presentacion";
import { listarPlantillas } from "@/lib/plantillas";
import { db } from "@/lib/db";
import { MemorandoForm } from "@/components/MemorandoForm";
import { FileEdit } from "lucide-react";
import { CabeceraTablero } from "@/components/tablero";

export default async function NuevaInternaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeRadicar(permisos)) redirect("/correspondencia");

  const [dependencias, series, usuario, plantillas, usuarios] = await Promise.all([
    listarDependenciasActivas(),
    listarSeriesVigentes(),
    db.usuario.findUnique({ where: { id: session.userId }, select: { dependenciaId: true } }),
    listarPlantillas("INTERNA"),
    db.usuario.findMany({
      where: { activo: true, OR: [{ rol: "ADMIN" }, { rolCorrespondencia: { not: null } }] },
      select: { id: true, nombre: true, dependenciaId: true, rolCorrespondencia: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <CabeceraTablero icon={FileEdit} titulo="Nuevo memorando interno" descripcion="Comunicación entre dependencias. Se radica y se firma electrónicamente (SHA-256) en el mismo paso." />
      <MemorandoForm
        dependencias={dependencias.map((d) => ({ id: d.id, nombre: d.nombre }))}
        usuarios={usuarios}
        series={series.map((s) => ({
          id: s.id,
          codigo: s.codigo,
          nombre: s.nombre,
          dependenciaId: s.dependenciaId,
          dependenciaNombre: s.dependencia?.nombre ?? null,
          subseries: s.subseries.map(subserieBuscable),
        }))}
        dependenciaOrigenSugerida={usuario?.dependenciaId ?? null}
        plantillas={plantillas}
        usuarioNombre={session.nombre}
      />
    </div>
  );
}
