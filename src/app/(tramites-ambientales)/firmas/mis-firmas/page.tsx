import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSignature, Eye, FileText } from "lucide-react";
import { verificarSesion as getSession } from "@/lib/permisos";
import { db } from "@/lib/db";
import { TituloSeccion, EstadoVacio } from "@/components/sgdea/ui";
import { FirmasSubNav } from "@/components/FirmasSubNav";
import { formatearFechaHoraLarga } from "@/lib/fecha";

export default async function MisFirmasTramitesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const firmas = await db.firmaExpedienteDocumento.findMany({
    where: { usuarioId: session.userId },
    orderBy: { fechaHora: "desc" },
    select: {
      id: true,
      fechaHora: true,
      hashContenido: true,
      documento: {
        select: {
          id: true,
          nombre: true,
          mimeType: true,
          expedienteId: true,
          expediente: { select: { numero: true, tramiteTipo: { select: { nombre: true } } } },
        },
      },
    },
  });

  return (
    <section className="space-y-4">
      <TituloSeccion icon={FileSignature}>Mis firmas</TituloSeccion>
      <FirmasSubNav />

      {firmas.length === 0 ? (
        <EstadoVacio icon={FileSignature}>Todavía no ha firmado ningún documento en Trámites ambientales.</EstadoVacio>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white shadow-sm">
          {firmas.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-800">{f.documento.nombre}</p>
                <p className="truncate text-xs text-stone-400">
                  Expediente {f.documento.expediente.numero} · {f.documento.expediente.tramiteTipo.nombre}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-stone-400">
                  {formatearFechaHoraLarga(f.fechaHora)} · SHA-256 {f.hashContenido.slice(0, 16)}…
                </p>
              </div>
              <a
                href={`/api/documentos/${f.documento.id}${f.documento.mimeType === "application/pdf" ? "/rotulado" : ""}`}
                target="_blank"
                rel="noreferrer"
                title={f.documento.mimeType === "application/pdf" ? "Abre el PDF con su sello de firma electrónica y QR" : "Abre el archivo firmado"}
                className="inline-flex flex-none items-center gap-1 rounded-md bg-cdmb-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cdmb-700"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                Ver documento
              </a>
              <Link
                href={`/expedientes/${f.documento.expedienteId}/ficha-firma?documento=${f.documento.id}`}
                className="inline-flex flex-none items-center gap-1 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                Ver ficha técnica
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
