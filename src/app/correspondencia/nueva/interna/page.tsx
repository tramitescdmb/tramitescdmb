import { redirect } from "next/navigation";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario } from "@/lib/permisos";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { listarSeriesVigentes } from "@/lib/trd";
import { subserieBuscable } from "@/lib/trd-presentacion";
import { listarPlantillas } from "@/lib/plantillas";
import { db } from "@/lib/db";
import { MemorandoForm, type RespuestaA } from "@/components/MemorandoForm";
import Link from "next/link";
import { contextoMemorandos, eligeOrigenLibre, memorandoPendienteDe } from "@/lib/memorandos";
import { FileEdit, Reply } from "lucide-react";
import { CabeceraTablero } from "@/components/tablero";

export default async function NuevaInternaPage({ searchParams }: { searchParams: Promise<{ respondeAId?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { respondeAId } = await searchParams;
  const permisos = await obtenerPermisosUsuario(session.userId);
  const ctx = await contextoMemorandos(session.userId, permisos);

  const original = respondeAId && ctx.firmante ? await memorandoPendienteDe(respondeAId, ctx) : null;
  if (respondeAId && !original) redirect(`/correspondencia/${respondeAId}?error=${encodeURIComponent("Este memorando ya fue respondido, no está dirigido a su oficina o su cargo no firma memorandos.")}`);
  if (!ctx.firmante) {
    return (
      <div className="mx-auto max-w-lg rounded-md border border-stone-200 bg-white p-6 text-center">
        <h1 className="text-base font-semibold text-stone-900">Nuevo memorando</h1>
        <p className="mt-2 text-sm text-stone-600">
          Los memorandos los envían la Dirección General, la Secretaría General, las subdirecciones, las jefaturas de oficina, la asesoría de
          dirección y la revisoría fiscal, según la denominación del empleo registrada para la firma.
        </p>
        <Link href="/correspondencia/memorandos" className="mt-4 inline-flex rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
          Ir a memorandos
        </Link>
      </div>
    );
  }

  const [dependencias, series, plantillas, usuarios] = await Promise.all([
    listarDependenciasActivas(),
    listarSeriesVigentes(),
    listarPlantillas("INTERNA"),
    db.usuario.findMany({
      where: { activo: true, OR: [{ rol: "ADMIN" }, { rolCorrespondencia: { not: null } }] },
      select: { id: true, nombre: true, dependenciaId: true, rolCorrespondencia: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const respondeA: RespuestaA | null =
    original && original.dependenciaOrigenId
      ? {
          id: original.id,
          radicado: original.radicado,
          asunto: original.asunto,
          contenido: original.respuestaTexto,
          dependenciaDestinoId: original.dependenciaOrigenId,
          usuarioDestinoId:
            usuarios.find((u) => u.id === original.radicadoPorId && u.dependenciaId === original.dependenciaOrigenId)?.id ??
            usuarios.find((u) => u.dependenciaId === original.dependenciaOrigenId && u.rolCorrespondencia === "JEFE_DEPENDENCIA")?.id ??
            null,
        }
      : null;

  return (
    <div className="space-y-4">
      <CabeceraTablero
        icon={original ? Reply : FileEdit}
        titulo={original ? `Responder memorando ${original.radicado}` : "Nuevo memorando interno"}
        descripcion="Comunicación entre dependencias. Se radica y se firma electrónicamente (SHA-256) en el mismo paso."
      />
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
        dependenciaOrigenSugerida={ctx.dependenciaId}
        origenFijo={!eligeOrigenLibre(permisos)}
        respondeA={respondeA}
        plantillas={plantillas}
        usuarioNombre={session.nombre}
      />
    </div>
  );
}
