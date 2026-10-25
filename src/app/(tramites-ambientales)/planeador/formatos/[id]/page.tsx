import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verificarSesion as getSession, obtenerPermisosUsuario, puedeEditarFormatosVisita } from "@/lib/permisos";
import { BandaTablero } from "@/components/tablero";
import { EditorFormato } from "@/components/formatos/EditorFormato";
import { estructuraDesdeJson, tramitesEnUso } from "@/lib/formatos-visita-db";

export default async function EditarFormatoVisitaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeEditarFormatosVisita(permisos)) notFound();

  const [formato, tipos, otros] = await Promise.all([
    db.formatoVisita.findUnique({
      where: { id },
      include: {
        versiones: {
          orderBy: { numero: "desc" },
          include: { creadoPor: { select: { nombre: true } }, publicadaPor: { select: { nombre: true } }, _count: { select: { visitas: true } } },
        },
      },
    }),
    db.tramiteTipo.findMany({ where: { activo: true }, select: { codigo: true, nombre: true }, orderBy: { codigo: "asc" } }),
    db.formatoVisita.findMany({ select: { id: true, nombre: true, tramites: true, activo: true } }),
  ]);
  if (!formato) notFound();

  const borrador = formato.versiones.find((v) => v.estado === "BORRADOR");
  const publicada = formato.versiones.find((v) => v.estado === "PUBLICADA");
  const base = borrador ?? publicada ?? formato.versiones[0];
  const enUso = tramitesEnUso(otros, formato.id);
  const nombreFormato = new Map(otros.map((o) => [o.id, o.nombre]));

  return (
    <div className="space-y-4">
      <BandaTablero>
        <Link href="/planeador/formatos" className="text-xs font-medium uppercase tracking-wide text-cdmb-700 hover:underline">
          ← Formatos de visita
        </Link>
        <h2 className="mt-1 text-xl font-semibold text-stone-900">{formato.nombre}</h2>
        <p className="font-mono text-xs text-stone-500">{formato.codigo}</p>
      </BandaTablero>
      <EditorFormato
        formato={{
          id: formato.id,
          codigo: formato.codigo,
          nombre: formato.nombre,
          titulo: formato.titulo,
          versionDocumento: formato.versionDocumento,
          fechaDocumento: formato.fechaDocumento ?? "",
          tramites: formato.tramites,
          activo: formato.activo,
        }}
        estructuraInicial={estructuraDesdeJson(base?.estructura)}
        hayBorrador={!!borrador}
        hayPublicada={!!publicada}
        numeroEnEdicion={borrador?.numero ?? (publicada ? publicada.numero + 1 : 1)}
        versiones={formato.versiones.map((v) => ({
          id: v.id,
          numero: v.numero,
          estado: v.estado,
          nota: v.nota,
          autor: v.publicadaPor?.nombre ?? v.creadoPor.nombre,
          fecha: (v.publicadaEn ?? v.updatedAt).toISOString(),
          visitas: v._count.visitas,
        }))}
        tipos={tipos.map((t) => ({ ...t, ocupadoPor: enUso.has(t.codigo) ? (nombreFormato.get(enUso.get(t.codigo)!) ?? "otro formato") : null }))}
      />
    </div>
  );
}
