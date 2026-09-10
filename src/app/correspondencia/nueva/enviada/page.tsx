import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verificarSesion as getSession } from "@/lib/permisos";
import { obtenerPermisosUsuario, puedeRadicar } from "@/lib/permisos";
import { listarDependenciasActivas } from "@/lib/dependencias";
import { listarSeriesVigentes } from "@/lib/trd";
import { listarPlantillas } from "@/lib/plantillas";
import { MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION } from "@/lib/municipios";
import { RadicarEnviadaForm } from "@/components/RadicarEnviadaForm";

export default async function NuevaEnviadaPage({ searchParams }: { searchParams: Promise<{ respondeAId?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const permisos = await obtenerPermisosUsuario(session.userId);
  if (!puedeRadicar(permisos)) redirect("/correspondencia");

  const { respondeAId } = await searchParams;
  const [dependencias, series, recibidaARespoder, documentosRespuesta, plantillas] = await Promise.all([
    listarDependenciasActivas(),
    listarSeriesVigentes(),
    respondeAId
      ? db.comunicacion.findUnique({
          where: { id: respondeAId },
          select: {
            id: true,
            radicado: true,
            asunto: true,
            respuestaTexto: true,
            terceroTipo: true,
            terceroTipoIdentificacion: true,
            terceroIdentificacion: true,
            terceroNombre: true,
            terceroEmail: true,
            terceroTelefono: true,
            terceroDireccion: true,
            terceroMunicipio: true,
          },
        })
      : null,
    respondeAId
      ? db.comunicacionDocumento.findMany({
          where: { comunicacionId: respondeAId, esRespuesta: true },
          select: { nombre: true },
        })
      : [],
    listarPlantillas("ENVIADA"),
  ]);
  const municipios = [...MUNICIPIOS_JURISDICCION_CDMB, FUERA_DE_JURISDICCION];
  const inicial = recibidaARespoder
    ? {
        respondeAId: recibidaARespoder.id,
        respondeALabel: `${recibidaARespoder.radicado} — ${recibidaARespoder.asunto.slice(0, 60)}${recibidaARespoder.terceroNombre ? ` (${recibidaARespoder.terceroNombre})` : ""}`,
        asunto: `Respuesta a ${recibidaARespoder.radicado} — ${recibidaARespoder.asunto}`,
        contenido: recibidaARespoder.respuestaTexto ?? "",
        destinatarioTipo: recibidaARespoder.terceroTipo ?? undefined,
        destinatarioTipoIdentificacion: recibidaARespoder.terceroTipoIdentificacion ?? undefined,
        destinatarioIdentificacion: recibidaARespoder.terceroIdentificacion ?? undefined,
        destinatarioNombre: recibidaARespoder.terceroNombre ?? undefined,
        destinatarioEmail: recibidaARespoder.terceroEmail ?? undefined,
        destinatarioTelefono: recibidaARespoder.terceroTelefono ?? undefined,
        destinatarioDireccion: recibidaARespoder.terceroDireccion ?? undefined,
        destinatarioMunicipio: recibidaARespoder.terceroMunicipio ?? undefined,
      }
    : undefined;

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
          subseries: s.subseries.map((ss) => ({ id: ss.id, codigo: ss.codigo, nombre: ss.nombre })),
        }))}
        municipios={municipios}
        inicial={inicial}
        documentosRespuesta={documentosRespuesta.map((d) => d.nombre)}
        plantillas={plantillas}
        usuarioNombre={session.nombre}
      />
    </div>
  );
}
