import { notFound, redirect } from "next/navigation";
import { ListChecks } from "lucide-react";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeEditarFormatosVisita } from "@/lib/permisos";
import { CabeceraTablero } from "@/components/tablero";
import { codigoProcedimiento, tipoActividadDetectado } from "@/lib/temas-visita";
import { ActividadesPasos, type TramiteActividades } from "@/components/planeador/ActividadesPasos";

export default async function ActividadesPasosPage({ searchParams }: { searchParams: Promise<{ tramite?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeEditarFormatosVisita(permisos)) notFound();
  const { tramite } = await searchParams;

  const [tipos, formatos] = await Promise.all([
    db.tramiteTipo.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: {
        codigo: true,
        nombre: true,
        flujos: {
          orderBy: { orden: "asc" },
          select: {
            id: true,
            nombre: true,
            pasos: {
              orderBy: { numero: "asc" },
              select: { id: true, numero: true, titulo: true, descripcion: true, esDecision: true, tipoActividad: true, formatoVisitaId: true },
            },
          },
        },
      },
    }),
    db.formatoVisita.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, tramites: true, porDefecto: true } }),
  ]);
  const generico = formatos.find((f) => f.porDefecto);

  const tramites: TramiteActividades[] = tipos.map((t) => {
    const codigo = codigoProcedimiento(t.codigo);
    const delTramite = formatos.find((f) => f.tramites.includes(codigo)) ?? generico;
    return {
      codigo: t.codigo,
      nombre: t.nombre,
      formatoDelTramite: delTramite?.nombre ?? null,
      flujos: t.flujos.map((f) => ({
        id: f.id,
        nombre: f.nombre,
        pasos: f.pasos.map((p) => ({
          id: p.id,
          numero: p.numero,
          titulo: p.titulo,
          tipoActividad: p.tipoActividad,
          detectado: tipoActividadDetectado(p),
          formatoVisitaId: p.formatoVisitaId,
        })),
      })),
    };
  });

  const configurados = tipos.reduce((a, t) => a + t.flujos.reduce((b, f) => b + f.pasos.filter((p) => p.tipoActividad || p.formatoVisitaId).length, 0), 0);

  return (
    <div className="space-y-4">
      <CabeceraTablero
        icon={ListChecks}
        titulo="Actividades por paso"
        contador={configurados}
        descripcion="Defina qué actividad se realiza en cada paso de los trámites y qué formato de visita aplica. Los pasos sin definir se detectan por su título."
      />
      <ActividadesPasos tramites={tramites} formatos={formatos.map((f) => ({ id: f.id, nombre: f.nombre }))} abierto={tramite ?? null} />
    </div>
  );
}
