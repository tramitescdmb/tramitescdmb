import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, FileCheck2 } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { db } from "@/lib/db";
import { puedeActuarSolicitud } from "@/lib/solicitudes-firma";
import { FirmarSolicitudInline } from "@/components/FirmarSolicitudInline";
import { TituloSeccion } from "@/components/sgdea/ui";

export default async function FirmarSolicitudTramitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const solicitud = await db.solicitudFirma.findUnique({
    where: { id },
    select: {
      id: true,
      rol: true,
      orden: true,
      estado: true,
      usuarioAsignadoId: true,
      documentoExpedienteId: true,
      documentoExpediente: {
        select: { id: true, nombre: true, mimeType: true, expedienteId: true, expediente: { select: { numero: true } } },
      },
    },
  });
  if (!solicitud || !solicitud.documentoExpediente) notFound();
  if (solicitud.usuarioAsignadoId !== session.userId) redirect("/firmas/buzon");
  if (solicitud.rol === "LECTURA") redirect(`/expedientes/${solicitud.documentoExpediente.expedienteId}`);

  const doc = solicitud.documentoExpediente;
  const hermanas = await db.solicitudFirma.findMany({
    where: { documentoExpedienteId: solicitud.documentoExpedienteId! },
    select: { rol: true, orden: true, estado: true },
  });
  const puedeActuarYo = solicitud.estado === "PENDIENTE" && puedeActuarSolicitud(hermanas, solicitud);

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <Link href="/firmas/buzon" className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-700">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Volver al buzón
      </Link>

      <TituloSeccion icon={FileCheck2}>{solicitud.rol === "FIRMA" ? "Firmar documento" : "Dar visto bueno"}</TituloSeccion>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-medium text-stone-800">{doc.nombre}</p>
        <Link href={`/expedientes/${doc.expedienteId}`} className="text-xs font-medium text-cdmb-700 hover:underline">
          Expediente {doc.expediente.numero}
        </Link>
      </div>

      {solicitud.estado !== "PENDIENTE" ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50/60 p-6 text-center text-sm text-stone-400">
          Esta solicitud ya fue resuelta.
        </p>
      ) : !puedeActuarYo ? (
        <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-6 text-center text-sm text-amber-700">
          Debe(n) resolver primero quien(es) tiene(n) un turno anterior.
        </p>
      ) : (
        <FirmarSolicitudInline
          rol={solicitud.rol === "FIRMA" ? "FIRMA" : "VISTO_BUENO"}
          endpointCompletar={`/api/solicitudes-firma/${solicitud.id}/completar`}
          endpointRechazar={`/api/solicitudes-firma/${solicitud.id}/rechazar`}
          documentoUrl={`/api/documentos/${doc.id}`}
          documentoNombre={doc.nombre}
          documentoMimeType={doc.mimeType}
          volverHref="/firmas/buzon"
        />
      )}
    </section>
  );
}
